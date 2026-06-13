import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  LineChart,
  Sparkles,
  Target,
  Lock,
  Trophy,
  Users,
} from "lucide-react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingDemoAnimation } from "@/components/landing/LandingDemoAnimation";
import { LandingJourneyNav } from "@/components/landing/LandingJourneyNav";
import { Reveal } from "@/components/landing/Reveal";
import { NodentWordmark } from "@/components/branding/NodentWordmark";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRODUCT_FEATURES = [
  {
    icon: BookOpen,
    title: "VCE revision questions",
    body: "Answer exam-style questions across maths and English with instant scoring and feedback.",
  },
  {
    icon: BarChart3,
    title: "Progress dashboard",
    body: "See weak topics, watch accuracy improve, and focus revision where it actually matters.",
  },
  {
    icon: Trophy,
    title: "Live student rankings",
    body: "Compare your rank with other students — not just 7/10, but where that score places you.",
  },
  {
    icon: Target,
    title: "Topic insights",
    body: "Your report card shows percentiles, strongest areas, and what to hit before the next SAC.",
  },
];

const PRICING = [
  {
    name: "Starter",
    price: "$0",
    period: "during beta",
    blurb: "Try Nodent and see where you stand on one subject.",
    perks: ["VCE-style practice", "Basic rankings", "Progress snapshot"],
    locked: false,
  },
  {
    name: "Student",
    price: "$12",
    period: "/ month",
    blurb: "Full competitive revision for a serious study year.",
    perks: [
      "All maths & English subjects",
      "Live rankings & percentiles",
      "Progress dashboard & insights",
      "Timed quiz & topic content",
    ],
    locked: true,
  },
  {
    name: "School",
    price: "Custom",
    period: "",
    blurb: "For cohorts who want class-wide visibility before results.",
    perks: ["Admin question bank", "Cohort insights", "Bulk import", "Dedicated support"],
    locked: true,
  },
] as const;

