export type MilestoneStatus =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "approved"
  | "paid"
  // Legacy aliases for backward compatibility
  | "under_ai_review"
  | "awaiting_client_approval"
  | "revision_requested"
  | "payment_pending";

export type CriterionStatus =
  | "met"
  | "missing"
  | "needs_manual_review"
  // Legacy aliases
  | "satisfied"
  | "needs_verification"
  | "pending";

export interface AcceptanceCriterion {
  id: string;
  title: string;
  description: string;
  status: CriterionStatus;
  evidence?: string;
  aiNotes?: string;
}

export interface AutomatedCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface AIAssessment {
  overallScore: number;
  summary: string;
  status: "approved" | "changes_requested" | "needs_verification";
  verifiedAt: string;
  isDemonstration: boolean;
  criteria: AcceptanceCriterion[];
  automatedChecks?: AutomatedCheck[];
  suggestedRevisions?: string[];
  // Deliverable Evaluation Additions
  qualityScore?: number;
  qualityNotes?: string;
  missingDeliverables?: string[];
  inconsistencies?: string[];
  verifiedFindings?: string[];
  unverifiedAssumptions?: string[];
  submissionFingerprint?: string;
  isCached?: boolean;
  isQuotaExceeded?: boolean;
}

export interface DeliverableAttachment {
  name: string;
  size: string;
  type: string;
  url?: string;
  dataUrl?: string;
  uploadedAt?: string;
}

export interface DeliverableLink {
  title: string;
  url: string;
  type?: "photo" | "design" | "document" | "cloud" | "demo" | "repo" | "other";
}

export interface MilestoneSubmission {
  id: string;
  version: number;
  submittedAt: string;
  submittedBy: string;
  demoUrl?: string;
  githubRepo?: string;
  githubPr?: string;
  loomVideo?: string;
  notes: string;
  deliverableLinks?: DeliverableLink[];
  attachments?: DeliverableAttachment[];
  aiAssessment?: AIAssessment;
  revisionRequest?: {
    requestedAt: string;
    reason: string;
    requestedBy: string;
  };
}

export interface Milestone {
  id: string;
  stageNumber: number;
  title: string;
  description: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: MilestoneStatus;
  paidAt?: string;
  transactionId?: string;
  acceptanceCriteria: AcceptanceCriterion[];
  submissions: MilestoneSubmission[];
  latestAudit?: AIAssessment;
}

export interface ActivityItem {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: "client" | "freelancer" | "ai_system" | "payment";
  action: string;
  details?: string;
  milestoneTitle?: string;
}

export interface TransactionRecord {
  id: string;
  milestoneId: string;
  milestoneTitle: string;
  projectId: string;
  projectTitle: string;
  amount: number;
  currency: string;
  paidAt: string;
  transactionId: string;
  status: "completed" | "pending";
  isSimulated: boolean;
  payer: string;
  payee: string;
  isDemo?: boolean;
  payerId?: string;
  payeeId?: string;
}

export interface NotificationItem {
  id: string;
  timestamp: string;
  title: string;
  message: string;
  type: "submission" | "revision" | "approval" | "payment" | "proposal" | "system";
  unread: boolean;
  projectId?: string;
  milestoneId?: string;
  isDemo?: boolean;
  userId?: string;
}

export type ProjectStatus =
  | "draft"
  | "awaiting_acceptance"
  | "changes_requested"
  | "accepted"
  | "rejected"
  | "active"
  | "completed"
  | "archived";

export interface ProjectContract {
  id: string;
  title: string;
  description: string;
  category: string;
  clientId?: string;
  freelancerId?: string;
  isDemo?: boolean;
  client: {
    id?: string;
    milestoneOSId?: string;
    name: string;
    email: string;
    avatar: string;
    company: string;
  };
  freelancer: {
    id?: string;
    milestoneOSId?: string;
    name: string;
    email: string;
    avatar: string;
    title: string;
    rating: number;
  };
  totalBudget: number;
  totalPaid: number;
  // Aliases for compatibility
  escrowFunded: number;
  escrowReleased: number;
  currency: string;
  createdAt: string;
  targetDeadline: string;
  status: ProjectStatus;
  milestones: Milestone[];
  activityLog: ActivityItem[];
  // Shared proposal and initiation fields
  initiatedBy: "client" | "freelancer";
  initiatorMilestoneOSId?: string;
  proposalStatus?: "draft" | "awaiting_acceptance" | "changes_requested" | "accepted" | "rejected";
  proposalFeedback?: string;
  acceptedAt?: string;
  acceptedByMilestoneOSId?: string;
  termsAgreed?: boolean;

