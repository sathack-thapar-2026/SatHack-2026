/**
 * PerMile — Server-side authentication & authorization helpers.
 *
 * The caller's identity is ONLY ever taken from a Supabase access token
 * (Authorization: Bearer <jwt>) that the server verifies itself.
 * Identity values sent in a request body, query string or custom headers
 * (userId, userEmail, role, x-user-*) are never trusted.
 */

import { NextResponse } from "next/server";
import { getServerSupabase } from "./supabase";
import { DomainError } from "./errors";
import { extractBaseCode } from "@/lib/dashboard-data";
import type { ProjectContract } from "@/lib/dashboard-data";

export interface AuthedCaller {
  id: string;
  email: string; // lower-cased, verified by Supabase
  name: string;
  avatar: string;
  baseCode: string;
  milestoneOSId: string; // CL-XXXXXX
  company?: string;
  title?: string;
}

const CACHE_TTL_MS = 20_000;
const CACHE_MAX = 500;
const callerCache = new Map<string, { caller: AuthedCaller; expires: number }>();

function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token ? token : null;
}

/** Returns the verified caller, or null when there is no valid session. */
export async function authenticate(req: Request): Promise<AuthedCaller | null> {
  const token = readBearer(req);
  if (!token) return null;

  const cached = callerCache.get(token);
  if (cached && cached.expires > Date.now()) return cached.caller;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) return null;
    const user = data.user;

    let profile: any = null;
    try {
      const res = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      profile = res.data;
    } catch (_) {}

    const meta = (user.user_metadata || {}) as Record<string, any>;
    const email = (user.email || profile?.email || "").trim().toLowerCase();
    const baseCode =
      extractBaseCode(profile?.base_code) ||
      extractBaseCode(profile?.milestone_os_id) ||
      extractBaseCode(meta.baseCode) ||
      extractBaseCode(meta.milestoneOSId) ||
      user.id.slice(0, 6).toUpperCase();
    const name = profile?.full_name || meta.name || email.split("@")[0] || "Member";

    const caller: AuthedCaller = {
      id: user.id,
      email,
      name,
      avatar: profile?.avatar || name.slice(0, 2).toUpperCase(),
      baseCode,
      milestoneOSId: `CL-${baseCode}`,
      company: profile?.company || meta.company || undefined,
      title: profile?.title || meta.title || undefined,
    };

    if (callerCache.size >= CACHE_MAX) {
      const oldest = callerCache.keys().next().value;
      if (oldest) callerCache.delete(oldest);
    }
    callerCache.set(token, { caller, expires: Date.now() + CACHE_TTL_MS });
    return caller;
  } catch (err) {
    console.error("Token verification failed:", err);
    return null;
  }
}

/** Like authenticate(), but throws a 401 DomainError when there is no valid session. */
export async function requireCaller(req: Request): Promise<AuthedCaller> {
  const caller = await authenticate(req);
  if (!caller) {
    throw new DomainError(401, "Authentication required. Please sign in again.", "UNAUTHENTICATED");
  }
  return caller;
}

export function unauthorizedResponse(message = "Authentication required. Please sign in again.") {
  return NextResponse.json({ error: message, code: "UNAUTHENTICATED" }, { status: 401 });
}

/** Which side(s) of a project the verified caller is on. */
export function projectRoles(
  project: ProjectContract,
  caller: Pick<AuthedCaller, "id" | "email" | "baseCode">
): { isClient: boolean; isFreelancer: boolean } {
  const email = caller.email?.toLowerCase();
  const clientBase = extractBaseCode(project.client?.milestoneOSId);
  const freelancerBase = extractBaseCode(project.freelancer?.milestoneOSId);

  const isClient = Boolean(
    (caller.id && (project.clientId === caller.id || project.client?.id === caller.id)) ||
      (email && project.client?.email?.toLowerCase() === email) ||
      (caller.baseCode && clientBase && clientBase === caller.baseCode)
  );
  const isFreelancer = Boolean(
    (caller.id && (project.freelancerId === caller.id || project.freelancer?.id === caller.id)) ||
      (email && project.freelancer?.email?.toLowerCase() === email) ||
      (caller.baseCode && freelancerBase && freelancerBase === caller.baseCode)
  );
  return { isClient, isFreelancer };
}

export function assertParticipant(project: ProjectContract, caller: AuthedCaller) {
  const roles = projectRoles(project, caller);
  if (!roles.isClient && !roles.isFreelancer) {
    // 404 (not 403) so project ids can't be probed by non-participants.
    throw new DomainError(404, "Project not found or you are not a participant.", "NOT_FOUND");
  }
  return roles;
}

export function assertClient(project: ProjectContract, caller: AuthedCaller, message: string) {
  const roles = assertParticipant(project, caller);
  if (!roles.isClient) throw new DomainError(403, message, "FORBIDDEN");
  return roles;
}

export function assertFreelancer(project: ProjectContract, caller: AuthedCaller, message: string) {
  const roles = assertParticipant(project, caller);
  if (!roles.isFreelancer) throw new DomainError(403, message, "FORBIDDEN");
  return roles;
}

/** The party who did NOT create the proposal (the one who has to accept it). */
export function proposalSides(project: ProjectContract) {
  const clientInitiated = project.initiatedBy === "client";
  return {
    proposer: clientInitiated ? project.client : project.freelancer,
    recipient: clientInitiated ? project.freelancer : project.client,
    proposerIsClient: clientInitiated,
  };
}

export function callerIsProposer(project: ProjectContract, caller: AuthedCaller): boolean {
  const roles = projectRoles(project, caller);
  return project.initiatedBy === "client" ? roles.isClient : roles.isFreelancer;
}

export function callerIsRecipient(project: ProjectContract, caller: AuthedCaller): boolean {
  const roles = projectRoles(project, caller);
  return project.initiatedBy === "client" ? roles.isFreelancer : roles.isClient;
}
