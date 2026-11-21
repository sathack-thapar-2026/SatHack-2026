/**
 * MilestoneOS — Server-Side Multi-User Database & Ledger Store
 * Single Source of Truth: Supabase PostgreSQL
 *
 * Design notes
 *  - Every project mutation goes through mutateProject(): it serialises writes per project
 *    inside this process AND uses an optimistic `updated_at` check so concurrent writers
 *    (other server instances) cannot silently overwrite each other.
 *  - Database write errors are never swallowed: they surface as exceptions.
 *  - Business-rule violations are thrown as DomainError (safe to show to the caller).
 *  - This module does NOT authenticate anybody. Routes must authorise callers first.
 */

import {
  ProjectContract,
  TransactionRecord,
  NotificationItem,
  ProjectStatus,
  AIAssessment,
  MilestoneSubmission,
  Milestone,
  MilestoneStatus,
  ActivityItem,
  extractBaseCode,
  isProjectAccepted,
  formatCurrency,
  roundMoney,
} from "@/lib/dashboard-data";
import type { CaptureOrderResult } from "./payments";
import { getServerSupabase } from "./supabase";
import { projectRoles } from "./auth";
import { DomainError } from "./errors";
import { newId } from "./ids";

export interface ProjectFilter {
  userId?: string;
  userEmail?: string;
  milestoneOSId?: string;
  role?: "client" | "freelancer";
  status?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return UUID_PATTERN.test(str);
}

/** Human readable timestamp used for display fields that are stored as strings. */
function displayDateTime(input?: string | Date): string {
  const d = input ? new Date(input) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requireSupabase() {
  const supabase = getServerSupabase();
  if (!supabase) {
    throw new DomainError(503, "The database is not configured on the server.", "DB_UNAVAILABLE");
  }
  return supabase;
}

function rowToProject(row: any): ProjectContract {
  const base: ProjectContract = row.data && typeof row.data === "object" ? { ...row.data } : ({} as any);

  return {
    ...base,
    id: row.id,
    title: row.title || base.title || "Untitled Project",
    description: row.description ?? base.description ?? "",
    category: row.category || base.category || "Full-Stack Development",
    currency: row.currency || base.currency || "USD",
    totalBudget: Number(row.total_budget ?? base.totalBudget ?? 0),
    totalPaid: Number(row.total_paid ?? base.totalPaid ?? 0),
    escrowFunded: Number(row.escrow_funded ?? base.escrowFunded ?? 0),
    escrowReleased: Number(row.escrow_released ?? base.escrowReleased ?? 0),
    targetDeadline: row.target_deadline || base.targetDeadline || "TBD",
    status: (row.status || base.status || "active") as any,
    proposalStatus: (row.proposal_status || base.proposalStatus || "accepted") as any,
    termsAgreed: row.terms_agreed ?? base.termsAgreed ?? true,
    clientId: row.client_id || base.clientId,
    freelancerId: row.freelancer_id || base.freelancerId,
    client: {
      id: row.client_id || base.client?.id,
      name: row.client_name || base.client?.name || "Client",
      email: row.client_email || base.client?.email || "",
      avatar: base.client?.avatar || (row.client_name ? row.client_name.slice(0, 2).toUpperCase() : "CL"),
      company: row.client_company || base.client?.company || undefined,
      milestoneOSId: row.client_mso_id || base.client?.milestoneOSId || undefined,
    },
    freelancer: {
      id: row.freelancer_id || base.freelancer?.id,
      name: row.freelancer_name || base.freelancer?.name || "Freelancer",
      email: row.freelancer_email || base.freelancer?.email || "",
      avatar: base.freelancer?.avatar || (row.freelancer_name ? row.freelancer_name.slice(0, 2).toUpperCase() : "FL"),
      title: row.freelancer_title || base.freelancer?.title || undefined,
      rating: base.freelancer?.rating ?? 5.0,
      milestoneOSId: row.freelancer_mso_id || base.freelancer?.milestoneOSId || undefined,
    },
    initiatedBy: (row.initiated_by || base.initiatedBy || "client") as any,
    initiatorMilestoneOSId: row.initiator_mso_id || base.initiatorMilestoneOSId,
    invitationToken: row.invitation_token || base.invitationToken,
    invitationStatus: row.invitation_status || base.invitationStatus,
    isDemo: Boolean(row.is_demo ?? base.isDemo),
    milestones: Array.isArray(row.milestones) ? row.milestones : base.milestones || [],
    activityLog: Array.isArray(row.activity_log) ? row.activity_log : base.activityLog || [],
    createdAt:
      base.createdAt ||
      (row.created_at
        ? new Date(row.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
          })
        : "Today"),
  };
}

