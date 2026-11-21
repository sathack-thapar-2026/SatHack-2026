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

interface MistPuff {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
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

  // Phase 3 webstrip entrance fade
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

  // Phase 3: Reveal webstrips after horizon & initial hills rise (approx 1.2s)
  React.useEffect(() => {
    if (isReduced) {
      setWebstripsVisible(true);
      return;
    }
    const timer = setTimeout(() => {
      setWebstripsVisible(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [isReduced]);

  // Main Canvas Render Loop
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

    // Fixed stars (twinkling in dark mode)
    const starCount = 85;
    const stars: Star[] = [];
    for (let i = 0; i < starCount; i++) {
      stars.push({
        x: Math.random(),
        y: Math.random() * 0.55,
        r: Math.random() * 1.1 + 0.6,
        baseAlpha: Math.random() * 0.5 + 0.25,
        twinkleSpeed: Math.random() * 1.5 + 0.8,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Drifting atmospheric mist puffs
    const mistPuffs: MistPuff[] = [
      { x: -0.2, y: 0.60, w: 0.85, h: 0.16, speed: 0.007, alpha: 0.22 },
      { x: 0.35, y: 0.66, w: 0.95, h: 0.18, speed: -0.005, alpha: 0.25 },
      { x: 0.1, y: 0.74, w: 1.05, h: 0.22, speed: 0.006, alpha: 0.28 },
      { x: -0.3, y: 0.80, w: 1.15, h: 0.24, speed: -0.008, alpha: 0.30 },
      { x: 0.25, y: 0.86, w: 1.25, h: 0.25, speed: 0.005, alpha: 0.32 },
    ];

    // ========================================================
    // THEME PALETTES (RGB)
    // Ethereal Light Mode (Luminous Morning) vs Dark Mode (Midnight)
    // ========================================================
    // Sky
    const skyLightTop: RGB = [240, 247, 253]; // #F0F7FD Ethereal crystalline daylight
    const skyDarkTop: RGB = [11, 16, 29];    // #0B101D Deep midnight
    const skyLightMid: RGB = [226, 240, 250]; // #E2F0FA Soft sky
    const skyDarkMid: RGB = [16, 24, 39];    // #101827 Navy
    const skyLightBot: RGB = [210, 233, 246]; // #D2E9F6 Luminous horizon
    const skyDarkBot: RGB = [21, 36, 56];    // #152438 Atmospheric base

    // Horizon Line
    const horizonLight: RGB = [88, 182, 216]; // Soft glowing cyan-sky
    const horizonDark: RGB = [88, 199, 232];  // Electric cyan

    // Hills 1 (Distant Ridge — Ethereal Pastel Sage / Alpine Mint)
    const h1LightTop: RGB = [190, 218, 212]; // Crest
    const h1DarkTop: RGB = [31, 56, 69];     // Distant blue-green
    const h1LightMid: RGB = [172, 204, 196];
    const h1DarkMid: RGB = [25, 47, 59];
    const h1LightBot: RGB = [154, 188, 180]; // Valley base
    const h1DarkBot: RGB = [18, 33, 41];

    // Hills 2 (Middle Ridge — Soft Dreamy Sage)
    const h2LightTop: RGB = [148, 186, 175]; // Crest
    const h2DarkTop: RGB = [26, 54, 44];     // Forest green
    const h2LightMid: RGB = [128, 168, 156];
    const h2DarkMid: RGB = [21, 44, 36];
    const h2LightBot: RGB = [110, 150, 138];
    const h2DarkBot: RGB = [14, 29, 24];

    // Hills 3 (Near Foreground Ridge — Frosted Alpine Jade)
    const h3LightTop: RGB = [104, 152, 138]; // Crest
    const h3DarkTop: RGB = [19, 40, 32];     // Deep forest
    const h3LightMid: RGB = [85, 130, 118];
    const h3DarkMid: RGB = [15, 32, 25];
    const h3LightBot: RGB = [68, 112, 100];
    const h3DarkBot: RGB = [10, 22, 18];

    // Hills 4 (Foreground / Ground — Deep Frosted Sage-Teal / #0D1D18 in Dark)
    const h4LightTop: RGB = [68, 114, 102];  // Crest
    const h4DarkTop: RGB = [15, 34, 26];     // #0D1D18 foreground
    const h4LightMid: RGB = [52, 94, 82];
    const h4DarkMid: RGB = [11, 26, 20];
    const h4LightBot: RGB = [38, 76, 66];
    const h4DarkBot: RGB = [7, 17, 13];

    // Mist RGB
    const mistLightRGB: RGB = [255, 255, 255]; // Pearlescent white morning mist
    const mistDarkRGB: RGB = [45, 82, 98];      // Muted blue-green

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
      // 1. ATMOSPHERIC SKY (Luminous Dawn in Light, Midnight in Dark)
      // ========================================================
      const skyProgress = easeOutCubic(elapsed / 0.9);
      ctx.globalAlpha = skyProgress;

      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, rgbStr(lerpRGB(skyLightTop, skyDarkTop, t)));
      skyGrad.addColorStop(0.38, rgbStr(lerpRGB(skyLightMid, skyDarkMid, t)));
      skyGrad.addColorStop(0.68, rgbStr(lerpRGB(skyLightBot, skyDarkBot, t)));
      skyGrad.addColorStop(1, rgbStr(lerpRGB([195, 224, 240], [14, 26, 38], t)));

      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      // Celestial / Ambient Ethereal Morning Dawn Glow on Horizon
      const glowGrad = ctx.createRadialGradient(
        width * 0.5 + px * 30,
        height * 0.58,
        20,
        width * 0.5 + px * 30,
        height * 0.58,
        width * 0.75
      );

      // Ethereal radiant morning light in Light Mode vs subtle cyan glow in Dark Mode
      const glowR = Math.round(lerp(255, 88, t));
      const glowG = Math.round(lerp(255, 199, t));
      const glowB = Math.round(lerp(255, 232, t));
      const glowA = lerp(0.35, 0.08, t);

      glowGrad.addColorStop(0, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA})`);
      glowGrad.addColorStop(0.35, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA * 0.55})`);
      glowGrad.addColorStop(0.7, `rgba(${glowR}, ${glowG}, ${glowB}, ${glowA * 0.18})`);
      glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);

      // ========================================================
      // 2. SCATTERED TWINKLING STARS (Dark Mode Only)
      // ========================================================
      if (t > 0.02 && elapsed > 0.4) {
        const starIntro = easeOutCubic((elapsed - 0.4) / 1.1);
        for (const star of stars) {
          const starX = star.x * width + px * 6;
          const starY = star.y * height + py * 4;
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

      // ========================================================
      // 3. HORIZON LINE REVEAL
      // ========================================================
      if (elapsed > 0.3) {
        const horizonProg = easeOutCubic((elapsed - 0.3) / 1.2);
        const horizonY = height * 0.60;
        const lineGrad = ctx.createLinearGradient(0, 0, width, 0);

        const hColor = lerpRGB(horizonLight, horizonDark, t);
        const hAlpha = lerp(0.25, 0.22, t) * horizonProg;

        lineGrad.addColorStop(0, `rgba(${hColor[0]}, ${hColor[1]}, ${hColor[2]}, 0)`);
        lineGrad.addColorStop(0.5, `rgba(${hColor[0]}, ${hColor[1]}, ${hColor[2]}, ${hAlpha.toFixed(3)})`);
        lineGrad.addColorStop(1, `rgba(${hColor[0]}, ${hColor[1]}, ${hColor[2]}, 0)`);

        ctx.strokeStyle = lineGrad;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const startX = (width * (1 - horizonProg)) / 2;
        const endX = width - startX;
        ctx.moveTo(startX, horizonY);
        ctx.lineTo(endX, horizonY);
        ctx.stroke();
      }

      // ========================================================
      // 4. LAYER 1: DISTANT HILLS (Pale Ethereal Sage-Mint)
      // Base lowered to height * 0.61 so hero typography floats freely
      // ========================================================
      if (elapsed > 0.5) {
        const p1 = easeOutCubic((elapsed - 0.5) / 1.5);
        const riseY = (1 - p1) * 140;
        const offX = px * 10;
        const offY = py * 6 + riseY;

        ctx.globalAlpha = p1;
        const hillGrad1 = ctx.createLinearGradient(0, height * 0.54, 0, height);
        hillGrad1.addColorStop(0, rgbStr(lerpRGB(h1LightTop, h1DarkTop, t)));
        hillGrad1.addColorStop(0.45, rgbStr(lerpRGB(h1LightMid, h1DarkMid, t)));
        hillGrad1.addColorStop(1, rgbStr(lerpRGB(h1LightBot, h1DarkBot, t)));

        ctx.fillStyle = hillGrad1;
        ctx.beginPath();
        ctx.moveTo(0, height);

        const yBase1 = height * 0.61 + offY;
        ctx.lineTo(0, yBase1 + 20);
        ctx.bezierCurveTo(
          width * 0.2 + offX,
          yBase1 - 50,
          width * 0.4 + offX,
          yBase1 + 35,
          width * 0.65 + offX,
          yBase1 - 30
        );
        ctx.bezierCurveTo(
          width * 0.85 + offX,
          yBase1 - 70,
          width * 0.95 + offX,
          yBase1 + 10,
          width,
          yBase1 - 15
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Luminous Crest Rim Light
        const rimAlpha1 = lerp(0.70, 0.35, t) * p1;
        ctx.strokeStyle = `rgba(255, 255, 255, ${rimAlpha1.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yBase1 + 20);
        ctx.bezierCurveTo(
          width * 0.2 + offX,
          yBase1 - 50,
          width * 0.4 + offX,
          yBase1 + 35,
          width * 0.65 + offX,
          yBase1 - 30
        );
        ctx.bezierCurveTo(
          width * 0.85 + offX,
          yBase1 - 70,
          width * 0.95 + offX,
          yBase1 + 10,
          width,
          yBase1 - 15
        );
        ctx.stroke();
      }

      // ========================================================
      // 5. LAYER 2: DISTANT MIST & AERIAL HAZE
      // ========================================================
      if (elapsed > 1.0) {
        const mistProg = easeOutCubic((elapsed - 1.0) / 1.4);
        ctx.globalAlpha = mistProg * 0.75;

        const currentMistRGB = lerpRGB(mistLightRGB, mistDarkRGB, t);

        for (let i = 0; i < 2; i++) {
          const puff = mistPuffs[i];
          puff.x += puff.speed * 0.016;
          if (puff.x > 1.25) puff.x = -0.4;
          if (puff.x < -0.4) puff.x = 1.25;

          const cx = puff.x * width + px * 12;
          const cy = puff.y * height + py * 8;
          const w = puff.w * width;
          const h = puff.h * height;

          const mg = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
          mg.addColorStop(0, `rgba(${currentMistRGB[0]}, ${currentMistRGB[1]}, ${currentMistRGB[2]}, ${puff.alpha.toFixed(3)})`);
          mg.addColorStop(0.55, `rgba(${currentMistRGB[0]}, ${currentMistRGB[1]}, ${currentMistRGB[2]}, ${(puff.alpha * 0.5).toFixed(3)})`);
          mg.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ========================================================
      // 6. LAYER 3: MIDDLE HILLS (Soft Dreamy Sage)
      // Base lowered to height * 0.70
      // ========================================================
      if (elapsed > 0.9) {
        const p2 = easeOutCubic((elapsed - 0.9) / 1.6);
        const riseY = (1 - p2) * 200;
        const offX = px * 22;
        const offY = py * 12 + riseY;

        ctx.globalAlpha = p2;
        const hillGrad2 = ctx.createLinearGradient(0, height * 0.62, 0, height);
        hillGrad2.addColorStop(0, rgbStr(lerpRGB(h2LightTop, h2DarkTop, t)));
        hillGrad2.addColorStop(0.40, rgbStr(lerpRGB(h2LightMid, h2DarkMid, t)));
        hillGrad2.addColorStop(1, rgbStr(lerpRGB(h2LightBot, h2DarkBot, t)));

        ctx.fillStyle = hillGrad2;
        ctx.beginPath();
        ctx.moveTo(0, height);

        const yBase2 = height * 0.70 + offY;
        ctx.lineTo(0, yBase2 - 10);
        ctx.bezierCurveTo(
          width * 0.25 + offX,
          yBase2 + 60,
          width * 0.45 + offX,
          yBase2 - 65,
          width * 0.72 + offX,
          yBase2 + 25
        );
        ctx.bezierCurveTo(
          width * 0.88 + offX,
          yBase2 + 70,
          width * 0.96 + offX,
          yBase2 - 35,
          width,
          yBase2 - 15
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Luminous Crest Rim Light
        const rimAlpha2 = lerp(0.60, 0.30, t) * p2;
        ctx.strokeStyle = `rgba(255, 255, 255, ${rimAlpha2.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yBase2 - 10);
        ctx.bezierCurveTo(
          width * 0.25 + offX,
          yBase2 + 60,
          width * 0.45 + offX,
          yBase2 - 65,
          width * 0.72 + offX,
          yBase2 + 25
        );
        ctx.bezierCurveTo(
          width * 0.88 + offX,
          yBase2 + 70,
          width * 0.96 + offX,
          yBase2 - 35,
          width,
          yBase2 - 15
        );
        ctx.stroke();
      }

      // ========================================================
      // 7. LAYER 4: MID-FOREGROUND MIST
      // ========================================================
      if (elapsed > 1.4) {
        const mistProg = easeOutCubic((elapsed - 1.4) / 1.5);
        ctx.globalAlpha = mistProg * 0.8;

        const currentMistRGB = lerpRGB(mistLightRGB, mistDarkRGB, t);

        for (let i = 2; i < 4; i++) {
          const puff = mistPuffs[i];
          puff.x += puff.speed * 0.016;
          if (puff.x > 1.25) puff.x = -0.4;
          if (puff.x < -0.4) puff.x = 1.25;

          const cx = puff.x * width + px * 25;
          const cy = puff.y * height + py * 14;
          const w = puff.w * width;
          const h = puff.h * height;

          const mg = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
          mg.addColorStop(0, `rgba(${currentMistRGB[0]}, ${currentMistRGB[1]}, ${currentMistRGB[2]}, ${puff.alpha.toFixed(3)})`);
          mg.addColorStop(0.6, `rgba(${currentMistRGB[0]}, ${currentMistRGB[1]}, ${currentMistRGB[2]}, ${(puff.alpha * 0.45).toFixed(3)})`);
          mg.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = mg;
          ctx.beginPath();
          ctx.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ========================================================
      // 8. LAYER 5: NEAR FOREGROUND HILLS (Frosted Alpine Jade)
      // Base lowered to height * 0.79
      // ========================================================
      if (elapsed > 1.3) {
        const p3 = easeOutCubic((elapsed - 1.3) / 1.6);
        const riseY = (1 - p3) * 260;
        const offX = px * 36;
        const offY = py * 18 + riseY;

        ctx.globalAlpha = p3;
        const hillGrad3 = ctx.createLinearGradient(0, height * 0.72, 0, height);
        hillGrad3.addColorStop(0, rgbStr(lerpRGB(h3LightTop, h3DarkTop, t)));
        hillGrad3.addColorStop(0.38, rgbStr(lerpRGB(h3LightMid, h3DarkMid, t)));
        hillGrad3.addColorStop(1, rgbStr(lerpRGB(h3LightBot, h3DarkBot, t)));

        ctx.fillStyle = hillGrad3;
        ctx.beginPath();
        ctx.moveTo(0, height);

        const yBase3 = height * 0.79 + offY;
        ctx.lineTo(0, yBase3 + 35);
        ctx.bezierCurveTo(
          width * 0.28 + offX,
          yBase3 - 75,
          width * 0.55 + offX,
          yBase3 + 45,
          width * 0.82 + offX,
          yBase3 - 50
        );
        ctx.bezierCurveTo(
          width * 0.92 + offX,
          yBase3 - 80,
          width * 0.98 + offX,
          yBase3 - 15,
          width,
          yBase3 + 10
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Luminous Crest Rim Light
        const rimAlpha3 = lerp(0.50, 0.25, t) * p3;
        ctx.strokeStyle = `rgba(255, 255, 255, ${rimAlpha3.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yBase3 + 35);
        ctx.bezierCurveTo(
          width * 0.28 + offX,
          yBase3 - 75,
          width * 0.55 + offX,
          yBase3 + 45,
          width * 0.82 + offX,
          yBase3 - 50
        );
        ctx.bezierCurveTo(
          width * 0.92 + offX,
          yBase3 - 80,
          width * 0.98 + offX,
          yBase3 - 15,
          width,
          yBase3 + 10
        );
        ctx.stroke();
      }

      // ========================================================
      // 9. LAYER 6: FOREGROUND HILL / GROUND (Deep Frosted Sage-Teal)
      // Base lowered to height * 0.88
      // ========================================================
      if (elapsed > 1.6) {
        const p4 = easeOutCubic((elapsed - 1.6) / 1.6);
        const riseY = (1 - p4) * 320;
        const offX = px * 50;
        const offY = py * 22 + riseY;

        ctx.globalAlpha = p4;
        const hillGrad4 = ctx.createLinearGradient(0, height * 0.82, 0, height);
        hillGrad4.addColorStop(0, rgbStr(lerpRGB(h4LightTop, h4DarkTop, t)));
        hillGrad4.addColorStop(0.38, rgbStr(lerpRGB(h4LightMid, h4DarkMid, t)));
        hillGrad4.addColorStop(1, rgbStr(lerpRGB(h4LightBot, h4DarkBot, t)));

        ctx.fillStyle = hillGrad4;
        ctx.beginPath();
        ctx.moveTo(0, height);

        const yBase4 = height * 0.88 + offY;
        ctx.lineTo(0, yBase4 - 25);
        ctx.bezierCurveTo(
          width * 0.35 + offX,
          yBase4 + 40,
          width * 0.65 + offX,
          yBase4 - 60,
          width * 0.88 + offX,
          yBase4 + 12
        );
        ctx.bezierCurveTo(
          width * 0.94 + offX,
          yBase4 + 30,
          width * 0.98 + offX,
          yBase4 - 8,
          width,
          yBase4 - 12
        );
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();

        // Luminous Crest Rim Light
        const rimAlpha4 = lerp(0.40, 0.20, t) * p4;
        ctx.strokeStyle = `rgba(255, 255, 255, ${rimAlpha4.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, yBase4 - 25);
        ctx.bezierCurveTo(
          width * 0.35 + offX,
          yBase4 + 40,
          width * 0.65 + offX,
          yBase4 - 60,
          width * 0.88 + offX,
          yBase4 + 12
        );
        ctx.bezierCurveTo(
          width * 0.94 + offX,
          yBase4 + 30,
          width * 0.98 + offX,
          yBase4 - 8,
          width,
          yBase4 - 12
        );
        ctx.stroke();
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

  // Ethereal webstrips colors for Light vs Dark mode
  // In Light Mode: radiant cyan, turquoise, sky blue with luminous white core
  const webstripColors = isDark
    ? ["#0070BA", "#009CDE", "#38BDF8", "#58C7E8", "#00E599"] // Electric cyan, glowing sky blue, teal
    : ["#0077B6", "#0096C7", "#00B4D8", "#38BDF8", "#06B6D4"]; // Luminous azure, cerulean, turquoise

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 h-screen w-screen overflow-hidden pointer-events-none select-none"
    >
      {/* Canvas Layer: Sky, Radiant Dawn Glow, Stars, Layered Hills with Crest Rim Lighting, Mist */}
      <canvas ref={canvasRef} className="block size-full" />

      {/* Webstrips Layer: Interconnected Flowing Ribbons (Phase 3 Entrance Animation) */}
      <div
        className="absolute inset-0 size-full pointer-events-none transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          opacity: webstripsVisible ? (isDark ? 0.85 : 0.72) : 0,
        }}
      >
        <WebThreads
          colors={webstripColors}
          coreColor="#FFFFFF"
          backgroundColor="transparent"
          lightMode={false} // Use luminous additive bloom in both themes for true ethereal glow
          threadCount={6}
          speed={0.09}
          frequency={3.8}
          spread={0.28}
          position={0.46}
          glow={isDark ? 0.024 : 0.020}
          brightness={isDark ? 0.88 : 0.82}
          thickness={1.05}
          fade={0.02}
          shimmer={true}
          mouseInteraction={true}
          mouseStrength={0.25}
          pulseOnClick={false}
          dpr={1}
        />
      </div>

      {/* Soft Vignette to Enhance Cinematic Depth */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(7,143,190,0.06)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(11,16,29,0.55)_100%)] transition-colors duration-500" />
    </div>
  );
}
