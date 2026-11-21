"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface PermileLogoProps {
  variant?: "full" | "compact" | "icon";
  href?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
}

export type PayZorrLogoProps = PermileLogoProps;

export default function PermileLogo({
  variant = "compact",
  href = "/",
  className,
  size = "md",
  showTagline = false,
}: PermileLogoProps) {
  const iconSizes = {
    sm: "h-7 w-7",
    md: "h-8 sm:h-9 w-8 sm:w-9",
    lg: "h-10 sm:h-11 w-10 sm:w-11",
    xl: "h-12 sm:h-14 w-12 sm:w-14",
  };

  const textSizes = {
    sm: "text-lg tracking-[-0.03em]",
    md: "text-xl sm:text-2xl tracking-[-0.035em]",
    lg: "text-2xl sm:text-3xl tracking-[-0.035em]",
    xl: "text-3xl sm:text-4xl tracking-[-0.04em]",
  };

  const content = (
    <div className={cn("inline-flex items-center gap-2.5 group select-none", className)}>
      <div className={cn("relative shrink-0 transition-transform group-hover:scale-105 rounded-xl overflow-hidden shadow-xs", iconSizes[size])}>
        <img
          src="/permile-icon.png"
          alt="PerMile"
          className="size-full object-contain drop-shadow-sm rounded-xl"
        />
      </div>

      {variant !== "icon" && (
        <div className="flex flex-col justify-center">
          <span
            className={cn(
              "font-sans font-extrabold leading-none transition-transform group-hover:scale-[1.01]",
              textSizes[size]
            )}
            style={{ fontFamily: "var(--font-sans), 'Plus Jakarta Sans', sans-serif" }}
          >
            <span className="text-[#172B43] dark:text-[#F4F7FA] transition-colors">Per</span>
            <span className="text-[#0284C7] dark:text-[#38BDF8] transition-colors">M</span>
            <span className="text-[#172B43] dark:text-[#F4F7FA] transition-colors">ile</span>
          </span>
          {(showTagline || variant === "full") && (
            <span className="text-[10px] font-semibold text-[#526B82] dark:text-[#CBD5E1] tracking-wider uppercase mt-0.5">
              Verified Milestones
            </span>
          )}
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

// Backward-compatibility export
export { PermileLogo as PayZorrLogo };
