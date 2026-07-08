import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LandingFlowArrow } from "@/components/landing/LandingFlowArrow";
import { Reveal } from "@/components/landing/Reveal";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto inline-block max-w-full">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark">{children}</p>
      <div className="mt-2 h-0.5 w-full rounded-full bg-brand/70" aria-hidden />
    </div>
  );
}

function SectionTitle({
  as: Tag = "h2",
  children,
}: {
  as?: "h2" | "h3";
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "mt-3 font-display font-bold leading-[1.1] tracking-tight text-[#0b0f19]",
        Tag === "h2" &&
          "text-[clamp(1.65rem,3.5vw,2.35rem)] uppercase",
        Tag === "h3" && "text-2xl sm:text-3xl",
      )}
    >
      {children}
    </Tag>
  );
}

export function LandingProblemFlow() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showFix, setShowFix] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShowFix(true);
      return;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShowFix(true);
          io.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0px 0px -30% 0px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-2xl text-center">
      <Reveal>
        <SectionEyebrow>Sound familiar?</SectionEyebrow>
        <SectionTitle>
          You&apos;re working hard — but the feedback is too slow.
        </SectionTitle>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          Tutoring is expensive. Teacher feedback can take days. Meanwhile you keep practising the
          same mistakes — and they show up again on SACs and exams.
        </p>
      </Reveal>

      <div ref={sentinelRef} className="h-px w-full" aria-hidden />

      <LandingFlowArrow visible={showFix} />

      <div
        className={cn(
          "landing-reveal",
          showFix && "landing-reveal-visible landing-reveal-delayed",
        )}
      >
        <SectionEyebrow>How Nodent helps</SectionEyebrow>
        <SectionTitle as="h3">
          Feedback in seconds. Clarity on what to improve.
        </SectionTitle>
        <p className="mt-4 text-lg text-slate-600">
          Nodent is a VCE study platform: practice VCE-style questions, get smart marking on written
          work, and see exactly where to recover marks — without booking another tutoring session.
        </p>
        <Link
          to="/login"
          className={cn(
            buttonVariants(),
            "mt-8 inline-flex rounded-full bg-brand text-white hover:bg-brand-dark",
          )}
        >
          Get started
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </div>
    </div>
  );
}
