import { useCallback, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ReelSlide = {
  id: string;
  label: string;
  tone: "sky" | "slate" | "cream";
};

const TONE_CLASS: Record<ReelSlide["tone"], string> = {
  sky: "from-[#dbeafe] via-[#eff6ff] to-[#f8fafc]",
  slate: "from-[#e2e8f0] via-[#f1f5f9] to-[#f8fafc]",
  cream: "from-[#fde8e4] via-[#fff7f5] to-[#faf9f7]",
};

type LandingPhotoReelProps = {
  slides: ReelSlide[];
  className?: string;
};

export function LandingPhotoReel({ slides, className }: LandingPhotoReelProps) {
  const [index, setIndex] = useState(0);
  const count = slides.length;

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + count) % count);
  }, [count]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % count);
  }, [count]);

  const slide = slides[index]!;

  return (
    <div className={cn("landing-reel", className)}>
      <div
        className={cn(
          "landing-reel-frame relative aspect-[16/10] w-full overflow-hidden rounded-sm bg-gradient-to-br sm:aspect-[16/9]",
          TONE_CLASS[slide.tone],
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center p-8 sm:p-12">
          <div className="w-full max-w-md rounded-lg border border-black/8 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#0b0f19]/45">
              Nodent preview
            </p>
            <p className="mt-3 font-display text-xl font-semibold text-[#0b0f19] sm:text-2xl">
              {slide.label}
            </p>
            <div className="mt-5 space-y-2">
              <div className="h-2 w-full rounded-full bg-black/[0.06]" />
              <div className="h-2 w-4/5 rounded-full bg-black/[0.06]" />
              <div className="h-2 w-3/5 rounded-full bg-brand-light/60" />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={prev}
          className="landing-reel-arrow flex size-10 items-center justify-center rounded-full border border-black/10 text-[#0b0f19]/70 transition-colors hover:border-black/20 hover:text-[#0b0f19]"
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="text-sm text-[#0b0f19]/45">
          {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
        </span>
        <button
          type="button"
          onClick={next}
          className="landing-reel-arrow flex size-10 items-center justify-center rounded-full border border-black/10 text-[#0b0f19]/70 transition-colors hover:border-black/20 hover:text-[#0b0f19]"
          aria-label="Next slide"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
