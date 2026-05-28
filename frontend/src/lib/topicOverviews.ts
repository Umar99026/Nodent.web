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
    return `### Section A — Analytical response to a text

#### What you need to do

Write an analytical response on **one** set text. Choose **one** prompt/topic for your selected text and engage with the **ideas, concerns and values** raised by the prompt, supported by **close reference** to the text.

If your text is a **poetry** or **short story collection**, you may write on multiple pieces (or at least **two** in close detail).

---

#### Key content points to know

| Area | What this means |
| --- | --- |
| Text knowledge | Characters, plot, setting, structure, symbols, motifs |
| Themes / ideas | Big concepts like power, identity, freedom, justice, memory, family, belonging |
| Authorial intent | What the writer/director suggests about human behaviour or society |
| Values and concerns | What the text criticises, celebrates, questions or warns against |
| Evidence | Short quotations, scenes, moments, structural choices, imagery |
| Prompt unpacking | Understanding command terms like “discuss”, “to what extent”, “how does…” |

---

#### What a strong response does

VCAA assesses Section A on **knowledge of the text**, its **structure**, **ideas/concerns/values**, **coherent analysis**, **evidence**, and **fluent expression**.

A high-scoring response:
- directly answers the **prompt** (not plot retell)
- builds a clear **argument** across the essay
- analyses the writer’s **choices** (how meaning is made)
- uses evidence smoothly and selectively (short, embedded)
- shows complexity: **“although…, ultimately…”**

---

#### Suggested structure

**Introduction**
- Direct answer to the prompt
- 2–3 key ideas
- Overall interpretation of the text

**Body paragraph 1**
- Main argument
- Evidence
- Analysis of meaning / authorial purpose

**Body paragraph 2**
- Second argument
- Evidence
- Analysis

**Body paragraph 3**
- More complex or contrasting idea
- Evidence
- Analysis

**Conclusion**
- Return to the prompt
- Summarise the text’s broader message

---

#### Tips for this study platform

**Useful practice modes**

| Feature | Purpose |
| --- | --- |
| Prompt unpacking drills | Identify what the question is really asking |
| Quote bank by theme | Memorisation and evidence selection |
| Theme-to-evidence matching | Build analytical thinking |
| Essay plan generator | Teach structure before full writing |
| Paragraph feedback | Faster than marking whole essays |
| “Plot summary vs analysis” detector | Avoid retelling |

**Useful stats to show**
- Text knowledge score
- Prompt relevance score
- Evidence quality score
- Analysis depth score
- Expression score`;
  }
  if (section === "B") {
    return `### Section B — Creating a text

#### What you need to do

Create one written text (excluding song, poetry or verse). Your response must connect meaningfully with:
- one **Framework of Ideas**
- the given **title**
- at least **one stimulus**

Your text must have a clear purpose using at least one of: **explain**, **express**, **reflect**, **argue** (or a combination).

---

#### Frameworks of Ideas (example list)

| Framework | Example focus |
| --- | --- |
| Writing about country | Place, land, identity, belonging, connection |
| Writing about protest | Resistance, change, justice, voice |
| Writing about personal journeys | Growth, change, struggle, discovery |
| Writing about play | Rules, freedom, imagination, competition |

---

#### Key content points to know

| Area | What this means |
| --- | --- |
| Framework of Ideas | The broad conceptual area you are writing within |
| Title | Must shape the piece, not just be copied at the top |
| Stimulus | Must be meaningfully used, not randomly inserted |
| Purpose | Explain, express, reflect, argue — or a combination |
| Audience | Who the piece is written for |
| Form | Speech, opinion piece, memoir, personal reflection, essay, letter, feature article, etc. |
| Voice | The personality, tone and perspective of the writing |
| Cohesion | The piece should feel complete and controlled |

---

#### What a strong response does

VCAA assesses Section B on relevant ideas from the **Framework/title/stimulus**, a cohesive text with clear **purpose** and appropriate **voice**, suitable structure and language features, and fluent expression.

A high-scoring response:
- clearly fits the chosen Framework
- uses the title in a meaningful way
- integrates stimulus naturally
- has a clear form, voice and purpose
- sounds polished, controlled and intentional
- avoids vague/generic writing or forced melodrama

---

#### Suggested planning method

Decide before you write:
- Framework:
- Title:
- Stimulus chosen:
- Form:
- Audience:
- Purpose:
- Voice:
- Main idea:
- Ending:

**Example**
- Framework: Writing about protest
- Title: Small Acts, Big Wins
- Stimulus: quote about starting with the next person who needs help
- Form: reflective speech
- Purpose: to reflect and argue
- Voice: thoughtful, sincere, hopeful
- Main idea: protest does not always begin with grand gestures

---

#### Tips for this study platform

**Useful practice modes**

| Feature | Purpose |
| --- | --- |
| Framework idea bank | Generate deeper ideas |
| Stimulus integration practice | Prevent forced/superficial use |
| Form selector | Teach different writing structures |
| Voice/tone drills | Write with control |
| Purpose checker | Check whether the piece explains/reflects/argues/expresses |
| Timed writing prompts | Build exam speed |

**Useful stats to show**
- Framework relevance score
- Stimulus integration score
- Purpose clarity score
- Voice control score
- Cohesion score
- Language quality score`;
  }
  return `### Section C — Analysis of argument and language

#### What you need to do

Analyse **how** arguments, written/spoken language and **visuals** are used to persuade an intended audience.

VCAA uses:
- **language** = written and spoken language
- **visuals** = images and graphics

You are given background information and persuasive material (written/spoken/visual) plus a task asking you to analyse persuasion.

---

#### Key content points to identify and analyse

| Area | What this means |
| --- | --- |
| Contention | The writer/speaker’s overall point of view |
| Arguments | The main reasons used to support the contention |
| Audience | Who is being targeted |
| Tone | Calm, urgent, frustrated, hopeful, inclusive, critical, etc. |
| Language choices | Word choice, appeals, rhetorical questions, repetition, inclusive language |
| Persuasive appeals | Logic, emotion, ethics, fear, responsibility, community values |
| Visuals | Images, layout, captions, symbolism, contrast, framing |
| Intended effect | How the audience is positioned to think, feel or act |

---

#### What a strong response does

VCAA assesses Section C on understanding of **contention/arguments/point of view**, analysis of written/spoken language and visuals, **evidence**, and fluent expression.

A high-scoring response:
- identifies the overall contention early
- follows the development of argument logically
- analyses persuasion (not just labels techniques)
- links language choices to intended audience response
- discusses visuals meaningfully
- avoids technique-spotting without explanation

---

#### Strong paragraph formula

Argument being made  
\(+\) evidence from the material  
\(+\) language choice / visual feature  
\(+\) intended effect on the audience  
\(+\) link to contention

**Example sentence style**

By describing the proposal as a “smarter investment”, the writer positions the audience to view the change as practical and responsible, strengthening support for their overall contention.`;
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
