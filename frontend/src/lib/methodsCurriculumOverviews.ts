/**
 * VCE Mathematical Methods — Units 1 & 2 study design summaries for Practice Setup.
 * Uses the same Markdown + KaTeX conventions as questions (`$...$`, `$$...$$`).
 */

export const METHODS_STUDY_DESIGN_TOPICS = [
  "Unit 1 — Functions, relations and graphs",
  "Unit 1 — Algebra, number and structure",
  "Unit 1 — Calculus",
  "Unit 1 — Data analysis, probability and statistics",
  "Unit 2 — Functions, relations and graphs",
  "Unit 2 — Algebra, number and structure",
  "Unit 2 — Calculus",
  "Unit 2 — Data analysis, probability and statistics",
] as const;

export type MethodsStudyDesignTopic = (typeof METHODS_STUDY_DESIGN_TOPICS)[number];

const norm = (s: string) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Legacy / sheet labels → canonical study-design topic (best-effort for existing banks). */
const METHODS_TOPIC_ALIASES: Record<string, MethodsStudyDesignTopic> = {
  calculus: "Unit 2 — Calculus",
  "functions & graphs": "Unit 1 — Functions, relations and graphs",
  trigonometry: "Unit 2 — Functions, relations and graphs",
  algebra: "Unit 1 — Algebra, number and structure",
  probability: "Unit 1 — Data analysis, probability and statistics",
  functions: "Unit 1 — Functions, relations and graphs",
  graphs: "Unit 1 — Functions, relations and graphs",
  "functions, relations and graphs": "Unit 1 — Functions, relations and graphs",
  statistics: "Unit 2 — Data analysis, probability and statistics",
  "data analysis": "Unit 2 — Data analysis, probability and statistics",
};

