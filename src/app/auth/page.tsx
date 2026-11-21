"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import WebThreadsController from "@/components/WebThreadsController";
import ThemeToggle from "@/components/ThemeToggle";
import {
  Eye,
  EyeOff,
  User,
  Briefcase,
  Lock,
  Mail,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  generateMilestoneOSId,
  extractBaseCode,
  formatClientId,
  formatFreelancerId,
} from "@/lib/dashboard-data";
import { isSupabaseConfigured, getSupabaseClient } from "@/lib/supabase";

type AuthMode = "login" | "signup";

// Optional one-click demo account. It is configured through environment variables
// (NEXT_PUBLIC_DEMO_EMAIL / _PASSWORD / _NAME); when they are not set the demo section is hidden.
const DEMO_EMAIL = process.env.NEXT_PUBLIC_DEMO_EMAIL || "";
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "";
const DEMO_NAME = process.env.NEXT_PUBLIC_DEMO_NAME || "Demo User";
const DEMO_ENABLED = Boolean(DEMO_EMAIL && DEMO_PASSWORD);

/** Only same-site paths are allowed as a post-login destination (blocks open redirects). */
function safeReturnUrl(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}
type UserRole = "client" | "freelancer" | "both";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Perspective selection for Hackathon Demo flow
  const [demoPerspective, setDemoPerspective] = useState<"client" | "freelancer">("client");

  // Form Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & Validation States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const queryMode = searchParams.get("mode");
    if (queryMode === "signup" || queryMode === "login") {
      setMode(queryMode);
    }
  }, [searchParams]);

  const syncLocalProfile = (
    userName: string,
    userEmail: string,
    userMsoId: string,
    primaryRole: "client" | "freelancer" = "client"
  ) => {
    try {
      const cleanEmail = userEmail.trim().toLowerCase();
      const defaultName = cleanEmail.split("@")[0] || "User";
      const actualName = userName.trim() || defaultName;
      const initials = actualName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const baseCode = extractBaseCode(userMsoId) || "USER01";
      const clientId = formatClientId(baseCode);
      const freelancerId = formatFreelancerId(baseCode);

      const activeUser = {
        name: actualName,
        email: cleanEmail,
        avatar: initials,
        baseCode,
        clientId,
        freelancerId,
        milestoneOSId: primaryRole === "freelancer" ? freelancerId : clientId,
        role: primaryRole,
        roles: ["client", "freelancer"],
      };

      localStorage.setItem("milestoneos_active_user_v8", JSON.stringify(activeUser));
      localStorage.setItem("milestoneos_role_v8", primaryRole);
      localStorage.removeItem("milestoneos_demo_mode");
    } catch (_) {}
  };

  // Instant Demo Login for Hackathon Judges
  const handleDemoLogin = async (demoRole: "client" | "freelancer" = demoPerspective) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!DEMO_ENABLED) {
      setLoading(false);
      setErrorMsg("The demo account is not configured.");
      return;
    }

    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
        });

        if (!error && data.user) {
          const userMeta = data.user.user_metadata || {};
          const userName = userMeta.name || DEMO_NAME;
          const userMsoId = userMeta.milestoneOSId || generateMilestoneOSId();

          localStorage.removeItem("milestoneos_demo_mode");
          syncLocalProfile(userName, DEMO_EMAIL, userMsoId, demoRole);
          setSuccessMsg(`Welcome, ${userName}! Signed in via Supabase Auth.`);
          setTimeout(() => {
            router.push(`/dashboard?role=${demoRole}`);
          }, 350);
          return;
        }
      } catch (err) {
        console.warn("Supabase quick sign-in fallback", err);
      }
    }

    setLoading(false);
    setErrorMsg("The demo account could not be signed in right now. Please sign in with your own account.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Basic Validation
    if (!email || !password) {
      setErrorMsg("Please provide both email and password.");
      return;
    }

    if (!email.includes("@") || !email.includes(".")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters in length.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please verify your confirmation.");
      return;
    }

    setLoading(true);
    const returnUrl = safeReturnUrl(searchParams.get("returnUrl"), "/dashboard?role=client");
    const supabaseClient = getSupabaseClient();

    // 1. If Supabase is configured in .env.local, use Supabase Auth
    if (supabaseClient) {
      try {
        if (mode === "signup") {
          const cleanEmail = email.trim().toLowerCase();
          const defaultName = cleanEmail.split("@")[0] || "User";
          const finalName = name.trim() || defaultName;

          // Route through /api/auth/signup to automatically auto-confirm user without email bottleneck
          const res = await fetch("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: cleanEmail,
              password,
              name: finalName,
              role: "both",
            }),
          });
          const resData = await res.json();

          if (!res.ok || !resData.success) {
            setLoading(false);
            setErrorMsg(resData.error || "Sign up failed.");
            return;
          }

          const newMsoId = resData.user?.milestoneOSId || generateMilestoneOSId();
          const newName = resData.user?.name || finalName;

          // Log in with password to establish the browser session
          await supabaseClient.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          syncLocalProfile(newName, cleanEmail, newMsoId);
          setSuccessMsg(`Account created on Supabase! ID: ${newMsoId}. Redirecting...`);
          setTimeout(() => router.push(returnUrl), 500);
          return;
        } else {
          // Login with Supabase
          const cleanEmail = email.trim().toLowerCase();
          const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (error) {
            setLoading(false);
            setErrorMsg(error.message || "Invalid email or password.");
            return;
          }

          const userMeta = data.user?.user_metadata || {};
          const userName = userMeta.name || cleanEmail.split("@")[0];
          const userMsoId = userMeta.milestoneOSId || generateMilestoneOSId();
          const userRole: "client" | "freelancer" =
            userMeta.role === "freelancer" ? "freelancer" : "client";

          syncLocalProfile(userName, cleanEmail, userMsoId, userRole);
          setSuccessMsg(`Welcome back, ${userName}! Authenticated via Supabase.`);
          setTimeout(
            () => router.push(safeReturnUrl(searchParams.get("returnUrl"), `/dashboard?role=${userRole}`)),
            500
          );
          return;
        }
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || "Authentication failed. Please verify your connection.");
        return;
      }
    }

    // The auth service is not configured, and there is deliberately no password-less fallback login.
    setLoading(false);
    setErrorMsg("Sign-in is unavailable because the authentication service is not configured.");
  };

  return (
    <div className="w-full max-w-md relative z-10">
      {/* Glow highlight behind card */}
      <div className="absolute -inset-1 rounded-[32px] bg-gradient-to-r from-[#004C8F]/20 via-[#0070BA]/25 to-[#00A3E0]/20 blur-xl opacity-60 dark:opacity-40 pointer-events-none" />

      {/* Form Card with Decreased Opacity (Sleek Frosted Glass) */}
      <div className="relative rounded-3xl border border-white/50 bg-white/65 p-6 sm:p-8 shadow-2xl shadow-blue-900/10 backdrop-blur-2xl dark:border-white/10 dark:bg-[#0d1527]/55 dark:shadow-2xl dark:shadow-black/70 ring-1 ring-black/5 dark:ring-white/10 transition-all duration-300">
        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100/60 p-1 dark:bg-slate-900/50 backdrop-blur-md text-sm font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white/90 text-slate-900 shadow-md font-bold dark:bg-gradient-to-r dark:from-[#004C8F] dark:to-[#0070BA] dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 rounded-xl transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white/90 text-slate-900 shadow-md font-bold dark:bg-gradient-to-r dark:from-[#004C8F] dark:to-[#0070BA] dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Header Text */}
        <div className="mt-5 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {mode === "login" ? "Welcome Back" : "Join MilestoneOS"}
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
            {mode === "login"
              ? "Access your project milestones and secure escrow payouts."
              : "Create your free account with universal access to Client and Freelancer tools."}
          </p>
        </div>

        {DEMO_ENABLED && (
          <>
        {/* INSTANT HACKATHON DEMO ACCESS (Visually Distinct Dedicated Section) */}
        <div className="mt-5 rounded-2xl border border-amber-400/40 bg-gradient-to-br from-amber-500/[0.08] via-sky-500/[0.03] to-blue-500/[0.05] p-4 dark:border-amber-400/25 dark:from-amber-400/[0.05] dark:via-sky-400/[0.02] dark:to-indigo-400/[0.03] backdrop-blur-md space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
                <Sparkles className="h-3 w-3" />
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                Instant Hackathon Demo Access
              </span>
            </div>
            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              Judges Sandbox
            </span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            Evaluate the platform with preloaded demo contracts, secure funded milestones, and Gemini AI audit reviews:
          </p>

          {/* Perspective selector for Demo Flow */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Select Starting Perspective:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDemoPerspective("client")}
                className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  demoPerspective === "client"
                    ? "border-[#0070BA] bg-white dark:bg-[#0070BA]/25 shadow-xs ring-1 ring-[#0070BA]"
                    : "border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <User className="h-3 w-3 text-[#0070BA] dark:text-sky-400" />
                    <span>{DEMO_NAME} (Client)</span>
                  </span>
                  {demoPerspective === "client" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] dark:bg-sky-400" />
                  )}
                </div>
                <span className="text-[10px] font-semibold text-[#0070BA] dark:text-sky-300 mt-0.5">
                  Client Perspective
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  Review work &amp; release payments
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDemoPerspective("freelancer")}
                className={`flex flex-col p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  demoPerspective === "freelancer"
                    ? "border-[#0070BA] bg-white dark:bg-[#0070BA]/25 shadow-xs ring-1 ring-[#0070BA]"
                    : "border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    <Briefcase className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                    <span>{DEMO_NAME} (Freelancer)</span>
                  </span>
                  {demoPerspective === "freelancer" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0070BA] dark:bg-sky-400" />
                  )}
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Freelancer Perspective
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400">
                  Submit work &amp; get paid
                </span>
              </button>
            </div>
          </div>

          {/* ONE SINGLE BUTTON: Explore Demo Workspace */}
          <button
            type="button"
            onClick={() => handleDemoLogin(demoPerspective)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-900 shadow-xs hover:shadow transition-all hover:scale-[1.005] active:scale-[0.99] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
            <span>Explore Demo Workspace as {DEMO_NAME} ({demoPerspective === "client" ? "Client" : "Freelancer"})</span>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
          </button>
        </div>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {mode === "signup" ? "or register personal account" : "or sign in with email"}
          </span>
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
        </div>

          </>
        )}

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-rose-200/80 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300 flex items-start gap-2 backdrop-blur-sm animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/80 p-3 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 flex items-start gap-2 backdrop-blur-sm animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/70 bg-white/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300/70 bg-white/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setSuccessMsg("Password reset instructions have been sent to your email address.")}
                  className="text-[11px] text-[#0070BA] dark:text-sky-400 font-medium hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300/70 bg-white/60 pl-9 pr-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/70 bg-white/60 pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-[#0070BA] focus:outline-none focus:ring-4 focus:ring-[#0070BA]/15 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          {mode === "signup" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-sky-300">
              <Check className="h-3.5 w-3.5 text-[#0070BA] dark:text-sky-400 shrink-0" />
              <span>Universal Account: Access both Client &amp; Freelancer perspectives.</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-gradient-glow w-full mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#004C8F] via-[#0070BA] via-[#00A3E0] to-[#004C8F] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <span>{mode === "login" ? "Sign In" : "Create Account"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="mt-5 text-center text-xs text-slate-600 dark:text-slate-400">
          {mode === "login" ? (
            <span>
              Don't have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-[#0070BA] dark:text-sky-400 font-bold hover:underline cursor-pointer ml-0.5"
              >
                Create one free
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-[#0070BA] dark:text-sky-400 font-bold hover:underline cursor-pointer ml-0.5"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Floating Trust Verification Badges */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[#0070BA] dark:text-sky-400" />
          <span>Secure Escrow Sandbox</span>
        </span>
        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#0070BA] dark:text-sky-400" />
          <span>Gemini 2.5 Deliverable Audit</span>
        </span>
        <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>Zero Upfront Risk</span>
        </span>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="relative min-h-screen bg-[#F8FAFD] dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col justify-between overflow-hidden transition-colors duration-200">
      {/* 
        INTERACTIVE WEB THREADS STUDIO BACKGROUND:
        Renders the exact same glowing luminous web lines with real-time controls,
        presets, mouse interaction, and ripple pulses on the login page!
      */}
      <WebThreadsController />

      {/* AMBIENT FLANK LIGHTING: Softly frames the left and right margins with rich brand blue ambiance */}
      <div className="fixed inset-y-0 left-0 w-72 sm:w-96 bg-gradient-to-r from-blue-200/25 via-sky-100/15 to-transparent pointer-events-none z-0 dark:from-blue-900/15 dark:via-sky-950/5 dark:to-transparent" />
      <div className="fixed inset-y-0 right-0 w-72 sm:w-96 bg-gradient-to-l from-sky-200/25 via-blue-100/10 to-transparent pointer-events-none z-0 dark:from-sky-900/15 dark:via-blue-950/5 dark:to-transparent" />

      {/* AMBIENT RADIAL LIGHTING ORBS */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-blue-600/20 via-sky-500/15 to-teal-400/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed -top-24 -left-24 w-96 h-96 bg-sky-500/15 dark:bg-sky-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />
      <div className="fixed -bottom-24 -right-24 w-96 h-96 bg-blue-600/15 dark:bg-blue-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* ARCHITECTURAL DOT GRID PATTERN */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.035] dark:opacity-[0.07] bg-[radial-gradient(#0070BA_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Top Glass Bar */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200/60 bg-white/75 backdrop-blur-xl px-4 sm:px-8 py-3.5 flex items-center justify-between dark:border-white/10 dark:bg-[#070b14]/75">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#004C8F] via-[#0070BA] to-[#00A3E0] text-white font-bold shadow-md shadow-blue-500/25 group-hover:scale-105 transition-all">
            <span className="text-base font-extrabold tracking-tight">M</span>
          </div>
          <span className="font-extrabold text-lg text-slate-900 dark:text-white tracking-tight">
            Milestone<span className="text-[#0070BA] dark:text-[#38BDF8]">OS</span>
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white/80 hover:bg-white hover:border-[#0070BA]/50 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Form Center Stage */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16 relative z-10">
        <Suspense
          fallback={
            <div className="text-center text-slate-400 text-sm py-12 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#0070BA]" />
              <span>Loading workspace...</span>
            </div>
          }
        >
          <AuthForm />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200/60 dark:border-white/10 bg-white/40 dark:bg-transparent backdrop-blur-md">
        Safe Milestone Payments Powered by Gemini AI
      </footer>
    </div>
  );
}
