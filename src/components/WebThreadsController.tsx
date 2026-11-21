"use client";

import { useState, useEffect } from "react";
import WebThreads from "./WebThreads";

// Light mode: bright, cheerful sky / aqua / mint tones (dark navy lines looked dull and heavy on the light background).
const LIGHT_COLORS = ["#0EA5E9", "#22D3EE", "#2DD4BF", "#38BDF8", "#818CF8"];
// Dark mode: the original brand blues with a mint accent.
const DARK_COLORS = ["#0070BA", "#00457C", "#009CDE", "#38BDF8", "#00E599"];

export default function WebThreadsController() {
  const [isDark, setIsDark] = useState(false);

  // Sync theme changes
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

  return (
    <div className="fixed inset-0 z-0 h-screen w-screen overflow-hidden pointer-events-none opacity-90 dark:opacity-85 transition-opacity duration-300">
      <WebThreads
        colors={isDark ? DARK_COLORS : LIGHT_COLORS}
        coreColor={isDark ? "#FFFFFF" : "#D7F3FF"}
        lightMode={false}
        threadCount={6}
        speed={0.12}
        frequency={4.0}
        spread={0.26}
        position={0.48}
        glow={isDark ? 0.019 : 0.015}
        brightness={isDark ? 0.62 : 0.95}
        thickness={1.05}
        fade={0.015}
        mouseInteraction={true}
        pulseOnClick={true}
        dpr={1}
      />
    </div>
  );
}