const MARKDOWN: Record<MethodsStudyDesignTopic, string> = {
  "Unit 1 — Functions, relations and graphs": `## Unit 1 — Area of Study 1  
### Functions, relations and graphs

Students use graphs of **polynomial** and **power** functions of a single real variable. They interpret key features of graphs and functions in modelling and in theory.

---

### 1. Functions, domain and representation

- **Function notation** and a function as a mapping from a domain to a **co-domain**; **range** as the set of output values actually attained.
- **Domain** including **maximal**, **natural** and **implied** domains for rules that arise from formulas.
- A function may be given by a **rule**, a **graph**, or a **table**; move between these representations.

---

### 2. Reading graphs (with and without a formula)

Qualitative interpretation of **features** of graphs, including **real data** where no explicit rule is given:

- approximate location of **axis intercepts**
- **stationary** points (local max / min)
- **points of inflection**
- **asymptotic** behaviour (vertical / horizontal where relevant)
- **symmetry** (e.g. even / odd structure where obvious from the graph)

---

### 3. Power functions and transformations

Graphs of power functions for integer and simple rational exponents as required by the study design, and **transformations** to the form

$$
y = a(x+b)^n + c
$$

where $n$ is fixed by the family you are studying and $a$, $b$, $c$ control dilation, translation, and reflection structure.

---

### 4. Polynomials (low degree)

Graphs of **polynomial** functions of low degree; interpret:

- **axis intercepts**
- **turning points**
- **end behaviour** as $x \to \pm\infty$
- links between **factorised form** and **x-intercepts** (see Unit 1 Algebra for factor theorems).
`,

  "Unit 1 — Algebra, number and structure": `## Unit 1 — Area of Study 2  
### Algebra, number and structure

This area supports **Functions**, **Calculus** and **Data analysis**. In Unit 1 the focus is the algebra of **polynomial** functions of low degree and **transformations of the plane**.

---

### 1. Symbolic skills

- **Substitution** into expressions; **equivalent** forms; **simplifying** expressions.
- **Distributive** and **exponent** laws applied to polynomial and power forms, moving between equivalent forms.

---

### 2. Parameters and families

Use **parameters** to describe **families** of functions and relations; determine a **rule** from suitable information (points, intercepts, shape class, etc.).

---

### 3. Transformations of the plane

Apply to **basic** functions and relations using **dilations** (including “parallel to an axis” and “from an axis” language), **reflections** in an axis, and **translations**. Matrix form is optional.

---

### 4. Polynomials: roots, factors, intercepts

Connect **roots** of a polynomial, **linear factors**, and **x-axis intercepts** of its graph.

Use as required:

- **Remainder theorem**
- **Factor theorem**
- **Rational root** theorem (where applicable)

Solve **polynomial equations** of low degree **numerically**, **graphically**, and **algebraically**, including approximating a root by the **bisection method**.

---

### 5. Equation types studied in Unit 1

- **Simultaneous linear equations** (for two variables, connect algebraic solutions to **geometric** intersection of lines).

- Equations that can be framed as

$$
f(x) = g(x)
$$

solve **numerically**, **graphically**, and **algebraically** where appropriate (including intersection interpretation on graphs).
`,

  "Unit 1 — Calculus": `## Unit 1 — Area of Study 3  
### Calculus (introduction)

This introduction focuses on **constant** and **average** rates of change and an informal approach to **instantaneous** rate in familiar contexts (including **numerical** and **graphical** estimation).

---

### 1. Rates of change

- **Average rate of change** over an interval; interpret as gradient of a **secant**.
- **Instantaneous rate** introduced informally as the **limiting case** of average rate as the interval shrinks (conceptual, with numerical / graphical support).

---

### 2. Graphs of empirical relationships

Read **rate of change** from context graphs, e.g.:

- temperature or pollution vs time  
- **motion** graphs (position / velocity ideas approached informally)

**Height of water** in tanks of different shape filled at a **constant** rate: relate filling graphs to rate of change of height.

Informal language around **continuity** and **smoothness** as relevant to whether “gradient of tangent” is meaningful at a point.

---

### 3. Gradient of the tangent

Use the **gradient of the tangent** at a point on $y=f(x)$ to describe **instantaneous** rate of change:

- where rate is **positive**, **negative**, or **zero**
- how the sign and magnitude of this gradient relate to **features** of the graph of $f$ (increasing / decreasing / local extremes in qualitative terms).
`,

  "Unit 1 — Data analysis, probability and statistics": `## Unit 1 — Area of Study 4  
### Data analysis, probability and statistics

Introduces **finite** sample spaces and **basic** probability with **counting**.

---

### 1. Language and representations

- **Experiment (trial)**, **outcome**, **event**, **relative frequency** (informal probability from repetition).
- Represent sample spaces and events using **lists**, **grids**, **Venn diagrams**, **tables**, and similar diagrams.

---

### 2. Events and variables

- **Elementary** and **compound** events.
- Introduce **random variables** and the **distribution** of results from repeated experiments (informal, discrete settings).

---

### 3. Simulation

Simulation using physical generators (coins, dice, spinners) and **technology**-based pseudo-random generators; display and interpret repeated outcomes, including informal **proportions** in samples.

---

### 4. Counting and probability

- **Addition** and **multiplication** counting principles (careful tracking of ordered vs unordered settings only as required by your course prescription).
- **Combinations** (selections) and values such as

$$
\binom{n}{r}
$$

with applications to computing probabilities in finite equally-likely models when appropriate.
`,

  "Unit 2 — Functions, relations and graphs": `## Unit 2 — Area of Study 1  
### Functions, relations and graphs

Students study **circular**, **exponential** and **logarithmic** functions of one variable: key features and modelling.

---

### 1. Circular (trigonometric) functions

- The **unit circle**, **radians**, **arc length**; sine, cosine and tangent as functions of a **real variable**.
- For small $|x|$ (radians), interpret relationships such as $\sin x \approx x$ in suitable informal limits-based discussion.
- **Exact values** at standard axes multiples (e.g. multiples of $\tfrac{\pi}{6}$, $\tfrac{\pi}{4}$).
- **Symmetry**, **complementary** relationships, **periodicity** for $\sin$, $\cos$, $\tan$.
- Functions of the form

$$
y = a\,\phi(bx+c)+d
$$

where $\phi$ is $\sin$, $\cos$ or $\tan$, identifying **period**, **amplitude** (where defined), **phase** shift, and **vertical** shift from parameters within modelling contexts.

---

### 2. Exponential functions

Functions

$$
y = a\,e^{kt} \quad \text{or equivalently} \quad y = a\,b^{t}
$$

(with parameters determined by context): graphs and simple modelling. Interpret **initial value**, **growth/decay rate**, **half-life**, **doubling time**, and **long-run** behaviour; relate to parameters in the chosen form.

---

### 3. Logarithmic functions

Logarithms as inverses of exponentials: for suitable bases $a>0$, $a\neq 1$,

$$
y = \log_a x \quad \leftrightarrow \quad x = a^y
$$

Graphs, domain/range, and identities such as

$$
\log_a(xy)=\log_a x + \log_a y,\qquad \log_a(x^r)=r\log_a x
$$

(develop fully in Unit 2 Algebra as laws for solving equations).
`,

  "Unit 2 — Algebra, number and structure": `## Unit 2 — Area of Study 2  
### Algebra, number and structure

Focus: algebra of simple **transcendental** functions and **transformations**, consolidating Unit 1 skills.

---

### 1. Solving equations with inverses (restricted domains)

Use **inverse functions** and **transformations** to solve equations

$$
f(x)=k
$$

where $f$ is $\sin$, $\cos$, $\tan$ or an exponential $a^x$ (base $a>0$, $a\neq 1$) on a **given domain**, using **exact** values where possible and **approximate** values from a calculator otherwise.

---

### 2. Exponent and logarithm laws

**Exponent laws** and **logarithm laws** (including change-of-base where needed) applied to **solving** simple exponential and logarithmic **equations**.

---

### 3. Newton’s method

Numerical approximation of a root of a **cubic** polynomial using the **Newton’s method** algorithm (as specified for Methods).

---

### Revision / consolidation

Opportunity to revisit Unit 1 algebra (polynomials, transformations, systems) alongside the transcendental material above.
`,

  "Unit 2 — Calculus": `## Unit 2 — Area of Study 3  
### Calculus

Differentiation and **anti-differentiation** of **polynomials** by rule, with applications including **graph analysis**.

---

### 1. The derivative as a limit

Informal limit view of the gradient of the tangent; standard limit definitions such as

$$
f'(x)=\lim_{h\to 0}\frac{f(x+h)-f(x)}{h}
$$

and equivalent one-sided forms as used in your course.

**Central difference** approximation:

$$
f'(x)\approx \frac{f(x+h)-f(x-h)}{2h}
$$

and its **graphical** interpretation (secant slopes around $x$).

---

### 2. Meaning of the derivative

- $f'(x)$ as **gradient** of $y=f(x)$ at a point.
- As **instantaneous rate of change** in applied contexts.

---

### 3. Differentiation

Differentiate **polynomial** functions using **linearity** and the **power rule** (by prescription).

---

### 4. Applications of differentiation

Including:

- **instantaneous** rates from a rule or graph  
- **stationary** values; local **max / min**  
- **points of inflection** (coordinate work as required)  
- analysing graphs including **motion** graphs  
- **optimisation** with explicit attention to **modelling domain** and local vs global extrema.

---

### 5. Anti-differentiation

- Anti-differentiation as the **inverse** of differentiation.
- **Families** of curves sharing the same derivative; use a **boundary / initial condition** to pin down the **particular** anti-derivative.
`,

  "Unit 2 — Data analysis, probability and statistics": `## Unit 2 — Area of Study 4  
### Data analysis, probability and statistics

Finite-sample probability with structure: complementary, mutually exclusive, **conditional**, **independent** events; **counting** representations; **simulation**.

---

### 1. Representing events

Calculate and organise probabilities using **lists**, **tables**, **grids**, **Venn diagrams**, **tree diagrams**; **elementary** and **compound** events.

---

### 2. Addition rule

For events $A$, $B$:

$$
P(A\cup B)=P(A)+P(B)-P(A\cap B)
$$

If $A$ and $B$ are **mutually exclusive**, $P(A\cap B)=0$ so

$$
P(A\cup B)=P(A)+P(B)
$$

---

### 3. Conditional probability

$$
P(A\mid B)=\frac{P(A\cap B)}{P(B)}, \qquad P(B)>0
$$

Interpret via **reduced sample space**.

---

### 4. Useful identities

- **Multiplication** rule $P(A\cap B)=P(B)\,P(A\mid B)$.
- **Law of total probability** for a partition (two-event case as prescribed).

---

### 5. Independence

For **pairwise independent** events (as prescribed), relations such as

$$
P(A\cap B)=P(A)\,P(B)
$$

and extensions to simple combinations of independent events.

---

### 6. Simulation

Use simulation to estimate probabilities in **with-replacement** and **without-replacement** selection models (as required in your course).
`,
};

export function getMethodsCurriculumOverview(topic: string): string | null {
  const t = String(topic ?? "").trim();
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(MARKDOWN, t)) {
    return MARKDOWN[t as MethodsStudyDesignTopic];
  }

  const n = norm(t);
  const alias = METHODS_TOPIC_ALIASES[n];
  if (alias) return MARKDOWN[alias] ?? null;

  for (const k of METHODS_STUDY_DESIGN_TOPICS) {
    if (norm(k) === n) return MARKDOWN[k];
  }
  return null;
}

/** If the bank does not use study-design labels, practising without a topic filter avoids an empty quiz. */
export function topicExistsInQuestionBank(topic: string, questions: { topic?: string }[]): boolean {
  const t = String(topic ?? "").trim();
  if (!t || t === "all") return true;
  return questions.some((q) => String(q.topic ?? "").trim() === t);
}
