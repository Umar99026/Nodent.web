import type { Subject } from "@/lib/subjects";
import { getGeneralMathsCurriculumOverview } from "@/lib/generalMathsCurriculumOverviews";
import { getMethodsCurriculumOverview } from "@/lib/methodsCurriculumOverviews";
import { getSpecialistMathsCurriculumOverview } from "@/lib/specialistMathsCurriculumOverviews";

type EnglishSection = "A" | "B" | "C";

function isMathish(subjectName: string) {
  return /math|methods|specialist|further/i.test(subjectName);
}

function overviewEnglish(section: EnglishSection) {
  if (section === "A") {
    return `### Section A — Text response

You write an analytical essay on **one** selected text (or pair) from the study design — themes, characters, ideas, and authorial views.

**What markers want**
- A clear **contention** that answers the specific prompt (not a theme list)
- **Evidence** (short, embedded quotes) + **analysis** (how language/structure proves your point)
- **TEEL** paragraphs: topic sentence → evidence → analysis → link to contention

**VCE task types**
- Theme / idea prompts (“How does the text explore …?”)
- Character prompts (“To what extent is …?”)
- Viewpoint prompts (author’s perspective on an issue)

**Time discipline:** plan 5–10 minutes; aim for 3–4 body paragraphs plus intro and conclusion.

**Micro‑checklist**
- Re-word the prompt in your introduction
- Embed quotes; avoid long block quotes
- Explain *so what?* — effect on reader and link to contention
- Conclusion: synthesis, not new evidence`;
  }
  if (section === "B") {
    return `### Section B — Creative writing

You produce a **narrative** or **persuasive** piece inspired by a stimulus (image, title, sentence, etc.).

**What markers want**
- Strong **voice** and **idea** sustained across the piece
- Deliberate **craft**: imagery, motif, structure, pacing, point of view
- Clear **connection** to the stimulus (adapt, don’t copy the wording)

**VCE forms**
- Short story / memoir-style narrative
- Speech, opinion piece, or hybrid (read the task instructions)

**Micro‑checklist**
- Hook in the opening; orient the reader quickly
- Sensory detail with purpose (not a list of adjectives)
- End with a shift, realisation, or resolution that fits the prompt
- Proofread for sentence control — clarity is marked`;
  }
  return `### Section C — Writing / argument analysis

You analyse **how** an author argues (language / argument analysis), not whether you agree.

**What markers want**
- **Contention** and **target audience** stated early
- **Arguments** as a line of reasoning (not a list of devices)
- **Technique → example → effect** on audience

**High-value techniques (VCE)**
- Tone shifts, inclusive language, appeals (logic, emotion, credibility)
- Rhetorical questions, contrast, anecdote, statistics, expert opinion
- Visuals in hybrid pieces — layout, gaze, symbolism

**Micro‑checklist**
- Argument map: contention + 2–3 supporting moves
- Group by **argument**, not by technique alphabet
- Quote briefly; analyse **intended effect** on the audience
- Compare two pieces only if the task asks for comparison`;
}

export function getTopicOverview(args: {
  subjectId: string;
  subject?: Subject;
  topic?: string;
  englishSection?: EnglishSection;
}): string {
  const subjectName = args.subject?.name ?? args.subjectId;

  if (args.subjectId === "english") {
    const sec = args.englishSection ?? "A";
    return overviewEnglish(sec);
  }

  const topic = (args.topic ?? "all").trim();
  if (!topic || topic === "all") {
    return `### Your plan
- Pick a topic to focus your practice.
- Skim the overview (formulas / theory).
- Hit **Questions** to start.

**Subject:** ${subjectName}`;
  }

  if (args.subjectId === "methods") {
    const m = getMethodsCurriculumOverview(topic);
    if (m) return m;
    return `### ${topic}

No overview is defined for this label yet. Use one of the fourteen **Units 3 & 4 topics** (Functions and transformations, Differential calculus, …) with the exact spelling.

**Subject:** Mathematical Methods`;
  }

  if (args.subjectId === "general-maths") {
    const g = getGeneralMathsCurriculumOverview(topic);
    if (g) return g;
    return `### ${topic}

No overview is defined for this label yet. Use one of the four **Units 3 & 4 topics** (Data analysis; Recursion and financial modelling; Matrices; Networks and decision mathematics) with the exact spelling.

**Subject:** General Mathematics`;
  }

  if (args.subjectId === "specialist-maths") {
    const sp = getSpecialistMathsCurriculumOverview(topic);
    if (sp) return sp;
    return `### ${topic}

No overview is defined for this label yet. Use one of the twelve **Units 3 & 4 topics** (Logic and proof, Complex numbers and algebra, Differential calculus, …) with the exact spelling.

**Subject:** Specialist Mathematics`;
  }

  if (isMathish(subjectName)) {
    return `### ${topic}

Structured study-design notes for **${subjectName}** are not bundled yet. Use your class materials, then start **Questions** when you’re ready.`;
  }

  // Default non-maths overview
  return `### ${topic}

**Quick overview for ${subjectName}**
- Key definitions you should be able to say in one sentence
- 3 high‑yield facts / rules for this topic
- What a “full marks” answer usually includes

**Common traps**
- Vague explanations (be specific, use examples)
- Not linking evidence back to the question wording`;
}
