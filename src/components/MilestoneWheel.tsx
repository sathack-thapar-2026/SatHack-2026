"use client";

import * as React from "react";
import { ShieldCheck, ChevronUp, ChevronDown, Sparkles, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MilestoneWheelData {
  index: number;
  percent: number;
  title: string;
  desc: string;
}

export interface MilestoneWheelProps {
  milestones: MilestoneWheelData[];
  currentBudget: number;
  symbol: string;
  className?: string;
}

/* WorksWheel Geometry Tuning */
const CARD_H = 0.38; // card height as fraction of stage height
const CARD_MAX_W = 0.40; // max card width as fraction of stage width
const CARD_RATIO = 1.45; // width / height ratio
const STEP = 46; // degrees between cards on the vertical drum (ample breathing room)
const DRUM = 2.25; // drum radius in card heights
const LENS = 2.8; // perspective distance in card heights
const RING_R = 1.15; // ring radius in card heights
const BOW = 1.82; // arc radius pushing turned cards leftward
const EASE = 0.12; // rAF easing interpolation factor
const SETTLE = 150; // debounce timeout to snap to closest milestone

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = (deg: number) => (deg * Math.PI) / 180;
const bowAt = (drumDeg: number, bow: number) => -bow * (1 - Math.cos(rad(drumDeg)));

/**
 * WorksWheel Transform Matrix:
 * Applies horizontal bow, circular ring orbit terms, and vertical cylindrical drum terms.
 * CRITICAL: rotateX must precede translateZ so cards are pushed OUTWARD along the cylinder radius!
 */
function placeCard(
  ringAngle: number,
  drumDeg: number,
  ringR: number,
  drumR: number,
  bow: number,
  m: number
) {
  // Ring components (orbiting around center when m -> 0)
  const ringX = Math.sin(rad(ringAngle)) * ringR * (1 - m);
  const ringY = -Math.cos(rad(ringAngle)) * (ringR * 0.82) * (1 - m);
  const ringTiltZ = Math.sin(rad(ringAngle)) * 10 * (1 - m);

  // Drum bow sideways displacement
  const bowX = m * bowAt(drumDeg, bow);

  return (
    `translateX(${(ringX + bowX).toFixed(2)}px) ` +
    `translateY(${ringY.toFixed(2)}px) ` +
    `rotateZ(${ringTiltZ.toFixed(2)}deg) ` +
    `rotateX(${(m * drumDeg).toFixed(2)}deg) ` +
    `translateZ(${(m * drumR).toFixed(2)}px)`
  );
}

export default function MilestoneWheel({
  milestones,
  currentBudget,
  symbol,
  className,
}: MilestoneWheelProps) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const wheelRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLElement | null)[]>([]);
  const faceRefs = React.useRef<(HTMLElement | null)[]>([]);
  const labelRef = React.useRef<HTMLDivElement>(null);

  const turn = React.useRef(0);
  const target = React.useRef(0);
  const [active, setActive] = React.useState(0);
  const [stage, setStage] = React.useState({ w: 0, h: 0 });
  const [isReducedMotion, setIsReducedMotion] = React.useState(false);

  const count = milestones.length;
  const last = Math.max(count - 1, 0);

  // Reduced motion detection
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(media.matches);
    const handler = () => setIsReducedMotion(media.matches);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  // ResizeObserver for stage dimensions
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateSize = () => {
      setStage({ w: el.clientWidth, h: el.clientHeight });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Metrics derived from measured stage
  const metrics = React.useMemo(() => {
    const { w, h } = stage;
    const cardW = Math.min(h * CARD_H * CARD_RATIO, w * CARD_MAX_W);
    const cardH = cardW / CARD_RATIO;
    const drumR = cardH * DRUM;
    const ringR = cardH * RING_R;
    const ringScale = count
      ? clamp((((2 * Math.PI * ringR) / count) * 0.78) / (cardW || 1), 0.65, 0.95)
      : 0.82;

    return {
      cardW,
      cardH,
      ringR,
      ringScale,
      drumR,
      bow: cardH * BOW,
      depth: Math.max(cardH * LENS, 650),
    };
  }, [stage, count]);

  // Scroll mapping: sync track scroll position to target turn (0 to count)
  React.useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const handleScroll = () => {
      const rect = track.getBoundingClientRect();
      const trackH = track.offsetHeight;
      const vh = window.innerHeight;
      const scrollable = trackH - vh;
      if (scrollable <= 0) return;

      const offsetTop = 80;
      const currentProgress = -(rect.top - offsetTop);
      const progress = clamp(currentProgress / scrollable, 0, 1);

      // Map progress [0, 1] -> turn [0, 4]
      target.current = progress * (last + 1);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [last]);

  // Smooth scroll jump helper
  const scrollToStage = React.useCallback(
    (stageIndex: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const trackTop = window.scrollY + rect.top - 80;
      const trackH = track.offsetHeight;
      const scrollable = trackH - window.innerHeight;
      if (scrollable <= 0) return;

      const targetTurn = clamp(stageIndex + 1, 0, last + 1);
      const targetY = trackTop + (targetTurn / (last + 1)) * scrollable;
      window.scrollTo({ top: targetY, behavior: "smooth" });
    },
    [last]
  );

  // Wheel animation pass using requestAnimationFrame
  React.useEffect(() => {
    if (!stage.h) return;
    let frame = 0;
    const { ringR, ringScale, drumR, bow } = metrics;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const gap = target.current - turn.current;
      if (Math.abs(gap) < 0.0005) {
        turn.current = target.current;
      } else {
        turn.current += gap * (isReducedMotion ? 1 : EASE);
      }

      const t = turn.current;
      const m = clamp(t, 0, 1); // morph from ring (0) to drum (1)
      const pos = Math.max(0, t - 1); // drum rotation position (0 to 3)

      // Pull the drum back so the front face lands on the picture plane
      if (wheelRef.current) {
        wheelRef.current.style.transform = `translateZ(${-m * drumR}px) rotateX(${(1 - m) * 12}deg)`;
      }

      for (let i = 0; i < count; i++) {
        const d = i - pos;
        const drumDeg = d * STEP;
        const ringAngle = (i / count) * 360;
        const card = cardRefs.current[i];
        const face = faceRefs.current[i];

        if (card) {
          // Transform card with WorksWheel math
          card.style.transform = placeCard(ringAngle, drumDeg, ringR, drumR, bow, m);

          // Visibility & Culling:
          // In drum mode (m > 0.3), cull any card beyond immediate neighbor (|d| > 1.1)
          // This guarantees background cards NEVER bleed or show through!
          let opacity = 1;
          const dist = Math.abs(d);

          if (m > 0.3) {
            if (dist <= 0.35) {
              opacity = 1; // Front active card is 100% visible
            } else if (dist <= 1.1) {
              // Smoothly fade out neighbor as it rotates away
              opacity = lerp(1, 0, (dist - 0.35) / 0.75);
            } else {
              opacity = 0; // Behind or opposite side: completely culled
            }
          }

          card.style.opacity = String(opacity);
          card.style.pointerEvents = dist <= 0.45 ? "auto" : "none";
          // Front card gets top z-index; neighbors step down
          card.style.zIndex = String(Math.max(1, Math.round(100 - dist * 20)));
        }

        if (face) {
          const isFront = m > 0.6 && Math.abs(d) < 0.35;
          const targetScale = isFront ? 1.02 : lerp(ringScale, 0.94, m);
          face.style.transform = `scale(${targetScale})`;
        }
      }

      // Ring center label fades out as drum unfolds
      if (labelRef.current) {
        labelRef.current.style.opacity = String(Math.max(0, 1 - m * 1.6));
      }

      const currentActive = clamp(Math.round(pos), 0, last);
      setActive((prev) => (prev === currentActive ? prev : currentActive));
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [metrics, stage.h, count, last, isReducedMotion]);

  // Pointer drag scrubbing support
  const dragStartY = React.useRef<number | null>(null);
  const settleTimeout = React.useRef<number | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const deltaY = dragStartY.current - e.clientY;
    dragStartY.current = e.clientY;
    window.scrollBy({ top: deltaY * 2.5, behavior: "auto" });
  };

  const onPointerUp = () => {
    dragStartY.current = null;
    if (settleTimeout.current) window.clearTimeout(settleTimeout.current);
    settleTimeout.current = window.setTimeout(() => {
      if (target.current >= 0.5) {
        const nearestStage = clamp(Math.round(target.current) - 1, 0, last);
        scrollToStage(nearestStage);
      }
    }, SETTLE);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      scrollToStage(Math.min(active + 1, last));
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      scrollToStage(Math.max(active - 1, 0));
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* DESKTOP & TABLET: 3D Scroll-Driven Ring-to-Drum Wheel (sm and up) */}
      <div ref={trackRef} className="hidden sm:block relative h-[250vh] lg:h-[270vh]">
        {/* Sticky viewport pinned while scrolling through the milestone sequence */}
        <div className="sticky top-20 h-[calc(100vh-5.5rem)] min-h-[580px] max-h-[760px] flex flex-col justify-between py-2 select-none overflow-hidden">
          
          {/* Top Stage Control Header */}
          <div className="relative z-30 mx-auto w-full max-w-4xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md bg-white/85 dark:bg-[#131B2E]/90 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
            {/* Active Stage Indicator */}
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-[#0070BA] font-mono text-xs font-bold dark:bg-[#0070BA]/20 dark:text-sky-300">
                0{milestones[active]?.index}
              </span>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Active Milestone ({active + 1} of {count})
                </span>
                <div className="text-sm font-bold text-slate-800 dark:text-white leading-tight">
                  {milestones[active]?.title}
                </div>
              </div>
            </div>

            {/* Quick Stage Navigation Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200/70 dark:border-slate-700/70">
              {milestones.map((m, idx) => (
                <button
                  key={m.index}
                  type="button"
                  onClick={() => scrollToStage(idx)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer",
                    active === idx
                      ? "bg-gradient-to-r from-[#004C8F] to-[#0070BA] text-white shadow-sm shadow-blue-500/25 scale-[1.03]"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  )}
                >
                  0{m.index}
                </button>
              ))}
            </div>

            {/* Arrow Steppers */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => scrollToStage(Math.max(active - 1, 0))}
                disabled={active === 0}
                aria-label="Previous milestone"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollToStage(Math.min(active + 1, last))}
                disabled={active === last}
                aria-label="Next milestone"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 3D Wheel Stage */}
          <div
            ref={stageRef}
            tabIndex={0}
            role="region"
            aria-label="Milestone 3D Wheel"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            className="relative flex-1 w-full min-h-[440px] cursor-grab active:cursor-grabbing outline-none overflow-hidden"
            style={{ perspective: `${metrics.depth}px` }}
          >
            {/* Center Hub Label visible only in initial Ring State */}
            <div
              ref={labelRef}
              className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center text-center transition-opacity duration-300"
            >
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[#0070BA] dark:text-sky-300 text-xs font-bold uppercase tracking-wider mb-2">
                <Layers className="h-3.5 w-3.5" />
                <span>4 Protected Milestones</span>
              </div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Scroll to Explore Stages
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[200px] leading-relaxed">
                Release payments step-by-step as real work is verified
              </p>
            </div>

            {/* 3D Wheel Drum Container */}
            <div
              ref={wheelRef}
              className="absolute top-1/2 left-1/2 [transform-style:preserve-3d] transition-transform duration-75"
            >
              {milestones.map((m, idx) => {
                const amount = Math.round((currentBudget * m.percent) / 100);
                const isActiveCard = active === idx;

                return (
                  <div
                    key={m.index}
                    id={`milestone-card-${idx}`}
                    ref={(node) => {
                      cardRefs.current[idx] = node;
                    }}
                    onClick={() => scrollToStage(idx)}
                    className="group absolute [backface-visibility:hidden] cursor-pointer"
                    style={{
                      width: metrics.cardW || 330,
                      height: metrics.cardH || 230,
                      marginLeft: -(metrics.cardW || 330) / 2,
                      marginTop: -(metrics.cardH || 230) / 2,
                    }}
                  >
                    {/* Inner Card Face — SOLID OPAQUE BACKGROUND to ensure zero bleed-through */}
                    <div
                      ref={(node) => {
                        faceRefs.current[idx] = node;
                      }}
                      className={cn(
                        "relative block size-full rounded-2xl border p-5 sm:p-6 transition-all duration-300 flex flex-col justify-between shadow-xl",
                        // Solid background with zero translucency so background cards cannot be seen through
                        "bg-white dark:bg-[#131B2E]",
                        isActiveCard
                          ? "border-[#0070BA] dark:border-sky-400 ring-2 ring-sky-400/30 shadow-2xl shadow-blue-500/20 dark:shadow-sky-500/25"
                          : "border-slate-200 dark:border-slate-800 shadow-slate-200/50 dark:shadow-black/40 hover:border-[#0070BA]/50"
                      )}
                    >
                      {/* Top Row: Milestone Number & Percentage */}
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span
                            className={cn(
                              "flex h-7 w-7 items-center justify-center rounded-xl font-mono text-xs font-bold transition-colors",
                              isActiveCard
                                ? "bg-gradient-to-r from-[#004C8F] to-[#0070BA] text-white shadow-sm"
                                : "bg-blue-50 text-[#0070BA] dark:bg-[#0070BA]/20 dark:text-sky-300"
                            )}
                          >
                            0{m.index}
                          </span>
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-full text-xs font-bold border",
                              isActiveCard
                                ? "bg-sky-500/10 text-[#0070BA] dark:text-sky-300 border-sky-400/30"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-transparent"
                            )}
                          >
                            {m.percent}% of budget
                          </span>
                        </div>

                        {/* Amount */}
                        <div className="mt-3.5 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                          {symbol}
                          {amount.toLocaleString()}
                        </div>

                        {/* Title & Description */}
                        <h4 className="mt-1.5 text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                          {m.title}
                        </h4>
                        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                          {m.desc}
                        </p>
                      </div>

                      {/* Bottom Footer: Verification Assurance */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-[#0070BA] dark:text-sky-400">
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                          <span>Paid safely after review</span>
                        </div>
                        {isActiveCard && (
                          <span className="flex items-center gap-1 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-sky-950/60 dark:text-sky-300">
                            <Sparkles className="h-2.5 w-2.5" /> Front
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Progress Bar & Scroll Cue */}
          <div className="relative z-30 mx-auto w-full max-w-xl px-4 flex flex-col items-center gap-2">
            {/* 4-Step Milestone Progress Bar */}
            <div className="w-full flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/70 p-1 rounded-full backdrop-blur-sm">
              {milestones.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1.5 flex-1 rounded-full transition-all duration-300",
                    i <= active
                      ? "bg-gradient-to-r from-[#004C8F] to-[#0070BA] dark:from-sky-500 dark:to-cyan-400 shadow-sm"
                      : "bg-slate-300/60 dark:bg-slate-700/60"
                  )}
                />
              ))}
            </div>

            <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Scroll down to advance milestones • Use arrows or click stages
            </span>
          </div>
        </div>
      </div>

      {/* MOBILE: Simplified Swipeable Carousel (screens below sm) */}
      <div className="sm:hidden mt-8 px-2">
        {/* Mobile Navigation Tabs */}
        <div className="flex rounded-xl border border-slate-200/90 bg-white p-1 text-xs font-bold dark:border-slate-800 dark:bg-[#131B2E] shadow-sm mb-4">
          {milestones.map((m, idx) => (
            <button
              key={m.index}
              type="button"
              onClick={() => setActive(idx)}
              className={cn(
                "flex-1 py-1.5 text-center rounded-lg transition-colors cursor-pointer",
                active === idx
                  ? "bg-gradient-to-r from-[#004C8F] to-[#0070BA] text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              )}
            >
              Stage 0{m.index}
            </button>
          ))}
        </div>

        {/* Active Mobile Milestone Card */}
        {milestones[active] && (() => {
          const m = milestones[active];
          const amount = Math.round((currentBudget * m.percent) / 100);
          return (
            <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-[#131B2E] dark:shadow-none">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-[#0070BA] font-mono dark:bg-[#0070BA]/20 dark:text-sky-300">
                  0{m.index}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-[#0070BA] border border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40">
                  {m.percent}% of budget
                </span>
              </div>

              <div className="mt-4 text-3xl font-black text-slate-900 dark:text-white tabular-nums tracking-tight">
                {symbol}
                {amount.toLocaleString()}
              </div>

              <h4 className="mt-2 text-base font-bold text-slate-800 dark:text-slate-100">
                {m.title}
              </h4>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {m.desc}
              </p>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[#0070BA] dark:text-sky-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Paid safely after review</span>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActive((prev) => Math.max(prev - 1, 0))}
                    disabled={active === 0}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive((prev) => Math.min(prev + 1, last))}
                    disabled={active === last}
                    className="p-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-30"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