export default function LandingPage() {
  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const selectDemoStep = useCallback((index: number) => {
    setDemoStepIndex(index);
    document.getElementById("demo-animation")?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, []);

  return (
    <div className="landing-root min-h-dvh overflow-x-clip text-[#0b0f19]">
      <LandingNav />

      {/* Hero */}
      <section
        id="top"
        className="landing-section relative overflow-x-clip pt-24 pb-16 sm:pt-32 sm:pb-28"
      >
        <div className="landing-hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="orb-float-slow pointer-events-none absolute -left-32 top-20 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
        <div className="orb-float-medium pointer-events-none absolute -right-24 top-40 h-80 w-80 rounded-full bg-brand-light/30 blur-3xl" />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2 lg:gap-10 sm:px-8">
          <div>
            <p className="landing-hero-badge mb-6 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-dark shadow-sm backdrop-blur-sm">
              <Sparkles className="size-4" />
              Competitive VCE revision
            </p>
            <h1 className="font-display text-[clamp(1.85rem,6.5vw,3.35rem)] font-bold leading-[1.1] tracking-tight text-[#0b0f19]">
              Know where you stand{" "}
              <span className="landing-gradient-text">before results land.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              A competitive VCE revision platform where students answer questions, track
              progress, climb leaderboards, and see how they compare — before SACs and exams.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                to="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-7 text-base text-white shadow-lg shadow-brand/30 hover:bg-brand-dark sm:w-auto",
                )}
              >
                Start revising with clarity
                <ArrowRight className="ml-2 size-4" />
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-full border-slate-200 bg-white/80 px-7 text-base text-slate-800 hover:bg-white sm:w-auto"
                onClick={() =>
                  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Watch demo
              </Button>
            </div>
          </div>

          <div className="landing-hero-float relative z-0 mx-auto mt-6 w-full max-w-2xl overflow-hidden sm:max-w-3xl lg:mt-10 lg:max-w-none lg:w-full">
            <div className="landing-mockup-main glass-card grain-texture overflow-hidden rounded-2xl border-2 border-white/70 shadow-2xl shadow-brand/20 sm:rounded-3xl lg:origin-top lg:scale-[1.04]">
              <div className="flex items-center gap-2.5 border-b-2 border-slate-100 bg-slate-50/90 px-5 py-4 sm:px-6 sm:py-4.5">
                <span className="size-3 rounded-full bg-red-400/80" />
                <span className="size-3 rounded-full bg-amber-400/80" />
                <span className="size-3 rounded-full bg-emerald-400/80" />
                <span className="ml-2 text-sm font-medium text-slate-500">Nodent · Dashboard</span>
              </div>
              <div className="space-y-5 p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      Report card
                    </p>
                    <p className="font-display text-2xl font-bold text-[#0b0f19]">72nd percentile</p>
                  </div>
                  <div className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-dark">
                    Rank #18 ↑6
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                  {["Methods", "English", "General"].map((s, i) => (
                    <div
                      key={s}
                      className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm sm:p-4"
                    >
                      <p className="text-[10px] font-medium text-slate-500">{s}</p>
                      <p className="mt-1 font-semibold text-[#0b0f19]">
                        {i === 0 ? "84%" : i === 1 ? "71%" : "68%"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-brand/15 bg-gradient-to-br from-brand/5 to-white p-4">
                  <p className="text-sm font-medium text-slate-700">Weakest topic</p>
                  <p className="mt-1 font-display text-lg font-semibold text-brand-dark">
                    Calculus · integration
                  </p>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:h-3">
                    <div className="landing-progress-bar h-full w-[68%] rounded-full bg-brand" />
                  </div>
                </div>
              </div>
            </div>
            <div className="landing-mockup-card glass-card absolute -bottom-6 -left-4 hidden w-44 rounded-xl border border-white/70 p-3 shadow-xl sm:block">
              <div className="flex items-center gap-2">
                <Trophy className="size-4 text-brand" />
                <p className="text-xs font-semibold text-[#0b0f19]">Live rankings</p>
              </div>
            </div>
            <div className="landing-mockup-card-alt glass-card absolute -right-2 top-8 hidden w-40 rounded-xl border border-white/70 p-3 shadow-xl sm:block">
              <p className="text-[10px] text-slate-500">This session</p>
              <p className="text-sm font-semibold text-[#0b0f19]">8 / 10 correct</p>
            </div>
          </div>
        </div>
      </section>

      {/* Product: problem + solution + features */}
      <section id="product" className="landing-section scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
              The problem
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Most students only find out where they stand after results are already out.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Most VCE students revise without really knowing where they stand. They do
              questions, maybe check answers, but they don&apos;t know whether they&apos;re
              improving, falling behind, or actually competitive compared to others.
            </p>
          </Reveal>

          <Reveal delayMs={80} className="mt-12">
            <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/8 to-white p-8 sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
                The solution
              </p>
              <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
                Revise, compete, and measure your performance in one place.
              </h3>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                Students answer VCE-style revision questions, get scored, see their rank,
                compare with others, and track progress over time — so they know exactly
                where they stand before SACs and exams.
              </p>
            </div>
          </Reveal>

          <Reveal className="mx-auto mt-20 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
              Product
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Not just another revision tool.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              VCE-specific revision, ranking, progress insights, and competition — before
              exam day.
            </p>
          </Reveal>

          <div className="mt-16 grid gap-5 sm:grid-cols-2">
            {PRODUCT_FEATURES.map((f, i) => (
              <Reveal key={f.title} delayMs={i * 80} className="h-full">
                <article className="landing-feature-card group h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand/25 hover:shadow-lg hover:shadow-brand/10 sm:p-8">
                  <div className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="font-display text-xl font-semibold text-[#0b0f19]">{f.title}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{f.body}</p>
                </article>
              </Reveal>
            ))}
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {[
              {
                icon: Trophy,
                quote: "A score tells you how you did. A rank tells you where you stand.",
                title: "Why ranking matters",
                body: "Ranking gives motivation and context — so every mark means something compared to other students.",
              },
              {
                icon: LineChart,
                quote: "Stop guessing what to revise.",
                title: "Why progress tracking matters",
                body: "See weak spots, watch accuracy improve, and focus where it matters most.",
              },
              {
                icon: Users,
                quote: "Every question can move you up the leaderboard.",
                title: "Why competition matters",
                body: "Revision feels different when you're actively climbing — not just passively reading notes.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delayMs={i * 100}>
                <article className="h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                  <item.icon className="size-6 text-brand" />
                  <p className="mt-4 font-display text-lg font-semibold italic text-brand-dark">
                    &ldquo;{item.quote}&rdquo;
                  </p>
                  <h4 className="mt-4 font-semibold text-[#0b0f19]">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="landing-section scroll-mt-24 bg-gradient-to-b from-white to-brand/[0.06] py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
              Pricing
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Start free during beta.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Try Nodent and see where you stand — more plans are on the way.
            </p>
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {PRICING.map((tier, i) => (
              <Reveal key={tier.name} delayMs={i * 100} className="h-full">
                <article
                  className={cn(
                    "flex h-full flex-col rounded-2xl border p-8 transition-all duration-300",
                    tier.locked
                      ? "border-slate-200 bg-slate-50/90 text-slate-500 shadow-sm"
                      : "border-brand bg-white shadow-md shadow-brand/10 ring-2 ring-brand/25 hover:shadow-lg hover:shadow-brand/15",
                  )}
                >
                  {tier.locked ? (
                    <span className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                      <Lock className="size-3" aria-hidden />
                      Coming soon
                    </span>
                  ) : (
                    <span className="mb-4 h-6" />
                  )}
                  <h3
                    className={cn(
                      "flex items-center gap-2 font-display text-xl font-semibold",
                      tier.locked ? "text-slate-500" : "text-[#0b0f19]",
                    )}
                  >
                    {tier.locked ? <Lock className="size-4 shrink-0 text-slate-400" aria-hidden /> : null}
                    {tier.name}
                  </h3>
                  <p className={cn("mt-2 text-sm", tier.locked ? "text-slate-400" : "text-slate-600")}>
                    {tier.blurb}
                  </p>
                  <p
                    className={cn(
                      "mt-6 font-display text-4xl font-bold tracking-tight",
                      tier.locked && "text-slate-400",
                    )}
                  >
                    {tier.price}
                    {tier.period ? (
                      <span
                        className={cn(
                          "text-base font-normal",
                          tier.locked ? "text-slate-400" : "text-slate-500",
                        )}
                      >
                        {tier.period}
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-8 flex-1 space-y-3">
                    {tier.perks.map((perk) => (
                      <li
                        key={perk}
                        className={cn(
                          "flex items-start gap-2 text-sm",
                          tier.locked ? "text-slate-400" : "text-slate-700",
                        )}
                      >
                        <Check
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            tier.locked ? "text-slate-300" : "text-brand",
                          )}
                        />
                        {perk}
                      </li>
                    ))}
                  </ul>
                  {tier.locked ? (
                    <span
                      className={cn(
                        buttonVariants(),
                        "mt-8 flex w-full cursor-not-allowed justify-center gap-2 rounded-full border border-slate-200 bg-slate-100 text-slate-400",
                      )}
                    >
                      <Lock className="size-4" aria-hidden />
                      Not available yet
                    </span>
                  ) : (
                    <Link
                      to="/login"
                      className={cn(
                        buttonVariants(),
                        "mt-8 flex w-full justify-center rounded-full bg-brand text-white hover:bg-brand-dark",
                      )}
                    >
                      Get started
                    </Link>
                  )}
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Demo */}
      <section id="demo" className="landing-section scroll-mt-24 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
              Demo
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              See how a session works.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Choose a subject, answer VCE-style questions, get instant feedback, see your
              score, compare your rank, and track growth across sessions — all in one flow.
            </p>
          </Reveal>

          <Reveal delayMs={80} className="mt-10">
            <LandingJourneyNav activeIndex={demoStepIndex} onSelect={selectDemoStep} />
          </Reveal>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-2">
            <Reveal>
              <p className="text-lg leading-relaxed text-slate-600">
                Follow the journey below — each step shows what students actually do in Nodent,
                from picking a subject to watching their rank and progress move over time.
              </p>
              <Link
                to="/login"
                className={cn(
                  buttonVariants(),
                  "mt-8 inline-flex items-center rounded-full bg-[#0b0f19] px-6 text-white hover:bg-[#0b0f19]/90",
                )}
              >
                See where you stand today
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Reveal>

            <Reveal delayMs={120}>
              <div id="demo-animation">
                <LandingDemoAnimation
                  stepIndex={demoStepIndex}
                  onStepIndexChange={setDemoStepIndex}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="landing-section scroll-mt-24 border-t border-slate-200/80 bg-white py-24 sm:py-32"
      >
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
              About
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built for the pressure students already feel.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-600">
              Uncertainty, comparison, wanting to know if you&apos;re doing enough — Nodent is
              for students who are tired of waiting for results to find out. Know your level
              early, improve with purpose, and walk into assessments with confidence.
            </p>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              No more wondering if you&apos;re behind. No more revising blind. A competitive
              VCE platform that shows your level before exam day.
            </p>
          </Reveal>

          <Reveal delayMs={100} className="mt-14">
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { stat: "VCE", label: "Curriculum-focused revision" },
                { stat: "Live", label: "Student rankings" },
                { stat: "Early", label: "Clarity before results" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-slate-100 bg-slate-50/80 py-8 text-center"
                >
                  <p className="font-display text-3xl font-bold text-brand-dark">{item.stat}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA + footer */}
      <section className="landing-section py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-light to-[#a8daf7] px-8 py-14 text-center shadow-xl shadow-brand/25 sm:px-12">
              <div className="orb-float-slow pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-2xl" />
              <h2 className="relative font-display text-3xl font-bold text-white sm:text-4xl">
                Start revising with clarity.
              </h2>
              <p className="relative mx-auto mt-4 max-w-lg text-white/90">
                See where you stand today — before SACs, before exams, before results land.
              </p>
              <Link
                to="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "relative mt-8 inline-flex h-12 items-center rounded-full bg-white px-8 text-base font-semibold text-brand-dark hover:bg-white/95",
                )}
              >
                Create your account
              </Link>
            </div>
          </Reveal>

          <footer className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-slate-200 pt-10 sm:flex-row">
            <NodentWordmark size="sm" variant="onCream" />
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Nodent. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-600">
              <button
                type="button"
                className="hover:text-brand-dark"
                onClick={() => document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })}
              >
                Product
              </button>
              <Link to="/login" className="hover:text-brand-dark">
                Log in
              </Link>
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
