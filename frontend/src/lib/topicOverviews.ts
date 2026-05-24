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

**What markers want**
- A clear contention / controlling idea
- Evidence (quotes) + analysis (how it proves your point)
- Tight paragraph structure (topic sentence → evidence → analysis → link)

**Micro‑checklist**
- Define key theme/author intention in the first paragraph
- Embed quotes (don’t “quote dump”)
- Explain *so what?* after each quote`;
  }
  if (section === "B") {
    return `### Section B — Creative writing

**What markers want**
- Strong idea + consistent voice
- Purposeful crafting choices (imagery, motif, structure)
- A clear relationship to the stimulus (not just a copy)

**Micro‑checklist**
- Establish setting/character quickly
- Use sensory detail with restraint
- End with a deliberate shift or resolution`;
  }
  return `### Section C — Writing / argument analysis

**What markers want**
- Accurate identification of argument + audience
- Clear explanation of techniques and intended effect
- Control (don’t list devices—analyse impact)

**Micro‑checklist**
- Start with argument map (contention + key points)
- Analyse techniques in context (quote → technique → effect)
- Track tone shifts and audience targeting`;
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

