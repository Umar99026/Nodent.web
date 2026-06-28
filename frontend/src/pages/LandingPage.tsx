import type { ReactNode } from "react";

import { useCallback, useState } from "react";

import { Link } from "react-router-dom";

import { ArrowRight, Check, Lock } from "lucide-react";
import { InstagramIcon } from "@/components/icons/InstagramIcon";

import { LandingNav } from "@/components/landing/LandingNav";

import { LandingHeroPoster } from "@/components/landing/LandingHeroPoster";

import { LandingProblemFlow } from "@/components/landing/LandingProblemFlow";

import { LandingDemoAnimation } from "@/components/landing/LandingDemoAnimation";

import { LandingJourneyNav } from "@/components/landing/LandingJourneyNav";

import { LandingWhyCardStack } from "@/components/landing/LandingWhyCardStack";

import { Reveal } from "@/components/landing/Reveal";

import { NodentWordmark } from "@/components/branding/NodentWordmark";

import { buttonVariants } from "@/components/ui/button";

import { cn } from "@/lib/utils";



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

const INSTAGRAM_URL = "https://www.instagram.com/nodent.learning/";



function SectionEyebrow({ children }: { children: ReactNode }) {

  return (

    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark">{children}</p>

  );

}



function SectionTitle({

  children,

  className,

}: {

  children: ReactNode;

  className?: string;

}) {

  return (

    <h2

      className={cn(

        "mt-3 font-display text-[clamp(1.65rem,3.5vw,2.35rem)] font-bold uppercase leading-[1.1] tracking-tight text-[#0b0f19]",

        className,

      )}

    >

      {children}

    </h2>

  );

}



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

      <LandingHeroPoster />



      {/* Product */}

      <section

        id="product"

        className="landing-section scroll-mt-24 border-t border-black/8 py-20 sm:py-28"

      >

        <div className="mx-auto max-w-7xl px-5 sm:px-8">

          <LandingProblemFlow />

          <div className="mt-24 grid gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <SectionEyebrow>Why it works</SectionEyebrow>
              <SectionTitle>Ranking, progress, and competition — together.</SectionTitle>
              <p className="mt-4 text-lg text-slate-600">
                Three ideas that change how revision feels when you can see where you stand.
              </p>
            </Reveal>

            <Reveal delayMs={100}>
              <LandingWhyCardStack />
            </Reveal>
          </div>

        </div>

      </section>



      {/* Demo */}

      <section

        id="demo"

        className="landing-section scroll-mt-24 border-t border-black/8 bg-white py-20 sm:py-28"

      >

        <div className="mx-auto max-w-7xl px-5 sm:px-8">

          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">

            <div>

              <Reveal>

                <SectionEyebrow>Demo</SectionEyebrow>

                <SectionTitle>See how a session works.</SectionTitle>

                <p className="mt-4 text-lg leading-relaxed text-slate-600">

                  Choose a subject, answer VCE-style questions, get instant feedback, see your score,

                  compare your rank, and track growth across sessions.

                </p>

              </Reveal>



              <Reveal delayMs={80} className="mt-8">

                <LandingJourneyNav activeIndex={demoStepIndex} onSelect={selectDemoStep} />

              </Reveal>



              <Reveal delayMs={120} className="mt-8">

                <p className="text-lg leading-relaxed text-slate-600">

                  Follow the journey — each step shows what students actually do in Nodent, from

                  picking a subject to watching their rank and progress move over time.

                </p>

                <Link

                  to="/login"

                  className={cn(

                    buttonVariants(),

                    "mt-8 inline-flex items-center rounded-full bg-[#0b0f19] px-6 text-white hover:bg-[#0b0f19]/90",

                  )}

                >

                  See where you stand

                  <ArrowRight className="ml-2 size-4" />

                </Link>

              </Reveal>

            </div>



            <Reveal delayMs={100}>

              <div id="demo-animation" className="lg:pt-4">

                <LandingDemoAnimation

                  stepIndex={demoStepIndex}

                  onStepIndexChange={setDemoStepIndex}

                />

              </div>

            </Reveal>

          </div>

        </div>

      </section>



      {/* Pricing */}

      <section

        id="pricing"

        className="landing-section scroll-mt-24 border-t border-black/8 bg-gradient-to-b from-white to-brand/[0.06] py-20 sm:py-28"

      >

        <div className="mx-auto max-w-7xl px-5 sm:px-8">

          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,1fr)] lg:items-start lg:gap-16">

            <Reveal className="lg:sticky lg:top-28">

              <SectionEyebrow>Pricing</SectionEyebrow>

              <SectionTitle>Start free during beta.</SectionTitle>

              <p className="mt-4 text-lg text-slate-600">

                Try Nodent and see where you stand — more plans are on the way.

              </p>

            </Reveal>



            <div className="grid gap-6 lg:grid-cols-3">

              {PRICING.map((tier, i) => (

                <Reveal key={tier.name} delayMs={i * 100} className="h-full">

                  <article

                    className={cn(

                      "flex h-full flex-col rounded-2xl border p-8 transition-all duration-300",

                      tier.locked

                        ? "border-slate-200 bg-slate-50/90 text-slate-500 shadow-sm"

                        : "border-brand bg-white shadow-md shadow-brand/10 ring-2 ring-brand/25 hover:shadow-lg",

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

                      {tier.locked ? (

                        <Lock className="size-4 shrink-0 text-slate-400" aria-hidden />

                      ) : null}

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

        </div>

      </section>



      {/* CTA + footer */}

      <section className="landing-section border-t border-black/8 py-20 sm:py-24">

        <div className="mx-auto max-w-7xl px-5 sm:px-8">

          <Reveal>

            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand-light to-[#a8daf7] px-8 py-14 shadow-xl shadow-brand/25 sm:px-12">

              <div className="orb-float-slow pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/20 blur-2xl" />

              <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">

                <div className="max-w-xl text-left">

                  <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">

                    Start revising with clarity.

                  </h2>

                  <p className="mt-4 text-white/90">

                    See where you stand today — before SACs, before exams, before results land.

                  </p>

                </div>

                <Link

                  to="/login"

                  className={cn(

                    buttonVariants({ size: "lg" }),

                    "inline-flex h-12 shrink-0 items-center self-start rounded-full bg-white px-8 text-base font-semibold text-brand-dark hover:bg-white/95 lg:self-center",

                  )}

                >

                  Create your account

                </Link>

              </div>

            </div>

          </Reveal>



          <footer className="mt-16 border-t border-slate-200 pt-10">
            <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
              <NodentWordmark size="sm" variant="onCream" />

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-brand/40 hover:text-brand-dark"
              >
                <InstagramIcon className="size-4" />
                <span>Follow us</span>
                <span className="text-slate-500">@nodent.learning</span>
              </a>

              <p className="text-sm text-slate-500">
                © {new Date().getFullYear()} Nodent. All rights reserved.
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600 sm:justify-end">

              <button

                type="button"

                className="hover:text-brand-dark"

                onClick={() =>

                  document.getElementById("product")?.scrollIntoView({ behavior: "smooth" })

                }

              >

                Product

              </button>

              <button

                type="button"

                className="hover:text-brand-dark"

                onClick={() =>

                  document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })

                }

              >

                Demo

              </button>

              <Link to="/login" className="hover:text-brand-dark">

                Log in

              </Link>

              <Link to="/feedback" className="hover:text-brand-dark">

                Feedback

              </Link>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-brand-dark"
              >
                <InstagramIcon className="size-3.5" />
                Instagram
              </a>

            </div>

          </footer>

        </div>

      </section>

    </div>

  );

}