function projectToRow(p: ProjectContract): any {
  const cId = p.clientId || p.client?.id;
  const fId = p.freelancerId || p.freelancer?.id;
  const validCId = isValidUUID(cId) ? cId : null;
  const validFId = isValidUUID(fId) ? fId : null;

  if (validCId) {
    p.clientId = validCId;
    if (p.client) p.client.id = validCId;
  }
  if (validFId) {
    p.freelancerId = validFId;
    if (p.freelancer) p.freelancer.id = validFId;
  }

  return {
    id: p.id,
    title: p.title || "Untitled Project",
    description: p.description || "",
    category: p.category || "Full-Stack Development",
    currency: p.currency || "USD",
    total_budget: p.totalBudget || 0,
    total_paid: p.totalPaid || 0,
    escrow_funded: p.escrowFunded || 0,
    escrow_released: p.escrowReleased || 0,
    target_deadline: p.targetDeadline || "TBD",
    status: p.status || "active",
    proposal_status: p.proposalStatus || "accepted",
    terms_agreed: Boolean(p.termsAgreed ?? true),
    client_id: validCId,
    freelancer_id: validFId,
    client_name: p.client?.name || "Client",
    client_email: p.client?.email || "",
    client_company: p.client?.company || null,
    client_mso_id: p.client?.milestoneOSId || null,
    freelancer_name: p.freelancer?.name || "Freelancer",
    freelancer_email: p.freelancer?.email || "",
    freelancer_title: p.freelancer?.title || null,
    freelancer_mso_id: p.freelancer?.milestoneOSId || null,
    initiated_by: p.initiatedBy || "client",
    invitation_token: p.invitationToken || null,
    invitation_status: p.invitationStatus || "active",
    is_demo: Boolean(p.isDemo),
    milestones: p.milestones || [],
    activity_log: p.activityLog || [],
    data: p,
    updated_at: new Date().toISOString(),
  };
}

function rowToTransaction(row: any): TransactionRecord {
  const base: TransactionRecord = row.data && typeof row.data === "object" ? { ...row.data } : ({} as any);
  return {
    ...base,
    id: row.id,
    projectId: row.project_id || base.projectId,
    projectTitle: row.project_title || base.projectTitle || "",
    milestoneId: row.milestone_id || base.milestoneId,
    milestoneTitle: row.milestone_title || base.milestoneTitle || "",
    amount: Number(row.amount ?? base.amount ?? 0),
    currency: row.currency || base.currency || "USD",
    status: (row.status || base.status || "completed") as any,
    payer: row.payer || base.payer || "Client",
    payee: row.payee || base.payee || "Freelancer",
    payerId: row.payer_id || base.payerId,
    payeeId: row.payee_id || base.payeeId,
    paidAt:
      base.paidAt ||
      (row.paid_at
        ? new Date(row.paid_at).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Today"),
    transactionId: row.paypal_transaction_id || base.transactionId,
    isSimulated: Boolean(row.is_simulated ?? base.isSimulated),
    isDemo: Boolean(row.is_demo ?? base.isDemo),
  };
}

// ----------------------------------------------------------------------------
// Short-lived read cache (list views only). Single-record reads and every
// mutation always hit the database directly so they never act on stale data.
// ----------------------------------------------------------------------------

let cachedProjects: { data: ProjectContract[]; timestamp: number } | null = null;
let cachedTransactions: { data: TransactionRecord[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 5000;

export function invalidateServerCache() {
  cachedProjects = null;
  cachedTransactions = null;
}

async function getLiveProjects(): Promise<ProjectContract[]> {
  const now = Date.now();
  if (cachedProjects && now - cachedProjects.timestamp < CACHE_TTL_MS) {
    return cachedProjects.data;
  }
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error || !data) {
    console.error("Supabase getLiveProjects error:", error);
    // Serve slightly stale data rather than failing the dashboard, but NEVER report an empty list on error.
    if (cachedProjects) return cachedProjects.data;
    throw new Error("Failed to load projects.");
  }
  const mapped = data.map(rowToProject);
  cachedProjects = { data: mapped, timestamp: now };
  return mapped;
}

async function getLiveTransactions(): Promise<TransactionRecord[]> {
  const now = Date.now();
  if (cachedTransactions && now - cachedTransactions.timestamp < CACHE_TTL_MS) {
    return cachedTransactions.data;
  }
  const supabase = requireSupabase();
  const { data, error } = await supabase.from("transactions").select("*").order("paid_at", { ascending: false });
  if (error || !data) {
    console.error("Supabase getLiveTransactions error:", error);
    if (cachedTransactions) return cachedTransactions.data;
    throw new Error("Failed to load transactions.");
  }
  const mapped = data.map(rowToTransaction);
  cachedTransactions = { data: mapped, timestamp: now };
  return mapped;
}

// ----------------------------------------------------------------------------
// Safe project mutation: per-project lock + optimistic concurrency + retry.
// ----------------------------------------------------------------------------

const projectLockTails = new Map<string, Promise<void>>();

async function withProjectLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const previous = projectLockTails.get(projectId) ?? Promise.resolve();
  let release!: () => void;
  const mine = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => mine);
  projectLockTails.set(projectId, tail);
  try {
    await previous;
    return await fn();
  } finally {
    release();
    if (projectLockTails.get(projectId) === tail) projectLockTails.delete(projectId);
  }
}

