import { BookOpen, ChartNoAxesCombined, CircleCheck, PenLine } from "lucide-react";
import { Link } from "react-router-dom";

import { PublicResourceLayout } from "@/components/seo/PublicResourceLayout";
import { Seo } from "@/components/seo/Seo";

const TITLE = "Free VCE Resources & Study Tools | Nodent";
const DESCRIPTION = "Free VCE resources and exam-style practice for Mathematical Methods, General Mathematics, Specialist Mathematics and English, with instant feedback from Nodent.";

const subjects = [
  ["Mathematical Methods", "Practise functions, calculus, probability and algebra with questions designed for VCE revision."],
  ["General Mathematics", "Build confidence across data analysis, matrices, networks, finance and recurrence relations."],
  ["Specialist Mathematics", "Work through vectors, complex numbers, calculus, mechanics and proof-style questions."],
  ["VCE English", "Plan and write responses, then use focused feedback to identify strengths and next improvements."],
] as const;

const schema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Free VCE Resources and Study Tools",
  url: "https://nodent.pages.dev/vce-resources",
  description: DESCRIPTION,
  inLanguage: "en-AU",
  isPartOf: { "@type": "WebSite", name: "Nodent", url: "https://nodent.pages.dev/" },
  about: ["VCE study", "VCE revision", "VCE practice questions", "Victorian Certificate of Education"],
};

export default function VceResourcesPage() {
  return (
    <>
      <Seo title={TITLE} description={DESCRIPTION} path="/vce-resources" structuredData={schema} />
      <PublicResourceLayout
        eyebrow="Free VCE resources"
        title="VCE study resources that turn practice into progress."
        intro="Practise VCE-style questions, check your understanding and find the topics that need more work. Nodent brings maths and English revision into one focused study space."
      >
        <section aria-labelledby="subjects-heading">
          <h2 id="subjects-heading" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            VCE subjects you can practise
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Good revision is active: answer a question, check the result, understand the correction and try again. Nodent supports that loop across four popular VCE subjects.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {subjects.map(([name, description]) => (
              <article key={name} className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
                <BookOpen className="size-6 text-brand-dark" aria-hidden />
                <h3 className="mt-4 font-display text-xl font-bold">{name}</h3>
                <p className="mt-2 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 grid gap-8 rounded-3xl bg-[#0b0f19] p-7 text-white sm:p-10 lg:grid-cols-3" aria-labelledby="study-heading">
          <div className="lg:col-span-3">
            <h2 id="study-heading" className="font-display text-3xl font-bold">A clearer way to revise for VCE</h2>
          </div>
          <div>
            <PenLine className="size-6 text-brand-light" />
            <h3 className="mt-4 font-semibold">Answer actively</h3>
            <p className="mt-2 leading-7 text-white/70">Use typed or handwritten working instead of only rereading notes.</p>
          </div>
          <div>
            <CircleCheck className="size-6 text-brand-light" />
            <h3 className="mt-4 font-semibold">Correct mistakes</h3>
            <p className="mt-2 leading-7 text-white/70">See whether an answer is correct and use feedback to understand the method.</p>
          </div>
          <div>
            <ChartNoAxesCombined className="size-6 text-brand-light" />
            <h3 className="mt-4 font-semibold">Target weak topics</h3>
            <p className="mt-2 leading-7 text-white/70">Use your results to spend revision time where it can recover the most marks.</p>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="free-heading">
          <h2 id="free-heading" className="font-display text-3xl font-bold">What is free?</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            You can create a free Nodent account and complete unlimited practice questions with answer matching and core feedback. Free students also receive a daily allowance of three detailed AI markings, which can be used for typed answers or handwriting scans. Paid access is available for students who want more detailed marking and expanded revision tools.
          </p>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Preparing for assessments? Explore our <Link to="/free-vce-practice-exams" className="font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4">free VCE practice exam guide and exam-style questions</Link>.
          </p>
        </section>
      </PublicResourceLayout>
    </>
  );
}

