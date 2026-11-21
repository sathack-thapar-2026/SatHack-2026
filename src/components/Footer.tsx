import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/60 dark:border-slate-800/40 bg-slate-50/80 dark:bg-[#06080F]/80 backdrop-blur-md text-slate-500 text-xs py-14 transition-colors">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            Safe Milestone Payments
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-600 dark:text-slate-400 font-medium">
            <Link href="/#how-it-works" className="hover:text-[#0070BA] dark:hover:text-white">
              How It Works
            </Link>
            <Link href="/#calculator" className="hover:text-[#0070BA] dark:hover:text-white">
              Payment Calculator
            </Link>
            <Link href="/#benefits" className="hover:text-[#0070BA] dark:hover:text-white">
              Who It's For
            </Link>
            <Link href="/dashboard" className="text-[#0070BA] dark:text-sky-400 font-bold hover:underline">
              Live Dashboard
            </Link>
            <Link href="/auth?mode=login" className="hover:text-[#0070BA] dark:hover:text-white">
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-400">
          <div>
            © 2026. Work completed. Progress verified. Payments made with confidence.
          </div>
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0070BA] dark:text-sky-400" />
            <span>Verified Milestone Protection</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
