"use client";

import { useState } from "react";
import ScrollReveal from "@/components/ScrollReveal";
import MilestoneWheel from "@/components/MilestoneWheel";

export default function MilestoneCalculator() {
  const [budget, setBudget] = useState(50000);
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");

  const symbol = currency === "INR" ? "₹" : "$";
  const rateMultiplier = currency === "INR" ? 1 : 0.012;
  const currentBudget = Math.round(budget * rateMultiplier);

  const milestones = [
    {
      index: 1,
      percent: 25,
      title: "Design & Look",
      desc: "Color schemes, layout sketches, and agreed design previews.",
    },
    {
      index: 2,
      percent: 35,
      title: "Building Main Pages",
      desc: "Working website pages, navigation, and interactive features.",
    },
    {
      index: 3,
      percent: 25,
      title: "Online Payments Setup",
      desc: "Secure checkout so your customers can buy products or pay you.",
    },
    {
      index: 4,
      percent: 15,
      title: "Testing & Going Live",
      desc: "Final checks, fixing any glitches, and officially launching the site.",
    },
  ];

  return (
    <section id="calculator" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 transition-colors duration-500">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <ScrollReveal direction="up" delay={50}>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#172B43] dark:text-[#F4F7FA] tracking-tight">
              See How Your Money Is Protected
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#526B82] dark:text-[#AAB7B5]">
              Never pay 100% upfront to someone you just met. Pay step-by-step as real work gets completed and verified.
            </p>
          </div>
        </ScrollReveal>

        {/* Budget Slider Card */}
        <ScrollReveal direction="up" delay={150}>
          <div className="mt-10 mx-auto max-w-xl rounded-3xl border border-[#172B43]/10 dark:border-white/10 bg-white/85 dark:bg-[#131F33]/85 p-7 shadow-xl dark:shadow-2xl shadow-black/15 dark:shadow-black/50 backdrop-blur-xl transition-colors duration-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#526B82] dark:text-[#AAB7B5]">
                Total Project Budget
              </span>
              <div className="flex rounded-xl border border-[#172B43]/10 dark:border-white/10 bg-slate-100 dark:bg-[#0E1624] p-0.5 text-xs font-bold">
                <button
                  onClick={() => setCurrency("INR")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    currency === "INR"
                      ? "bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] text-white shadow-sm"
                      : "text-[#526B82] hover:text-[#172B43] dark:text-[#AAB7B5] dark:hover:text-[#F2F4F0]"
                  }`}
                >
                  ₹ INR
                </button>
                <button
                  onClick={() => setCurrency("USD")}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    currency === "USD"
                      ? "bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] text-white shadow-sm"
                      : "text-[#526B82] hover:text-[#172B43] dark:text-[#AAB7B5] dark:hover:text-[#F2F4F0]"
                  }`}
                >
                  $ USD
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-[#172B43] dark:text-[#F4F7FA] tabular-nums tracking-tight">
                {symbol}{currentBudget.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-[#526B82] dark:text-[#AAB7B5]">
                split into 4 verified stages
              </span>
            </div>

            <input
              type="range"
              min="20000"
              max="150000"
              step="5000"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="w-full mt-6 h-2 bg-slate-200 dark:bg-[#1B2B3E] rounded-lg appearance-none cursor-pointer accent-[#078FBE] dark:accent-[#58C7E8]"
            />

            <div className="mt-2.5 flex justify-between text-[11px] font-semibold text-[#788DA0] dark:text-[#AAB7B5]/80">
              <span>{symbol}{Math.round(20000 * rateMultiplier).toLocaleString()} (Smaller Website)</span>
              <span>{symbol}{Math.round(150000 * rateMultiplier).toLocaleString()} (Full Online Platform)</span>
            </div>
          </div>
        </ScrollReveal>

        {/* 3D Scroll-Driven Milestone Wheel (WorksWheel transformation) */}
        <div className="mt-12 w-full">
          <MilestoneWheel
            milestones={milestones}
            currentBudget={currentBudget}
            symbol={symbol}
          />
        </div>
      </div>
    </section>
  );
}
