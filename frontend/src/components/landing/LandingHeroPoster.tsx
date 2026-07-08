import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { LandingDashboardMockup } from "@/components/landing/LandingDashboardMockup";
import { scrollToSection } from "@/components/landing/useScrollReveal";

export function LandingHeroPoster() {
  return (
    <section
      id="top"
      className="landing-hero-poster landing-section relative min-h-[100dvh] overflow-hidden"
    >
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-5 pb-10 pt-[calc(env(safe-area-inset-top,0px)+6.25rem)] sm:px-8 sm:pb-12 sm:pt-[calc(env(safe-area-inset-top,0px)+6.75rem)]">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)] lg:gap-8">
          <div className="max-w-lg pl-1 sm:pl-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
              A VCE study platform — without the big tutoring bill
            </p>
            <h1 className="mt-4 font-display text-[clamp(2rem,5.5vw,3.25rem)] font-bold uppercase leading-[1.05] tracking-tight text-white">
              Better feedback.
              <br />
              Faster improvement.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
              Don&apos;t want to spend hundreds a week on tutoring? Nodent is a VCE revision tool
              with study resources and instant marking — so you know what to fix before your next SAC.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center border border-white/50 px-6 text-xs font-semibold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/10"
              >
                Start free
              </Link>
              <button
                type="button"
                onClick={() => scrollToSection("demo")}
                className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/75 transition-colors hover:text-white"
              >
                See the AI in action
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none lg:px-4">
            <div className="landing-hero-mockup-float relative z-20">
              <LandingDashboardMockup className="mx-auto shadow-2xl shadow-black/25" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
