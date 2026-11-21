import Link from "next/link";
import Navbar from "@/components/Navbar";
import WorkflowSection from "@/components/WorkflowSection";
import MilestoneCalculator from "@/components/MilestoneCalculator";
import WhoItsFor from "@/components/WhoItsFor";
import Footer from "@/components/Footer";
import HillsLandscapeBackground from "@/components/HillsLandscapeBackground";
import CinematicHeroText from "@/components/CinematicHeroText";
import ScrollReveal from "@/components/ScrollReveal";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-transparent text-[var(--text-primary)] flex flex-col transition-colors duration-500 selection:bg-cyan-500/25 selection:text-cyan-600 dark:selection:text-cyan-300">
      {/* Cinematic Ethereal Void with Glowing Flowing Lines & Ambient Lighting */}
      <HillsLandscapeBackground />

      <Navbar />

      <main className="relative z-10 flex-1">
        {/* HERO SECTION — Cinematic Word-by-Word Reveal */}
        <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <CinematicHeroText />
        </section>

        {/* 1. THREE SIMPLE STEPS (HOW IT WORKS) */}
        <WorkflowSection />

        {/* 2. INTERACTIVE MILESTONE CALCULATOR (3D WORKSWHEEL) */}
        <MilestoneCalculator />

        {/* 3. FOR CLIENTS & FREELANCERS */}
        <WhoItsFor />

        {/* FRIENDLY CLOSING CTA — Translucent Glass Surface */}
        <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 backdrop-blur-[2px]">
          <ScrollReveal direction="up" delay={100}>
            <div className="mx-auto max-w-3xl text-center rounded-3xl border border-[#172B43]/10 dark:border-white/10 bg-white/80 dark:bg-[#131F33]/85 p-8 sm:p-12 shadow-xl dark:shadow-2xl shadow-black/20 dark:shadow-black/50 backdrop-blur-xl">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172B43] dark:text-[#F4F7FA] tracking-tight">
                Ready to Protect Your Next Project?
              </h2>
              <p className="mt-3 text-base text-[#526B82] dark:text-[#AAB7B5] max-w-xl mx-auto leading-relaxed">
                Join clients and freelancers who build and get paid with total confidence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/auth?mode=signup"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-cyan-400/20"
                >
                  <span>Create Free Account</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/auth?mode=login"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[#172B43]/12 dark:border-white/10 bg-white/80 dark:bg-[#172338]/80 hover:bg-white dark:hover:bg-[#1E2D44] hover:border-[#172B43]/20 dark:hover:border-white/20 px-7 py-3.5 text-sm font-semibold text-[#172B43] dark:text-[#F4F7FA] shadow-md dark:shadow-lg dark:shadow-black/30 backdrop-blur-md transition-all cursor-pointer"
                >
                  <span>Sign In to Workspace</span>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
