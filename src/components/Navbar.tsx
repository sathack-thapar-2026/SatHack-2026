"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import PermileLogo from "@/components/PermileLogo";

const NAV_LINKS = [
  { label: "How It Works", href: "/#how-it-works", id: "how-it-works" },
  { label: "Payment Calculator", href: "/#calculator", id: "calculator" },
  { label: "Who It's For", href: "/#benefits", id: "benefits" },
  { label: "Live Dashboard", href: "/dashboard", id: "dashboard" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const sectionIds = ["how-it-works", "calculator", "benefits"];
          const triggerPoint = window.innerHeight * 0.35;

          let currentActive: string | null = null;
          for (const id of sectionIds) {
            const el = document.getElementById(id);
            if (el) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= triggerPoint && rect.bottom >= triggerPoint) {
                currentActive = id;
                break;
              }
            }
          }

          if (window.scrollY < 120) {
            currentActive = null;
          } else if (
            window.innerHeight + window.scrollY >=
            document.documentElement.scrollHeight - 80
          ) {
            currentActive = "benefits";
          }

          setActiveSection(currentActive);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#EAF4FA]/85 dark:bg-[#101827]/85 backdrop-blur-xl border-b border-[#172B43]/10 dark:border-white/[0.08] transition-colors duration-500">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand Logo */}
        <PermileLogo variant="compact" size="md" href="/" />

        {/* Clean Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-sm">
          {NAV_LINKS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`transition-colors duration-200 ${
                  isActive
                    ? "font-bold text-[#078FBE] dark:text-[#58C7E8] drop-shadow-sm dark:drop-shadow-[0_0_12px_rgba(88,199,232,0.35)]"
                    : "text-[#526B82] hover:text-[#172B43] dark:text-[#AAB7B5] dark:hover:text-[#F2F4F0] font-medium"
                }`}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Actions & Theme Switch */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <Link
            href="/auth?mode=login"
            className="hidden sm:inline-flex text-sm font-semibold text-[#526B82] hover:text-[#172B43] dark:text-[#AAB7B5] dark:hover:text-[#F2F4F0] px-3.5 py-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth?mode=signup"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] px-4 py-2 text-sm font-bold text-white shadow-md shadow-cyan-950/40 hover:shadow-cyan-500/25 border border-cyan-400/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span>Get Started</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex items-center justify-center rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#172B43]/10 dark:border-white/10 bg-[#EAF4FA]/95 dark:bg-[#101827]/95 px-4 pt-3 pb-6 backdrop-blur-2xl transition-colors duration-300">
          <nav className="flex flex-col gap-2 text-base font-semibold">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`py-2 px-3 transition-all duration-200 rounded-lg ${
                    isActive
                      ? "text-[#078FBE] dark:text-[#58C7E8] font-bold bg-[#078FBE]/10 dark:bg-white/[0.06] drop-shadow-sm dark:drop-shadow-[0_0_10px_rgba(88,199,232,0.4)]"
                      : "text-[#526B82] hover:text-[#172B43] dark:text-[#AAB7B5] dark:hover:text-[#F2F4F0] font-medium"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 pt-3 border-t border-[#172B43]/10 dark:border-white/10 flex flex-col gap-2">
            <Link
              href="/auth?mode=login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl border border-[#172B43]/10 dark:border-white/10 text-sm font-semibold text-[#172B43] dark:text-[#F2F4F0] bg-white/60 dark:bg-white/[0.04] hover:bg-white/90 dark:hover:bg-white/[0.08]"
            >
              Sign In
            </Link>
            <Link
              href="/auth?mode=signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] text-sm font-bold text-white shadow-md shadow-cyan-950/40 border border-cyan-400/20"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
