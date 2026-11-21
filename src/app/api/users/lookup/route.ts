import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/server/supabase";
import {
  extractBaseCode,
  formatClientId,
  formatFreelancerId,
} from "@/lib/dashboard-data";
import { resolveCounterpartyIdentity } from "@/server/identity";
import { requireCaller } from "@/server/auth";
import { DomainError, errorResponse } from "@/server/errors";

/** j***@example.com — enough to recognise an account, not enough to harvest addresses. */
function maskEmail(email?: string | null): string {
  if (!email || !email.includes("@")) return "";
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}

export async function GET(req: NextRequest) {
  try {
    // Only signed-in users can browse or look up other accounts.
    const caller = await requireCaller(req);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const email = searchParams.get("email");
    const query = searchParams.get("q");
    const isList = searchParams.get("list") === "true";
    const roleParam = searchParams.get("expectedRole") || searchParams.get("role");
    const expectedRole: "client" | "freelancer" = roleParam === "client" ? "client" : "freelancer";
    const serverSupabase = getServerSupabase();

    // 1. Directory List Mode: browse registered counterparties (never includes the caller)
    if (isList) {
      if (!serverSupabase) throw new DomainError(503, "Directory is unavailable.", "DB_UNAVAILABLE");

      const columns = "id, milestone_os_id, full_name, email, role, avatar, company, title, rating";
      const [othersRes, selfRes] = await Promise.all([
        serverSupabase.from("profiles").select(columns).neq("id", caller.id).order("full_name", { ascending: true }).limit(30),
        serverSupabase.from("profiles").select(columns).eq("id", caller.id).maybeSingle(),
      ]);
      if (othersRes.error) {
        console.error("Directory listing failed:", othersRes.error);
        throw new DomainError(500, "Could not load the directory.");
      }

      // The caller's own account comes first: an account can send a request to its own other role.
      const listData = [...(selfRes.data ? [selfRes.data] : []), ...(othersRes.data || [])];

      const users = listData.map((row) => {
        const base = extractBaseCode(row.milestone_os_id) || String(row.id).slice(0, 6).toUpperCase();
        return {
          id: row.id,
          isSelf: row.id === caller.id,
          baseCode: base,
          clientId: formatClientId(base),
          freelancerId: formatFreelancerId(base),
          milestoneOSId: expectedRole === "freelancer" ? formatFreelancerId(base) : formatClientId(base),
          name: row.full_name || "User",
          email: maskEmail(row.email),
          avatar: row.avatar || (row.full_name ? row.full_name.slice(0, 2).toUpperCase() : "US"),
          role: row.role,
          company: row.company || "Client Organization",
          title: row.title || (expectedRole === "freelancer" ? "Independent Specialist" : "Client"),
          rating: Number(row.rating || 5.0),
        };
      });

      return NextResponse.json({
        success: true,
        count: users.length,
        users,
      });
    }

    // 2. Direct Single User Lookup via Central Identity Resolution
    const lookupKey = (id || email || query || "").trim();
    if (!lookupKey) {
      return NextResponse.json(
        { found: false, error: "Please provide a valid account ID, code, or email (e.g. ?id=FL-XXXXXX or ?email=user@example.com)." },
        { status: 400 }
      );
    }

    const result = await resolveCounterpartyIdentity({
      identifier: lookupKey,
      expectedRole,
      proposerId: caller.id,
      proposerEmail: caller.email,
    });

    if (!result.success) {
      const statusCode = result.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        {
          found: false,
          error: result.error,
          code: result.code,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      found: true,
      user: { ...result.user, email: maskEmail(result.user.email), isSelf: result.user.id === caller.id },
    });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ found: false, error: err.message, code: err.code }, { status: err.status });
    }
    return errorResponse(err, "Failed to lookup user");
  }
}
