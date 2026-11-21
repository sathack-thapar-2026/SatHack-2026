"use client";

import { useState, useEffect } from "react";
import ScrollReveal from "@/components/ScrollReveal";
import TiltedGridHero from "@/components/TiltedGridHero";

const LIGHT_CARDS = [
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
    alt: "STAGE 05: Invoices & Dispute-Proof Records",
  },
];

const DARK_CARDS = [
  {
    src: "/cards/stage1-dark.svg",
    alt: "STAGE 01: Agree on Stages & Budgets",
  },
  {
    src: "/cards/stage2-dark.svg",
    alt: "STAGE 02: Submit Work with Real Proof",
  },
  {
    src: "/cards/stage3-dark.svg",
    alt: "STAGE 03: Automated Work Verification",
  },
  {
    src: "/cards/stage4-dark.svg",
    alt: "STAGE 04: Approve & Release Payments",
  },
  {
    src: "/cards/stage5-dark.svg",
    alt: "STAGE 05: Invoices & Dispute-Proof Records",
  },
];

export default function WorkflowSection() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkDark();

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const cards = isDark ? DARK_CARDS : LIGHT_CARDS;

  return (
    <section
      id="how-it-works"
      className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 bg-transparent transition-colors duration-500 overflow-hidden border-y border-[#172B43]/10 dark:border-white/[0.06]"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <ScrollReveal direction="up" delay={50}>
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-5xl font-extrabold text-[#172B43] dark:text-[#F4F7FA] tracking-tight">
              Simple Steps to Fair Payments
            </h2>
            <p className="mt-3 text-base text-[#1E3A56] dark:text-[#E2E8F0] max-w-2xl mx-auto leading-relaxed font-medium">
              No stress, no misunderstandings, and no lost money. Watch how work moves from agreed specifications to verified milestone settlements.
            </p>
          </div>
        </ScrollReveal>

        {/* 3D Cylindrical Curved Infinite Animation Strip */}
        <div className="relative w-full h-[460px] sm:h-[520px] md:h-[560px] flex items-center justify-center">
          <TiltedGridHero
            images={cards}
            speed={6.5}
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
