import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import {
  ProjectContract,
  ActivityItem,
  formatClientId,
  formatFreelancerId,
  normalizeCurrency,
  PROJECT_CURRENCIES,
  roundMoney,
} from "@/lib/dashboard-data";
import { resolveCounterpartyIdentity } from "@/server/identity";
import { requireCaller } from "@/server/auth";
import { DomainError, errorResponse, readJson } from "@/server/errors";
import { INVITATION_TOKEN_PATTERN, newId, newInvitationToken } from "@/server/ids";

const MAX_MILESTONES = 50;
const MAX_CRITERIA = 25;

function cleanText(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function parseAmount(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) {
    throw new DomainError(400, "Milestone amounts must be valid, non-negative numbers.");
  }
  return Math.round(n * 100) / 100;
}

export async function GET(req: NextRequest) {
  try {
    // Identity comes ONLY from the verified session token — never from query parameters.
    const caller = await requireCaller(req);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const roleParam = searchParams.get("role");
    const role = roleParam === "client" || roleParam === "freelancer" ? roleParam : undefined;

    const { projects, version } = await db.getProjectsWithVersion({
      userId: caller.id,
      userEmail: caller.email,
      milestoneOSId: caller.milestoneOSId,
      role,
      status,
    });

    // ?versionOnly=1 is what the dashboard polls: a few bytes that change whenever any of the caller's
    // projects changes, so the (large) project list is only downloaded when there is something new.
    if (searchParams.get("versionOnly") === "1") {
      return NextResponse.json({ success: true, version, count: projects.length });
    }

    return NextResponse.json({
      success: true,
      count: projects.length,
      version,
      projects,
    });
  } catch (err) {
    return errorResponse(err, "Failed to fetch projects");
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireCaller(req);
    const body = await readJson(req);

    const title = cleanText(body.title, 200);
    if (!title) throw new DomainError(400, "A project title is required.");
    if (!body.client || typeof body.client !== "object" || !body.freelancer || typeof body.freelancer !== "object") {
      throw new DomainError(400, "Title, client, and freelancer are required");
    }

    const description = cleanText(body.description, 5000);
    const category = cleanText(body.category, 100, "Full-Stack Development") || "Full-Stack Development";
    const targetDeadline = cleanText(body.targetDeadline, 100, "TBD") || "TBD";
    const initiatedBy: "client" | "freelancer" = body.initiatedBy === "freelancer" ? "freelancer" : "client";
    const asDraft = body.asDraft === true;
    const isPublicInvitation = body.isPublicInvitation === true;

    // One currency per project: every milestone is priced in it, so totals and payments can never mix currencies.
    const currency = normalizeCurrency(typeof body.currency === "string" && body.currency.trim() ? body.currency : "USD");
    if (!PROJECT_CURRENCIES.includes(currency)) {
      throw new DomainError(400, `Unsupported currency "${currency}". Use one of: ${PROJECT_CURRENCIES.join(", ")}.`);
    }

    const rawMilestones: any[] = Array.isArray(body.milestones) ? body.milestones : [];
    if (rawMilestones.length > MAX_MILESTONES) {
      throw new DomainError(400, `A project can have at most ${MAX_MILESTONES} milestones.`);
    }

    const projectId = newId("proj");
    const milestones = rawMilestones.map((m: any, idx: number) => {
      const criteria: any[] = Array.isArray(m?.acceptanceCriteria) ? m.acceptanceCriteria.slice(0, MAX_CRITERIA) : [];
      return {
        id: `m_${projectId}_${idx + 1}`,
        stageNumber: idx + 1,
        title: cleanText(m?.title, 200) || `Milestone ${idx + 1}`,
        description: cleanText(m?.description, 2000),
        amount: parseAmount(m?.amount ?? 0),
        currency,
        dueDate: cleanText(m?.dueDate, 100, "TBD") || "TBD",
        status: "not_started" as const,
        acceptanceCriteria: criteria.map((c: any, cIdx: number) => ({
          id: `crit_${projectId}_${idx + 1}_${cIdx + 1}`,
          title:
            typeof c === "string"
              ? cleanText(c, 300) || `Requirement ${cIdx + 1}`
              : cleanText(c?.title || c?.text, 300) || `Requirement ${cIdx + 1}`,
          description:
            typeof c === "string" ? cleanText(c, 1000) : cleanText(c?.description || c?.text, 1000),
          status: "pending" as const,
        })),
        submissions: [],
      };
    });
    const totalBudget = roundMoney(milestones.reduce((sum, m) => sum + m.amount, 0));

    // --- The proposer is ALWAYS the verified caller; their details come from their profile. ---
    const callerClientId = formatClientId(caller.baseCode);
    const callerFreelancerId = formatFreelancerId(caller.baseCode);

    let clientData: ProjectContract["client"];
    let freelancerData: ProjectContract["freelancer"];

    const proposerClient: ProjectContract["client"] = {
      id: caller.id,
      name: caller.name,
      email: caller.email,
      avatar: caller.avatar,
      company: caller.company || cleanText(body.client?.company, 120, "Client Organization") || "Client Organization",
      milestoneOSId: callerClientId,
    };
    const proposerFreelancer: ProjectContract["freelancer"] = {
      id: caller.id,
      name: caller.name,
      email: caller.email,
      avatar: caller.avatar,
      title: caller.title || cleanText(body.freelancer?.title, 120, "Independent Specialist") || "Independent Specialist",
      rating: 5.0,
      milestoneOSId: callerFreelancerId,
    };

    // The counterparty is resolved against registered accounts (or left as a placeholder for link invites).
    if (initiatedBy === "client") {
      clientData = proposerClient;
      if (isPublicInvitation) {
        freelancerData = {
          id: undefined,
          name: cleanText(body.freelancer?.name, 100, "Unassigned Recipient") || "Unassigned Recipient",
          email: cleanText(body.freelancer?.email, 200, "pending-invitation@milestoneos.link"),
          avatar: cleanText(body.freelancer?.avatar, 4, "??") || "??",
          title: cleanText(body.freelancer?.title, 120, "Invited Freelancer") || "Invited Freelancer",
          rating: 5.0,
          milestoneOSId: "",
        };
      } else {
        const identifier =
          body.freelancer?.milestoneOSId || body.freelancer?.id || body.freelancerId || body.freelancer?.email;
        if (!identifier) {
          throw new DomainError(400, "Freelancer identifier is required when creating a client request.");
        }
        const result = await resolveCounterpartyIdentity({
          identifier: String(identifier),
          expectedRole: "freelancer",
          proposerId: caller.id,
          proposerEmail: caller.email,
        });
        if (!result.success) {
          return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
        }
        freelancerData = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          avatar: result.user.avatar || "FL",
          title: result.user.title || "Independent Specialist",
          milestoneOSId: result.user.freelancerId,
          rating: result.user.rating || 5.0,
        };
      }
    } else {
      freelancerData = proposerFreelancer;
      if (isPublicInvitation) {
        clientData = {
          id: undefined,
          name: cleanText(body.client?.name, 100, "Unassigned Recipient") || "Unassigned Recipient",
          email: cleanText(body.client?.email, 200, "pending-invitation@milestoneos.link"),
          avatar: cleanText(body.client?.avatar, 4, "??") || "??",
          company: cleanText(body.client?.company, 120, "Invited Client Organization") || "Invited Client Organization",
          milestoneOSId: "",
        };
      } else {
        const identifier = body.client?.milestoneOSId || body.client?.id || body.clientId || body.client?.email;
        if (!identifier) {
          throw new DomainError(400, "Client identifier is required when proposing a project.");
        }
        const result = await resolveCounterpartyIdentity({
          identifier: String(identifier),
          expectedRole: "client",
          proposerId: caller.id,
          proposerEmail: caller.email,
        });
        if (!result.success) {
          return NextResponse.json({ error: result.error, code: result.code }, { status: 400 });
        }
        clientData = {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          avatar: result.user.avatar || "CL",
          company: result.user.company || "Client Organization",
          milestoneOSId: result.user.clientId,
        };
      }
    }

    if (!isPublicInvitation && clientData.id && freelancerData.id && clientData.id === freelancerData.id) {
      throw new DomainError(400, "Client and Freelancer must be different registered users. Self-assignment is not permitted.");
    }

    const proposerName = initiatedBy === "client" ? clientData.name : freelancerData.name;
    const activity: ActivityItem = {
      id: newId("act"),
      action: asDraft
        ? `Drafted project "${title}"`
        : isPublicInvitation
        ? `${proposerName} created shareable proposal link for "${title}"`
        : `${proposerName} submitted project proposal for mutual agreement`,
      actor: proposerName,
      actorRole: initiatedBy,
      timestamp: "Just now",
    };

    // Invitation link: the client may supply the token it already put in the share link, if well-formed.
    const suppliedToken = typeof body.invitationToken === "string" ? body.invitationToken : "";
    const invitationToken =
      isPublicInvitation && INVITATION_TOKEN_PATTERN.test(suppliedToken) ? suppliedToken : newInvitationToken();

    let invitationExpiresAt: string | undefined;
    if (isPublicInvitation) {
      const supplied = typeof body.invitationExpiresAt === "string" ? new Date(body.invitationExpiresAt).getTime() : NaN;
      const now = Date.now();
      const within30Days = Number.isFinite(supplied) && supplied > now && supplied <= now + 30 * 24 * 60 * 60 * 1000;
      invitationExpiresAt = new Date(within30Days ? supplied : now + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const newProject: ProjectContract = {
      id: projectId,
      title,
      description,
      category,
      client: clientData,
      freelancer: freelancerData,
      clientId: clientData.id,
      freelancerId: freelancerData.id,
      totalBudget,
      totalPaid: 0,
      escrowFunded: 0,
      escrowReleased: 0,
      currency,
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      targetDeadline,
      status: asDraft ? "draft" : "awaiting_acceptance",
      initiatedBy,
      initiatorMilestoneOSId: initiatedBy === "client" ? callerClientId : callerFreelancerId,
      termsAgreed: false,
      proposalStatus: asDraft ? "draft" : "awaiting_acceptance",
      isPublicInvitation,
      invitationToken,
      invitationStatus: "active",
      invitationExpiresAt,
      invitationCreatedByRole: isPublicInvitation ? initiatedBy : undefined,
      isDemo: false,
      milestones,
      activityLog: [activity],
    };

    const saved = await db.createProject(newProject, caller.id);

    return NextResponse.json({
      success: true,
      project: saved,
    });
  } catch (err) {
    return errorResponse(err, "Failed to create project");
  }
}
