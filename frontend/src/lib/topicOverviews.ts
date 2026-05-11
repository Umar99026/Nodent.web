import type { Subject } from "@/lib/subjects";

type EnglishSection = "A" | "B" | "C";

function norm(s: string) {
  return String(s ?? "").trim().toLowerCase();
}

function isMathish(subjectName: string) {
  return /math|methods|specialist|further/i.test(subjectName);
}

function overviewMath(topic: string) {
  const t = norm(topic);

  if (/prob|random|binom|normal|z[-\s]?score|hypothesis|sampling|confidence/i.test(t)) {
    return `### ${topic}

**Core formulas**
- \(z = \\frac{x-\\mu}{\\sigma}\\)
- \(P(a<X<b)=P\\left(\\frac{a-\\mu}{\\sigma}<Z<\\frac{b-\\mu}{\\sigma}\\right)\)
- Binomial: \(P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}\)
- \(E(X)=np\), \(\\mathrm{Var}(X)=np(1-p)\)

**Checklist**
- Identify the distribution + parameters (\(n,p\) or \(\\mu,\\sigma\))
- Convert to a standard form (often \(Z\))
- Be explicit with “at least / at most / between”

**Common traps**
- Rounding too early, or using \(\\sigma\\) vs \(\\sigma^2\)
- Forgetting continuity correction when appropriate`;
  }

  if (/finance|interest|annuity|loan|amort|present value|future value/i.test(t)) {
    return `### ${topic}

**Core formulas**
- Compound interest: \(A=P(1+i)^n\)
- Present value: \(P=\\frac{A}{(1+i)^n}\)
- Annuity (FV): \(A=R\\frac{(1+i)^n-1}{i}\)
- Annuity (PV): \(P=R\\frac{1-(1+i)^{-n}}{i}\)

**Checklist**
- Decide if it’s a single lump sum or a stream of payments
- Keep units consistent (monthly rate with months)
- State your rate \(i\) clearly (as a decimal)

**Common traps**
- Mixing annual rate with monthly \(n\)
- Using PV formula when the question wants FV (or vice‑versa)`;
  }

  if (/calculus|different|derivative|integral|area|rate of change|antiderivative/i.test(t)) {
    return `### ${topic}

**Core formulas**
- Power rule: \\(\\frac{d}{dx}x^n = nx^{n-1}\\)
- Product rule: \\((uv)'=u'v+uv'\\)
- Chain rule: \\(\\frac{d}{dx}f(g(x)) = f'(g(x))g'(x)\\)
- Fundamental theorem: \\(\\int_a^b f(x)\\,dx = F(b)-F(a)\\)

**Checklist**
- Write the function cleanly before differentiating/integrating
- Mark turning points by solving \(f'(x)=0\)
- For area, check sign (area vs signed area)

**Common traps**
- Forgetting chain rule factors
- Dropping absolute values for “distance/area”`;
  }

  return `### ${topic}

**Quick refresher**
- Write down the key definitions for this topic.
- List the 2–3 formulas you keep using.
- Watch for unit consistency and rounding rules.

Hit **Questions** when you’re ready.`;
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

  if (isMathish(subjectName)) return overviewMath(topic);

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