  // Method B: Shareable Invitation Link
  invitationToken?: string;
  invitationStatus?: "active" | "revoked" | "claimed" | "expired";
  invitationExpiresAt?: string;
  isPublicInvitation?: boolean;
  invitationCreatedByRole?: "client" | "freelancer";
}

export function isProjectCompleted(project: ProjectContract | null | undefined): boolean {
  if (!project) return false;
  if (project.status === "completed") return true;
  if (!project.milestones || project.milestones.length === 0) return false;
  return project.milestones.every((m) => m.status === "paid");
}

/** Currencies the checkout can settle in. Anything else (e.g. INR) must be changed before payment. */
export const SUPPORTED_CHECKOUT_CURRENCIES: string[] = ["USD", "EUR", "GBP", "CAD", "AUD"];

/** Currencies a project can be written in: everything checkout can settle, plus INR (display only; see warning in the UI). */
export const PROJECT_CURRENCIES: string[] = [...SUPPORTED_CHECKOUT_CURRENCIES, "INR"];

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
  CAD: "CA$",
  AUD: "A$",
};

/** Normalises user/legacy spellings ("₹", "rupees", " usd ") to an ISO-style code. */
export function normalizeCurrency(currency?: string | null): string {
  const c = (currency || "").toUpperCase().trim();
  if (!c) return "USD";
  if (c === "₹" || c === "RUPEE" || c === "RUPEES") return "INR";
  if (c === "$") return "USD";
  return c;
}

/** Symbol for a currency ("$", "₹", "€"...). Unknown codes fall back to "CODE " so nothing is mislabelled as dollars. */
export function getCurrencySymbol(currency?: string): string {
  const code = normalizeCurrency(currency);
  return CURRENCY_SYMBOLS[code] ?? `${code} `;
}

