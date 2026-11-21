"use client";

import ScrollReveal from "@/components/ScrollReveal";
import TiltedGridHero from "@/components/TiltedGridHero";

const WORKFLOW_CARDS = [
  {
    src: "/cards/stage1.svg",
    alt: "STAGE 01: Agree on Stages & Budgets",
  },
  {
    src: "/cards/stage2.svg",
    alt: "STAGE 02: Submit Work with Real Proof",
  },
  {
    src: "/cards/stage3.svg",
    alt: "STAGE 03: Automated Work Verification",
  },
  {
    src: "/cards/stage4.svg",
    alt: "STAGE 04: Approve & Release Payments",
  },
  {
    src: "/cards/stage5.svg",
    alt: "STAGE 05: Invoices & Dispute-Proof Ledger",
  },
];

export default function WorkflowSection() {
  return (
    <section
      id="how-it-works"
      className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50/70 dark:bg-white/[0.02] backdrop-blur-[2px] transition-colors overflow-hidden border-y border-slate-200/60 dark:border-white/5"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <ScrollReveal direction="up" delay={50}>
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Simple Steps to Fair Payments
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              No stress, no misunderstandings, and no lost money. Watch how work moves from agreed specifications to verified milestone settlements.
            </p>
          </div>
        </ScrollReveal>

        {/* 3D Cylindrical Curved Infinite Animation Strip */}
        <div className="relative w-full h-[460px] sm:h-[520px] md:h-[560px] flex items-center justify-center">
          <TiltedGridHero
            images={WORKFLOW_CARDS}
            speed={4.5}
            tileHeight={76}
            aspectRatio={16 / 10}
            gap={8}
            axis={50}
            curve={46}
            fade={12}
            className="w-full h-full"
          />
        </div>
      </div>
    </section>
  );
}
