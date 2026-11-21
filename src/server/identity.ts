import { getServerSupabase } from "./supabase";
import { extractBaseCode, formatClientId, formatFreelancerId } from "@/lib/dashboard-data";

export interface ResolvedUserIdentity {
  id: string; // Supabase Auth UUID
  baseCode: string;
  clientId: string;
  freelancerId: string;
  milestoneOSId: string;
  name: string;
  email: string;
  role: "client" | "freelancer" | "both";
  company?: string;
  title?: string;
  avatar?: string;
  rating?: number;
}

export type IdentityResolutionResult =
  | { success: true; user: ResolvedUserIdentity }
  | { success: false; error: string; code: "INVALID_FORMAT" | "NOT_FOUND" | "ROLE_MISMATCH" | "SELF_ASSIGNMENT" };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE_CODE_REGEX = /^[A-Z0-9]{6}$/;
const FULL_ID_REGEX = /^(?:CL|FL|MSO)-[A-Z0-9]{6}$/;

/** Escapes LIKE/ILIKE wildcards so user input can only ever match literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Universal Central Identity Resolution Function.
 *
 * Given an input (e.g. FL-XXXXXX, CL-XXXXXX, MSO-XXXXXX, base code, email, or UUID),
 * resolves against public.profiles in Supabase PostgreSQL:
 * 1. Normalizes the entered ID (anything that is not a strict ID/email/UUID is rejected).
 * 2. Queries public.profiles by id, email, or milestone_os_id.
 * 3. Validates that the profile exists.
 * 4. Prevents self-assignment (proposer cannot be recipient).
 * 5. Returns the exact Supabase Auth UUID and profile attributes.
 *
 * Every MilestoneOS account owns both a client ID (CL-) and a freelancer ID (FL-)
 * derived from one shared base code, so any account can act on either side.
 */
export async function resolveCounterpartyIdentity(params: {
  identifier: string;
  expectedRole: "client" | "freelancer";
  proposerId?: string | null;
  proposerEmail?: string | null;
}): Promise<IdentityResolutionResult> {
  const { identifier, expectedRole, proposerId, proposerEmail } = params;

  if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
    return {
      success: false,
      error: `Please enter a valid ${expectedRole === "freelancer" ? "Freelancer ID (e.g. FL-XXXXXX)" : "Client ID (e.g. CL-XXXXXX)"}.`,
      code: "INVALID_FORMAT",
    };
  }

  const rawInput = identifier.trim();
  const cleanInput = rawInput.toUpperCase();
  const isEmail = rawInput.includes("@");
  const isUUID = UUID_REGEX.test(rawInput);

  let baseCode: string | null = null;
  if (!isEmail && !isUUID) {
    const candidate = extractBaseCode(cleanInput);
    baseCode = BASE_CODE_REGEX.test(candidate) ? candidate : null;
  }

  // Validate format and role prefix if user provided a typed prefix
  if (expectedRole === "freelancer" && cleanInput.startsWith("CL-")) {
    return {
      success: false,
      error: `You entered a Client ID ('${rawInput}'). When hiring a freelancer, you must enter the Freelancer's ID starting with 'FL-' (e.g. FL-${baseCode || "XXXXXX"}).`,
      code: "ROLE_MISMATCH",
    };
  }

  if (expectedRole === "client" && cleanInput.startsWith("FL-")) {
    return {
      success: false,
      error: `You entered a Freelancer ID ('${rawInput}'). When proposing to a client, you must enter the Client's ID starting with 'CL-' (e.g. CL-${baseCode || "XXXXXX"}).`,
      code: "ROLE_MISMATCH",
    };
  }

  // Anything that is not a UUID, an email, or a well-formed MilestoneOS ID cannot match an account.
  if (!isUUID && !isEmail && !baseCode && !FULL_ID_REGEX.test(cleanInput)) {
    return {
      success: false,
      error: `"${rawInput}" is not a valid account ID. Use an ID like ${expectedRole === "freelancer" ? "FL-XXXXXX" : "CL-XXXXXX"}.`,
      code: "INVALID_FORMAT",
    };
  }

  const supabase = getServerSupabase();
  if (!supabase) {
    return {
      success: false,
      error: "Supabase connection unavailable for account verification.",
      code: "NOT_FOUND",
    };
  }

  let profile: any = null;

  // 1. Lookup by UUID
  if (isUUID) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", rawInput).maybeSingle();
    if (!error && data) profile = data;
  }

  // 2. Lookup by Email
  if (!profile && isEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", rawInput.toLowerCase())
      .maybeSingle();
    if (!error && data) profile = data;
  }

  // 3. Lookup by Base Code in milestone_os_id (baseCode is strictly 6 alphanumerics, so no wildcards)
  if (!profile && baseCode) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("milestone_os_id", `%${baseCode}%`)
      .limit(1)
      .maybeSingle();
    if (!error && data) profile = data;
  }

  // 4. Exact match on the full milestone_os_id string (wildcards escaped)
  if (!profile && FULL_ID_REGEX.test(cleanInput)) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("milestone_os_id", escapeLike(cleanInput))
      .limit(1)
      .maybeSingle();
    if (!error && data) profile = data;
  }

  if (!profile) {
    return {
      success: false,
      error: `No registered account found matching "${rawInput}". Please verify the account ID.`,
      code: "NOT_FOUND",
    };
  }

  // Self-assignment check: recipient cannot be the same as proposer
  const cleanProposerId = proposerId?.trim().toLowerCase();
  const cleanProposerEmail = proposerEmail?.trim().toLowerCase();
  if (
    (cleanProposerId && String(profile.id).toLowerCase() === cleanProposerId) ||
    (cleanProposerEmail && String(profile.email || "").toLowerCase() === cleanProposerEmail)
  ) {
    return {
      success: false,
      error: "You cannot create a project proposal or request addressed to your own account.",
      code: "SELF_ASSIGNMENT",
    };
  }

  const resolvedBase = extractBaseCode(profile.milestone_os_id) || String(profile.id).slice(0, 6).toUpperCase();

  const user: ResolvedUserIdentity = {
    id: profile.id,
    baseCode: resolvedBase,
    clientId: formatClientId(resolvedBase),
    freelancerId: formatFreelancerId(resolvedBase),
    milestoneOSId: expectedRole === "freelancer" ? formatFreelancerId(resolvedBase) : formatClientId(resolvedBase),
    name: profile.full_name || "Registered User",
    email: profile.email,
    role: "both",
    company: profile.company || (expectedRole === "client" ? "Client Organization" : undefined),
    title: profile.title || (expectedRole === "freelancer" ? "Independent Specialist" : undefined),
    avatar: profile.avatar || (profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : "US"),
    rating: Number(profile.rating || 5.0),
  };

  return {
    success: true,
    user,
  };
}
