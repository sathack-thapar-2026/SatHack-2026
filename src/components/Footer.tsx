import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import PayZorrLogo from "@/components/PayZorrLogo";

export default function Footer() {
  return (
    <footer className="border-t border-[#172B43]/10 dark:border-white/[0.08] bg-white/90 dark:bg-[#0A101A]/95 backdrop-blur-xl text-[#334D68] dark:text-[#CBD5E1] text-xs py-14 transition-colors duration-500">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <PayZorrLogo variant="compact" size="sm" href="/" />
            <span className="text-xs font-semibold text-[#1E3A56] dark:text-[#CBD5E1] hidden sm:inline">
              • Payments Made Effortless
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-[#1E3A56] dark:text-[#CBD5E1] font-semibold">
            <Link href="/#how-it-works" className="hover:text-[#0284C7] dark:hover:text-[#58C7E8] transition-colors">
              How It Works
            </Link>
            <Link href="/#calculator" className="hover:text-[#0284C7] dark:hover:text-[#58C7E8] transition-colors">
              Payment Calculator
            </Link>
            <Link href="/#benefits" className="hover:text-[#0284C7] dark:hover:text-[#58C7E8] transition-colors">
              Who It's For
            </Link>
            <Link href="/dashboard" className="text-[#0284C7] dark:text-[#58C7E8] font-bold hover:underline">
              Live Dashboard
            </Link>
            <Link href="/auth?mode=login" className="hover:text-[#0284C7] dark:hover:text-[#58C7E8] transition-colors">
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-[#172B43]/10 dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#475569] dark:text-[#94A3B8]">
          <div>
            © 2026 PayZorr. Payments Made Effortless. Work completed. Progress verified.
          </div>
          <div className="flex items-center gap-2 text-[#1E3A56] dark:text-[#CBD5E1] font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-[#0284C7] dark:text-[#58C7E8]" />
            <span>Verified Milestone Protection</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
