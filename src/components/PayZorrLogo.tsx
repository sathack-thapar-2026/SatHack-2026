"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface PayZorrLogoProps {
  variant?: "full" | "compact" | "icon";
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
}

export default function PayZorrLogo({
  variant = "compact",
  href = "/",
  className,
  size = "md",
  showTagline = false,
}: PayZorrLogoProps) {
  // Height configurations
  const heightClasses = {
    sm: "h-7",
    md: "h-8 sm:h-9",
    lg: "h-10 sm:h-11",
    xl: "h-12 sm:h-14",
  };

  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-8 w-8",
    lg: "h-10 w-10",
    xl: "h-12 w-12",
  };

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 group select-none", className)}>
      {variant === "icon" ? (
        <div className={cn("relative shrink-0 transition-transform group-hover:scale-105", iconSizes[size])}>
          <img
            src="/payzorr-icon.png"
            alt="PayZorr"
            className="size-full object-contain drop-shadow-sm"
          />
        </div>
      ) : variant === "full" || showTagline ? (
        <div className={cn("relative shrink-0 transition-transform group-hover:scale-[1.02]", heightClasses[size])}>
          {/* Light Mode Logo */}
          <img
            src="/payzorr-logo.png"
            alt="PayZorr — Payments Made Effortless"
            className="h-full w-auto object-contain dark:hidden"
          />
          {/* Dark Mode Logo */}
          <img
            src="/payzorr-logo-dark.png"
            alt="PayZorr — Payments Made Effortless"
            className="h-full w-auto object-contain hidden dark:block"
          />
        </div>
      ) : (
        <div className={cn("relative shrink-0 transition-transform group-hover:scale-[1.02]", heightClasses[size])}>
          {/* Light Mode Compact Logo */}
          <img
            src="/payzorr-logo-compact.png"
            alt="PayZorr"
            className="h-full w-auto object-contain dark:hidden"
          />
          {/* Dark Mode Compact Logo */}
          <img
            src="/payzorr-logo-compact-dark.png"
            alt="PayZorr"
            className="h-full w-auto object-contain hidden dark:block"
          />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#087FBE] rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
