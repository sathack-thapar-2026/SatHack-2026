/**
 * PayZorr — authenticated fetch for the app's own API routes.
 *
 * Every protected route verifies the caller's Supabase access token on the server,
 * so every request from the browser must carry it. Identity is never sent in the body.
 */

import { getSupabaseClient } from "./supabase";

export async function getAccessToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch (_) {
    return null;
  }
}

const REDIRECT_GUARD_KEY = "milestoneos_auth_redirect_at";

/** Sends the user back to the sign-in page once (never in a loop) when the server rejects the session. */
function handleSessionRejected() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/auth")) return;
  try {
    const last = Number(sessionStorage.getItem(REDIRECT_GUARD_KEY) || 0);
    if (Date.now() - last < 15_000) return;
    sessionStorage.setItem(REDIRECT_GUARD_KEY, String(Date.now()));
    localStorage.removeItem("milestoneos_active_user_v8");
  } catch (_) {}
  const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.assign(`/auth?returnUrl=${returnUrl}`);
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body !== undefined && init.body !== null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // Every request has a deadline, so a stuck request can never leave a button "busy" forever.
  const res = await fetch(input, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(90_000) });
  if (res.status === 401) handleSessionRejected();
  return res;
}

/** POST/PATCH helper that parses the JSON reply and throws a readable Error on failure. */
export async function authJson<T = any>(
  input: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  const res = await authFetch(input, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok || (data && data.success === false)) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}
