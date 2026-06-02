import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SCROLL_RANGE = 200;

/** Top-left wordmark: logo N stays; scroll reveals “odent” + underline beside it. */
export function LandingLogoHero({ className }: { className?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setProgress(Math.min(Math.max(y / SCROLL_RANGE, 0), 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const eased = 1 - Math.pow(1 - progress, 2);
  const odentOpacity = Math.min(1, eased * 1.25);
  const odentX = (1 - eased) * 12;
  const underlineDraw = Math.min(1, Math.max(0, (eased - 0.15) / 0.8));

  return (
    <div
      className={cn("landing-logo-wordmark flex items-end overflow-visible leading-none", className)}
      aria-label="Nodent"
    >
      <span className="relative inline-flex h-[3.25rem] w-[2.35rem] shrink-0 items-end justify-end overflow-visible sm:h-14 sm:w-10">
        <img
          src="/logo.png"
          alt=""
          className="landing-logo-n-pop h-full w-full max-h-[3.25rem] object-contain object-bottom select-none sm:max-h-14"
          draggable={false}
        />
      </span>

      <div
        className="relative -ml-1 min-w-0 overflow-x-clip overflow-y-visible pr-1 transition-[max-width] duration-100 sm:-ml-0.5"
        style={{
          opacity: odentOpacity,
          transform: `translate(${odentX}px, 0px)`,
          maxWidth: eased > 0.02 ? "8.5rem" : 0,
        }}
        aria-hidden={odentOpacity < 0.05}
      >
        <span className="relative inline-block pb-0">
          <span
            className="relative z-[1] inline-block whitespace-nowrap pr-0.5 text-[#0b0f19] antialiased"
            style={{
              fontFamily: "'Caveat', cursive",
              fontWeight: 600,
              fontSize: "1.625rem",
              lineHeight: 1,
              letterSpacing: "-0.02em",
            }}
          >
            odent
          </span>
          <svg
            className="pointer-events-none absolute left-[-2%] top-[calc(100%-0.08em)] h-[0.42em] w-[106%] max-w-none overflow-visible text-[#0b0f19]/85"
            viewBox="0 0 220 12"
            fill="none"
            aria-hidden
            preserveAspectRatio="xMidYMin meet"
          >
            <path
              d="M12 9 Q110 4.8 208 4.5"
              stroke="currentColor"
              strokeWidth="4.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              style={{
                strokeDasharray: 1,
                strokeDashoffset: 1 - underlineDraw,
              }}
            />
          </svg>
        </span>
      </div>
    </div>
  );
}
