/**
 * VCE Mathematical Methods — four Areas of Study (Units 1–2 combined per topic).
 * Markdown + KaTeX matches `RichQuestionContent` (`$...$`, `$$...$$`).
 */

import {
  METHODS_AREA_OF_STUDY_TOPICS,
  type MethodsAreaOfStudyTopic,
  stripMethodsUnitPrefix,
} from "@/lib/methodsAreaTopic";

export { METHODS_AREA_OF_STUDY_TOPICS, type MethodsAreaOfStudyTopic };

/** @deprecated Use METHODS_AREA_OF_STUDY_TOPICS */
export const METHODS_STUDY_DESIGN_TOPICS = METHODS_AREA_OF_STUDY_TOPICS;

const norm = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const METHODS_TOPIC_ALIASES: Record<string, MethodsAreaOfStudyTopic> = {
  calculus: "Calculus",
  "functions & graphs": "Functions, relations and graphs",
  trigonometry: "Functions, relations and graphs",
  algebra: "Algebra, number and structure",
  probability: "Data analysis, probability and statistics",
  functions: "Functions, relations and graphs",
  graphs: "Functions, relations and graphs",
  statistics: "Data analysis, probability and statistics",
  "data analysis": "Data analysis, probability and statistics",
};

const MARKDOWN: Record<MethodsAreaOfStudyTopic, string> = {
  "Functions, relations and graphs": `## Functions, relations and graphs
### Area of Study 1 (Units 1–2 combined)

---

### Unit 1 — Polynomial and power functions

Students use graphs of **polynomial** and **power** functions of a single real variable and interpret key features in modelling and theory.

#### Functions, domain and representation

- **Function notation**; **domain**, **co-domain**, **range** (including maximal / natural / implied domains).
- Representations: **rule**, **graph**, **table**; move between them; **inverse** functions and graphs.

#### Reading graphs

Qualitative interpretation of graphs with or without a formula: **intercepts**, **stationary** points, **inflection**, **asymptotes**, **symmetry**, and real **data** sets.

#### Power functions and transformations

Graphs of power functions (integer / simple rational exponents as prescribed) and transformations to

$$
y = a(x+b)^n + c
$$

#### Low-degree polynomials

Intercept / turning / end behaviour; links to factors (see **Algebra, number and structure**).

---

### Unit 2 — Circular, exponential and logarithmic functions

#### Circular (trigonometric)

- **Unit circle**, **radians**, **arc length**; $\sin$, $\cos$, $\tan$ as functions on $\mathbb{R}$.
- Small-angle ideas such as $\sin x \approx x$ (for $|x|$ small, radians).
- **Exact values** at multiples of $\tfrac{\pi}{6}$, $\tfrac{\pi}{4}$.
- **Symmetry**, **complementary** and **periodicity** properties.

Functions

$$
y = a\,\phi(bx+c)+d,\quad \phi\in\{\sin,\cos,\tan\}
$$

Interpret **period**, **amplitude**, **phase**, **vertical shift** in modelling.

#### Exponential

$$
y = ae^{kt} \quad \text{or} \quad y = ab^{t}
$$

**Initial value**, growth/decay, **half-life**, **doubling time**, long-run behaviour.

#### Logarithmic

$y=\log_a x \leftrightarrow x=a^y$; graphs; laws such as $\log_a(xy)=\log_ax+\log_ay$, $\log_a(x^r)=r\log_ax$.
`,

  "Algebra, number and structure": `## Algebra, number and structure
### Area of Study 2 (Units 1–2 combined)

---

### Unit 1 — Symbolic algebra and transformations

Supports work in functions, calculus and statistics.

- **Substitution**, **equivalence**, **simplification**; **distributive** and **exponent** laws on polynomial / power expressions.
- **Parameters** and **families** of functions; determine rules from information.
- **Transformations of the plane**: dilations (parallel to / from an axis), **reflections**, **translations** (matrix form optional).

#### Polynomials: roots, factors, intercepts

**Remainder**, **factor**, **rational root** theorems as applicable.

Solve **polynomial equations** numerically, graphically, algebraically; **bisection** for roots.

#### Other equation types

- **Simultaneous linear** equations (two variables: link algebra to geometry of lines).
- Equations $f(x)=g(x)$ numerically, graphically, algebraically.

---

### Unit 2 — Transcendental algebra

- Solve $f(x)=k$ for $\sin/\cos/\tan$ and $a^x$ on a **given domain** (exact where dictated, otherwise CAS).
- **Exponent** and **logarithm** laws; solving exponential / logarithmic equations.
- **Newton’s method** for numerical roots of **cubic** polynomials (as prescribed).
`,

  Calculus: `## Calculus
### Area of Study 3 (Units 1–2 combined)

---

### Unit 1 — Introduction to rate of change

- **Average** vs **instantaneous** rates; average as **secant** gradient; instantaneous as informal **limit** of average rate.
- “Real world” graphs (temperature, pollution, **motion**, water height in tanks) — informal **continuity** / **smoothness**.
- **Gradient of tangent** at a point: sign of rate; link to shape of $y=f(x)$ (increasing/decreasing, qualitative extremes).

---

### Unit 2 — Differentiation and anti-differentiation (polynomials)

#### Derivative as limit

Definitions such as

$$
f'(x)=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
$$

**Central difference**:

$$
f'(x)\approx\frac{f(x+h)-f(x-h)}{2h}
$$

and its graphical meaning.

#### Meaning and rules

- $f'(x)$ as **gradient** and **instantaneous rate**.
- Differentiate **polynomials** by rule (**power rule**, linearity).

#### Applications

**Stationary** points, local **max/min**, **inflection**, **motion** graphs, **optimisation** with modelling domain and local vs global extrema.

#### Anti-differentiation

Families with the same derivative; **boundary / initial** condition for a particular antiderivative.
`,

  "Data analysis, probability and statistics": `## Data analysis, probability and statistics
### Area of Study 4 (Units 1–2 combined)

---

### Unit 1 — Experiments, outcomes, counting

- **Trial**, **outcome**, **event**, **frequency**, **probability**; finite **sample spaces**.
- Represent events: **lists**, **grids**, **Venn diagrams**, **tables**.
- **Elementary** vs **compound** events; **random variables** (introductory).
- **Simulation** (physical + technology pseudo-random); interpret repeated outcomes / **proportions**.
- **Addition** / **multiplication** counting principles; **combinations** $\displaystyle\binom{n}{r}$ and probability applications.

---

### Unit 2 — Structured probability

Represent and compute using lists, grids, Venn, **tree diagrams**.

**Addition rule**:

$$
P(A\cup B)=P(A)+P(B)-P(A\cap B)
$$

Mutually exclusive case: $P(A\cap B)=0$.

**Conditional** probability:

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)},\quad P(B)>0
$$

**Multiplication** rule, **law of total probability** (two-event case).

**Independence** (pairwise): e.g. $P(A\cap B)=P(A)P(B)$ when appropriate.

**Simulation** with and without replacement.
`,
};

export function getMethodsCurriculumOverview(topic: string): string | null {
  const t0 = String(topic ?? "").trim();
  if (!t0) return null;
  const t = stripMethodsUnitPrefix(t0);

  if (Object.prototype.hasOwnProperty.call(MARKDOWN, t)) {
    return MARKDOWN[t as MethodsAreaOfStudyTopic];
  }

  const n = norm(t);
  const alias = METHODS_TOPIC_ALIASES[n];
  if (alias) return MARKDOWN[alias] ?? null;

  for (const k of METHODS_AREA_OF_STUDY_TOPICS) {
    if (norm(k) === n || norm(k) === norm(t0)) return MARKDOWN[k];
  }
  return null;
}

export function topicExistsInQuestionBank(topic: string, questions: { topic?: string }[]): boolean {
  const t = String(topic ?? "").trim();
  if (!t || t === "all") return true;
  return questions.some((q) => String(q.topic ?? "").trim() === t);
}
