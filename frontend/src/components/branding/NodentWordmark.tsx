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
      <span className="relative inline-block pb-1">
        <span
          className={cn(
            "relative z-[1] inline-block antialiased",
            sizeMap[size],
            textClass,
            variant === "onCream"
              ? "[text-shadow:0_0_1px_rgba(15,23,42,0.22),0_1px_0_rgba(255,255,255,0.9),0_2px_8px_rgba(15,23,42,0.08)]"
              : "[text-shadow:0_0_1px_rgba(0,0,0,0.4),0_1px_0_rgba(255,255,255,0.35),0_2px_10px_rgba(0,0,0,0.24)]",
          )}
          style={{
            fontFamily: "'Caveat', cursive",
            fontWeight: 600,
            letterSpacing: "0.01em",
            textRendering: "optimizeLegibility",
          }}
        >
          Nodent
        </span>

        {/* Slanted underline with a slight upward bow. */}
        <svg
          className={cn(
            "pointer-events-none absolute left-[-2%] top-full w-[106%] max-w-none -translate-y-[0.02em] overflow-visible",
            strokeClass,
          )}
          viewBox="0 0 220 12"
          fill="none"
          aria-hidden
          preserveAspectRatio="xMidYMin meet"
        >
          <path
            d="M12 9 Q110 4.8 208 4.5"
            stroke="currentColor"
            strokeWidth="3.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.9}
          />
        </svg>
      </span>
    </span>
  );
}