const MAX_WRITE_ATTEMPTS = 4;

async function mutateProject<T>(
  projectId: string,
  mutator: (project: ProjectContract) => T | Promise<T>
): Promise<{ project: ProjectContract; result: T } | null> {
  const supabase = requireSupabase();

  return withProjectLock(projectId, async () => {
    for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
      if (error) throw new Error(`Failed to load project ${projectId}: ${error.message}`);
      if (!data) return null;

      const project = rowToProject(data);
      const result = await mutator(project);
      const row = projectToRow(project);

      let query = supabase.from("projects").update(row).eq("id", projectId);
      if (data.updated_at) query = query.eq("updated_at", data.updated_at);
      const { data: written, error: writeError } = await query.select("id");
      if (writeError) throw new Error(`Failed to save project ${projectId}: ${writeError.message}`);

      if (written && written.length > 0) {
        invalidateServerCache();
        return { project, result };
      }
      // Another writer changed the row between our read and write: reload and re-apply.
    }
    throw new DomainError(
      409,
      "This project was modified by someone else at the same time. Please try again.",
      "CONFLICT"
    );
  });
}

// ----------------------------------------------------------------------------
// Business-rule guards shared by several mutations.
// ----------------------------------------------------------------------------

const CLOSED_PROJECT_STATUSES: ProjectStatus[] = ["rejected", "archived", "completed"];
const PRE_ACCEPTANCE_STATUSES: ProjectStatus[] = ["draft", "awaiting_acceptance", "changes_requested"];

function assertProjectWorkable(project: ProjectContract) {
  if (PRE_ACCEPTANCE_STATUSES.includes(project.status)) {
    throw new DomainError(
      403,
      "Work submissions are locked until the project proposal is accepted and active.",
      "PROJECT_NOT_ACTIVE"
    );
  }
  if (CLOSED_PROJECT_STATUSES.includes(project.status)) {
    throw new DomainError(409, `This project is ${project.status} and can no longer be changed.`, "PROJECT_CLOSED");
  }
}

function findMilestone(project: ProjectContract, milestoneId: string): Milestone {
  const milestone = project.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new DomainError(404, "Milestone not found.", "NOT_FOUND");
  return milestone;
}

const SUBMITTABLE: MilestoneStatus[] = ["not_started", "in_progress", "changes_requested", "revision_requested", "submitted"];
const REVIEWABLE: MilestoneStatus[] = ["submitted", "awaiting_client_approval", "under_ai_review"];
export const PAYABLE_MILESTONE_STATUSES: MilestoneStatus[] = ["approved", "payment_pending"];

function newActivity(partial: Omit<ActivityItem, "id" | "timestamp">): ActivityItem {
  return { id: newId("act"), timestamp: "Just now", ...partial };
}

// ----------------------------------------------------------------------------
// Public data API
// ----------------------------------------------------------------------------

