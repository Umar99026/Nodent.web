import { useId } from "react";
import { cn } from "@/lib/utils";

type NodentWordmarkProps = {
  className?: string;
  /** Hero on login left */
  size?: "sm" | "md" | "lg" | "xl";
  /** Background context for colour + shadow */
  variant?: "onBrand" | "onDark" | "onCream";
};

const sizeMap = {
  sm: "text-[1.35rem] leading-none",
  md: "text-2xl leading-none",
  lg: "text-4xl leading-none sm:text-[2.75rem]",
  xl: "text-5xl leading-none",
};

export function NodentWordmark({
  className,
  size = "lg",
  variant = "onBrand",
}: NodentWordmarkProps) {
  const uid = useId().replace(/:/g, "");
  const filterId = `nodent-chalk-${uid}`;

  const textClass =
    variant === "onCream"
      ? "text-navy"
      : "text-white";

  const strokeClass =
    variant === "onCream"
      ? "text-navy/75"
      : "text-white/90";

  return (
    <span className={cn("relative inline-block overflow-visible", className)}>
      {/* Whole word + underline rotate together (no per-letter skew). */}
      <span className="-rotate-[12deg] inline-block origin-center">
        <span className="relative inline-block pb-1">
          <span
            className={cn(
              "relative z-[1] inline-block font-bold tracking-[0.02em] antialiased",
              sizeMap[size],
              textClass,
              variant === "onCream"
                ? "[text-shadow:0_0_1px_rgba(15,23,42,0.35),0_1px_0_rgba(255,255,255,0.95),0_2px_8px_rgba(15,23,42,0.1)]"
                : "[text-shadow:0_0_1px_rgba(0,0,0,0.45),0_1px_0_rgba(255,255,255,0.55),0_2px_10px_rgba(0,0,0,0.28)]",
            )}
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 700,
              textRendering: "optimizeLegibility",
            }}
          >
            Nodent
          </span>

          <svg
            className={cn(
              /* Stroke lives in the top of the viewBox so it sits flush under the word (no empty SVG padding above the line). */
              "pointer-events-none absolute left-[-6%] top-full w-[112%] max-w-none -translate-y-[0.08em] overflow-visible",
              strokeClass,
            )}
            viewBox="0 0 220 8"
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMin meet"
          >
            <defs>
              <filter id={filterId} x="-20%" y="-40%" width="140%" height="180%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="0.65" />
              </filter>
            </defs>
            <path
              d="M5 2.25 C 74 5.35, 146 5.35, 215 2.25"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={0.92}
              filter={`url(#${filterId})`}
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
