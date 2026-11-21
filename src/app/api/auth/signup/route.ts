import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/server/supabase";
import {
  generateBaseCode,
  formatClientId,
  formatFreelancerId,
} from "@/lib/dashboard-data";

// Simple in-memory sign-up throttle (per client IP) to blunt scripted account creation.
const SIGNUP_WINDOW_MS = 10 * 60 * 1000;
const SIGNUP_MAX_PER_WINDOW = 10;
const signupAttempts = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (signupAttempts.get(ip) || []).filter((t) => now - t < SIGNUP_WINDOW_MS);
  recent.push(now);
  signupAttempts.set(ip, recent);
  if (signupAttempts.size > 5000) {
    for (const [key, times] of signupAttempts) {
      if (times.every((t) => now - t >= SIGNUP_WINDOW_MS)) signupAttempts.delete(key);
    }
  }
  return recent.length > SIGNUP_MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  try {
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: "Too many sign-up attempts. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
    }
    const { email, password, name } = body || {};

    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }
    if (password.length > 128) {
      return NextResponse.json(
        { success: false, error: "Password must be at most 128 characters." },
        { status: 400 }
      );
    }

    // Generate shared unique 6-character base code for the user
    const baseCode = generateBaseCode();
    const clientId = formatClientId(baseCode);
    const freelancerId = formatFreelancerId(baseCode);

    // Every account gets both workspaces (a client ID and a freelancer ID from one base code),
    // so the profile is stored as "both" — otherwise they could never receive proposals as a freelancer.
    const userRoles = ["client", "freelancer"];
    const defaultName = cleanEmail.split("@")[0];
    const userName = (typeof name === "string" ? name.trim().slice(0, 100) : "") || defaultName;
    const avatarInitials = userName.slice(0, 2).toUpperCase();

    const adminSupabase = getServerSupabase();

    if (adminSupabase) {
      const { data, error } = await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: userName,
          // The database trigger copies this into profiles.role, whose check constraint only allows
          // 'client' or 'freelancer' on existing databases. Sending 'both' here makes the trigger fail
          // ("Database error creating new user"). Dual-role access comes from `roles` and the shared base code.
          role: "client",
          roles: userRoles,
          baseCode,
          clientId,
          freelancerId,
          milestoneOSId: clientId,
        },
      });

      if (error) {
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 400 }
        );
      }

      // Upsert into profiles. Older databases may lack some columns / the 'both' role value,
      // so degrade step by step until one variant is accepted.
      const base = {
        id: data.user.id,
        milestone_os_id: clientId,
        full_name: userName,
        email: cleanEmail,
        avatar: avatarInitials,
      };
      const attempts: Record<string, unknown>[] = [
        { ...base, base_code: baseCode, role: "both", roles: userRoles },
        { ...base, role: "both", roles: userRoles },
        { ...base, role: "both" },
        { ...base, role: "client" },
      ];
      let profileSaved = false;
      let lastProfileError: unknown = null;
      for (const payload of attempts) {
        const res = await adminSupabase.from("profiles").upsert(payload);
        if (!res.error) {
          profileSaved = true;
          break;
        }
        lastProfileError = res.error;
      }
      if (!profileSaved) {
        console.error("Could not save profile for new user:", lastProfileError);
      }

      return NextResponse.json({
        success: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name: userName,
          role: "both",
          roles: userRoles,
          baseCode,
          clientId,
          freelancerId,
          milestoneOSId: clientId,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Sign-up is unavailable because the authentication service is not configured.",
      },
      { status: 503 }
    );
  } catch (err) {
    console.error("Sign up failed:", err);
    return NextResponse.json({ success: false, error: "Sign up failed." }, { status: 500 });
  }
}