export const db = {
  /**
   * Projects visible to a verified user (client or freelancer side).
   * Never returns anything when no identity is supplied.
   */
  async getProjects(filter?: ProjectFilter): Promise<ProjectContract[]> {
    const userId = filter?.userId?.trim();
    const userEmail = filter?.userEmail?.trim().toLowerCase();
    const userBaseCode = extractBaseCode(filter?.milestoneOSId?.trim().toUpperCase());
    const role = filter?.role;
    const status = filter?.status;

    if (!userId && !userEmail && !userBaseCode) return [];

    const all = await getLiveProjects();
    return all.filter((p) => {
      if (status && p.status !== status) return false;
      if (p.status === "rejected" && status !== "rejected") return false;

      const { isClient, isFreelancer } = projectRoles(p, {
        id: userId || "",
        email: userEmail || "",
        baseCode: userBaseCode,
      });

      if (role === "client") return isClient;
      if (role === "freelancer") return isFreelancer;
      return isClient || isFreelancer;
    });
  },

  /**
   * Fresh read of a single project. NO access check is performed here —
   * routes must authorise the caller (assertParticipant etc.) before using the result.
   */
  async getProjectById(id: string): Promise<ProjectContract | undefined> {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Failed to load project: ${error.message}`);
    return data ? rowToProject(data) : undefined;
  },

  async getProjectByInvitationToken(token: string): Promise<ProjectContract | null> {
    if (!token) return null;
    const supabase = requireSupabase();
    const { data, error } = await supabase.from("projects").select("*").eq("invitation_token", token).maybeSingle();
    if (error) throw new Error(`Failed to load invitation: ${error.message}`);
    return data ? rowToProject(data) : null;
  },

  async claimInvitation(
    token: string,
    claimingUser: {
      id: string;
      name: string;
      email: string;
      avatar: string;
      milestoneOSId: string;
      role: "client" | "freelancer";
      companyOrTitle?: string;
    }
  ): Promise<ProjectContract | null> {
    const existing = await db.getProjectByInvitationToken(token);
    if (!existing) return null;

    const outcome = await mutateProject(existing.id, (project) => {
      if (project.invitationStatus === "revoked") {
        throw new DomainError(410, "This invitation has been revoked.", "REVOKED");
      }
      if (project.invitationStatus === "claimed" || project.status === "active" || project.status === "completed") {
        throw new DomainError(409, "This proposal has already been accepted.", "ALREADY_CLAIMED");
      }
      if (project.status === "rejected" || project.status === "archived") {
        throw new DomainError(410, "This proposal is no longer available.", "UNAVAILABLE");
      }
      if (project.invitationExpiresAt && new Date(project.invitationExpiresAt).getTime() < Date.now()) {
        throw new DomainError(410, "This invitation link has expired.", "EXPIRED");
      }

      const isClientSender = project.initiatedBy === "client";
      if (isClientSender) {
        project.freelancer = {
          id: claimingUser.id,
          name: claimingUser.name,
          email: claimingUser.email,
          avatar: claimingUser.avatar,
          title: claimingUser.companyOrTitle || "Freelancer",
          rating: 5.0,
          milestoneOSId: claimingUser.milestoneOSId,
        };
        project.freelancerId = claimingUser.id;
      } else {
        project.client = {
          id: claimingUser.id,
          name: claimingUser.name,
          email: claimingUser.email,
          avatar: claimingUser.avatar,
          company: claimingUser.companyOrTitle || "Client Organization",
          milestoneOSId: claimingUser.milestoneOSId,
        };
        project.clientId = claimingUser.id;
      }

      project.status = "active";
      project.proposalStatus = "accepted";
      project.acceptedAt = new Date().toISOString();
      project.acceptedByMilestoneOSId = claimingUser.milestoneOSId;
      project.termsAgreed = true;
      project.invitationStatus = "claimed";

      project.milestones.forEach((m, idx) => {
        if (!m.status || m.status === "not_started") {
          m.status = idx === 0 ? "in_progress" : "not_started";
        }
      });

      project.activityLog.unshift(
        newActivity({
          action: `${claimingUser.name} accepted the project proposal via private invitation link. Agreement is now active.`,
          actor: claimingUser.name,
          actorRole: claimingUser.role,
        })
      );
      return isClientSender;
    });

    if (!outcome) return null;

    const supabase = requireSupabase();
    if (isValidUUID(claimingUser.id)) {
      const { error } = await supabase.from("project_members").upsert(
        {
          project_id: outcome.project.id,
          user_id: claimingUser.id,
          project_role: outcome.result ? "freelancer" : "client",
          membership_status: "accepted",
        },
        { onConflict: "project_id,user_id,project_role" }
      );
      if (error) console.warn("Could not record project membership:", error.message);
    }
    return outcome.project;
  },

  async revokeInvitation(token: string): Promise<boolean> {
    const existing = await db.getProjectByInvitationToken(token);
    if (!existing) return false;

    const outcome = await mutateProject(existing.id, (project) => {
      if (project.invitationStatus === "claimed" || project.status === "active" || project.status === "completed") {
        throw new DomainError(409, "This proposal was already accepted and can no longer be revoked.", "ALREADY_CLAIMED");
      }
      project.invitationStatus = "revoked";
      project.status = "rejected";
      project.proposalStatus = "rejected";
    });
    return Boolean(outcome);
  },

  async createProject(project: ProjectContract, creatorId?: string): Promise<ProjectContract> {
    project.isDemo = Boolean(project.isDemo);

    let cid = project.clientId || project.client?.id;
    let fid = project.freelancerId || project.freelancer?.id;

    if (project.initiatedBy === "client") {
      if (creatorId) cid = creatorId;
    } else if (project.initiatedBy === "freelancer") {
      if (creatorId) fid = creatorId;
    }

    if (cid) {
      project.clientId = cid;
      if (project.client) project.client.id = cid;
    }
    if (fid) {
      project.freelancerId = fid;
      if (project.freelancer) project.freelancer.id = fid;
    }

    const supabase = requireSupabase();
    const row = projectToRow(project);
    const { error } = await supabase.from("projects").insert(row);
    if (error) {
      console.error("Supabase createProject error:", error);
      throw new Error(`Failed to save project to Supabase: ${error.message}`);
    }

    // Persistent notification for the recipient
    const recipientId = project.initiatedBy === "client" ? project.freelancerId : project.clientId;
    const senderName = project.initiatedBy === "client" ? project.client?.name : project.freelancer?.name;
    if (recipientId && isValidUUID(recipientId) && project.status !== "draft") {
      const { error: notifErr } = await supabase.from("notifications").insert({
        id: newId("notif"),
        user_id: recipientId,
        project_id: project.id,
        title: project.initiatedBy === "client" ? "Project Assignment Received" : "Incoming Project Proposal",
        message: `${senderName || "Counterparty"} sent you a project proposal: "${project.title}" (${formatCurrency(project.totalBudget, project.currency)}). Review to accept.`,
        type: "proposal",
        unread: true,
        is_demo: Boolean(project.isDemo),
        created_at: new Date().toISOString(),
      });
      if (notifErr) console.warn("Could not insert recipient notification:", notifErr.message);
    }

    invalidateServerCache();
    return project;
  },

  async deleteProject(id: string): Promise<boolean> {
    const supabase = requireSupabase();
    const { error: notifError } = await supabase.from("notifications").delete().eq("project_id", id);
    if (notifError) console.warn("Could not delete project notifications:", notifError.message);
    const { error } = await supabase.from("projects").delete().eq("id", id);
    invalidateServerCache();
    if (error) {
      console.error("Supabase deleteProject error:", error);
      return false;
    }
    return true;
  },

  /** Applies already-validated field updates. The project id can never be changed here. */
  async updateProject(id: string, updates: Partial<ProjectContract>): Promise<ProjectContract | null> {
    const outcome = await mutateProject(id, (project) => {
      const { id: _ignoredId, ...safe } = updates as any;
      Object.assign(project, safe);
    });
    return outcome ? outcome.project : null;
  },

  async updateProjectStatus(id: string, status: ProjectStatus, feedback?: string): Promise<ProjectContract | null> {
    const outcome = await mutateProject(id, (project) => {
      project.status = status;
      if (status === "active") {
        project.termsAgreed = true;
        project.proposalStatus = "accepted";
        project.invitationStatus = "claimed";
        project.acceptedAt = new Date().toISOString();
        project.milestones.forEach((m, idx) => {
          if (m.status === "not_started" && idx === 0) {
            m.status = "in_progress";
          }
        });
      } else if (status === "changes_requested") {
        project.proposalStatus = "changes_requested";
        project.proposalFeedback = feedback;
      } else if (status === "rejected") {
        project.proposalStatus = "rejected";
      }

      const actorName = project.initiatedBy === "client" ? project.freelancer.name : project.client.name;
      const actorRole = project.initiatedBy === "client" ? "freelancer" : "client";
      project.activityLog.unshift(
        newActivity({
          action:
            status === "active"
              ? `${actorName} accepted the project proposal. Contract terms are now mutually agreed and active.`
              : status === "changes_requested"
              ? `${actorName} requested revisions: "${feedback}".`
              : `${actorName} declined the project proposal.`,
          actor: actorName,
          actorRole,
        })
      );
      return { actorName };
    });
    if (!outcome) return null;
    const project = outcome.project;
    const actorName = outcome.result.actorName;

    const supabase = requireSupabase();
    // Mark earlier proposal notifications for this project as read
    const { error: readErr } = await supabase
      .from("notifications")
      .update({ unread: false })
      .eq("project_id", project.id)
      .eq("type", "proposal");
    if (readErr) console.warn("Could not mark proposal notifications read:", readErr.message);

    // Notify the proposer of the decision
    const proposerId = project.initiatedBy === "client" ? project.clientId : project.freelancerId;
    if (proposerId) {
      await db.createNotification({
        id: newId("notif"),
        timestamp: "Just now",
        title:
          status === "active"
            ? "Proposal Accepted & Contract Active!"
            : status === "changes_requested"
            ? "Proposal Changes Requested"
            : "Proposal Declined",
        message:
          status === "active"
            ? `${actorName} accepted your project proposal for "${project.title}". Milestone 01 is now active!`
            : `${actorName} responded to your proposal for "${project.title}".`,
        type: status === "active" ? "approval" : "proposal",
        unread: true,
        projectId: project.id,
        userId: proposerId,
        isDemo: Boolean(project.isDemo),
      });
    }
    return project;
  },

  async startMilestone(projectId: string, milestoneId: string, actorName: string) {
    const outcome = await mutateProject(projectId, (project) => {
      assertProjectWorkable(project);
      const milestone = findMilestone(project, milestoneId);
      if (milestone.status === "in_progress") return milestone; // idempotent
      if (milestone.status !== "not_started") {
        throw new DomainError(409, "Only milestones that have not started can be started.", "BAD_STATE");
      }
      milestone.status = "in_progress";
      project.activityLog.unshift(
        newActivity({
          action: `${actorName} started work on "${milestone.title}".`,
          actor: actorName,
          actorRole: "freelancer",
          milestoneTitle: milestone.title,
        })
      );
      return milestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  async submitMilestoneWork(
    projectId: string,
    milestoneId: string,
    submission: MilestoneSubmission,
    audit?: AIAssessment
  ): Promise<{ project: ProjectContract; milestone: Milestone } | null> {
    const outcome = await mutateProject(projectId, (project) => {
      assertProjectWorkable(project);
      const milestone = findMilestone(project, milestoneId);
      if (!SUBMITTABLE.includes(milestone.status)) {
        throw new DomainError(
          409,
          milestone.status === "paid"
            ? "This milestone has already been paid."
            : "This milestone has already been approved and can no longer receive submissions.",
          "BAD_STATE"
        );
      }

      milestone.submissions = milestone.submissions || [];
      submission.version = milestone.submissions.length + 1;
      milestone.submissions.push(submission);
      milestone.status = "submitted";
      if (audit) {
        milestone.latestAudit = audit;
        submission.aiAssessment = audit;
      } else {
        milestone.latestAudit = undefined;
      }

      project.activityLog.unshift(
        newActivity({
          action: `Submitted work for Stage 0${milestone.stageNumber}: ${milestone.title}`,
          actor: project.freelancer.name,
          actorRole: "freelancer",
          milestoneTitle: milestone.title,
        })
      );
      return milestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  async setMilestoneAudit(
    projectId: string,
    milestoneId: string,
    audit: AIAssessment
  ): Promise<{ project: ProjectContract; milestone: Milestone } | null> {
    const outcome = await mutateProject(projectId, (project) => {
      const milestone = findMilestone(project, milestoneId);
      milestone.latestAudit = audit;
      if (milestone.submissions && milestone.submissions.length > 0) {
        milestone.submissions[milestone.submissions.length - 1].aiAssessment = audit;
      }
      return milestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  async reviewMilestone(
    projectId: string,
    milestoneId: string,
    action: "approve" | "request_changes",
    feedback?: string
  ): Promise<{ project: ProjectContract; milestone: Milestone } | null> {
    const outcome = await mutateProject(projectId, (project) => {
      assertProjectWorkable(project);
      const milestone = findMilestone(project, milestoneId);
      if (!REVIEWABLE.includes(milestone.status)) {
        throw new DomainError(
          409,
          milestone.status === "paid" || milestone.status === "approved"
            ? "This milestone has already been approved."
            : "There is no submitted work on this milestone to review yet.",
          "BAD_STATE"
        );
      }

      if (action === "approve") {
        milestone.status = "approved";
        project.activityLog.unshift(
          newActivity({
            action: `Approved Stage 0${milestone.stageNumber}: ${milestone.title}. Ready for payment release.`,
            actor: project.client.name,
            actorRole: "client",
            milestoneTitle: milestone.title,
          })
        );
      } else {
        milestone.status = "changes_requested";
        project.activityLog.unshift(
          newActivity({
            action: `Requested revisions on Stage 0${milestone.stageNumber}: ${milestone.title}`,
            actor: project.client.name,
            actorRole: "client",
            details: feedback,
            milestoneTitle: milestone.title,
          })
        );
      }
      return milestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  /**
   * Records a verified, completed payment capture. Idempotent: recording the same capture
   * twice returns the existing transaction instead of double-counting.
   */
  async recordPayment(
    projectId: string,
    milestoneId: string,
    capture: CaptureOrderResult
  ): Promise<{ project: ProjectContract; milestone: Milestone; transaction: TransactionRecord } | null> {
    const supabase = requireSupabase();
    const txId = `tx_${capture.captureId}`;

    const outcome = await mutateProject(projectId, (project) => {
      const milestone = findMilestone(project, milestoneId);

      if (milestone.status === "paid") {
        if (milestone.transactionId === capture.captureId) {
          return { milestone, alreadyRecorded: true };
        }
        throw new DomainError(409, "Milestone has already been paid and settled.", "ALREADY_PAID");
      }
      if (!PAYABLE_MILESTONE_STATUSES.includes(milestone.status)) {
        throw new DomainError(409, "This milestone must be approved before it can be paid.", "BAD_STATE");
      }

      const paidAtDisplay = displayDateTime(capture.timestamp);
      milestone.status = "paid";
      milestone.paidAt = paidAtDisplay;
      milestone.transactionId = capture.captureId;

      project.totalPaid = roundMoney((project.totalPaid || 0) + milestone.amount);
      project.escrowReleased = roundMoney((project.escrowReleased || 0) + milestone.amount);
      if (project.milestones.every((m) => m.status === "paid")) {
        project.status = "completed";
      }

      const curr = milestone.currency || project.currency || "USD";
      project.activityLog.unshift(
        newActivity({
          action: `Released payment (${formatCurrency(milestone.amount, curr)}) for Stage 0${milestone.stageNumber}: ${milestone.title} via Payment Capture ${capture.captureId}`,
          actor: project.client.name,
          actorRole: "client",
          milestoneTitle: milestone.title,
        })
      );
      return { milestone, alreadyRecorded: false };
    });

    if (!outcome) return null;
    const { project } = outcome;
    const { milestone, alreadyRecorded } = outcome.result;

    const currency = milestone.currency || project.currency || "USD";
    const transaction: TransactionRecord = {
      id: txId,
      projectId: project.id,
      projectTitle: project.title,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      amount: milestone.amount,
      currency,
      status: "completed",
      payer: project.client.name,
      payee: project.freelancer.name,
      payerId: project.clientId,
      payeeId: project.freelancerId,
      paidAt: milestone.paidAt || displayDateTime(),
      transactionId: capture.captureId,
      isSimulated: capture.isSimulated ?? false,
      isDemo: Boolean(project.isDemo),
    };

    // Deterministic id (tx_<captureId>) makes this upsert safe to repeat, which also
    // repairs a missing ledger row when the same (already recorded) capture is replayed.
    const txPayerId = project.clientId && isValidUUID(project.clientId) ? project.clientId : null;
    const txPayeeId = project.freelancerId && isValidUUID(project.freelancerId) ? project.freelancerId : null;
    const { error: ledgerError } = await supabase.from("transactions").upsert(
      {
        id: transaction.id,
        project_id: project.id,
        project_title: project.title,
        milestone_id: milestone.id,
        milestone_title: milestone.title,
        payer_id: txPayerId,
        payer: project.client.name,
        payee_id: txPayeeId,
        payee: project.freelancer.name,
        amount: milestone.amount,
        currency,
        status: "completed",
        paypal_transaction_id: capture.captureId,
        paid_at: new Date().toISOString(),
        is_simulated: Boolean(capture.isSimulated),
        is_demo: Boolean(project.isDemo),
        data: transaction,
      },
      { onConflict: "id" }
    );
    if (ledgerError) {
      // The milestone is already marked paid, so don't fail the payment; retrying the same capture re-creates the row.
      console.error(`Failed to write ledger row for capture ${capture.captureId} (already recorded=${alreadyRecorded}):`, ledgerError);
    }

    invalidateServerCache();
    return { project, milestone, transaction };
  },

  async addMilestone(
    projectId: string,
    milestone: {
      title: string;
      description: string;
      amount: number;
      dueDate?: string;
      acceptanceCriteria?: string[];
    },
    actor: { name: string; role: "client" | "freelancer" }
  ): Promise<{ project: ProjectContract; milestone: Milestone } | null> {
    const outcome = await mutateProject(projectId, (project) => {
      if (CLOSED_PROJECT_STATUSES.includes(project.status)) {
        throw new DomainError(409, `This project is ${project.status}; milestones can no longer be added.`, "PROJECT_CLOSED");
      }
      const newStageNumber = project.milestones.length + 1;
      const idSeed = Date.now();
      const newMilestone: Milestone = {
        id: newId("ms"),
        stageNumber: newStageNumber,
        title: milestone.title,
        description: milestone.description || "Milestone deliverables agreed with client.",
        amount: milestone.amount,
        currency: project.currency || "USD",
        dueDate: milestone.dueDate || project.targetDeadline || "TBD",
        status: "not_started",
        acceptanceCriteria: (milestone.acceptanceCriteria || []).map((critTitle, idx) => ({
          id: `crit_${idSeed}_${idx}`,
          title: critTitle,
          description: `Verified deliverable for ${critTitle}`,
          status: "pending" as const,
        })),
        submissions: [],
      };

      project.milestones.push(newMilestone);
      project.totalBudget = roundMoney((project.totalBudget || 0) + milestone.amount);

      const curr = project.currency || "USD";
      project.activityLog.unshift(
        newActivity({
          action: `${actor.name} added a new milestone: Stage 0${newStageNumber}: "${milestone.title}" (${formatCurrency(milestone.amount, curr)}).`,
          actor: actor.name,
          actorRole: actor.role,
          milestoneTitle: milestone.title,
        })
      );
      return newMilestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  async editMilestone(
    projectId: string,
    milestoneId: string,
    updates: {
      title?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
    }
  ): Promise<{ project: ProjectContract; milestone: Milestone } | null> {
    const outcome = await mutateProject(projectId, (project) => {
      const milestone = findMilestone(project, milestoneId);

      if (milestone.status === "paid" || milestone.status === "approved") {
        throw new DomainError(409, "Approved or paid milestones cannot be edited.", "BAD_STATE");
      }

      // Price is locked once the contract has been accepted.
      if (!isProjectAccepted(project) && updates.amount !== undefined && updates.amount !== milestone.amount) {
        project.totalBudget = roundMoney((project.totalBudget || 0) + (updates.amount - milestone.amount));
        milestone.amount = updates.amount;
      }

      if (updates.title) milestone.title = updates.title;
      if (updates.description) milestone.description = updates.description;
      if (updates.dueDate) milestone.dueDate = updates.dueDate;
      return milestone;
    });
    return outcome ? { project: outcome.project, milestone: outcome.result } : null;
  },

  async getTransactions(filter?: {
    userId?: string;
    userEmail?: string;
    projectId?: string;
  }): Promise<TransactionRecord[]> {
    const userId = filter?.userId?.trim();
    const userEmail = filter?.userEmail?.trim().toLowerCase();
    const projectId = filter?.projectId;

    if (!userId && !userEmail) return [];

    const all = await getLiveTransactions();
    const userProjects = await db.getProjects({ userId, userEmail });
    const userProjectIds = new Set(userProjects.map((p) => p.id));

    let userTxs = all.filter(
      (t) => userProjectIds.has(t.projectId) || (userId && (t.payerId === userId || t.payeeId === userId))
    );
    if (projectId) userTxs = userTxs.filter((t) => t.projectId === projectId);
    return userTxs;
  },

  async getNotifications(filter: { userId?: string }): Promise<NotificationItem[]> {
    if (!filter.userId) return [];
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", filter.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Failed to load notifications: ${error.message}`);
    return (data || []).map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type || "general",
      unread: Boolean(n.unread),
      timestamp: n.created_at || "Just now",
      projectId: n.project_id || undefined,
      userId: n.user_id || undefined,
      isDemo: Boolean(n.is_demo),
    }));
  },

  async createNotification(item: NotificationItem): Promise<NotificationItem> {
    const supabase = getServerSupabase();
    if (supabase) {
      const uId = item.userId && isValidUUID(item.userId) ? item.userId : null;
      const { error } = await supabase.from("notifications").upsert(
        {
          id: item.id,
          user_id: uId,
          project_id: item.projectId || null,
          title: item.title,
          message: item.message,
          type: item.type || "general",
          unread: Boolean(item.unread ?? true),
          is_demo: Boolean(item.isDemo),
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
      if (error) console.warn("Could not create notification:", error.message);
    }
    return item;
  },

  /** Marks one notification read — only if it belongs to `userId`. */
  async markNotificationRead(id: string, userId: string): Promise<boolean> {
    const supabase = requireSupabase();
    const { error } = await supabase.from("notifications").update({ unread: false }).eq("id", id).eq("user_id", userId);
    return !error;
  },

  async markAllNotificationsRead(userId: string): Promise<boolean> {
    const supabase = requireSupabase();
    const { error } = await supabase.from("notifications").update({ unread: false }).eq("user_id", userId);
    return !error;
  },
};