/** Rounds to cents so repeated additions never produce 0.30000000000000004. */
export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/** 1250 -> "$1,250 USD", 1250.5 -> "$1,250.50 USD", INR uses Indian digit grouping. */
export function formatCurrency(
  amount: number | undefined | null,
  currency: string = "USD",
  options?: { showCode?: boolean }
): string {
  const code = normalizeCurrency(currency);
  const safeAmount = roundMoney(Number(amount) || 0);
  const formattedNum = safeAmount.toLocaleString(code === "INR" ? "en-IN" : "en-US", {
    minimumFractionDigits: Number.isInteger(safeAmount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const suffix = options?.showCode !== false ? ` ${code}` : "";
  return `${getCurrencySymbol(code)}${formattedNum}${suffix}`;
}

/** Adds amounts per currency. Different currencies are never added together. */
export function sumByCurrency(
  items: Array<{ amount: number; currency?: string }>,
  fallbackCurrency = "USD"
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const item of items) {
    const code = normalizeCurrency(item.currency || fallbackCurrency);
    totals[code] = roundMoney((totals[code] || 0) + (Number(item.amount) || 0));
  }
  return totals;
}

/** {USD: 300, INR: 5000} -> "$300 USD + ₹5,000 INR" (empty -> "$0 USD"). */
export function formatCurrencyTotals(totals: Record<string, number>, fallbackCurrency = "USD"): string {
  const entries = Object.entries(totals);
  if (entries.length === 0) return formatCurrency(0, fallbackCurrency);
  return entries.map(([code, amount]) => formatCurrency(amount, code)).join(" + ");
}

export function isProjectAccepted(project: ProjectContract | null | undefined): boolean {
  if (!project) return false;
  if (
    project.status === "draft" ||
    project.status === "awaiting_acceptance" ||
    project.status === "changes_requested" ||
    project.status === "rejected"
  ) {
    return false;
  }
  if (project.proposalStatus && project.proposalStatus !== "accepted") {
    return false;
  }
  return (
    project.status === "active" ||
    project.status === "accepted" ||
    project.status === "completed" ||
    project.termsAgreed === true
  );
}

export function getFriendlyStatus(status: MilestoneStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "paid":
      return {
        label: "Payment Completed",
        badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      };
    case "approved":
    case "payment_pending":
      return {
        label: "Approved",
        badgeClass: "bg-blue-50 text-[#0070BA] dark:bg-blue-950/40 dark:text-sky-300 border border-blue-200 dark:border-blue-800",
      };
    case "submitted":
    case "under_ai_review":
    case "awaiting_client_approval":
      return {
        label: "Submitted for Review",
        badgeClass: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
      };
    case "changes_requested":
    case "revision_requested":
      return {
        label: "Changes Requested",
        badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      };
    case "in_progress":
      return {
        label: "In Progress",
        badgeClass: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 border border-slate-200 dark:border-white/10",
      };
    case "not_started":
    default:
      return {
        label: "Not Started",
        badgeClass: "bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400 border border-slate-200/60 dark:border-white/5",
      };
  }
}

export function getFriendlyCriterionStatus(status: CriterionStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case "met":
    case "satisfied":
      return {
        label: "Met",
        badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "missing":
      return {
        label: "Missing",
        badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
      };
    case "needs_manual_review":
    case "needs_verification":
    default:
      return {
        label: "Needs Manual Review",
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
      };
  }
}

export function getFriendlyProjectStatus(
  status: ProjectStatus,
  initiatedBy?: "client" | "freelancer",
  currentRole?: "client" | "freelancer"
): {
  label: string;
  badgeClass: string;
  isActionNeededForMe?: boolean;
} {
  switch (status) {
    case "completed":
      return {
        label: "Completed & Settled",
        badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
      };
    case "active":
    case "accepted":
      return {
        label: "Active Contract",
        badgeClass: "bg-blue-50 text-[#0070BA] dark:bg-blue-950/40 dark:text-sky-300 border border-blue-200 dark:border-blue-800",
      };
    case "awaiting_acceptance": {
      const isRecipient = currentRole && initiatedBy && currentRole !== initiatedBy;
      if (isRecipient) {
        return {
          label: "Incoming Proposal (Action Required)",
          badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700 font-bold",
          isActionNeededForMe: true,
        };
      }
      return {
        label: "Proposal Sent (Awaiting Acceptance)",
        badgeClass: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800",
      };
    }
    case "changes_requested": {
      const isSender = currentRole && initiatedBy && currentRole === initiatedBy;
      if (isSender) {
        return {
          label: "Changes Requested (Revise & Resubmit)",
          badgeClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-bold",
          isActionNeededForMe: true,
        };
      }
      return {
        label: "Changes Requested (Awaiting Revision)",
        badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
      };
    }
    case "rejected":
      return {
        label: "Proposal Declined",
        badgeClass: "bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400 border border-slate-200 dark:border-white/10",
      };
    case "draft":
      return {
        label: "Draft Proposal",
        badgeClass: "bg-slate-50 text-slate-600 dark:bg-white/5 dark:text-slate-400 border border-dashed border-slate-300 dark:border-white/10",
      };
    case "archived":
      return {
        label: "Archived",
        badgeClass: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400",
      };
    default:
      return {
        label: "Active",
        badgeClass: "bg-blue-50 text-[#0070BA] dark:bg-blue-950/40 dark:text-sky-300",
      };
  }
}

export function generateBaseCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function extractBaseCode(idOrCode?: string | null): string {
  if (!idOrCode) return "";
  const clean = idOrCode.trim().toUpperCase();
  const match = clean.match(/^(?:CL|FL|MSO)-([A-Z0-9]{6})$/i);
  if (match) return match[1];
  if (/^[A-Z0-9]{6}$/.test(clean)) return clean;
  return clean.replace(/^(?:CL|FL|MSO)-/i, "").slice(0, 6);
}

export function formatClientId(baseCode?: string | null): string {
  const code = extractBaseCode(baseCode) || "USER01";
  return `CL-${code}`;
}

export function formatFreelancerId(baseCode?: string | null): string {
  const code = extractBaseCode(baseCode) || "USER01";
  return `FL-${code}`;
}

export function generateMilestoneOSId(): string {
  return formatClientId(generateBaseCode());
}

export function generateInvitationToken(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(16);
  // Cryptographically secure randomness (browser and Node 19+ both provide globalThis.crypto).
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return `inv_${result}`;
}

export interface MilestoneOSUser {
  id: string;
  baseCode?: string;
  clientId?: string;
  freelancerId?: string;
  milestoneOSId: string;
  name: string;
  email: string;
  avatar: string;
  role: "client" | "freelancer" | "both";
  company?: string;
  title?: string;
  rating?: number;
}
