import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { verifyMilestoneWithAI, generateHeuristicAudit } from "@/server/gemini";
import { MilestoneSubmission, AIAssessment, DeliverableAttachment, DeliverableLink } from "@/lib/dashboard-data";
import { assertFreelancer, requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import { newId } from "@/server/ids";

export const maxDuration = 60;

/** Upper bound for all uploaded file data (base64 text) in a single submission. */
const MAX_ATTACHMENT_CHARS = 12_000_000;
const MAX_ATTACHMENTS = 20;
const MAX_LINKS = 20;

function optionalHttpUrl(value: unknown, label: string): string {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw new DomainError(400, `${label} must be a link.`);
  const trimmed = value.trim().slice(0, 2000);
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new DomainError(400, `${label} must be a valid link starting with http:// or https://.`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DomainError(400, `${label} must be a valid link starting with http:// or https://.`);
  }
  return trimmed;
}

function sanitizeLinks(raw: unknown): DeliverableLink[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_LINKS) throw new DomainError(400, `You can attach at most ${MAX_LINKS} links.`);
  const allowedTypes = ["photo", "design", "document", "cloud", "demo", "repo", "other"];
  return raw
    .filter((l: any) => l && typeof l === "object")
    .map((l: any) => ({
      title: typeof l.title === "string" ? l.title.trim().slice(0, 200) : "",
      url: optionalHttpUrl(l.url, "Deliverable link"),
      type: allowedTypes.includes(l.type) ? l.type : undefined,
    }))
    .filter((l) => l.url || l.title);
}

function sanitizeAttachments(raw: unknown): DeliverableAttachment[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length > MAX_ATTACHMENTS) throw new DomainError(400, `You can upload at most ${MAX_ATTACHMENTS} files.`);

  let totalChars = 0;
  const out: DeliverableAttachment[] = raw
    .filter((a: any) => a && typeof a === "object")
    .map((a: any) => {
      const dataUrl = typeof a.dataUrl === "string" ? a.dataUrl : undefined;
      if (dataUrl && !dataUrl.startsWith("data:")) {
        throw new DomainError(400, "Uploaded files must be sent as data URLs.");
      }
      const url = typeof a.url === "string" && a.url.startsWith("data:") ? a.url : undefined;
      totalChars += (dataUrl?.length || 0) + (url && url !== dataUrl ? url.length : 0);
      return {
        name: typeof a.name === "string" ? a.name.slice(0, 200) : "file",
        size: typeof a.size === "string" ? a.size.slice(0, 40) : "",
        type: typeof a.type === "string" ? a.type.slice(0, 120) : "application/octet-stream",
        dataUrl,
        url,
        uploadedAt: typeof a.uploadedAt === "string" ? a.uploadedAt.slice(0, 40) : undefined,
      };
    });

  if (totalChars > MAX_ATTACHMENT_CHARS) {
    throw new DomainError(413, "The uploaded files are too large. Keep the total under about 8 MB.", "TOO_LARGE");
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const caller = await requireCaller(req);
    const { id: milestoneId } = await params;
    const body = await readJson(req);

    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) throw new DomainError(400, "projectId is required");

    const project = await db.getProjectById(projectId);
    if (!project) throw new DomainError(404, "Project not found", "NOT_FOUND");
    assertFreelancer(project, caller, "Unauthorized. Only the designated freelancer can submit deliverables for this milestone.");

    const milestone = project.milestones.find((m) => m.id === milestoneId);
    if (!milestone) throw new DomainError(404, "Milestone not found", "NOT_FOUND");

    // Fail fast (before spending an AI call) when the workflow does not allow a submission.
    if (project.status === "awaiting_acceptance" || project.status === "draft" || project.status === "changes_requested") {
      throw new DomainError(403, "Work submissions are locked until the project proposal is accepted and active.");
    }
    if (project.status === "rejected" || project.status === "archived" || project.status === "completed") {
      throw new DomainError(409, `This project is ${project.status} and can no longer receive submissions.`);
    }
    if (milestone.status === "paid" || milestone.status === "approved") {
      throw new DomainError(409, "This milestone has already been approved and can no longer receive submissions.");
    }

    const repo = optionalHttpUrl(body.githubRepo || body.repoUrl, "Repository link");
    const demoUrl = optionalHttpUrl(body.demoUrl, "Demo link");
    const loomVideo = optionalHttpUrl(body.loomVideo, "Video link");
    const deliverableLinks = sanitizeLinks(body.deliverableLinks);
    const attachments = sanitizeAttachments(body.attachments);
    const notes =
      (typeof body.notes === "string" && body.notes.trim().slice(0, 5000)) ||
      "Submitted deliverable package for milestone review.";

    const submission: MilestoneSubmission = {
      id: newId("sub"),
      version: (milestone.submissions?.length || 0) + 1,
      submittedAt: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      }),
      submittedBy: project.freelancer.name,
      githubRepo: repo,
      demoUrl,
      loomVideo,
      notes,
      deliverableLinks,
      attachments,
    };

    const auditInput = {
      milestoneTitle: milestone.title,
      milestoneDescription: milestone.description,
      acceptanceCriteria: milestone.acceptanceCriteria || [],
      submission: {
        githubRepo: repo,
        demoUrl,
        loomVideo,
        notes: submission.notes,
        deliverableLinks: submission.deliverableLinks,
        attachments: submission.attachments,
      },
    };

    // Run AI Acceptance Verification in real-time (with immediate resilient fallback)
    let audit: AIAssessment;
    try {
      audit = await verifyMilestoneWithAI(auditInput);
    } catch (err) {
      console.warn("AI verification failed, using heuristic audit:", err);
      audit = generateHeuristicAudit(auditInput);
    }

    submission.aiAssessment = audit;

    const result = await db.submitMilestoneWork(projectId, milestoneId, submission, audit);
    if (!result) throw new DomainError(404, "Project not found", "NOT_FOUND");

    return NextResponse.json({
      success: true,
      message: "Work submitted and verified by PerMile AI Engine.",
      submission,
      audit,
      milestone: result.milestone,
      project: result.project,
    });
  } catch (err) {
    return errorResponse(err, "Failed to submit milestone work");
  }
}
