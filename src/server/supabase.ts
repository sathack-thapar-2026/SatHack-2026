/**
 * PerMile — Server-Side Supabase Client
 * Uses the Service Role Key (or Anon Key) for secure backend operations.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasServerSupabase(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseServiceKey &&
    supabaseUrl !== "https://your-project.supabase.co" &&
    supabaseServiceKey !== "your_supabase_anon_key_here" &&
    supabaseServiceKey !== "your_supabase_service_role_key_here" &&
    supabaseUrl.startsWith("https://")
  );
}

let serverClientInstance: SupabaseClient | null = null;

/** Upper bound for any single database/auth request made by the server. */
const REQUEST_TIMEOUT_MS = 30_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
  return fetch(input, { ...init, signal });
}

export function getServerSupabase(): SupabaseClient | null {
  if (!hasServerSupabase()) return null;
  if (!serverClientInstance) {
    serverClientInstance = createClient(supabaseUrl!, supabaseServiceKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: { fetch: fetchWithTimeout },
    });
  }
  return serverClientInstance;
}
