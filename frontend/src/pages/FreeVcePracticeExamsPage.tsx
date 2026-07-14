import { CalendarCheck, CheckCircle2, Clock3, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";

import { PublicResourceLayout } from "@/components/seo/PublicResourceLayout";
import { Seo } from "@/components/seo/Seo";

const TITLE = "Free VCE Practice Exams & Exam-Style Questions | Nodent";
const DESCRIPTION = "Prepare for VCE exams with free exam-style questions, timed practice and feedback for Methods, General Maths, Specialist Maths and English on Nodent.";

const schema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Free VCE Practice Exams and Exam-Style Questions",
  url: "https://nodent.pages.dev/free-vce-practice-exams",
  description: DESCRIPTION,
  inLanguage: "en-AU",
  isPartOf: { "@type": "WebSite", name: "Nodent", url: "https://nodent.pages.dev/" },
  about: ["free VCE practice exams", "VCE exam questions", "VCE exam preparation"],
};

const steps = [
  [CalendarCheck, "Choose a focus", "Start with one subject and a manageable set of exam-style questions."],
  [Clock3, "Work under time", "Use a realistic time limit and show every step you would want an assessor to credit."],
  [CheckCircle2, "Review the feedback", "Check the answer, method and units. Record the precise reason for each lost mark."],
  [RotateCcw, "Repeat the weak skill", "Return to the topic with a fresh question until you can complete it without help."],
] as const;

export default function FreeVcePracticeExamsPage() {
  return (
    <>
      <Seo title={TITLE} description={DESCRIPTION} path="/free-vce-practice-exams" structuredData={schema} />
      <PublicResourceLayout
        eyebrow="VCE exam preparation"
        title="Free VCE practice exams and exam-style questions."
        intro="Prepare for SACs and end-of-year exams with active, timed practice. Nodent helps you attempt VCE-style questions, check your working and turn every mistake into a specific next step."
      >
        <section aria-labelledby="included-heading">
          <h2 id="included-heading" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Practise the skills that VCE exams test
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Reading solutions can feel productive, but exam performance comes from retrieving methods and applying them independently. Nodent gives students a free starting point for Mathematical Methods, General Mathematics, Specialist Mathematics and English practice.
          </p>
          <div className="mt-8 rounded-3xl border border-brand/25 bg-brand/[0.08] p-7 sm:p-10">
            <h3 className="font-display text-2xl font-bold">Free practice on Nodent</h3>
            <ul className="mt-5 grid gap-4 text-slate-700 sm:grid-cols-2">
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-deep" /> Unlimited questions with simple answer matching and core feedback</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-deep" /> Three detailed AI markings per day for typed or handwritten answers</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-deep" /> VCE-style maths and English practice in one account</li>
              <li className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brand-deep" /> Feedback that helps identify what to revise next</li>
            </ul>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="method-heading">
          <h2 id="method-heading" className="font-display text-3xl font-bold">How to use a VCE practice exam effectively</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {steps.map(([Icon, name, description], index) => (
              <article key={name} className="rounded-2xl border border-black/8 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand-deep">{index + 1}</span>
                  <Icon className="size-5 text-brand-dark" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-xl font-bold">{name}</h3>
                <p className="mt-2 leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-16 rounded-3xl bg-[#0b0f19] p-7 text-white sm:p-10" aria-labelledby="official-heading">
          <h2 id="official-heading" className="font-display text-3xl font-bold">Use official papers as part of your preparation</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/70">
            Nodent provides VCE-style practice and feedback; it is not VCAA and does not present its questions as official VCAA examinations. For the most authentic final rehearsal, combine targeted Nodent practice with current study designs, examiner reports and past examinations published by VCAA.
          </p>
        </section>

        <section className="mt-16" aria-labelledby="resources-heading">
          <h2 id="resources-heading" className="font-display text-3xl font-bold">Build the rest of your revision plan</h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
            Exam practice works best when it is paired with topic revision and repeated correction. See all of Nodent&apos;s <Link to="/vce-resources" className="font-semibold text-brand-deep underline decoration-brand/30 underline-offset-4">free VCE resources and study tools</Link>, then create an account when you are ready to start answering questions.
          </p>
        </section>
      </PublicResourceLayout>
    </>
  );
}

