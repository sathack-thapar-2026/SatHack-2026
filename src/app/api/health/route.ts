import { NextResponse } from "next/server";
import { hasPaymentCredentials } from "@/server/payments";
import { hasGeminiKey, GEMINI_MODELS } from "@/server/gemini";
import { getServerSupabase } from "@/server/supabase";

export async function GET() {
  // Real connectivity probe (a cheap head-only query) instead of a hard-coded "connected".
  let dbStatus: "connected" | "unavailable" | "not_configured" = "not_configured";
  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { error } = await supabase.from("projects").select("id", { head: true, count: "exact" }).limit(1);
      dbStatus = error ? "unavailable" : "connected";
    } catch {
      dbStatus = "unavailable";
    }
  }

  const healthy = dbStatus === "connected";
  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        payments: {
          configured: hasPaymentCredentials(),
          environment: process.env.PAYPAL_ENVIRONMENT || "sandbox",
        },
        geminiAI: {
          configured: hasGeminiKey(),
          model: GEMINI_MODELS[0],
        },
        database: {
          status: dbStatus,
        },
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
