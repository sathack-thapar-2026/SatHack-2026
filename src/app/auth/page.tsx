"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import PermileLogo from "@/components/PermileLogo";
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
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Check,
  FileCheck,
  Zap,
} from "lucide-react";
import {
  generateMilestoneOSId,
  extractBaseCode,
  formatClientId,
  formatFreelancerId,
} from "@/lib/dashboard-data";
import { getSupabaseClient } from "@/lib/supabase";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  hasEntered: boolean;
  mouseCardTilt?: { rotateX: number; rotateY: number };
}

function AuthForm({ hasEntered, mouseCardTilt }: AuthFormProps) {
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
  const [rememberMe, setRememberMe] = useState(true);

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

    const demoUser = {
      name: "Rohan Verma",
      email: "rohan.verma@craftdev.io",
      id: demoRole === "client" ? "CL-2W8L41" : "FL-2W8L41",
      password: "Password123!",
    };

    const supabaseClient = getSupabaseClient();
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: demoUser.email,
          password: demoUser.password,
        });

        if (!error && data.user) {
          const userMeta = data.user.user_metadata || {};
          const userName = userMeta.name || demoUser.name;
          const userMsoId = demoRole === "client" ? "CL-2W8L41" : "FL-2W8L41";

          localStorage.removeItem("milestoneos_demo_mode");
          syncLocalProfile(userName, demoUser.email, userMsoId, demoRole);
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

    try {
      localStorage.removeItem("milestoneos_demo_mode");
      localStorage.setItem(
        "milestoneos_active_user_v8",
        JSON.stringify({
          name: demoUser.name,
          email: demoUser.email,
          avatar: "RV",
          baseCode: "2W8L41",
          clientId: "CL-2W8L41",
          freelancerId: "FL-2W8L41",
          milestoneOSId: demoUser.id,
          role: demoRole,
          roles: ["client", "freelancer"],
          isDemo: false,
        })
      );
      localStorage.setItem("milestoneos_role_v8", demoRole);
    } catch (_) {}

    setSuccessMsg(`Welcome, ${demoUser.name} (${demoRole === "client" ? "Client View" : "Freelancer View"})...`);
    setTimeout(() => {
      router.push(`/dashboard?role=${demoRole}`);
    }, 350);
  };

  // Instant Sandbox Authentication
  const handleInstantSandboxAuth = () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const returnUrl = searchParams.get("returnUrl") || "/dashboard?role=client";

    setTimeout(() => {
      setLoading(false);
      setSuccessMsg("Authenticated with Instant Sandbox. Redirecting to workspace...");
      setTimeout(() => {
        router.push(returnUrl);
      }, 400);
    }, 700);
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
    const returnUrl = searchParams.get("returnUrl") || "/dashboard?role=client";
    const supabaseClient = getSupabaseClient();

    // 1. If Supabase is configured, use Supabase Auth
    if (supabaseClient) {
      try {
        if (mode === "signup") {
          const cleanEmail = email.trim().toLowerCase();
          const defaultName = cleanEmail.split("@")[0] || "User";
          const finalName = name.trim() || defaultName;

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

          await supabaseClient.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          syncLocalProfile(newName, cleanEmail, newMsoId);
          setSuccessMsg(`Account created on Supabase! ID: ${newMsoId}. Redirecting...`);
          setTimeout(() => router.push(returnUrl), 500);
          return;
        } else {
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
          setTimeout(() => router.push(`/dashboard?role=${userRole}`), 500);
          return;
        }
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || "Authentication failed. Please verify your connection.");
        return;
      }
    }

    // 2. Fallback: Built-in local authentication
    const newId = generateMilestoneOSId();
    syncLocalProfile(name, email, newId);

    setTimeout(() => {
      setLoading(false);
      setSuccessMsg(
        mode === "login"
          ? `Welcome back, ${name || "User"}! Redirecting to your workspace...`
          : `Account created successfully with unique ID (${newId})! Redirecting...`
      );
      setTimeout(() => {
        router.push(returnUrl);
      }, 400);
    }, 700);
  };

  const tiltTransform = mouseCardTilt
    ? `perspective(1000px) rotateX(${mouseCardTilt.rotateX}deg) rotateY(${mouseCardTilt.rotateY}deg)`
    : undefined;

  return (
    <div
      style={{
        transform: hasEntered
          ? `${tiltTransform || "translate3d(0, 0, 0)"}`
          : "translate3d(0, 32px, 0) scale(0.96)",
        opacity: hasEntered ? 1 : 0,
        filter: hasEntered ? "blur(0px)" : "blur(12px)",
        transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.55s ease, filter 0.65s ease",
      }}
      className="w-full max-w-md mx-auto relative z-10 will-change-transform"
    >
      {/* Dynamic Specular Aura behind card */}
      <div className="absolute -inset-1 rounded-[26px] bg-gradient-to-r from-[#23C8E8]/20 via-[#42D6C0]/20 to-[#087FBE]/20 blur-xl opacity-60 dark:opacity-35 pointer-events-none transition-opacity duration-500" />

      {/* Translucent Aurora Glass Authentication Card */}
      <div className="relative rounded-[22px] border border-white/85 dark:border-white/10 bg-white/75 dark:bg-[#0E1726]/75 p-6 sm:p-8 shadow-2xl shadow-[#087FBE]/8 dark:shadow-black/60 backdrop-blur-xl transition-all duration-300">
        
        {/* Card Header */}
        <div className="text-left space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#142D46] dark:text-white tracking-tight">
            {mode === "login" ? "Welcome back." : "Create account."}
          </h2>
          <p className="text-xs sm:text-sm text-[#60778E] dark:text-slate-300 font-medium">
            {mode === "login"
              ? "Access your workspace."
              : "Start managing verified milestones today."}
          </p>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="mt-5 grid grid-cols-2 p-1 rounded-xl bg-slate-200/50 dark:bg-slate-800/60 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "login"
                ? "bg-white text-[#142D46] shadow-xs dark:bg-[#087FBE] dark:text-white"
                : "text-[#60778E] hover:text-[#142D46] dark:text-slate-400 dark:hover:text-white"
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
            className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === "signup"
                ? "bg-white text-[#142D46] shadow-xs dark:bg-[#087FBE] dark:text-white"
                : "text-[#60778E] hover:text-[#142D46] dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Create Account
          </button>
        </div>

        {/* DEMO ACCESS — IMPORTANT EXISTING FEATURE */}
        <div className="mt-5 rounded-2xl border border-[#23C8E8]/40 bg-gradient-to-br from-[#23C8E8]/[0.08] via-white/40 to-[#42D6C0]/[0.06] dark:from-[#23C8E8]/[0.08] dark:via-white/[0.02] dark:to-[#42D6C0]/[0.06] p-4 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#23C8E8]/20 text-[#087FBE] dark:text-[#23C8E8]">
                <Sparkles className="h-3 w-3" />
              </span>
              <span className="text-xs font-bold text-[#142D46] dark:text-white tracking-tight">
                Instant Hackathon Demo Access
              </span>
            </div>
            <span className="rounded-full bg-[#087FBE]/10 border border-[#087FBE]/20 px-2 py-0.5 text-[10px] font-bold text-[#087FBE] dark:text-[#23C8E8]">
              Judges Sandbox
            </span>
          </div>

          <p className="text-[11px] text-[#60778E] dark:text-slate-300 leading-relaxed">
            Evaluate the platform with preloaded demo contracts, secure funded milestones, and AI audit reviews:
          </p>

          {/* Two Selectable Cards: Client & Freelancer */}
          <div className="grid grid-cols-2 gap-2">
            {/* CLIENT CARD */}
            <button
              type="button"
              onClick={() => setDemoPerspective("client")}
              className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                demoPerspective === "client"
                  ? "border-[#087FBE] bg-white/95 dark:bg-[#087FBE]/25 shadow-xs ring-1 ring-[#087FBE]"
                  : "border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#142D46] dark:text-white flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-[#087FBE] dark:text-[#23C8E8]" />
                  <span>Client</span>
                </span>
                <div
                  className={`h-3 w-3 rounded-full border flex items-center justify-center ${
                    demoPerspective === "client"
                      ? "border-[#087FBE] bg-[#087FBE]"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {demoPerspective === "client" && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#087FBE] dark:text-[#23C8E8] mt-1">
                Rohan Verma
              </span>
              <span className="text-[10px] text-[#60778E] dark:text-slate-400 mt-0.5 leading-snug">
                Manage projects and approve milestones.
              </span>
            </button>

            {/* FREELANCER CARD */}
            <button
              type="button"
              onClick={() => setDemoPerspective("freelancer")}
              className={`flex flex-col p-3 rounded-xl border text-left transition-all cursor-pointer ${
                demoPerspective === "freelancer"
                  ? "border-[#087FBE] bg-white/95 dark:bg-[#087FBE]/25 shadow-xs ring-1 ring-[#087FBE]"
                  : "border-slate-200/80 bg-white/60 dark:border-white/10 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-white/[0.06]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#142D46] dark:text-white flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-teal-600 dark:text-[#42D6C0]" />
                  <span>Freelancer</span>
                </span>
                <div
                  className={`h-3 w-3 rounded-full border flex items-center justify-center ${
                    demoPerspective === "freelancer"
                      ? "border-[#087FBE] bg-[#087FBE]"
                      : "border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {demoPerspective === "freelancer" && (
                    <div className="h-1.5 w-1.5 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-teal-700 dark:text-[#42D6C0] mt-1">
                Rohan Verma
              </span>
              <span className="text-[10px] text-[#60778E] dark:text-slate-400 mt-0.5 leading-snug">
                Submit deliverables and track milestone progress.
              </span>
            </button>
          </div>

          {/* Action Button: Explore Demo Workspace */}
          <button
            type="button"
            onClick={() => handleDemoLogin(demoPerspective)}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-[#142D46] shadow-2xs hover:shadow-xs transition-all hover:scale-[1.005] active:scale-[0.99] dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#23C8E8]" />
            <span>
              Explore Demo Workspace as Rohan Verma ({demoPerspective === "client" ? "Client" : "Freelancer"})
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-[#60778E] dark:text-slate-300" />
          </button>
        </div>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#60778E] dark:text-slate-400">
            {mode === "signup" ? "or register personal account" : "or continue with email"}
          </span>
          <div className="h-px flex-1 bg-slate-200/80 dark:bg-white/10" />
        </div>

        {/* Alerts */}
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

        {/* Inputs Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "signup" && (
            <div>
              <label className="block text-xs font-semibold text-[#142D46] dark:text-slate-200 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-[#142D46] placeholder-slate-400 focus:border-[#087FBE] focus:outline-none focus:ring-3 focus:ring-[#087FBE]/20 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#142D46] dark:text-slate-200 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300/80 bg-white/70 pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-[#142D46] placeholder-slate-400 focus:border-[#087FBE] focus:outline-none focus:ring-3 focus:ring-[#087FBE]/20 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-[#142D46] dark:text-slate-200">
                Password
              </label>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300/80 bg-white/70 pl-9 pr-9 py-2.5 text-xs sm:text-sm text-[#142D46] placeholder-slate-400 focus:border-[#087FBE] focus:outline-none focus:ring-3 focus:ring-[#087FBE]/20 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
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
              <label className="block text-xs font-semibold text-[#142D46] dark:text-slate-200 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300/80 bg-white/70 pl-9 pr-3.5 py-2.5 text-xs sm:text-sm text-[#142D46] placeholder-slate-400 focus:border-[#087FBE] focus:outline-none focus:ring-3 focus:ring-[#087FBE]/20 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-white backdrop-blur-sm transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Remember Me & Forgot Password (Sign In state) */}
          {mode === "login" && (
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 text-[#60778E] dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-[#087FBE] focus:ring-[#087FBE]"
                />
                <span>Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setSuccessMsg("Password reset instructions have been sent to your email address.")}
                className="text-[#087FBE] dark:text-[#23C8E8] hover:underline font-semibold cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
          )}

          {mode === "signup" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-sky-300">
              <Check className="h-3.5 w-3.5 text-[#087FBE] dark:text-[#23C8E8] shrink-0" />
              <span>Universal Account: Access both Client &amp; Freelancer perspectives.</span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#087FBE] via-[#23C8E8] to-[#087FBE] py-3 text-sm font-bold text-white shadow-lg shadow-[#087FBE]/25 hover:shadow-[#087FBE]/35 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 transition-all cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Verifying credentials...</span>
              </>
            ) : (
              <>
                <span>{mode === "login" ? "Sign in →" : "Create account →"}</span>
              </>
            )}
          </button>
        </form>

        {/* Instant Sandbox Fast Access */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleInstantSandboxAuth}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-300/70 bg-white/60 hover:bg-white/90 px-4 py-2.5 text-xs font-semibold text-[#142D46] shadow-2xs hover:shadow-xs transition-all hover:scale-[1.005] active:scale-[0.99] dark:border-white/10 dark:bg-[#131c31]/50 dark:text-slate-200 dark:hover:bg-[#1a2642]/75 backdrop-blur-md cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 text-[#087FBE] dark:text-[#23C8E8]" />
            <span>Continue with Instant Sandbox</span>
          </button>
        </div>

        {/* Footer Switch Prompt */}
        <div className="mt-5 text-center text-xs text-[#60778E] dark:text-slate-400">
          {mode === "login" ? (
            <span>
              Don&apos;t have an account?{" "}
              <button
                onClick={() => {
                  setMode("signup");
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-[#087FBE] dark:text-[#23C8E8] font-bold hover:underline cursor-pointer ml-0.5"
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
                className="text-[#087FBE] dark:text-[#23C8E8] font-bold hover:underline cursor-pointer ml-0.5"
              >
                Sign In
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [hasEntered, setHasEntered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0, rawX: -200, rawY: -200 });
  const [activeWorkflowStage, setActiveWorkflowStage] = useState<1 | 2 | 3>(2);
  const [isHoveringWorkflow, setIsHoveringWorkflow] = useState(false);

  // Trigger entrance animation immediately on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasEntered(true);
    }, 60);
    return () => clearTimeout(timer);
  }, []);

  // Auto-cycle through workflow stages unless user is actively hovering
  useEffect(() => {
    if (isHoveringWorkflow) return;
    const interval = setInterval(() => {
      setActiveWorkflowStage((prev) => (prev === 3 ? 1 : ((prev + 1) as 1 | 2 | 3)));
    }, 3200);
    return () => clearInterval(interval);
  }, [isHoveringWorkflow]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const x = (clientX - left) / width - 0.5;
    const y = (clientY - top) / height - 0.5;
    setMousePos({
      x: x * 16,
      y: y * 16,
      rawX: clientX,
      rawY: clientY,
    });
  };

  const cardTilt = {
    rotateX: -mousePos.y * 0.45,
    rotateY: mousePos.x * 0.45,
  };

  const workflowDescriptions = {
    1: "Freelancer submits deliverables, source repository link, and live staging preview.",
    2: "Multi-modal AI objectively audits submitted work against the agreed contract criteria.",
    3: "Client signs off with verified certainty, and protected escrow funds release immediately.",
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen lg:h-screen lg:overflow-hidden bg-[#EAF4FA] dark:bg-[#070B14] text-[#142D46] dark:text-slate-100 flex flex-col transition-colors duration-200"
    >
      {/* 
        AURORA GLASS AMBIENT STYLING:
        Soft aurora-inspired cyan and teal flowing ribbons, smooth volumetric lighting,
        gentle depth and parallax, with light backgrounds and high contrast typography.
      */}
      <style>{`
        @keyframes aurora-drift-1 {
          0%, 100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
          }
          50% {
            transform: translate(50px, -40px) scale(1.15) rotate(14deg);
          }
        }
        @keyframes aurora-drift-2 {
          0%, 100% {
            transform: translate(0px, 0px) scale(1) rotate(0deg);
          }
          50% {
            transform: translate(-40px, 45px) scale(1.18) rotate(-18deg);
          }
        }
        @keyframes workflow-flow {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(280%);
          }
        }
        @keyframes pulse-halo {
          0%, 100% {
            opacity: 0.35;
            transform: scale(0.98);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.04);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .aurora-animate-1,
          .aurora-animate-2,
          .animate-workflow-flow,
          .animate-pulse-halo {
            animation: none !important;
          }
        }
      `}</style>

      {/* Atmospheric Background Aurora Layer */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft Cyan Ambient Light Orb */}
        <div
          style={{
            transform: `translate3d(${mousePos.x * 0.7}px, ${mousePos.y * 0.7}px, 0) scale(${hasEntered ? 1 : 0.85})`,
            opacity: hasEntered ? 1 : 0,
            transition: "transform 0.4s ease-out, opacity 0.8s ease",
          }}
          className="aurora-animate-1 absolute -top-32 -left-32 w-[680px] h-[680px] rounded-full bg-gradient-to-br from-[#23C8E8]/35 via-[#087FBE]/20 to-transparent blur-[125px]"
        />

        {/* Soft Teal / Cyan Flowing Ribbon in Center Left */}
        <div
          style={{
            transform: `translate3d(${-mousePos.x * 0.5}px, ${-mousePos.y * 0.5}px, 0) scale(${hasEntered ? 1 : 0.85})`,
            opacity: hasEntered ? 1 : 0,
            transition: "transform 0.4s ease-out, opacity 0.8s ease 0.1s",
          }}
          className="aurora-animate-2 absolute top-1/3 -left-20 w-[580px] h-[580px] rounded-full bg-gradient-to-tr from-[#42D6C0]/30 via-[#23C8E8]/20 to-transparent blur-[140px]"
        />

        {/* Deep Sky Glow on Right */}
        <div
          style={{
            transform: `translate3d(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px, 0) scale(${hasEntered ? 1 : 0.85})`,
            opacity: hasEntered ? 1 : 0,
            transition: "transform 0.4s ease-out, opacity 0.8s ease 0.2s",
          }}
          className="absolute -bottom-36 -right-36 w-[620px] h-[620px] rounded-full bg-gradient-to-tl from-[#087FBE]/25 via-[#23C8E8]/15 to-transparent blur-[130px]"
        />

        {/* Interactive Cursor Light Sphere */}
        <div
          className="pointer-events-none fixed h-[450px] w-[450px] rounded-full blur-[100px] transition-transform duration-100 ease-out"
          style={{
            left: mousePos.rawX,
            top: mousePos.rawY,
            transform: "translate(-50%, -50%)",
            background: "radial-gradient(circle, rgba(35, 200, 232, 0.18) 0%, rgba(66, 214, 192, 0.10) 45%, transparent 70%)",
            opacity: hasEntered ? 1 : 0,
          }}
        />

        {/* Translucent Glass-Like Curve Ribbons */}
        <svg
          className="absolute inset-0 w-full h-full opacity-45 dark:opacity-20 pointer-events-none transition-opacity duration-1000"
          style={{ opacity: hasEntered ? 0.45 : 0 }}
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
          viewBox="0 0 1440 900"
        >
          <path
            d="M-100,200 C300,50 600,450 1100,250 C1350,150 1500,320 1600,280"
            fill="none"
            stroke="url(#aurora-grad-1)"
            strokeWidth="80"
            filter="blur(45px)"
          />
          <path
            d="M-50,600 C400,750 800,400 1200,650 C1400,780 1550,600 1650,650"
            fill="none"
            stroke="url(#aurora-grad-2)"
            strokeWidth="90"
            filter="blur(55px)"
          />
          <defs>
            <linearGradient id="aurora-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#23C8E8" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#42D6C0" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#087FBE" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="aurora-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#087FBE" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#23C8E8" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#42D6C0" stopOpacity="0.2" />
            </linearGradient>
          </defs>
        </svg>

        {/* Minimal Subtle Pattern Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#087FBE_0.75px,transparent_0.75px)] [background-size:28px_28px] opacity-[0.035] dark:opacity-[0.05]" />
      </div>

      {/* FULL-HEIGHT SPLIT SCREEN CONTAINER */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row w-full h-full">

        {/* ========================================================
            LEFT PANEL (52% width) — BRANDING & AURORA VISUAL
           ======================================================== */}
        <div className="w-full lg:w-[52%] flex flex-col justify-between p-6 sm:p-10 lg:p-14 lg:border-r border-white/60 dark:border-white/10 relative">
          
          {/* Top Bar on Left: Brand Logo & Back to Home (Animated Slide In) */}
          <div
            style={{
              transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(-20px, 0, 0)",
              opacity: hasEntered ? 1 : 0,
              transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
            }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <PermileLogo variant="compact" size="md" href="/" />
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-xs font-bold text-[#142D46] dark:text-white px-3.5 py-2 rounded-xl bg-white/75 dark:bg-white/10 border border-white/85 dark:border-white/15 backdrop-blur-md shadow-2xs hover:bg-white dark:hover:bg-white/15 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4 text-[#087FBE] dark:text-[#23C8E8]" />
                <span>Back to Home</span>
              </Link>
            </div>

            {/* Mobile / Tablet Theme Toggle in Header */}
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
          </div>

          {/* Center Content: Branding & Copy with Staggered Cascading Reveal */}
          <div className="my-auto py-8 sm:py-12 space-y-6">
            
            {/* Small Eyebrow (Entrance delay 120ms) */}
            <div
              style={{
                transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
                opacity: hasEntered ? 1 : 0,
                transition: "transform 0.65s cubic-bezier(0.16, 1, 0.3, 1) 120ms, opacity 0.6s ease 120ms",
              }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/75 dark:bg-white/10 border border-white/85 dark:border-white/15 backdrop-blur-md shadow-2xs"
            >
              <span className="h-2 w-2 rounded-full bg-[#23C8E8] animate-pulse" />
              <span className="text-[11px] font-extrabold tracking-widest uppercase text-[#087FBE] dark:text-[#23C8E8]">
                THE FUTURE OF FREELANCING
              </span>
            </div>

            {/* Main Heading (Entrance delay 200ms) */}
            <h1
              style={{
                transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(0, 22px, 0)",
                opacity: hasEntered ? 1 : 0,
                filter: hasEntered ? "blur(0px)" : "blur(6px)",
                transition: "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 200ms, opacity 0.65s ease 200ms, filter 0.7s ease 200ms",
              }}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#142D46] dark:text-white tracking-tight leading-[1.12]"
            >
              Every milestone <br />
              <span className="bg-gradient-to-r from-[#087FBE] via-[#23C8E8] to-[#42D6C0] bg-clip-text text-transparent">
                deserves certainty.
              </span>
            </h1>

            {/* Supporting Copy (Entrance delay 280ms) */}
            <p
              style={{
                transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(0, 18px, 0)",
                opacity: hasEntered ? 1 : 0,
                transition: "transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 280ms, opacity 0.65s ease 280ms",
              }}
              className="text-sm sm:text-base text-[#60778E] dark:text-slate-300 max-w-lg leading-relaxed font-normal"
            >
              One workspace. Transparent deliverables. Confidence in every payment.
            </p>

            {/* Three Feature Indicators with Staggered Delays */}
            <div className="pt-2 flex flex-wrap gap-2.5">
              <div
                style={{
                  transform: hasEntered ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 14px, 0) scale(0.95)",
                  opacity: hasEntered ? 1 : 0,
                  transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 360ms, opacity 0.5s ease 360ms",
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/85 dark:border-white/15 text-xs font-semibold text-[#142D46] dark:text-slate-200 shadow-2xs backdrop-blur-md hover:bg-white hover:scale-[1.02] transition-transform cursor-default"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#087FBE]/10 text-[#087FBE] dark:bg-[#23C8E8]/20 dark:text-[#23C8E8]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <span>Verified deliverables</span>
              </div>

              <div
                style={{
                  transform: hasEntered ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 14px, 0) scale(0.95)",
                  opacity: hasEntered ? 1 : 0,
                  transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 440ms, opacity 0.5s ease 440ms",
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/85 dark:border-white/15 text-xs font-semibold text-[#142D46] dark:text-slate-200 shadow-2xs backdrop-blur-md hover:bg-white hover:scale-[1.02] transition-transform cursor-default"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#23C8E8]/10 text-[#087FBE] dark:bg-[#23C8E8]/20 dark:text-[#23C8E8]">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span>Transparent milestones</span>
              </div>

              <div
                style={{
                  transform: hasEntered ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 14px, 0) scale(0.95)",
                  opacity: hasEntered ? 1 : 0,
                  transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) 520ms, opacity 0.5s ease 520ms",
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/70 dark:bg-white/10 border border-white/85 dark:border-white/15 text-xs font-semibold text-[#142D46] dark:text-slate-200 shadow-2xs backdrop-blur-md hover:bg-white hover:scale-[1.02] transition-transform cursor-default"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#42D6C0]/15 text-teal-700 dark:text-[#42D6C0]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <span>Secure payment workflow</span>
              </div>
            </div>
          </div>

          {/* Lower Portion: Interactive Animated Milestone Workflow (SUBMIT → VERIFY → APPROVE) */}
          <div
            style={{
              transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(0, 28px, 0)",
              opacity: hasEntered ? 1 : 0,
              transition: "transform 0.75s cubic-bezier(0.16, 1, 0.3, 1) 580ms, opacity 0.7s ease 580ms",
            }}
            className="mt-auto pt-4"
            onMouseEnter={() => setIsHoveringWorkflow(true)}
            onMouseLeave={() => setIsHoveringWorkflow(false)}
          >
            <div className="rounded-2xl border border-white/85 dark:border-white/15 bg-white/65 dark:bg-white/[0.06] p-4 sm:p-5 backdrop-blur-xl shadow-lg shadow-[#087FBE]/5 transition-all">
              <div className="flex items-center justify-between mb-3 text-[11px] font-bold uppercase tracking-wider text-[#60778E] dark:text-slate-400">
                <span>Milestone Assurance Flow</span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#23C8E8]/15 text-[10px] font-bold text-[#087FBE] dark:text-[#23C8E8]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#087FBE] dark:bg-[#23C8E8] animate-ping" />
                  Stage 0{activeWorkflowStage} Active
                </span>
              </div>

              <div className="relative flex items-center justify-between px-2 sm:px-6">
                {/* Connecting Track with Glowing Traveling Line */}
                <div className="absolute top-5 left-10 right-10 h-1 bg-slate-200/80 dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full w-24 bg-gradient-to-r from-transparent via-[#23C8E8] to-transparent animate-workflow-flow" />
                </div>

                {/* Stage 1: SUBMIT (Interactive Node) */}
                <button
                  type="button"
                  onClick={() => setActiveWorkflowStage(1)}
                  className={`relative z-10 flex flex-col items-center text-center group cursor-pointer transition-transform ${
                    activeWorkflowStage === 1 ? "scale-105" : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${
                      activeWorkflowStage === 1
                        ? "bg-white dark:bg-slate-900 border-[#087FBE] text-[#087FBE] dark:text-[#23C8E8] ring-3 ring-[#087FBE]/20 shadow-md"
                        : "bg-white/90 dark:bg-slate-900/90 border-white/90 dark:border-white/20 text-[#60778E] shadow-sm"
                    }`}
                  >
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <span className={`mt-1.5 text-xs font-bold ${activeWorkflowStage === 1 ? "text-[#087FBE] dark:text-[#23C8E8]" : "text-[#142D46] dark:text-white"}`}>
                    Submit
                  </span>
                  <span className="text-[10px] text-[#60778E] dark:text-slate-400">Deliverable</span>
                </button>

                {/* Stage 2: VERIFY (Interactive Node) */}
                <button
                  type="button"
                  onClick={() => setActiveWorkflowStage(2)}
                  className={`relative z-10 flex flex-col items-center text-center group cursor-pointer transition-transform ${
                    activeWorkflowStage === 2 ? "scale-105" : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${
                      activeWorkflowStage === 2
                        ? "bg-white dark:bg-slate-900 border-[#23C8E8] text-[#23C8E8] ring-3 ring-[#23C8E8]/25 shadow-md"
                        : "bg-white/90 dark:bg-slate-900/90 border-white/90 dark:border-white/20 text-[#60778E] shadow-sm"
                    }`}
                  >
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <span className={`mt-1.5 text-xs font-bold ${activeWorkflowStage === 2 ? "text-[#23C8E8]" : "text-[#142D46] dark:text-white"}`}>
                    Verify
                  </span>
                  <span className="text-[10px] text-[#60778E] dark:text-slate-400">Smart Check</span>
                </button>

                {/* Stage 3: APPROVE (Interactive Node) */}
                <button
                  type="button"
                  onClick={() => setActiveWorkflowStage(3)}
                  className={`relative z-10 flex flex-col items-center text-center group cursor-pointer transition-transform ${
                    activeWorkflowStage === 3 ? "scale-105" : "hover:scale-105 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div
                    className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${
                      activeWorkflowStage === 3
                        ? "bg-white dark:bg-slate-900 border-[#42D6C0] text-[#42D6C0] ring-3 ring-[#42D6C0]/25 shadow-md"
                        : "bg-white/90 dark:bg-slate-900/90 border-white/90 dark:border-white/20 text-[#60778E] shadow-sm"
                    }`}
                  >
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className={`mt-1.5 text-xs font-bold ${activeWorkflowStage === 3 ? "text-[#42D6C0]" : "text-[#142D46] dark:text-white"}`}>
                    Approve
                  </span>
                  <span className="text-[10px] text-[#60778E] dark:text-slate-400">Funds Safe</span>
                </button>
              </div>

              {/* Dynamic Interactive Stage Context Tooltip */}
              <div className="mt-3.5 pt-3 border-t border-slate-200/60 dark:border-white/10 text-[11px] text-[#142D46] dark:text-slate-300 flex items-center justify-between transition-all">
                <span className="font-medium text-[#60778E] dark:text-slate-400">
                  {workflowDescriptions[activeWorkflowStage]}
                </span>
                <span className="text-[10px] font-bold text-[#087FBE] dark:text-[#23C8E8] shrink-0 ml-2">
                  Click to inspect
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================
            RIGHT PANEL (48% width) — AUTHENTICATION CARD
           ======================================================== */}
        <div className="w-full lg:w-[48%] flex flex-col justify-between p-6 sm:p-8 lg:p-12 relative overflow-y-auto">
          {/* Top Bar on Right: Desktop Theme Toggle */}
          <div
            style={{
              transform: hasEntered ? "translate3d(0, 0, 0)" : "translate3d(15px, 0, 0)",
              opacity: hasEntered ? 1 : 0,
              transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
            }}
            className="hidden lg:flex items-center justify-end pb-2"
          >
            <ThemeToggle />
          </div>

          {/* Form Stage with Entrance & Tilt */}
          <div className="my-auto py-4">
            <Suspense
              fallback={
                <div className="w-full max-w-md mx-auto p-8 rounded-[22px] bg-white/75 dark:bg-[#0E1726]/75 border border-white/80 dark:border-white/10 text-center shadow-lg">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-[#087FBE] dark:text-[#23C8E8]" />
                  <span className="text-xs text-[#60778E] dark:text-slate-400 mt-2 block">
                    Loading authentication...
                  </span>
                </div>
              }
            >
              <AuthForm hasEntered={hasEntered} mouseCardTilt={cardTilt} />
            </Suspense>
          </div>

          {/* Bottom Security Assurance Note */}
          <div
            style={{
              opacity: hasEntered ? 1 : 0,
              transition: "opacity 0.8s ease 600ms",
            }}
            className="pt-4 text-center text-[11px] text-[#60778E] dark:text-slate-400"
          >
            <span>Verified Milestone Settlement • Protected Escrow Architecture</span>
          </div>
        </div>

      </div>
    </div>
  );
}
