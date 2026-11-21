"use client";

import * as React from "react";
import WebThreads from "./WebThreads";

interface Star {
  x: number;
  y: number;
  r: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
}

type RGB = [number, number, number];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpRGB(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

function rgbStr(c: RGB, alpha = 1): string {
  return alpha >= 1
    ? `rgb(${c[0]}, ${c[1]}, ${c[2]})`
    : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha.toFixed(3)})`;
}

// Cubic ease-out
const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export default function HillsLandscapeBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  // Parallax pointer target & current values
  const mouse = React.useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Animation timing
  const startTime = React.useRef<number | null>(null);
  const [isReduced, setIsReduced] = React.useState(false);

  // Current theme mode: 0.0 = Light, 1.0 = Dark
  const [isDark, setIsDark] = React.useState(false);
  const themeProgress = React.useRef(0); // smoothed float 0..1
  const targetTheme = React.useRef(0);

  // Phase entrance fade for webstrips
  const [webstripsVisible, setWebstripsVisible] = React.useState(false);

  // Sync theme changes with DOM
  React.useEffect(() => {
    const checkDark = () => {
      const darkActive = document.documentElement.classList.contains("dark");
      setIsDark(darkActive);
      targetTheme.current = darkActive ? 1 : 0;
    };

    checkDark();
    themeProgress.current = document.documentElement.classList.contains("dark") ? 1 : 0;

    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Check prefers-reduced-motion
  React.useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReduced(q.matches);
    const handler = () => setIsReduced(q.matches);
    q.addEventListener("change", handler);
    return () => q.removeEventListener("change", handler);
  }, []);

  // Pointer move handler for subtle parallax
  React.useEffect(() => {
    const onPointerMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      mouse.current.targetX = nx;
      mouse.current.targetY = ny;
    };

    window.addEventListener("mousemove", onPointerMove, { passive: true });
    return () => window.removeEventListener("mousemove", onPointerMove);
  }, []);

  // Reveal webstrips smoothly shortly after mount
  React.useEffect(() => {
    if (isReduced) {
      setWebstripsVisible(true);
      return;
    }
    const timer = setTimeout(() => {
      setWebstripsVisible(true);
    }, 450);
    return () => clearTimeout(timer);
  }, [isReduced]);

  // Main Canvas Render Loop (Ethereal Atmospheric Void)
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame = 0;
    let isVisible = true;

    const onVisibilityChange = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    let width = 0;
    let height = 0;

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    // Fixed stars (twinkling in dark mode void)
    const starCount = 95;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.85,
        r: Math.random() * 1.1 + 0.6,
        baseAlpha: Math.random() * 0.5 + 0.25,
        twinkleSpeed: Math.random() * 1.5 + 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // ========================================================
    // ETHEREAL VOID PALETTES (RGB)
    // Pure atmospheric void in Light Mode vs Midnight Void in Dark Mode
    // ========================================================
    const skyLightTop: RGB = [240, 247, 253]; // #F0F7FD Ethereal crystalline daylight void
    const skyDarkTop: RGB = [11, 16, 29];    // #0B101D Deep midnight void
    const skyLightMid: RGB = [228, 242, 250]; // #E4F2FA
    const skyDarkMid: RGB = [16, 24, 39];    // #101827
    const skyLightBot: RGB = [215, 235, 247]; // #D7EBF7 Soft airy horizon
    const skyDarkBot: RGB = [21, 36, 56];    // #152438 Ambient base

    const render = (time: number) => {
      if (!isVisible) {
        animFrame = requestAnimationFrame(render);
        return;
      }

      if (startTime.current === null) {
        startTime.current = time;
      }

      const elapsed = isReduced ? 10 : (time - startTime.current) / 1000;

      // Smooth pointer interpolation
      mouse.current.x += (mouse.current.targetX - mouse.current.x) * 0.05;
      mouse.current.y += (mouse.current.targetY - mouse.current.y) * 0.05;

      const px = mouse.current.x;
      const py = mouse.current.y;

      // Smooth theme transitions (~600ms)
      themeProgress.current += (targetTheme.current - themeProgress.current) * 0.08;
      const t = themeProgress.current;

      ctx.clearRect(0, 0, width, height);

      // ========================================================
      // 1. ATMOSPHERIC VOID GRADIENT
      // ========================================================
      const skyProgress = easeOutCubic(elapsed / 0.8);
      ctx.globalAlpha = skyProgress;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, rgbStr(lerpRGB(skyLightTop, skyDarkTop, t)));
      skyGrad.addColorStop(0.45, rgbStr(lerpRGB(skyLightMid, skyDarkMid, t)));
      skyGrad.addColorStop(0.80, rgbStr(lerpRGB(skyLightBot, skyDarkBot, t)));
      skyGrad.addColorStop(1, rgbStr(lerpRGB([205, 228, 244], [14, 26, 38], t)));

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // ========================================================
      // 2. CELESTIAL / ETHEREAL AMBIENT LIGHTING
      // ========================================================
      const glowGrad = ctx.createRadialGradient(
        width * 0.5 + px * 35,
        height * 0.48 + py * 20,
        30,
        width * 0.5 + px * 35,
        height * 0.48 + py * 20,
        width * 0.75
      );

      // Diffused pearlescent daylight glow in Light Mode vs soft cyan glow in Dark Mode
      const glowR = Math.round(lerp(255, 88, t));
      const glowG = Math.round(lerp(255, 199, t));
      const glowB = Math.round(lerp(255, 232, t));
      const glowA = lerp(0.40, 0.10, t);

      glowGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA})`);
      glowGrad.addColorStop(0.35, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA * 0.50})`);
      glowGrad.addColorStop(0.70, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA * 0.15})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // ========================================================
      // 3. SCATTERED TWINKLING STARS (Dark Mode Void Only)
      // ========================================================
      if (t > 0.02 && elapsed > 0.3) {
        const starIntro = easeOutCubic((elapsed - 0.3) / 1.0);
        for (const star of stars) {
          const starX = star.x * width + px * 8;
          const starY = star.y * height + py * 6;
          const twinkle =
            0.65 + 0.35 * Math.sin((time / 1000) * star.twinkleSpeed + star.phase);
          const alpha = star.baseAlpha * twinkle * starIntro * t;

          if (alpha > 0.01) {
            ctx.fillStyle = `rgba(240, 246, 255, ${alpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(starX, starY, star.r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      ctx.globalAlpha = 1;
      animFrame = requestAnimationFrame(render);
    };

    animFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isReduced]);

  // Ethereal flowing webstrips colors:
  // Dark Mode: Electric cyan, glowing sky blue, teal
  // Light Mode: Luminous azure, cerulean, turquoise
  const webstripColors = isDark
    ? ["#0070BA", "#009CDE", "#38BDF8", "#58C7E8", "#00E599"]
    : ["#0077B6", "#0096C7", "#00B4D8", "#38BDF8", "#06B6D4"];

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 h-screen w-screen overflow-hidden pointer-events-none select-none"
    >
      {/* Canvas Layer: Pure Atmospheric Ethereal Void + Celestial Lighting + Twinkling Stars */}
      <canvas ref={canvasRef} className="block size-full" />

      {/* Webstrips Layer: The Ethereal Flowing Interconnected Lines */}
      <div
        className="absolute inset-0 size-full pointer-events-none transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          opacity: webstripsVisible ? (isDark ? 0.78 : 0.62) : 0,
        }}
      >
        <WebThreads
          colors={webstripColors}
          coreColor="#FFFFFF"
          backgroundColor="transparent"
          lightMode={false} // Luminous additive blooming in both themes for true ethereal glow
          threadCount={6}
          speed={0.004} // Slowed movement by 90% (from 0.038 to 0.004) for an ultra-subtle, peaceful ambient drift
          frequency={3.8}
          spread={0.28}
          position={0.48}
          glow={isDark ? 0.0195 : 0.0165} // Calibrated glow to prevent text interference
          brightness={isDark ? 0.78 : 0.70} // Restrained brightness for pristine text readability
          thickness={0.95}
          fade={0.02}
          shimmer={false} // Clean, steady lines without rapid shimmer vibrations
          mouseInteraction={true}
          mouseStrength={0.15}
          pulseOnClick={false}
          dpr={1}
        />
      </div>

      {/* Soft Vignette to Enhance Cinematic Void Depth */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(7,143,190,0.05)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(11,16,29,0.50)_100%)] transition-colors duration-500" />
    </div>
  );
}
