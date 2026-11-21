"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface WordItem {
  text: string;
  isItalic?: boolean;
  delayMs: number;
}

export default function CinematicHeroText() {
  const [hasEntered, setHasEntered] = React.useState(false);
  const [isReduced, setIsReduced] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReduced(media.matches);

    // Staggered trigger: landscape begins rising, then hero text unfolds smoothly
    const timer = setTimeout(() => {
      setHasEntered(true);
    }, 450);

    return () => clearTimeout(timer);
  }, []);

  // Words breakdown for cinematic word-by-word reveal (Meadow Rise inspired)
  const line1: WordItem[] = [
    { text: "Work", delayMs: 450 },
    { text: "completed.", delayMs: 580 },
  ];

  const line2: WordItem[] = [
    { text: "Progress", delayMs: 720 },
    { text: "verified.", delayMs: 860 },
  ];

  const line3: WordItem[] = [
    { text: "Payments", isItalic: true, delayMs: 1040 },
    { text: "made", isItalic: true, delayMs: 1140 },
    { text: "with", isItalic: true, delayMs: 1240 },
    { text: "confidence.", isItalic: true, delayMs: 1340 },
  ];

  const renderWord = (w: WordItem, key: string) => {
    const isReady = hasEntered || isReduced;

    return (
      <span
        key={key}
        className="inline-block overflow-hidden align-bottom mr-[0.22em] pb-1.5"
        style={{ perspective: "1000px" }}
      >
        <span
          className={`inline-block transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            w.isItalic
              ? "font-serif italic font-normal tracking-wide bg-gradient-to-r from-[#0369A1] via-[#0284C7] to-[#0F766E] dark:from-[#58C7E8] dark:via-[#8EE3F5] dark:to-[#B6F5EE] bg-clip-text text-transparent drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] dark:drop-shadow-[0_0_24px_rgba(88,199,232,0.45)]"
              : "text-[#0F1D2E] dark:text-[#F8FAFC] font-black tracking-tight drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)] dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
          }`}
          style={{
            transform: isReady
              ? "translate3d(0, 0, 0) rotate(0deg)"
              : "translate3d(0, 115%, 0) rotate(2.5deg)",
            opacity: isReady ? 1 : 0,
            filter: isReady ? "blur(0px)" : "blur(8px)",
            transitionDelay: isReduced ? "0ms" : `${w.delayMs}ms`,
          }}
        >
          {w.text}
        </span>
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-5xl text-center select-none">
      {/* Eyebrow Pill */}
      <div
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-[#131F33]/90 border border-[#0284C7]/30 dark:border-[#58C7E8]/30 backdrop-blur-md shadow-md shadow-cyan-900/5 dark:shadow-black/40 mb-6 transition-all duration-700"
        style={{
          transform: hasEntered || isReduced ? "translate3d(0, 0, 0)" : "translate3d(0, 16px, 0)",
          opacity: hasEntered || isReduced ? 1 : 0,
          transitionDelay: isReduced ? "0ms" : "300ms",
        }}
      >
        <span className="h-2 w-2 rounded-full bg-[#0284C7] dark:bg-[#58C7E8] animate-pulse" />
        <span className="text-[11px] font-extrabold tracking-widest uppercase text-[#0284C7] dark:text-[#58C7E8]">
          PAYZORR VERIFIED ESCROW
        </span>
      </div>

      {/* Main Heading — Word by Word Cinematic Reveal */}
      <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.12]">
        {/* Line 1 */}
        <div className="block">
          {line1.map((w, i) => renderWord(w, `l1-${i}`))}
        </div>

        {/* Line 2 */}
        <div className="block">
          {line2.map((w, i) => renderWord(w, `l2-${i}`))}
        </div>

        {/* Line 3 — Serif Italic Accent Phrase */}
        <div className="block mt-1 sm:mt-2">
          {line3.map((w, i) => renderWord(w, `l3-${i}`))}
        </div>
      </h1>

      {/* Supporting Subtitle Paragraph — Solid high-contrast text with background protection */}
      <div
        className="mt-6 text-base sm:text-lg text-[#172B43] dark:text-[#E2E8F0] font-semibold sm:font-medium max-w-2xl mx-auto leading-relaxed drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: hasEntered || isReduced ? "translate3d(0, 0, 0)" : "translate3d(0, 20px, 0)",
          opacity: hasEntered || isReduced ? 1 : 0,
          filter: hasEntered || isReduced ? "blur(0px)" : "blur(4px)",
          transitionDelay: isReduced ? "0ms" : "1450ms",
        }}
      >
        <p>
          PayZorr lets you pay freelancers in safe stages. Before any money moves,
          AI checks that the work matches what was promised—so clients never get
          burned, and freelancers always get paid on time.
        </p>
      </div>

      {/* CTA Buttons with Spring-like Settle */}
      <div
        className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          transform: hasEntered || isReduced ? "translate3d(0, 0, 0)" : "translate3d(0, 24px, 0)",
          opacity: hasEntered || isReduced ? 1 : 0,
          transitionDelay: isReduced ? "0ms" : "1650ms",
        }}
      >
        <Link
          href="/auth?mode=signup"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0E7490] via-[#0284C7] to-[#087FBE] px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-900/20 hover:shadow-cyan-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-cyan-400/20"
        >
          <span>Start for Free</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="#how-it-works"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-[#172B43]/20 dark:border-white/15 bg-white/95 dark:bg-[#131F33]/90 hover:bg-white dark:hover:bg-[#1E2D44] hover:border-[#172B43]/30 dark:hover:border-white/30 px-7 py-3.5 text-sm font-semibold text-[#172B43] dark:text-[#F4F7FA] shadow-md shadow-slate-900/5 dark:shadow-black/40 backdrop-blur-md transition-all cursor-pointer"
        >
          <span>See How It Works</span>
        </Link>
      </div>
    </div>
  );
}
