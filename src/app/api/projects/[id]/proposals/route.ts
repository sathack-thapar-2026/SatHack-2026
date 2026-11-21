import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  assertParticipant,
  callerIsProposer,
  callerIsRecipient,
  requireCaller,
} from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import { resolveCounterpartyIdentity } from "@/server/identity";
import { newId } from "@/server/ids";
import { normalizeCurrency, PROJECT_CURRENCIES, roundMoney } from "@/lib/dashboard-data";
import type { ActivityItem, Milestone, ProjectContract } from "@/lib/dashboard-data";

function cleanText(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function cleanId(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Za-z0-9_\-:.]{1,120}$/.test(value) ? value : fallback;
}

/** Rebuilds a milestone list from untrusted input: status is always reset and nothing can be pre-paid. */
function sanitizeMilestones(raw: unknown, projectId: string, fallbackCurrency: string): Milestone[] {
  if (!Array.isArray(raw)) throw new DomainError(400, "A revised proposal needs a milestone list.");
  if (raw.length > 50) throw new DomainError(400, "A project can have at most 50 milestones.");

  return raw.map((m: any, idx: number) => {
    const amount = Number(m?.amount ?? 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new DomainError(400, "Milestone amounts must be valid, non-negative numbers.");
    }
    const criteria: any[] = Array.isArray(m?.acceptanceCriteria) ? m.acceptanceCriteria.slice(0, 25) : [];
    return {
      id: cleanId(m?.id, `m_${projectId}_${idx + 1}`),
      stageNumber: idx + 1,
      title: cleanText(m?.title, 200) || `Milestone ${idx + 1}`,
      description: cleanText(m?.description, 2000),
      amount: roundMoney(amount),
      currency: fallbackCurrency, // always the project's currency
      dueDate: cleanText(m?.dueDate, 100, "TBD") || "TBD",
      status: "not_started" as const,
      acceptanceCriteria: criteria.map((c: any, cIdx: number) => ({
        id: cleanId(c?.id, `crit_${projectId}_${idx + 1}_${cIdx + 1}`),
        title:
          typeof c === "string"
            ? cleanText(c, 300) || `Requirement ${cIdx + 1}`
            : cleanText(c?.title || c?.text, 300) || `Requirement ${cIdx + 1}`,
        description: typeof c === "string" ? cleanText(c, 1000) : cleanText(c?.description || c?.text, 1000),
        status: "pending" as const,
      })),
      submissions: [],
    };
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id } = await params;
    const body = await readJson(req);
    const action: unknown = body.action;
    const feedback = cleanText(body.feedback, 2000);

    const project = await db.getProjectById(id);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertParticipant(project, caller);

    // Roles are derived ONLY from the verified identity and the stored contract.
    const isProposer = callerIsProposer(project, caller);
    const isRecipient = callerIsRecipient(project, caller);

    if (action === "accept" || action === "request_changes" || action === "reject") {
      if (!isRecipient) {
        throw new DomainError(
          403,
          isProposer
            ? "You cannot accept, decline or request changes on your own proposal. Only the recipient can."
            : "Unauthorized. Only the designated recipient can accept or review this project proposal.",
          "FORBIDDEN"
        );
      }
    }

    if (action === "accept") {
      if (project.status === "active" && project.proposalStatus === "accepted") {
        return NextResponse.json({
          success: true,
          message: "Project proposal has already been accepted and is active in My Projects.",
          project,
        });
      }
      if (project.status === "rejected" || project.proposalStatus === "rejected") {
        throw new DomainError(400, "Cannot accept a rejected proposal. A revised proposal must be resubmitted first.");
      }
      if (project.status !== "awaiting_acceptance" && project.status !== "changes_requested") {
        throw new DomainError(409, `This proposal cannot be accepted while it is ${project.status}.`, "BAD_STATE");
      }

      const updated = await db.updateProjectStatus(id, "active");
      return NextResponse.json({
        success: true,
        message: "Proposal accepted. Mutually agreed contract is now active in My Projects.",
        project: updated,
      });
    }

    if (action === "request_changes") {
      if (!feedback) {
        throw new DomainError(400, "Feedback is required when requesting changes");
      }
      if (project.status !== "awaiting_acceptance") {
        throw new DomainError(409, "Changes can only be requested on a proposal that is awaiting acceptance.", "BAD_STATE");
      }
      const updated = await db.updateProjectStatus(id, "changes_requested", feedback);
      return NextResponse.json({
        success: true,
        message: "Change request submitted to proposer.",
        project: updated,
      });
    }

    if (action === "reject") {
      if (project.status !== "awaiting_acceptance" && project.status !== "changes_requested") {
        throw new DomainError(409, "Only a pending proposal can be declined. Active contracts cannot be declined.", "BAD_STATE");
      }
      const updated = await db.updateProjectStatus(id, "rejected", feedback);
      return NextResponse.json({
        success: true,
        message: "Proposal declined and removed from workspace.",
        project: updated,
      });
    }

    if (action === "withdraw") {
      if (!isProposer) {
        throw new DomainError(403, "Only the original proposer can withdraw this proposal.", "FORBIDDEN");
      }
      const hasPayments =
        (project.totalPaid || 0) > 0 || project.milestones.some((m) => m.status === "paid" || m.transactionId);
      if (project.status === "active" || project.status === "completed" || hasPayments) {
        throw new DomainError(409, "An accepted contract with payment history cannot be withdrawn.", "BAD_STATE");
      }
      const removed = await db.deleteProject(id);
      if (!removed) throw new Error("Failed to remove the proposal.");
      return NextResponse.json({
        success: true,
        message: "Proposal withdrawn and removed from workspace.",
        removedProjectId: id,
      });
    }

    if (action === "resubmit") {
      if (!isProposer) {
        throw new DomainError(403, "Only the original proposer can revise and resubmit this proposal.", "FORBIDDEN");
      }
      if (project.status !== "draft" && project.status !== "changes_requested" && project.status !== "awaiting_acceptance") {
        throw new DomainError(409, "Only a pending proposal can be revised.", "BAD_STATE");
      }

      const data = body.updatedData && typeof body.updatedData === "object" ? body.updatedData : {};
      const currency = normalizeCurrency(typeof data.currency === "string" && data.currency.trim() ? data.currency : project.currency);
      if (!PROJECT_CURRENCIES.includes(currency)) {
        throw new DomainError(400, `Unsupported currency "${currency}". Use one of: ${PROJECT_CURRENCIES.join(", ")}.`);
      }

      const updates: Partial<ProjectContract> = {
        status: "awaiting_acceptance",
        proposalStatus: "awaiting_acceptance",
        proposalFeedback: undefined,
        currency,
      };
      const title = cleanText(data.title, 200);
      if (title) updates.title = title;
      if (typeof data.description === "string") updates.description = cleanText(data.description, 5000);
      const category = cleanText(data.category, 100);
      if (category) updates.category = category;
      const targetDeadline = cleanText(data.targetDeadline, 100);
      if (targetDeadline) updates.targetDeadline = targetDeadline;

      if (Array.isArray(data.milestones)) {
        const milestones = sanitizeMilestones(data.milestones, project.id, currency);
        updates.milestones = milestones;
        updates.totalBudget = roundMoney(milestones.reduce((s, m) => s + m.amount, 0));
      }

      // The recipient may be changed while revising, but only to another registered account.
      const recipientKey = project.initiatedBy === "client" ? "freelancer" : "client";
      const incoming = data[recipientKey];
      const existingRecipient = project[recipientKey];
      const identifier = incoming?.milestoneOSId || incoming?.id || incoming?.email;
      if (!project.isPublicInvitation && identifier) {
        const sameAsExisting = [existingRecipient?.milestoneOSId, existingRecipient?.id, existingRecipient?.email]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase() === String(identifier).toLowerCase());
        if (!sameAsExisting) {
          const resolved = await resolveCounterpartyIdentity({
            identifier: String(identifier),
            expectedRole: recipientKey,
            proposerId: caller.id,
            proposerEmail: caller.email,
          });
          if (!resolved.success) throw new DomainError(400, resolved.error, resolved.code);
          if (recipientKey === "freelancer") {
            updates.freelancer = {
              id: resolved.user.id,
              name: resolved.user.name,
              email: resolved.user.email,
              avatar: resolved.user.avatar || "FL",
              title: resolved.user.title || "Independent Specialist",
              milestoneOSId: resolved.user.freelancerId,
              rating: resolved.user.rating || 5.0,
            };
            updates.freelancerId = resolved.user.id;
          } else {
            updates.client = {
              id: resolved.user.id,
              name: resolved.user.name,
              email: resolved.user.email,
              avatar: resolved.user.avatar || "CL",
              company: resolved.user.company || "Client Organization",
              milestoneOSId: resolved.user.clientId,
            };
            updates.clientId = resolved.user.id;
          }
        }
      }

      const entry: ActivityItem = {
        id: newId("act"),
        timestamp: "Just now",
        actor: caller.name,
        actorRole: project.initiatedBy,
        action: `${caller.name} revised and resubmitted the project proposal for acceptance.`,
      };
      updates.activityLog = [entry, ...(project.activityLog || [])];

      const updated = await db.updateProject(id, updates);
      return NextResponse.json({
        success: true,
        message: "Proposal revised and resubmitted for mutual agreement.",
        project: updated,
      });
    }

    throw new DomainError(400, "Invalid action. Supported: accept, request_changes, reject, withdraw, resubmit");
  } catch (err) {
    return errorResponse(err, "Failed to process proposal action");
  }
}
