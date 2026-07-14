import type { ReactNode } from "react";
import { ArrowRight, BookOpenCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { NodentWordmark } from "@/components/branding/NodentWordmark";

type PublicResourceLayoutProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
};

export function PublicResourceLayout({ eyebrow, title, intro, children }: PublicResourceLayoutProps) {
  return (
    <div className="min-h-dvh bg-[#faf9f7] text-[#0b0f19]">
      <header className="border-b border-black/8 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" aria-label="Nodent home">
            <NodentWordmark size="sm" variant="onCream" />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium" aria-label="Main navigation">
            <Link to="/vce-resources" className="hidden text-slate-600 hover:text-brand-dark sm:inline">
              VCE resources
            </Link>
            <Link to="/free-vce-practice-exams" className="hidden text-slate-600 hover:text-brand-dark md:inline">
              Practice exams
            </Link>
            <Link to="/login" className="rounded-full bg-brand px-5 py-2.5 text-white hover:bg-brand-dark">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="border-b border-black/8 bg-gradient-to-br from-[#eef8ff] via-white to-[#f5fbff]">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-deep">{eyebrow}</p>
            <h1 className="mt-4 max-w-4xl font-display text-[clamp(2.25rem,6vw,4.5rem)] font-bold leading-[1.02] tracking-tight">
              {title}
            </h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600 sm:text-xl">{intro}</p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#0b0f19] px-6 py-3 font-semibold text-white hover:bg-[#0b0f19]/90"
            >
              Try Nodent free <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-5 py-14 sm:px-8 sm:py-20">{children}</div>
      </main>

      <footer className="border-t border-black/8 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="size-5 text-brand-dark" />
            <span className="text-sm text-slate-600">VCE practice with clear, immediate feedback.</span>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-slate-600">
            <Link to="/" className="hover:text-brand-dark">Home</Link>
            <Link to="/vce-resources" className="hover:text-brand-dark">VCE resources</Link>
            <Link to="/free-vce-practice-exams" className="hover:text-brand-dark">Practice exams</Link>
            <Link to="/login" className="hover:text-brand-dark">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

