"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import PayZorrLogo from "@/components/PayZorrLogo";

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
    <header className="sticky top-0 z-50 w-full bg-white/85 dark:bg-[#070B14]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-white/10 transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        {/* Brand Logo */}
        <PayZorrLogo variant="compact" size="md" href="/" />

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
                    ? "font-bold text-[#0070BA] dark:text-sky-400"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white font-medium"
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
            className="hidden sm:inline-flex text-sm font-semibold text-slate-700 hover:text-slate-950 px-3 py-2 rounded-xl hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth?mode=signup"
            className="btn-gradient-glow inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#004C8F] via-[#0070BA] via-[#00A3E0] to-[#004C8F] px-4 py-2 text-sm font-bold text-white shadow-md shadow-blue-600/25 hover:shadow-blue-600/35 hover:scale-[1.02] active:scale-[0.98]"
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
        <div className="md:hidden border-b border-slate-200 bg-white/95 px-4 pt-3 pb-6 backdrop-blur-xl dark:border-slate-800 dark:bg-[#0B0F19]/95">
          <nav className="flex flex-col gap-2 text-base font-semibold">
            {NAV_LINKS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`py-2 px-3 transition-all duration-200 ${
                    isActive
                      ? "font-black bg-gradient-to-r from-slate-950 via-[#004B87] to-[#0070BA] bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(56,189,248,0.75)] dark:bg-gradient-to-r dark:from-white dark:via-sky-100 dark:to-sky-300 dark:drop-shadow-[0_0_10px_rgba(255,255,255,1)] dark:drop-shadow-[0_0_20px_rgba(56,189,248,0.95)]"
                      : "text-slate-700 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
            <Link
              href="/auth?mode=login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-200"
            >
              Sign In
            </Link>
            <Link
              href="/auth?mode=signup"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 rounded-xl bg-emerald-500 text-sm font-bold text-white shadow-md shadow-emerald-500/20"
            >
              Create Account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
