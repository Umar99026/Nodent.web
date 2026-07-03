import{$ as e,Q as t,W as n,Z as r,it as i,t as a,tt as o}from"./button-B7GD8NtP.js";import{_ as s,f as ee,i as te,m as ne,p as re,r as ie}from"./api-d2c4hMAG.js";import{dt as c}from"./composite-CoVUzcUS.js";import{t as l}from"./AppShell-CCmB1yDa.js";import{n as u}from"./utils-9DOkZjSR.js";import{t as d}from"./book-open-CIirxQZ-.js";import{a as f,i as ae,n as oe,r as p,t as se}from"./select-7eawqvrw.js";import{t as ce}from"./file-text-DVgYWZik.js";import{s as m,u as h}from"./index-BEa5khyq.js";import{$ as le,J as g,K as ue,Q as _,W as v,X as y,Z as b,o as x,q as S,r as C,tt as w}from"./practiceQuestions-ztO-pZZZ.js";import{n as T}from"./questionBankCache-CDKaJMz5.js";import{n as E,t as D}from"./card-B1HScLvr.js";import{n as de,t as fe}from"./subjects-Cnb2j4u3.js";import{t as O}from"./RichQuestionContent-BOW89D4j.js";import{t as pe}from"./TopicPerformanceSelect-Da37EO3z.js";var k=i(o(),1),A=n();function me({markdown:e,className:t}){return(0,A.jsx)(`div`,{className:u(`curriculum-overview relative overflow-hidden rounded-2xl`,`border border-black/10 border-l-4 border-l-brand-light/70 bg-[#f3f4f6]/50`,`px-5 py-7 sm:rounded-3xl sm:px-8 sm:py-9`,`text-[#0b0f19] antialiased`,`[&_.katex-error]:hidden`,`[&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline [&_a]:decoration-brand/45 [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a]:transition-colors hover:[&_a]:text-brand hover:[&_a]:decoration-brand`,t),children:(0,A.jsx)(O,{text:e,preferMarkdown:!0,overviewMode:!0})})}var j=`### Types of data

| Type | Meaning | Example |
| --- | --- | --- |
| Numerical | Numbers with measurement/counting meaning | height, income, age |
| Categorical | Categories or groups | eye colour, suburb, brand |
| Discrete | Countable values | number of siblings |
| Continuous | Measured values | temperature, time, mass |

**Nominal vs ordinal**

| Type | Meaning | Example |
| --- | --- | --- |
| Nominal | Categories with no order | blood type, car brand |
| Ordinal | Categories with order | low / medium / high, rankings |

**Tip:** Before doing calculations, identify the data type. Some graphs and statistics only make sense for numerical data.

---

### Univariate data

One variable — e.g. test scores: 55, 60, 67, 72, 88, 91.

Describe using **centre**, **spread**, **shape**, and **outliers**.

---

### Measures of centre

**Mean:** $\\bar{x} = \\frac{\\sum x}{n}$

Example: 4, 6, 8, 10 → $\\bar{x} = \\frac{4+6+8+10}{4} = 7$

**Median:** middle value when ordered (average the two middle values if needed).

**Mode:** most common value.

---

### Measures of spread

**Range:** $\\text{Range} = \\max - \\min$

**IQR:** $\\text{IQR} = Q_3 - Q_1$ where $Q_1$ = lower quartile, $Q_2$ = median, $Q_3$ = upper quartile.

**Standard deviation** measures typical distance from the mean.

**Tip:** Use **median and IQR** if data is skewed or has outliers. Use **mean and SD** if data is roughly symmetric.

---

### Five-number summary

Minimum, $Q_1$, median, $Q_3$, maximum — often shown in a **boxplot**.

**Outlier fences:**

$$\\text{Lower fence} = Q_1 - 1.5(\\text{IQR}), \\quad \\text{Upper fence} = Q_3 + 1.5(\\text{IQR})$$

---

### Shape of distributions

| Shape | Meaning |
| --- | --- |
| Symmetric | roughly balanced on both sides |
| Positively skewed | tail to the right |
| Negatively skewed | tail to the left |
| Bimodal | two clear peaks |

**Tip:** Say which direction of skew and mention context — not just “it is skewed.”

---

### Scatterplots

Two variables — hours studied vs exam score, height vs weight, etc.

Comment on **direction**, **form**, **strength**, **outliers**.

| Feature | What to say |
| --- | --- |
| Direction | positive or negative |
| Form | linear or non-linear |
| Strength | weak, moderate, strong |
| Outliers | unusual points |

---

### Correlation coefficient

$r$ measures strength and direction of a **linear** relationship.

| $r$ | Meaning |
| --- | --- |
| $r = 1$ | perfect positive linear |
| $r = -1$ | perfect negative linear |
| $r = 0$ | no linear relationship |

**Tip:** Correlation does **not** prove causation.

---

### Least squares regression line

$$\\hat{y} = a + bx$$

| Symbol | Meaning |
| --- | --- |
| $a$ | $y$-intercept |
| $b$ | slope |
| $\\hat{y}$ | predicted value of $y$ |

**Example:** $\\hat{y} = 45 + 3x$ with $x$ = hours studied, $y$ = exam score. If $x = 5$, then $\\hat{y} = 60$.

**Slope 3:** each extra hour studied increases predicted score by 3 marks.

**Intercept 45:** when study time is 0 hours, predicted score is 45.

---

### Residuals

$$\\text{residual} = y - \\hat{y}$$

| Residual | Meaning |
| --- | --- |
| positive | actual above prediction |
| negative | actual below prediction |
| zero | exact prediction |

**Residual plots:** random scatter around 0 → linear model suitable; curved or fan shape → reconsider model.

---

### Coefficient of determination

$r^2$ = proportion of variation in $y$ explained by $x$.

If $r = 0.8$, then $r^2 = 0.64$ — **64%** of variation in $y$ explained by $x$. Always name both variables.

---

### Transformations to linearity

| Model | Form |
| --- | --- |
| Linear | $y = a + bx$ |
| Exponential | $y = Ak^{x}$ |
| Power | $y = Ax^{n}$ |
| Reciprocal | $y = a + \\frac{b}{x}$ |

**Exponential:** $\\log(y) = \\log(A) + x\\log(k)$ — graph $\\log(y)$ vs $x$.

**Power:** $\\log(y) = \\log(A) + n\\log(x)$ — graph $\\log(y)$ vs $\\log(x)$.

**Reciprocal:** graph $y$ vs $\\frac{1}{x}$.

---

### Time series

Data collected over time — monthly sales, daily temperature, quarterly profits.

| Component | Meaning |
| --- | --- |
| Trend | long-term increase/decrease |
| Seasonal | repeating pattern within a year |
| Cyclical | longer cycles over several years |
| Irregular | random/unpredictable changes |

**Moving means** smooth short-term fluctuations.

**Seasonal index:** $>1$ above average season; $<1$ below average; $=1$ average.

**Deseasonalising (multiplicative):**

$$\\text{Deseasonalised value} = \\frac{\\text{Actual value}}{\\text{Seasonal index}}$$

**Forecasting:** deseasonalise → fit trend → predict → reseasonalise:

$$\\text{Forecast actual} = (\\text{Forecast trend}) \\times (\\text{Seasonal index})$$

---

### Data — common mistakes

- **Correlation ≠ causation** — look for lurking variables.
- **Extrapolation** — predicting far outside the data range is unreliable.
- **Forgetting to reseasonalise** after using a trend on deseasonalised data.

---

### Data — key formulas

$$\\bar{x} = \\frac{\\sum x}{n}, \\quad \\text{IQR} = Q_3 - Q_1$$

$$\\text{residual} = y - \\hat{y}, \\quad \\hat{y} = a + bx$$

$$\\text{Deseasonalised} = \\frac{\\text{Actual}}{\\text{Seasonal index}}, \\quad \\text{Forecast} = (\\text{Trend forecast}) \\times (\\text{Seasonal index})$$

---

### Histograms and two-way tables

**Histograms** show frequency for numerical data in classes — describe centre, spread, shape, and outliers like other univariate graphs.

**Two-way tables** compare two categorical variables. Use **row or column percentages** when the question says “of those who …”.

**Tip:** On CAS, use one- and two-variable statistics; for regression, interpret $r$, $r^2$, and the line in context — not just the numbers.

---

### Theory: describing distributions

A distribution is described by **centre** (mean/median), **spread** (range/IQR/SD), **shape** (symmetry/skew/modality), and **outliers**.

**Mean** is sensitive to outliers; **median** is resistant. **SD** uses all deviations from the mean:

$$s = \\sqrt{\\frac{\\sum (x_i - \\bar{x})^2}{n-1}} \\quad \\text{(sample SD in Further/General)}$$

**Correlation** measures **linear** association only — $r^2$ is fraction of variance in $y$ explained by linear model in $x$.

**Least squares** chooses $b$ and $a$ to minimise $\\sum (y_i - \\hat{y}_i)^2$ — residuals should look random if model is appropriate.

---

### Theory: time series decomposition

Observed value often modelled as

$$Y = T \\times S \\times I \\quad \\text{(multiplicative)}$$

or additive $Y = T + S + I$. **Trend** is long-run direction; **seasonal** repeats each year; **irregular** is noise.

Seasonal indices average to 1 (multiplicative). Deseasonalising isolates trend for forecasting; reseasonalising applies seasonal pattern to trend forecast.
`,M=`### Recurrence relations

$$u_{n+1} = f(u_n)$$

**Example:** $u_{n+1} = u_n + 5$ with $u_0 = 10$ gives 10, 15, 20, 25, …

---

### Arithmetic sequences

$$u_{n+1} = u_n + d, \\quad u_n = u_0 + nd \\quad \\text{or} \\quad u_n = u_1 + (n-1)d$$

Example: 5, 8, 11, 14, … with $d = 3$ → $u_n = 5 + (n-1)(3)$.

---

### Geometric sequences

$$u_{n+1} = r u_n, \\quad u_n = u_0 r^n \\quad \\text{or} \\quad u_n = u_1 r^{n-1}$$

Example: 2, 6, 18, 54, … with $r = 3$ → $u_n = 2(3)^{n-1}$.

---

### Simple interest

$$I = Prn, \\quad A = P + I = P(1 + rn)$$

| Symbol | Meaning |
| --- | --- |
| $P$ | principal |
| $r$ | rate per period (decimal) |
| $n$ | number of periods |

---

### Compound interest

$$A = P(1+r)^n$$

Grows faster than simple interest — interest earns interest.

---

### Reducing balance depreciation

$$V_n = V_0(1-r)^n$$

**Example:** car $20\\,000$ at 15% per year → $V_3 = 20000(0.85)^3 \\approx 12282.50$.

---

### Flat rate depreciation

$$V_n = V_0 - nd$$

Same dollar amount subtracted each period.

---

### Loans

$$B_{n+1} = B_n(1+r) - R$$

| Symbol | Meaning |
| --- | --- |
| $B_n$ | balance after $n$ payments |
| $r$ | interest rate per payment period |
| $R$ | repayment amount |

**Tip:** Interest is usually applied before repayment unless stated otherwise.

---

### Investments with regular deposits

$$A_{n+1} = A_n(1+r) + D$$

$D$ = regular deposit each period.

---

### Annuities

**Future value:** $FV = \\frac{R}{r}\\big[(1+r)^n - 1\\big]$

**Present value:** $PV = \\frac{R}{r}\\big[1 - (1+r)^{-n}\\big]$

**Tip:** Match the interest rate period to the payment period. If 6% p.a. compounded monthly, $r = \\frac{0.06}{12} = 0.005$.

---

### Finance — common mistakes

- **Wrong interest period** — annual rate vs monthly compounding.
- Confusing **simple** and **compound** interest formulas.

---

### Finance — key formulas

$$I = Prn, \\quad A = P(1+rn), \\quad A = P(1+r)^n$$

$$V_n = V_0(1-r)^n, \\quad V_n = V_0 - nd$$

$$B_{n+1} = B_n(1+r) - R, \\quad A_{n+1} = A_n(1+r) + D$$

$$FV = \\frac{R}{r}\\big[(1+r)^n - 1\\big], \\quad PV = \\frac{R}{r}\\big[1 - (1+r)^{-n}\\big]$$

---

### Effective vs nominal interest (VCE)

**Nominal rate** is the advertised annual rate; **effective rate** accounts for compounding frequency.

**Example:** 6% p.a. compounded monthly → per month $r = 0.06/12 = 0.005$; effective annual rate $(1.005)^{12} - 1 \\approx 6.17\\%$.

---

### Choosing a finance model

| Situation | Model |
| --- | --- |
| Fixed amount added each period | $A_{n+1} = A_n(1+r) + D$ |
| Loan with repayments | $B_{n+1} = B_n(1+r) - R$ |
| Asset losing fixed % per period | $V_n = V_0(1-r)^n$ |
| Regular deposits / annuities | $FV$, $PV$ formulas |

**VCE tip:** Extended-response questions often want a **table** for the first few terms, then a **recurrence** or **formula**, then interpretation (total paid, interest component, break-even time).

---

### Theory: sequences and recurrence

A **sequence** $\\{u_n\\}$ can be defined explicitly $u_n=f(n)$ or recursively $u_{n+1}=g(u_n)$.

**Arithmetic:** constant difference $d$ — linear growth. **Geometric:** constant ratio $r$ — exponential growth/decay.

**Compound interest** is geometric on the balance: each period multiply by $(1+r)$ then adjust for deposits/repayments.

**Annuities** are geometric series: future value sums regular payments each compounded — closed form avoids long tables.

**Effective rate:** $r_{\\text{eff}} = (1+\\frac{r_{\\text{nom}}}{m})^m - 1$ for $m$ compounding periods per year.
`,N=`### Matrix order

An $m \\times n$ matrix has $m$ rows and $n$ columns.

**Tip:** rows first, columns second.

---

### Matrix addition and subtraction

Only when matrices have the **same order** — add/subtract corresponding entries.

---

### Scalar multiplication

Multiply **every** entry by the scalar.

---

### Matrix multiplication

If $A$ is $m \\times n$ and $B$ is $n \\times p$, then $AB$ is $m \\times p$. Inner dimensions must match:

$$(m \\times n)(n \\times p) = m \\times p$$

**Important:** $AB \\neq BA$ in general.

---

### Identity matrix

$$I = \\begin{pmatrix} 1 & 0 \\\\ 0 & 1 \\end{pmatrix}, \\quad AI = A, \\quad IA = A$$

---

### Inverse matrices

$A^{-1}$ satisfies $AA^{-1} = I$. Solve $AX = B$ with $X = A^{-1}B$.

**Tip:** Not every matrix has an inverse (singular matrices).

---

### Transition matrices

Model movement between states:

$$S_1 = T S_0, \\quad S_n = T^n S_0$$

**Tip:** Check whether columns or rows represent “from” states — proportions in a column often sum to 1.

---

### Steady state

When $S_{n+1} = S_n$, solve $S = TS$ (and any total population condition).

---

### Communication matrices

$1$ = connected, $0$ = not connected. Powers of the adjacency matrix can count walks of a given length (e.g. $A^2$ for 2-step walks).

---

### Matrices — common mistakes

- Multiplying in the **wrong order** — $AB \\neq BA$.

---

### Matrices — key formulas

Matrix multiplication: $(m \\times n)(n \\times p) = m \\times p$

$$S_{n+1} = T S_n, \\quad S_n = T^n S_0, \\quad S = TS \\text{ (steady state)}$$

---

### $2 \\times 2$ inverse (by hand)

For $A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, $A^{-1} = \\frac{1}{ad-bc}\\begin{pmatrix} d & -b \\\\ -c & a \\end{pmatrix}$ when $ad - bc \\neq 0$.

---

### Dominant eigenvalue / long-term behaviour

For a transition matrix $T$, the **dominant** eigenvalue is often $\\lambda = 1$ for a closed population model. Long-term distribution is proportional to the eigenvector for $\\lambda = 1$ (check column sums $= 1$).

**VCE applications:** market share over time, species distribution, routing probabilities — always state what each entry represents.

---

### Theory: linear transformations and matrix algebra

Matrices represent **linear transformations** on vectors (rotation, scaling, shear in 2D when applied to $\\begin{pmatrix}x\\\\y\\end{pmatrix}$).

**Matrix multiplication** composes transformations: apply $B$ then $A$ → matrix $AB$ (order matters).

**Determinant** of $2\\times 2$ matrix $ad-bc$: zero $\\Leftrightarrow$ no inverse (transformation collapses area to 0).

**Eigenvalues/eigenvectors** (General): $T\\mathbf{v}=\\lambda\\mathbf{v}$ — directions unchanged by transition matrix; $\\lambda=1$ often gives steady state when columns of $T$ are state proportions summing to 1.
`,P=`### Basic network terms

| Term | Meaning |
| --- | --- |
| Vertex / node | a point in the network |
| Edge / arc | connection between vertices |
| Degree | number of edges at a vertex |
| Path | sequence of connected vertices |
| Weighted graph | edges have costs/distances/times |

---

### Eulerian trails and circuits

Use **every edge** exactly once.

| Condition | Result |
| --- | --- |
| 0 odd vertices | Eulerian **circuit** exists |
| 2 odd vertices | Eulerian **trail** exists |
| more than 2 odd vertices | no Eulerian trail/circuit |

**Tip:** Euler = **edges**.

---

### Hamiltonian paths and cycles

Visit **every vertex** exactly once.

**Tip:** Hamilton = **vertices**. This distinction is very important.

---

### Shortest path

Minimum total weight between two vertices — often **Dijkstra’s algorithm**.

1. Start at source with distance 0.
2. Label tentative distances to neighbours.
3. Make the smallest label permanent.
4. Repeat until the destination is reached.

---

### Minimum spanning tree

Connect **all** vertices with **no cycles** and **minimum** total weight.

| Algorithm | Idea |
| --- | --- |
| **Prim’s** | grow tree from one vertex, add smallest edge to the tree |
| **Kruskal’s** | add smallest edges globally, skip cycles |

With $n$ vertices, a spanning tree has **$n - 1$** edges.

---

### Planar graphs

Euler’s formula (connected planar graph):

$$v + f = e + 2$$

$v$ = vertices, $f$ = faces (including outside), $e$ = edges.

---

### Critical path analysis

| Term | Meaning |
| --- | --- |
| EST | earliest starting time |
| EFT | earliest finishing time |
| LST | latest starting time |
| LFT | latest finishing time |
| Float | delay allowed without delaying the project |

$$\\text{EFT} = \\text{EST} + \\text{duration}, \\quad \\text{LST} = \\text{LFT} - \\text{duration}$$

$$\\text{Float} = \\text{LST} - \\text{EST} = \\text{LFT} - \\text{EFT}$$

**Critical path:** activities with float $= 0$ — determines minimum project time.

---

### Matching and allocation

Pair workers to jobs, students to projects, etc. — often bipartite graphs or allocation tables.

---

### Networks — common mistakes

- Confusing **shortest path** (two vertices) with **minimum spanning tree** (connect all vertices).

---

### Networks — key formulas

$$v + f = e + 2$$

$$\\text{Float} = \\text{LST} - \\text{EST} = \\text{LFT} - \\text{EFT}$$

Minimum spanning tree: $n - 1$ edges for $n$ vertices.

---

### Exam strategy

| Exam | Style |
| --- | --- |
| Exam 1 | Multiple-choice |
| Exam 2 | Extended response / application |

**High-yield skills**

1. **Know your CAS** — statistics, regression, matrices, finance solver, recursion, normal distribution.
2. **Interpret in context** — e.g. “strong positive linear association between hours studied and exam score,” not just $r = 0.82$.
3. **Watch units** — months vs years; match interest period to payment period.
4. **Use sentences** for “interpret” / “explain” / “describe” questions.

**Example:** $r^2 = 0.72$ → “72% of the variation in house price can be explained by the variation in house size.”

---

### Theory: graph theory foundations

A **graph** $G=(V,E)$ has vertices $V$ and edges $E$. **Degree** of vertex = number of incident edges. **Eulerian** circuits use every edge once — degree condition on vertices. **Hamiltonian** cycles visit every vertex once — no simple degree test.

**Shortest path** on weighted graphs: Dijkstra finds least total weight from a source when edge weights $\\geq 0$.

**Minimum spanning tree** connects all vertices with minimum total weight without cycles — unique if weights distinct.

**Critical path** on activity networks: longest path through weighted DAG of project activities sets minimum completion time; float measures slack.
`,F=e=>String(e??``).trim().toLowerCase().replace(/\s+/g,` `),I={statistics:`Data analysis`,"data analysis, probability and statistics":`Data analysis`,finance:`Recursion and financial modelling`,sequences:`Recursion and financial modelling`,recursion:`Recursion and financial modelling`,matrices:`Matrices`,matrix:`Matrices`,networks:`Networks and decision mathematics`,graphs:`Networks and decision mathematics`,"discrete mathematics":`Matrices`,"algebra, number and structure":`Recursion and financial modelling`,"functions, relations and graphs":`Data analysis`,"space and measurement":`Data analysis`};function L(e,t,n){return`${e}

**Area:** ${t}

---

${n}`}var R={"Data analysis":L(`## Data analysis`,`Data analysis`,j),"Recursion and financial modelling":L(`## Recursion and financial modelling`,`Recursion and financial modelling`,`**Sequences** where each term depends on the previous term — used heavily in **finance**, loans, and investments.

${M}`),Matrices:L(`## Matrices`,`Matrices`,`Organising numbers in **arrays** to model transitions, networks, and systems.

${N}`),"Networks and decision mathematics":L(`## Networks and decision mathematics`,`Networks and decision mathematics`,`**Graphs**, **paths**, **optimisation**, and **scheduling**.

${P}`)};function z(e){let t=String(e??``).trim();if(!t)return null;let n=w(t);if(Object.prototype.hasOwnProperty.call(R,n))return R[n];let r=F(n),i=I[r]??I[F(t)];if(i)return R[i]??null;for(let e of _)if(F(e)===r||F(e)===F(t))return R[e];return null}var B=`A function takes an input $x$ and gives exactly one output $y$: $y = f(x)$.

**Example:** $f(x) = x^2 + 3$. If $x = 2$, then $f(2) = 7$.

---

### Domain and range

| Term | Meaning |
| --- | --- |
| Domain | allowed $x$-values |
| Range | possible $y$-values |

**Example:** $f(x) = \\sqrt{x-2}$ requires $x - 2 \\geq 0$, so domain $[2, \\infty)$ and range $[0, \\infty)$.

**Tip — always check:** square roots ($\\geq 0$), fractions (denominator $\\neq 0$), logs (argument $> 0$).

---

### Function notation

If $f(x) = 2x - 5$, then $f(3) = 1$. To solve $f(x) = 7$: $2x - 5 = 7 \\Rightarrow x = 6$.

**Tip:** $f(3)$ means substitute $x = 3$. $f(x) = 3$ means solve for $x$.

---

### Transformations of graphs

For $y = f(x)$:

| New graph | Effect |
| --- | --- |
| $y = f(x) + a$ | up $a$ |
| $y = f(x) - a$ | down $a$ |
| $y = f(x - a)$ | right $a$ |
| $y = f(x + a)$ | left $a$ |
| $y = af(x)$ | vertical dilation factor $a$ |
| $y = f(ax)$ | horizontal dilation factor $\\frac{1}{a}$ |
| $y = -f(x)$ | reflect in $x$-axis |
| $y = f(-x)$ | reflect in $y$-axis |

**Memory:** outside $f(x)$ affects $y$; inside affects $x$ (inside changes feel backwards).

**Example:** $y = (x-3)^2 + 5$ is $y = x^2$ shifted **right 3**, **up 5**.

---

### Hybrid (piecewise) functions

Defined by different rules on different domains — e.g. a flat fee plus a per-km charge.

**Tip:** On CAS, graph piecewise with $\\{ \\text{rule}_1, \\text{domain}_1; \\text{rule}_2, \\text{domain}_2 \\}$ and check continuity at boundaries if asked.

---

### Theory: relations, functions, and inverses

A **relation** from set $A$ to set $B$ is any set of ordered pairs $(x,y)$ with $x \\in A$, $y \\in B$. A **function** $f: A \\to B$ is a relation where **each** $x \\in A$ is paired with **exactly one** $y \\in B$.

| Property | Definition | Graph idea |
| --- | --- | --- |
| One-to-one (injective) | $f(x_1) = f(x_2) \\Rightarrow x_1 = x_2$ | passes vertical **and** horizontal line tests |
| Onto (surjective) | every $y$ in codomain is hit | range = codomain |
| Bijective | both | has an inverse function |

**Inverse:** $f^{-1}$ exists on a restricted domain when $f$ is one-to-one. Algebraically: swap $x$ and $y$, solve for $y$. Graphically: reflection in $y = x$.

**Composition:** $(f \\circ g)(x) = f(g(x))$ — order matters; in general $(f \\circ g) \\neq (g \\circ f)$.

---

### Theory: transformations as operators on graphs

Write $y = f(x)$. Each transformation acts on the **input** (inside) or **output** (outside):

| Form | Operator on $f$ |
| --- | --- |
| $y = f(x-h)+k$ | translate right $h$, up $k$ |
| $y = af(x)$ | vertical stretch by $\\|a\\|$ about $x$-axis |
| $y = f(ax)$ | horizontal stretch by $\\frac{1}{\\|a\\|}$ about $y$-axis |
| $y = -f(x)$ | reflect in $x$-axis |
| $y = f(-x)$ | reflect in $y$-axis |

**Domain/range under transforms:** translations and dilations shift intervals; reflections swap signs in range; always re-check endpoints after transforming a restricted domain.

---

### What VCE Methods asks here

- State **domain** and **range** from a graph or rule (watch $\\sqrt{\\ },$ fractions, logs).
- Apply transformations and describe them in words (dilation, reflection, translation).
- Read $f(a)$ vs solve $f(x) = a$ — common Exam 1 distinction.
- Justify whether an inverse exists on a given domain (one-to-one on that interval).
`,V=`### Polynomial functions

| Function | Shape |
| --- | --- |
| $y = x$ | straight line |
| $y = x^2$ | parabola |
| $y = x^3$ | cubic |
| $y = x^4$ | quartic |

**Quadratic:** $y = ax^2 + bx + c$ or vertex form $y = a(x-h)^2 + k$ with turning point $(h,k)$.

**Example:** $y = 2(x-3)^2 + 1$ has turning point $(3,1)$; opens up since $a = 2 > 0$.

---

### Factor and remainder theorem

If $(x - a)$ is a factor of $P(x)$, then $P(a) = 0$. If $P(x)$ is divided by $(x - a)$, remainder $= P(a)$.

**Example:** Show $(x - 2)$ is a factor of $P(x) = x^3 - 5x + 2$. Since $P(2) = 8 - 10 + 2 = 0$, it factors.

---

### Sketching polynomials (VCE)

1. Factor (or use CAS) to find **$x$-intercepts** and **multiplicity** (cross vs touch).
2. **$y$-intercept:** $P(0)$.
3. **End behaviour** from leading term sign and degree.
4. Turning points from calculus or symmetry where applicable.

**Tip:** A repeated factor $(x-a)^2$ touches the axis at $x=a$; $(x-a)^3$ crosses with a flat point.

---

### Theory: degree, zeros, and the factor theorem

For a polynomial $P(x)$ of **degree** $n$ (highest power $x^n$):

- At most **$n$** real zeros (counting multiplicity).
- End behaviour: sign of leading coefficient $a_n$ and parity of $n$ determine whether $P(x) \\to \\pm\\infty$ as $x \\to \\pm\\infty$.

**Factor theorem:** $(x-a)$ is a factor $\\Leftrightarrow P(a) = 0$. **Remainder theorem:** remainder on division by $(x-a)$ is $P(a)$.

**Multiplicity at $x=a$:**

| Multiplicity $m$ | Graph at $x=a$ |
| --- | --- |
| odd | crosses axis, sign changes |
| even | touches axis, sign does not change |

**Rational functions** $R(x) = \\frac{P(x)}{Q(x)}$: zeros from $P$, vertical asymptotes from zeros of $Q$ (unless cancelled), horizontal/oblique asymptotes from degree comparison.

---

### Theory: completing the square and the quadratic formula

$ax^2+bx+c = 0$ has discriminant $\\Delta = b^2 - 4ac$:

| $\\Delta$ | Nature of roots |
| --- | --- |
| $>0$ | two distinct real roots |
| $=0$ | one repeated real root |
| $<0$ | no real roots (complex conjugate pair in further study) |

Vertex form $y = a(x-h)^2+k$ exposes the turning point directly — useful for sketching and optimisation without calculus.
`,H=`### Exponential functions

$y = a^x$ where $a > 0$, $a \\neq 1$. If $a > 1$, growth; if $0 < a < 1$, decay.

**Rule:** $a^{x+y} = a^x a^y$

---

### Logarithmic functions

$\\log_a(x) = y$ means $a^y = x$.

| Log law | Formula |
| --- | --- |
| Product | $\\log_a(xy) = \\log_a x + \\log_a y$ |
| Quotient | $\\log_a\\!\\left(\\frac{x}{y}\\right) = \\log_a x - \\log_a y$ |
| Power | $\\log_a(x^n) = n\\log_a x$ |

Domain: $x > 0$. Logs and exponentials are **inverse** functions.

---

### Natural base $e$

$e \\approx 2.718\\ldots$ — used for continuous growth/decay: $y = e^{kx}$.

$\\frac{d}{dx}(e^x) = e^x$, $\\int e^x\\,dx = e^x + C$.

---

### Solving exponential and log equations (VCE)

| Type | Approach |
| --- | --- |
| Same base | $2^{x+1} = 8 \\Rightarrow 2^{x+1} = 2^3 \\Rightarrow x = 2$ |
| Different bases | Take $\\ln$ of both sides: $3^x = 20 \\Rightarrow x = \\frac{\\ln 20}{\\ln 3}$ |
| Log equations | Rewrite in index form; check arguments $> 0$ |

**Example:** $\\ln(x-1) = 2 \\Rightarrow x - 1 = e^2 \\Rightarrow x = 1 + e^2$ (domain $x > 1$).

---

### Theory: exponential and logarithmic models

**Exponential growth/decay:** $N(t) = N_0 e^{kt}$. If $k>0$, growth; if $k<0$, decay. Doubling time (growth) and half-life (decay) link to $k$ via $N(t+T) = 2N(t)$ or $\\frac{1}{2}N(t)$.

**Logarithms** are inverses: $y = \\log_a x \\Leftrightarrow a^y = x$ for $a>0$, $a\\neq 1$. Laws follow from index laws:

$$\\log_a(xy) = \\log_a x + \\log_a y \\quad \\text{(product becomes sum)}$$

**Natural log $\\ln x$:** base $e$. Calculus identities: $\\frac{d}{dx}(e^x)=e^x$, $\\frac{d}{dx}(\\ln x)=\\frac{1}{x}$, $\\int \\frac{1}{x}\\,dx = \\ln|x|+C$.

**Change of base:** $\\log_a b = \\frac{\\ln b}{\\ln a}$ — used when bases differ in equations.
`,U=`### Circular functions

Main functions: $\\sin x$, $\\cos x$, $\\tan x$. In Methods, angles are usually in **radians**.

| $x$ | $\\sin x$ | $\\cos x$ |
| --- | --- | --- |
| $0$ | $0$ | $1$ |
| $\\frac{\\pi}{6}$ | $\\frac{1}{2}$ | $\\frac{\\sqrt{3}}{2}$ |
| $\\frac{\\pi}{4}$ | $\\frac{\\sqrt{2}}{2}$ | $\\frac{\\sqrt{2}}{2}$ |
| $\\frac{\\pi}{3}$ | $\\frac{\\sqrt{3}}{2}$ | $\\frac{1}{2}$ |
| $\\frac{\\pi}{2}$ | $1$ | $0$ |

**Transformation:** $y = a\\sin(n(x-b)) + c$

| Parameter | Effect |
| --- | --- |
| $a$ | amplitude $\\|a\\|$ |
| $n$ | period $\\frac{2\\pi}{\\|n\\|}$ for sin/cos |
| $b$ | horizontal shift |
| $c$ | vertical shift |

**Tip:** period of $\\tan$ is $\\frac{\\pi}{\\|n\\|}$.

---

### Solving circular equations (VCE)

On $[0, 2\\pi)$ or a given domain: use symmetry and reference angles.

**Example:** $\\sin x = \\frac{1}{2}$ on $[0, 2\\pi)$ → $x = \\frac{\\pi}{6}$ or $x = \\frac{5\\pi}{6}$.

**Tip:** Calculator in **radians** for calculus; exact values from the table above are expected on Exam 1.

---

### Theory: the unit circle and periodicity

On the unit circle, point at angle $\\theta$ has coordinates $(\\cos\\theta, \\sin\\theta)$. This defines $\\sin$ and $\\cos$ for all real $\\theta$.

**Pythagorean identity:** $\\sin^2\\theta + \\cos^2\\theta = 1$.

**Period:** $\\sin$ and $\\cos$ have period $2\\pi$; $\\tan$ has period $\\pi$.

**Symmetry identities (VCE):**

| Identity | Use |
| --- | --- |
| $\\sin(-\\theta) = -\\sin\\theta$ | odd function |
| $\\cos(-\\theta) = \\cos\\theta$ | even function |
| $\\sin(\\pi - \\theta) = \\sin\\theta$ | supplementary angles |

**General solution:** equations like $\\sin x = k$ have infinitely many solutions; on a restricted domain, list all solutions in that interval using reference angles and symmetry.
`,W=`### Composite functions

$(f \\circ g)(x) = f(g(x))$ — do the **inside** function first.

**Example:** $f(x) = x^2$, $g(x) = x+1$ gives $(f \\circ g)(x) = (x+1)^2$ but $(g \\circ f)(x) = x^2 + 1$. Usually $f \\circ g \\neq g \\circ f$.

---

### Inverse functions

If $y = f(x)$, inverse swaps input/output: $x = f^{-1}(y)$. Graph of $f^{-1}$ is reflection of $f$ in $y = x$.

**Example:** $f(x) = 2x + 3$ → swap: $x = 2y + 3$ → $f^{-1}(x) = \\frac{x-3}{2}$.

**Tip:** $f^{-1}(x)$ is **not** $\\frac{1}{f(x)}$. Inverse must be one-to-one on the domain used.

---

### Solving equations

Do the same operation to both sides.

**Example:** $3x - 7 = 11 \\Rightarrow x = 6$.

---

### Solving quadratics

$ax^2 + bx + c = 0$ — factorise, complete the square, formula, or CAS.

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}, \\quad \\Delta = b^2 - 4ac$$

| $\\Delta$ | Meaning |
| --- | --- |
| $\\Delta > 0$ | two real solutions |
| $\\Delta = 0$ | one repeated solution |
| $\\Delta < 0$ | no real solutions |

---

### Inequalities

Multiplying or dividing by a **negative** flips the sign.

**Example:** $-2x < 6 \\Rightarrow x > -3$.

---

### Simultaneous equations

Set expressions equal and solve — graphically these are **intersection points**.

---

### Exponential equations

$2^x = 16 \\Rightarrow x = 4$. If bases do not match: $3^x = 20 \\Rightarrow x = \\log_3(20) = \\frac{\\ln 20}{\\ln 3}$.

---

### Logarithmic equations

$\\log_2(x) = 5 \\Rightarrow x = 32$. Always check **log arguments** stay positive in the original equation.

---

### Theory: equivalence and algebraic structure

Solving equations means finding values that make two expressions **equal**. Operations must preserve equivalence:

| Operation | Preserves equivalence when |
| --- | --- |
| Add/subtract same quantity to both sides | always |
| Multiply/divide both sides | divisor $\\neq 0$ |
| Square both sides | may introduce **extraneous** solutions — check in original |

**Simultaneous equations:** geometrically intersection of curves; algebraically substitution or elimination.

**Inequalities:** solution set is an interval (or union). Multiplying by a negative **reverses** the inequality direction.
`,he=`Calculus studies **change** (differentiation) and **accumulation** (integration).

---

### Differentiation rules

| Function | Derivative |
| --- | --- |
| $x^n$ | $nx^{n-1}$ |
| $e^x$ | $e^x$ |
| $a^x$ | $a^x \\ln a$ |
| $\\ln x$ | $\\frac{1}{x}$ |
| $\\sin x$ | $\\cos x$ |
| $\\cos x$ | $-\\sin x$ |
| $\\tan x$ | $\\sec^2 x$ |

**Example:** $y = 3x^4 - 5x^2 + 7 \\Rightarrow y' = 12x^3 - 10x$.

---

### Chain rule

$\\frac{d}{dx}[f(g(x))] = f'(g(x))\\,g'(x)$

**Example:** $y = (2x+1)^5 \\Rightarrow y' = 5(2x+1)^4(2) = 10(2x+1)^4$.

---

### Product rule

$\\frac{d}{dx}(uv) = u'v + uv'$

**Example:** $y = x^2 e^x \\Rightarrow y' = e^x(2x + x^2)$.

---

### Quotient rule

$\\frac{d}{dx}\\!\\left(\\frac{u}{v}\\right) = \\frac{u'v - uv'}{v^2}$

---

### Theory: derivative as instantaneous rate of change

The **average rate of change** of $f$ on $[a,a+h]$ is

$$\\frac{f(a+h)-f(a)}{h}$$

The **derivative** $f'(a)$ is the limit as $h \\to 0$ (when it exists):

$$f'(a) = \\lim_{h \\to 0} \\frac{f(a+h)-f(a)}{h}$$

Geometrically: $f'(a)$ is the **gradient of the tangent** at $x=a$.

**Differentiability** implies continuity, but continuous functions can fail to be differentiable (e.g. $|x|$ at $0$).

**Higher derivatives:** $f''(x)$ measures **concavity** and acceleration in motion problems; $f''(x)>0$ → concave up.

---

### Theory: chain rule (composition)

If $y = f(u)$ and $u = g(x)$, then

$$\\frac{dy}{dx} = \\frac{dy}{du}\\cdot\\frac{du}{dx}$$

This is the calculus of **nested structure** — every layer contributes a factor. Product and quotient rules handle products/quotios of functions already differentiated in $x$.
`,ge=`### Tangents and normals

$m_{\\text{tangent}} = f'(a)$. Tangent: $y - y_1 = m(x - x_1)$.

$m_{\\text{normal}} = -\\frac{1}{m_{\\text{tangent}}}$ (if $m \\neq 0$).

**Example:** $f(x) = x^2$ at $x = 3$: $f(3) = 9$, $f'(3) = 6$, tangent $y = 6x - 9$.

---

### Stationary points

Where $f'(x) = 0$ — local max, local min, or stationary point of inflection.

| Sign change of $f'$ | Type |
| --- | --- |
| $+$ to $-$ | local maximum |
| $-$ to $+$ | local minimum |
| no change | stationary inflection |

---

### Second derivative

| $f''(x)$ | Concavity |
| --- | --- |
| $> 0$ | concave up |
| $< 0$ | concave down |
| $= 0$ | possible inflection (check change) |

**Tip:** For max/min questions, justify using derivative sign, $f''$, endpoints, or context.

---

### Exam focus — calculus applications

Optimisation, rates of change, tangents/normals, stationary points, graph sketching with calculus.

---

### Optimisation procedure (VCE extended response)

1. Define variables and write **constraint** / **objective** (area, cost, profit).
2. Express quantity to maximise/minimise as $f(x)$ on a valid domain.
3. Find stationary points; test with $f''$ or sign chart / endpoints.
4. Answer **in context** with units.

**Rates of change:** if $V$ depends on $r$ and $r$ depends on $t$, use $\\frac{dV}{dt} = \\frac{dV}{dr}\\cdot\\frac{dr}{dt}$.

---

### Theory: optimisation and the derivative test

On an open interval, **local extrema** occur at stationary points ($f'=0$) or endpoints (closed domain).

| Test | Condition | Conclusion |
| --- | --- | --- |
| First derivative | $f'$ changes $+$ to $-$ | local maximum |
| First derivative | $f'$ changes $-$ to $+$ | local minimum |
| Second derivative | $f'(c)=0$, $f''(c)>0$ | local minimum |
| Second derivative | $f'(c)=0$, $f''(c)<0$ | local maximum |

**Global** extrema on $[a,b]$: compare all critical points **and** endpoints.

**Related rates:** variables linked by an equation; differentiate with respect to time $t$ using the chain rule.
`,_e=`### Antidifferentiation

$$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C, \\quad n \\neq -1$$

**Example:** $\\int 6x^2\\,dx = 2x^3 + C$. Never forget **$+C$** for indefinite integrals.

---

### Integration rules

| Function | Integral |
| --- | --- |
| $x^n$ | $\\frac{x^{n+1}}{n+1} + C$ |
| $e^x$ | $e^x + C$ |
| $a^x$ | $\\frac{a^x}{\\ln a} + C$ |
| $\\frac{1}{x}$ | $\\ln\\|x\\| + C$ |
| $\\cos x$ | $\\sin x + C$ |
| $\\sin x$ | $-\\cos x + C$ |

---

### Fundamental theorem of calculus

If $F'(x) = f(x)$, then

$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

**Example:** $\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$.

---

### Average value of a function

$$\\text{Average of } f \\text{ on } [a,b] = \\frac{1}{b-a}\\int_a^b f(x)\\,dx$$

**Tip:** Exam 2 may ask for area between two curves: $\\int_a^b \\big|f(x) - g(x)\\big|\\,dx$ after finding intersection points.

---

### Theory: antiderivative and the FTC

$F(x)$ is an **antiderivative** of $f(x)$ if $F'(x)=f(x)$. The family of antiderivatives is $F(x)+C$.

**Fundamental theorem of calculus (Part 1):** if $F'=f$, then $\\int_a^b f(x)\\,dx = F(b)-F(a)$.

**Part 2 (accumulation):** define $A(x)=\\int_a^x f(t)\\,dt$. Then $A'(x)=f(x)$ — integration undoes differentiation.

**Riemann sum idea:** $\\int_a^b f(x)\\,dx$ is the limit of signed rectangular areas; positive above the axis, negative below.
`,ve=`### Definite integrals and area

$$\\int_a^b f(x)\\,dx$$

Area above the $x$-axis is positive; below is negative. For **total area**, split where the graph crosses the axis.

**Example:** $\\int_0^2 x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^2 = \\frac{8}{3}$.

---

### Kinematics

$$v(t) = x'(t), \\quad a(t) = v'(t) = x''(t)$$
$$x(t) = \\int v(t)\\,dt, \\quad v(t) = \\int a(t)\\,dt$$

**Example:** $x(t) = t^3 - 6t \\Rightarrow v(t) = 3t^2 - 6$, $a(t) = 6t$.

**Tip:** $v = 0$ → momentarily at rest; **speed** $= |v|$; **distance travelled** $\\neq$ displacement.

---

### Theory: integral as signed area and accumulation

$$\\int_a^b f(x)\\,dx$$

- **Net signed area** between graph and $x$-axis.
- **Total area** requires splitting where $f$ crosses zero and summing absolute contributions.

Between curves $f$ and $g$: area $= \\int_a^b |f(x)-g(x)|\\,dx$ on intervals where you know which is above.

**Kinematics link:** displacement $= \\int v\\,dt$; distance $= \\int |v|\\,dt$; velocity from acceleration is another accumulation.
`,ye=`### Basic probability

$$0 \\leq P(A) \\leq 1, \\quad P(A') = 1 - P(A)$$
$$P(A \\cup B) = P(A) + P(B) - P(A \\cap B)$$

If mutually exclusive: $P(A \\cap B) = 0$.

---

### Conditional probability

$$P(A|B) = \\frac{P(A \\cap B)}{P(B)}$$

The condition after $|$ is the “new world” you work in.

---

### Independent events

$$P(A \\cap B) = P(A)P(B) \\quad \\text{or} \\quad P(A|B) = P(A)$$

---

### Discrete random variables

| $x$ | $P(X=x)$ |
| --- | --- |

$$E(X) = \\sum x\\,P(X=x), \\quad \\operatorname{Var}(X) = E(X^2) - [E(X)]^2, \\quad \\sigma = \\sqrt{\\operatorname{Var}(X)}$$

---

### Binomial distribution

Use when: fixed $n$, success/failure, constant $p$, independent trials.

$$X \\sim \\operatorname{Bin}(n,p), \\quad P(X=x) = \\binom{n}{x} p^x (1-p)^{n-x}$$
$$E(X) = np, \\quad \\operatorname{Var}(X) = np(1-p)$$

**Tip:** at least 3 → $X \\geq 3$; at most 3 → $X \\leq 3$.

---

### Theory: probability axioms and random variables

**Kolmogorov axioms (Methods level):** $0 \\leq P(A) \\leq 1$, $P(\\Omega)=1$, countable additivity for disjoint events.

**Conditional probability** reweights the sample space to $B$:

$$P(A|B) = \\frac{P(A\\cap B)}{P(B)}, \\quad P(B)>0$$

**Independence:** $P(A\\cap B)=P(A)P(B)$ — knowing $B$ does not change $P(A)$.

A **discrete random variable** $X$ has PMF $p(x)=P(X=x)$ with $\\sum_x p(x)=1$.

**Linearity of expectation:** $E(aX+b)=aE(X)+b$. For independent $X,Y$: $\\operatorname{Var}(X+Y)=\\operatorname{Var}(X)+\\operatorname{Var}(Y)$.

**Binomial** counts successes in $n$ Bernoulli trials: $X=\\sum_{i=1}^n I_i$ with $P(I_i=1)=p$.
`,be=`### Continuous random variables

PDF $f(x)$ with $f(x) \\geq 0$ and $\\int_{-\\infty}^{\\infty} f(x)\\,dx = 1$.

$$P(a \\leq X \\leq b) = \\int_a^b f(x)\\,dx$$

For continuous $X$: $P(X = a) = 0$.

---

### Expected value and variance

$$E(X) = \\int_{-\\infty}^{\\infty} x f(x)\\,dx$$
$$E(X^2) = \\int_{-\\infty}^{\\infty} x^2 f(x)\\,dx, \\quad \\operatorname{Var}(X) = E(X^2) - [E(X)]^2$$

---

### Uniform distribution (common in Methods)

On $[a,b]$: $f(x) = \\frac{1}{b-a}$ for $a \\leq x \\leq b$.

$$E(X) = \\frac{a+b}{2}, \\quad \\operatorname{Var}(X) = \\frac{(b-a)^2}{12}$$

**Example:** Waiting time 0–10 minutes → $E(X) = 5$, $\\operatorname{Var}(X) = \\frac{100}{12} \\approx 8.33$.

---

### Theory: PDF, CDF, and continuous probability

For continuous $X$, **PDF** $f(x)$ satisfies $f(x)\\geq 0$ and $\\int_{-\\infty}^{\\infty} f(x)\\,dx=1$.

**CDF** $F(x)=P(X\\leq x)=\\int_{-\\infty}^x f(t)\\,dt$. Then $f(x)=F'(x)$ where derivative exists.

$$P(a\\leq X\\leq b)=\\int_a^b f(x)\\,dx, \\quad P(X=a)=0$$

**Expected value** is the centre of mass: $E(X)=\\int x f(x)\\,dx$.

**Uniform** on $[a,b]$: constant density — every subinterval of equal length has equal probability.
`,xe=`### Normal distribution

$$X \\sim N(\\mu, \\sigma^2)$$

Standardise: $Z = \\frac{X - \\mu}{\\sigma}$ where $Z \\sim N(0,1)$.

**Example:** $X \\sim N(50, 5^2)$, find $P(X < 60)$: $Z = \\frac{60-50}{5} = 2$, so $P(X < 60) = P(Z < 2)$.

---

### Empirical rule (68–95–99.7)

For $X \\sim N(\\mu, \\sigma^2)$:

| Interval | Approx. probability |
| --- | --- |
| $\\mu \\pm \\sigma$ | 68% |
| $\\mu \\pm 2\\sigma$ | 95% |
| $\\mu \\pm 3\\sigma$ | 99.7% |

**Inverse normal:** given $P(X < k) = 0.9$, standardise to find $Z$, then $k = \\mu + \\sigma Z$.

**VCE wording:** “Scores above 60” → $P(X > 60)$; watch whether the question wants a probability, a boundary score, or a $z$-score.

---

### Theory: the normal distribution

$X \\sim N(\\mu,\\sigma^2)$ has bell-shaped density centred at $\\mu$ with spread controlled by $\\sigma$.

**Standardisation:** $Z=\\frac{X-\\mu}{\\sigma} \\sim N(0,1)$. Any normal probability reduces to a $Z$-table or CAS.

**Properties:** sum of independent normals is normal (used in further study); linear transform: if $X\\sim N(\\mu,\\sigma^2)$ then $aX+b \\sim N(a\\mu+b, a^2\\sigma^2)$.

**Empirical rule** comes from integrating the normal density over $\\mu\\pm k\\sigma$.
`,Se=`### Sample proportions

$$\\hat{P} \\sim N\\!\\left(p, \\frac{p(1-p)}{n}\\right)$$

$$E(\\hat{P}) = p, \\quad \\operatorname{sd}(\\hat{P}) = \\sqrt{\\frac{p(1-p)}{n}}$$

Larger $n$ → smaller spread.

---

### When $\\hat{P}$ is approximately normal

Use $ \\hat{P} \\sim N\\!\\left(p, \\frac{p(1-p)}{n}\\right) $ when:

- random sample,
- $n$ large enough (often $np \\geq 10$ and $n(1-p) \\geq 10$ as a rule of thumb),
- sampling without replacement only if population is large relative to $n$.

**Example:** 40% support in population, $n = 100$ → $\\operatorname{sd}(\\hat{P}) = \\sqrt{\\frac{0.4 \\times 0.6}{100}} = 0.049$.

---

### Theory: sampling distribution of $\\hat{P}$

$\\hat{P}=\\frac{X}{n}$ where $X$ is count of successes. For large $n$,

$$\\hat{P} \\approx N\\!\\left(p, \\frac{p(1-p)}{n}\\right)$$

**Standard error** $\\operatorname{SE}(\\hat{P})=\\sqrt{\\frac{p(1-p)}{n}}$ shrinks as $n$ grows — larger samples give more precise estimates.

**Conditions (approximate normality):** random sample; $np\\geq 10$ and $n(1-p)\\geq 10$ (rule of thumb); if sampling without replacement, population size much larger than $n$.
`,Ce=`### Confidence intervals for proportions

An approximate **95% CI** for population proportion $p$:

$$\\hat{p} \\pm 1.96\\sqrt{\\frac{\\hat{p}(1-\\hat{p})}{n}}$$

**Example:** $\\hat{p} = 0.42$, $n = 200$:

$$0.42 \\pm 1.96\\sqrt{\\frac{0.42 \\times 0.58}{200}} \\approx 0.42 \\pm 0.068 \\Rightarrow (0.352,\\, 0.488)$$

**Interpretation (VCE):** We are 95% confident the true population proportion lies in this interval.

**Tip:** Use $z = 2$ only if the question allows the approximation; otherwise use 1.96 for 95%.

---

### Theory: confidence intervals (proportions)

A **95% confidence interval** is an interval estimate for unknown population proportion $p$:

$$\\hat{p} \\pm z^* \\sqrt{\\frac{\\hat{p}(1-\\hat{p})}{n}}$$

**Frequentist interpretation:** if we repeated sampling many times, about 95% of such intervals would contain the true $p$. The parameter $p$ is fixed; the interval is random.

**Margin of error** $= z^* \\times \\operatorname{SE}(\\hat{p})$ — half-width of the CI.

**Sample size** affects width: quadrupling $n$ halves the margin of error (approximately).

---

### Exam 1 vs Exam 2

| Exam | Style |
| --- | --- |
| Exam 1 | Tech-free, short-answer, exact working |
| Exam 2 | Technology-active, MCQ and extended response |

Exam 1 tests clean algebra and calculus; Exam 2 tests interpretation, modelling, and CAS efficiency.

---

### Common mistakes

1. **Domain** — e.g. $\\sqrt{x+4}$ needs $x \\geq -4$.
2. **$f^{-1}(x)$** is inverse, not reciprocal.
3. **Radians** in trig calculus: $\\frac{d}{dx}(\\sin x) = \\cos x$.
4. **$+C$** in indefinite integrals.
5. **Displacement vs distance** — distance may need splitting when velocity changes sign.
6. **Binomial conditions** — fixed $n$, two outcomes, constant $p$, independent trials.

---

### High-yield formulas

**Functions:** $(f \\circ g)(x) = f(g(x))$; quadratic formula; log laws

**Calculus:** chain, product, quotient rules; $\\int x^n\\,dx$; $v = x'$, $a = v'$

**Probability:** $P(A|B) = \\frac{P(A \\cap B)}{P(B)}$; $\\operatorname{Bin}(n,p)$; $Z = \\frac{X-\\mu}{\\sigma}$; $\\hat{P} \\sim N\\!\\left(p, \\frac{p(1-p)}{n}\\right)$
`,G=e=>String(e??``).trim().toLowerCase().replace(/\s+/g,` `),K={"functions, relations and graphs":`Functions and transformations`,calculus:`Differential calculus`,"algebra, number and structure":`Algebra and equations`,probability:`Discrete random variables`,statistics:`Sampling and sample proportions`,trigonometry:`Circular functions`};function q(e,t,n){return`${e}

**Area:** ${t}

---

${n}`}var J={"Functions and transformations":q(`## Functions and transformations`,`Functions, relations and graphs`,B),"Polynomial, power and rational functions":q(`## Polynomial, power and rational functions`,`Functions, relations and graphs`,V),"Exponential and logarithmic functions":q(`## Exponential and logarithmic functions`,`Functions, relations and graphs`,H),"Circular functions":q(`## Circular functions`,`Functions, relations and graphs`,U),"Algebra and equations":q(`## Algebra and equations`,`Algebra`,W),"Differential calculus":q(`## Differential calculus`,`Calculus`,he),"Applications of differentiation":q(`## Applications of differentiation`,`Calculus`,ge),"Integral calculus":q(`## Integral calculus`,`Calculus`,_e),"Applications of integration":q(`## Applications of integration`,`Calculus`,ve),"Discrete random variables":q(`## Discrete random variables`,`Probability and statistics`,ye),"Continuous random variables":q(`## Continuous random variables`,`Probability and statistics`,be),"The normal distribution":q(`## The normal distribution`,`Probability and statistics`,xe),"Sampling and sample proportions":q(`## Sampling and sample proportions`,`Probability and statistics`,Se),"Confidence intervals for proportions":q(`## Confidence intervals for proportions`,`Probability and statistics`,Ce)};function we(e){let t=String(e??``).trim();if(!t)return null;let n=b(t);if(Object.prototype.hasOwnProperty.call(J,n))return J[n];let r=G(n),i=K[r]??K[G(t)];if(i)return J[i]??null;for(let e of g)if(G(e)===r||G(e)===G(t))return J[e];return null}var Te=`### Logic and statements

This topic is about making mathematical arguments **precise**.

| Symbol | Meaning |
| --- | --- |
| $P \\Rightarrow Q$ | If $P$, then $Q$ |
| $P \\Leftrightarrow Q$ | $P$ if and only if $Q$ |
| $\\forall$ | For all |
| $\\exists$ | There exists |
| $\\neg P$ | Not $P$ |

**Example**

Statement:

$$\\forall x \\in \\mathbb{R},\\; x^2 \\geq 0$$

Meaning: for every real number $x$, $x^2$ is non-negative.

**Negation:**

$$\\exists x \\in \\mathbb{R} \\text{ such that } x^2 < 0$$

**Tip — negating statements**

| Change | To |
| --- | --- |
| $\\forall$ | $\\exists$ |
| $\\exists$ | $\\forall$ |
| $\\geq$ | $<$ |
| $>$ | $\\leq$ |
| **and** | **or** |
| **or** | **and** |

---

### Implication, converse, inverse, contrapositive

For a statement $P \\Rightarrow Q$:

| Form | Statement |
| --- | --- |
| Original | $P \\Rightarrow Q$ |
| Converse | $Q \\Rightarrow P$ |
| Inverse | $\\neg P \\Rightarrow \\neg Q$ |
| Contrapositive | $\\neg Q \\Rightarrow \\neg P$ |

The **original** and **contrapositive** are logically equivalent.

**Example**

- **Original:** If $n$ is divisible by $4$, then $n$ is even.
- **Contrapositive:** If $n$ is not even, then $n$ is not divisible by $4$.

These are equivalent.

**Exam tip:** If a direct proof is hard, try proving the **contrapositive**.

---

### Proof techniques

#### Direct proof

Start with the assumption and logically reach the conclusion.

**Example:** Prove: if $n$ is even, then $n^2$ is even.

If $n$ is even, $n = 2k$. Then

$$n^2 = (2k)^2 = 4k^2 = 2(2k^2)$$

so $n^2$ is even.

#### Proof by contradiction

Assume the opposite of what you want to prove, then show this leads to something impossible.

**Example:** Prove $\\sqrt{2}$ is irrational.

Assume $\\sqrt{2} = \\frac{p}{q}$ where $p,q$ have no common factor.

Then $2q^2 = p^2$, so $p^2$ is even, hence $p$ is even. Let $p = 2k$. Then $2q^2 = 4k^2$, so $q^2 = 2k^2$ and $q$ is also even — contradicting that $p$ and $q$ have no common factor.

Therefore $\\sqrt{2}$ is irrational.

---

### Mathematical induction

Induction proves statements for all positive integers $n$.

1. Prove true for $n = 1$ (**base case**).
2. Assume true for $n = k$ (**inductive assumption**).
3. Prove true for $n = k + 1$ (**inductive step**).
4. Conclude: true for all positive integers $n$.

**Example:** Prove $1 + 2 + 3 + \\cdots + n = \\frac{n(n+1)}{2}$.

**Base case** ($n=1$): $1 = \\frac{1 \\cdot 2}{2} = 1$ ✓

**Inductive assumption:** $1 + 2 + \\cdots + k = \\frac{k(k+1)}{2}$

**Step** ($k+1$):

$$1 + 2 + \\cdots + k + (k+1) = \\frac{k(k+1)}{2} + (k+1) = \\frac{k(k+1) + 2(k+1)}{2} = \\frac{(k+1)(k+2)}{2}$$

**Tip:** Clearly label base case, assumption, and inductive step — examiners care about structure.

---

### Strong induction

Sometimes the inductive step needs all $k \\leq n$, not just $n$. State clearly: “Assume true for all positive integers up to $k$.”

---

### VCE proof checklist

- State what you are proving ($\\forall n \\in \\mathbb{Z}^+$, …).
- Base case with explicit calculation.
- Assume $P(k)$ (or all $j \\leq k$).
- Show $P(k+1)$ using the assumption — do not skip algebra.
- Conclude “by mathematical induction”.

---

### Theory: propositional logic and quantifiers

**Truth tables** define connectives: $\\neg$, $\\land$, $\\lor$, $\\Rightarrow$, $\\Leftrightarrow$.

$P \\Rightarrow Q$ is false only when $P$ true and $Q$ false. **Contrapositive** $\\neg Q \\Rightarrow \\neg P$ is logically equivalent to $P \\Rightarrow Q$.

**Quantifiers:** $\\forall x\\,P(x)$ (“for all”) and $\\exists x\\,P(x)$ (“there exists”). Negation swaps quantifier and negates predicate.

**Proof** = finite sequence of justified steps from axioms/assumptions to conclusion. **Induction** proves statements for all $n \\in \\mathbb{Z}^+$ via base + inductive step.
`,Ee=`### Rational functions

A rational function has the form

$$f(x) = \\frac{P(x)}{Q(x)}$$

where $P(x)$ and $Q(x)$ are polynomials.

**Example:** $f(x) = \\frac{x+1}{x-2}$

| Feature | How to find it |
| --- | --- |
| Vertical asymptote | Set denominator $= 0$ (unless factor cancels) |
| Horizontal asymptote | Compare degrees of numerator and denominator |
| $x$-intercept | Set numerator $= 0$ |
| $y$-intercept | Substitute $x = 0$ |
| Hole | Common factor cancels |

**Worked features** for $f(x) = \\frac{x+1}{x-2}$:

- Vertical asymptote: $x - 2 = 0 \\Rightarrow x = 2$
- $x$-intercept: $x + 1 = 0 \\Rightarrow x = -1$
- $y$-intercept: $f(0) = \\frac{1}{-2} = -\\frac{1}{2}$
- Horizontal asymptote (equal degrees): $y = \\frac{1}{1} = 1$

---

### Partial fractions

Break a complicated rational expression into simpler parts.

**Example:**

$$\\frac{5x+1}{(x-1)(x+2)} = \\frac{A}{x-1} + \\frac{B}{x+2}$$

Multiply through: $5x + 1 = A(x+2) + B(x-1)$.

- Let $x = 1$: $6 = 3A \\Rightarrow A = 2$
- Let $x = -2$: $-9 = -3B \\Rightarrow B = 3$

So $\\frac{5x+1}{(x-1)(x+2)} = \\frac{2}{x-1} + \\frac{3}{x+2}$.

**Tip:** Partial fractions often appear before integration.

---

### Parametric equations

Write $x$ and $y$ in terms of a parameter (usually $t$):

$$x = f(t), \\quad y = g(t)$$

**Example:** $x = t^2$, $y = t + 1$. Eliminate $t$: $t = y - 1$, so $x = (y-1)^2$.

**Parametric derivative**

$$\\frac{dy}{dx} = \\frac{dy/dt}{dx/dt} \\quad \\text{provided } \\frac{dx}{dt} \\neq 0$$

**Example:** $x = t^2$, $y = t^3$

$$\\frac{dx}{dt} = 2t, \\quad \\frac{dy}{dt} = 3t^2 \\quad \\Rightarrow \\quad \\frac{dy}{dx} = \\frac{3t^2}{2t} = \\frac{3t}{2}$$

**Tip:** Check whether the question wants Cartesian form, gradient, speed, acceleration, domain/range, or intersection points.

---

### Polar coordinates

Use $(r, \\theta)$ instead of $(x,y)$.

| Conversion | Formula |
| --- | --- |
| To Cartesian | $x = r\\cos\\theta$, $y = r\\sin\\theta$ |
| From Cartesian | $r^2 = x^2 + y^2$, $\\tan\\theta = \\frac{y}{x}$ |

**Example:** $r = 4 \\Rightarrow r^2 = 16 = x^2 + y^2$ — a circle of radius $4$ centred at the origin.

**Tip:** Sketch polar graphs using a small table of $\\theta$ values.

---

### Theory: asymptotes and end behaviour

For $f(x)=\\frac{P(x)}{Q(x)}$:

| Degrees | Horizontal asymptote |
| --- | --- |
| $\\deg P < \\deg Q$ | $y=0$ |
| $\\deg P = \\deg Q$ | $y=\\frac{\\text{leading coeff of }P}{\\text{leading coeff of }Q}$ |
| $\\deg P > \\deg Q$ | none (oblique possible if exactly one higher) |

**Partial fractions** decompose rational integrands into sums of simpler fractions — linear denominators $(x-a)^{-1}$ or repeated, irreducible quadratics in denominator.

**Parametric** curves: velocity vector $\\mathbf{v}=(\\frac{dx}{dt},\\frac{dy}{dt})$; speed $=|\\mathbf{v}|$.
`,De=`### Complex numbers

$$z = a + bi, \\quad i^2 = -1$$

| Part | Meaning |
| --- | --- |
| $a$ | real part $\\operatorname{Re}(z)$ |
| $b$ | imaginary part $\\operatorname{Im}(z)$ |

**Example:** $z = 3 + 4i$ — $\\operatorname{Re}(z) = 3$, $\\operatorname{Im}(z) = 4$.

---

### Modulus and argument

For $z = a + bi$:

$$|z| = \\sqrt{a^2 + b^2}, \\quad \\arg(z) = \\theta \\text{ where } \\tan\\theta = \\frac{b}{a}$$

**Example:** $z = 3 + 4i$

$$|z| = \\sqrt{3^2 + 4^2} = 5, \\quad \\theta = \\tan^{-1}\\!\\left(\\frac{4}{3}\\right)$$

**Tip:** Always check the **quadrant** when finding $\\arg(z)$.

---

### Polar form

$$z = r(\\cos\\theta + i\\sin\\theta) = r\\,\\operatorname{cis}(\\theta), \\quad r = |z|$$

**Example:** $z = 1 + i$

$$r = \\sqrt{2}, \\quad \\theta = \\frac{\\pi}{4} \\quad \\Rightarrow \\quad z = \\sqrt{2}\\,\\operatorname{cis}\\!\\left(\\frac{\\pi}{4}\\right)$$

---

### Multiplication and division

If $z_1 = r_1\\operatorname{cis}(\\theta_1)$ and $z_2 = r_2\\operatorname{cis}(\\theta_2)$:

$$z_1 z_2 = r_1 r_2\\,\\operatorname{cis}(\\theta_1 + \\theta_2), \\quad \\frac{z_1}{z_2} = \\frac{r_1}{r_2}\\,\\operatorname{cis}(\\theta_1 - \\theta_2)$$

| Operation | Lengths | Angles |
| --- | --- | --- |
| Multiply | multiply | add |
| Divide | divide | subtract |

---

### De Moivre’s theorem

For integer $n$:

$$[r\\operatorname{cis}(\\theta)]^n = r^n\\operatorname{cis}(n\\theta)$$

**Example:** $z = 2\\operatorname{cis}\\!\\left(\\frac{\\pi}{6}\\right)$

$$z^3 = 2^3\\operatorname{cis}\\!\\left(3 \\cdot \\frac{\\pi}{6}\\right) = 8\\operatorname{cis}\\!\\left(\\frac{\\pi}{2}\\right) = 8i$$

---

### Roots of complex numbers

To solve $z^n = r\\operatorname{cis}(\\theta)$:

$$z_k = r^{1/n}\\operatorname{cis}\\!\\left(\\frac{\\theta + 2k\\pi}{n}\\right), \\quad k = 0,1,\\ldots,n-1$$

**Example:** $z^3 = 8 = 8\\operatorname{cis}(0)$

$$z_k = 2\\operatorname{cis}\\!\\left(\\frac{2k\\pi}{3}\\right), \\quad k = 0,1,2$$

The three roots are equally spaced on a circle in the Argand plane.

---

### Conjugates and real polynomials

$\\overline{z} = a - bi$. Key facts: $z + \\overline{z} = 2a$, $z\\overline{z} = |z|^2$.

If a polynomial has **real coefficients**, non-real roots occur in **conjugate pairs** — useful for factorising cubics/quartics on Specialist exams.

---

### Theory: Argand plane and polar form

Complex number $z=a+bi$ is point $(a,b)$ in the plane. **Modulus** $|z|$ is distance from origin; **argument** $\\arg(z)$ is angle from positive real axis.

**Polar multiplication:** multiply moduli, add arguments. **De Moivre:** powers rotate and scale:

$$z^n = r^n\\operatorname{cis}(n\\theta)$$

**$n$th roots** of $z=r\\operatorname{cis}\\theta$ are equally spaced on circle radius $r^{1/n}$ — vertices of regular $n$-gon.
`,Oe=`### Differentiation basics

$\\frac{dy}{dx}$ is the rate of change of $y$ with respect to $x$.

| Rule | Formula |
| --- | --- |
| Power | $\\frac{d}{dx}(x^n) = nx^{n-1}$ |
| Product | $(uv)' = u'v + uv'$ |
| Quotient | $\\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}$ |
| Chain | $\\frac{dy}{dx} = \\frac{dy}{du}\\cdot\\frac{du}{dx}$ |

**Example:** $y = (x^2 + 1)^5$. Let $u = x^2 + 1$:

$$\\frac{dy}{dx} = 5u^4 \\cdot 2x = 10x(x^2+1)^4$$

---

### Implicit differentiation

When $y$ is not isolated explicitly.

**Example:** $x^2 + y^2 = 25$

Differentiate both sides: $2x + 2y\\frac{dy}{dx} = 0$, so

$$\\frac{dy}{dx} = -\\frac{x}{y}$$

**Tip:** Whenever you differentiate a $y$-term, multiply by $\\frac{dy}{dx}$.

---

### Related rates

1. Write an equation linking variables.
2. Differentiate with respect to time $t$.
3. Substitute known values.
4. Solve for the required rate.

**Example:** $A = \\pi r^2$

$$\\frac{dA}{dt} = 2\\pi r\\,\\frac{dr}{dt}$$

If $r = 5$ and $\\frac{dr}{dt} = 2$, then $\\frac{dA}{dt} = 2\\pi(5)(2) = 20\\pi$.

---

### Theory: implicit curves and related rates

**Implicit differentiation** treats $y$ as $y(x)$ and applies chain rule to every $y$-term: differentiate $y^2$ → $2y\\frac{dy}{dx}$.

**Related rates:** identify variables as functions of time; differentiate constraint equation w.r.t. $t$; substitute known rates/values at an instant.
`,ke=`### Integration

Integration can represent area under a curve, accumulated change, or reverse differentiation.

$$\\int x^n\\,dx = \\frac{x^{n+1}}{n+1} + C, \\quad n \\neq -1$$

**Example:** $\\displaystyle\\int 3x^2\\,dx = x^3 + C$

---

### Integration by substitution

**Example:** $\\displaystyle\\int 2x(x^2+1)^5\\,dx$

Let $u = x^2 + 1$, $du = 2x\\,dx$:

$$\\int 2x(x^2+1)^5\\,dx = \\int u^5\\,du = \\frac{u^6}{6} + C = \\frac{(x^2+1)^6}{6} + C$$

**Tip:** Look for an “inner” function and (a multiple of) its derivative nearby.

---

### Integration by parts

$$\\int u\\,dv = uv - \\int v\\,du$$

Used for products such as $xe^x$, $x\\sin x$, $x\\ln x$.

**Example:** $\\displaystyle\\int xe^x\\,dx$ with $u = x$, $dv = e^x\\,dx$:

$$\\int xe^x\\,dx = xe^x - \\int e^x\\,dx = xe^x - e^x + C = e^x(x-1) + C$$

**LIATE** (choose $u$): **L**og → **I**nverse trig → **A**lgebraic → **T**rig → **E**xponential.

---

### Definite integrals and area (VCE)

$$\\int_a^b f(x)\\,dx = F(b) - F(a)$$

Area between curves: $\\int_a^b |f(x) - g(x)|\\,dx$ on an interval where you know which function is above.

**Tip:** Partial fractions (from the functions topic) often appear immediately before integrating a rational function.

---

### Theory: integration techniques

**Substitution:** reverse chain rule — choose $u$ so $du$ appears (up to constant) in integrand.

**Parts:** $\\int u\\,dv = uv - \\int v\\,du$ — choose $u$ using LIATE priority for products.

**Definite integrals** evaluate net signed area; split at zeros for total area; area between curves $=\\int |f-g|\\,dx$.
`,Ae=`### Differential equations

A differential equation contains a derivative.

**Example:** $\\frac{dy}{dx} = ky$ — rate of change proportional to $y$.

**Solution:** $y = Ae^{kx}$

#### Separable equations

**Example:** $\\frac{dy}{dx} = xy$

Separate: $\\frac{1}{y}\\,dy = x\\,dx$. Integrate:

$$\\ln|y| = \\frac{x^2}{2} + C \\quad \\Rightarrow \\quad y = Ae^{x^2/2}$$

**Tip:** If all $y$'s go on one side and all $x$'s on the other, the equation is separable.

---

### Initial conditions

A **particular solution** needs an initial condition, e.g. $y(0) = 5$, to find $A$ in $y = Ae^{kx}$.

**Modelling (VCE):** exponential growth/decay (populations, cooling), logistic-style saturation may appear in worded problems — identify $\\frac{dy}{dt}$ proportional to $y$ or to “room left”.

---

### Theory: differential equations

A **DE** relates a function and its derivatives. **Order** = highest derivative present.

**Separable:** $\\frac{dy}{dx}=g(x)h(y)$ → $\\int\\frac{1}{h(y)}\\,dy=\\int g(x)\\,dx$.

**Exponential model** $\\frac{dy}{dt}=ky$ has solution $y=Ae^{kt}$; sign of $k$ determines growth/decay.

**Initial condition** $y(t_0)=y_0$ selects particular solution from family $y=\\cdots+C$.
`,je=`### Kinematics with calculus

| Quantity | Relation |
| --- | --- |
| Velocity | $v = \\frac{dx}{dt}$ |
| Acceleration | $a = \\frac{dv}{dt}$ |
| Alternative | $a = v\\frac{dv}{dx}$ |
| From acceleration | $x = \\int v\\,dt$, $v = \\int a\\,dt$ |

**Example:** If $v = 3t^2$, then $a = \\frac{dv}{dt} = 6t$ and $x = \\int 3t^2\\,dt = t^3 + C$.

---

### Displacement, distance, speed

| Quantity | Meaning |
| --- | --- |
| Displacement | net change in position $\\int_{t_1}^{t_2} v\\,dt$ |
| Distance travelled | $\\int_{t_1}^{t_2} \\|v\\|\\,dt$ — split if $v$ changes sign |
| Speed | $\\|v\\|$ (scalar) |

**Projectile (2D):** often $x(t)$ linear in $t$, $y(t)$ quadratic; resolve into components or use vector $\\mathbf{r}(t)$.

**VCE:** “When is the particle at rest?” → solve $v = 0$. “Greatest height” → $v = 0$ at apex (if moving vertically).

---

### Theory: motion along a line and in the plane

Position $x(t)$, velocity $v(t)=\\frac{dx}{dt}$, acceleration $a(t)=\\frac{dv}{dt}=\\frac{d^2x}{dt^2}$.

**Constant acceleration** (1D): $v=v_0+at$, $x=x_0+v_0 t+\\frac{1}{2}at^2$.

**$a=v\\frac{dv}{dx}$** useful when acceleration given as function of position/speed rather than time.
`,Me=`### Vectors

A vector has **magnitude** and **direction**.

**Example:** $\\mathbf{a} = \\begin{pmatrix} 3 \\\\ 4 \\end{pmatrix}$

$$|\\mathbf{a}| = \\sqrt{3^2 + 4^2} = 5, \\quad \\hat{\\mathbf{a}} = \\frac{\\mathbf{a}}{|\\mathbf{a}|} = \\begin{pmatrix} 3/5 \\\\ 4/5 \\end{pmatrix}$$

---

### Dot product

$$\\mathbf{a} \\cdot \\mathbf{b} = a_1 b_1 + a_2 b_2 + a_3 b_3 = |\\mathbf{a}||\\mathbf{b}|\\cos\\theta$$

$$\\cos\\theta = \\frac{\\mathbf{a} \\cdot \\mathbf{b}}{|\\mathbf{a}||\\mathbf{b}|}$$

If $\\mathbf{a} \\cdot \\mathbf{b} = 0$, the vectors are **perpendicular**.

---

### Vector projection

Projection of $\\mathbf{a}$ onto $\\mathbf{b}$:

$$\\operatorname{proj}_{\\mathbf{b}}\\mathbf{a} = \\frac{\\mathbf{a} \\cdot \\mathbf{b}}{|\\mathbf{b}|^2}\\,\\mathbf{b}$$

---

### Cross product

$\\mathbf{a} \\times \\mathbf{b}$ is perpendicular to both $\\mathbf{a}$ and $\\mathbf{b}$.

$$|\\mathbf{a} \\times \\mathbf{b}| = |\\mathbf{a}||\\mathbf{b}|\\sin\\theta$$

| Shape | Area |
| --- | --- |
| Parallelogram | $\\|\\mathbf{a} \\times \\mathbf{b}\\|$ |
| Triangle | $\\frac{1}{2}\\,\\|\\mathbf{a} \\times \\mathbf{b}\\|$ |

---

### Theory: vector algebra in $\\mathbb{R}^2$ and $\\mathbb{R}^3$

Vectors encode displacement: $\\overrightarrow{AB}=\\mathbf{b}-\\mathbf{a}$. **Scalar (dot) product** measures alignment:

$$\\mathbf{a}\\cdot\\mathbf{b}=|\\mathbf{a}||\\mathbf{b}|\\cos\\theta$$

**Vector (cross) product** in $\\mathbb{R}^3$ is perpendicular to both operands with magnitude $|\\mathbf{a}||\\mathbf{b}|\\sin\\theta$ — encodes area and orientation.
`,Ne=`### Vector equation of a line

$$\\mathbf{r} = \\mathbf{a} + \\lambda\\mathbf{d}$$

| Symbol | Meaning |
| --- | --- |
| $\\mathbf{r}$ | general point on the line |
| $\\mathbf{a}$ | known point |
| $\\mathbf{d}$ | direction vector |
| $\\lambda$ | parameter |

**Example:** through $(1,2,3)$ with direction $(4,5,6)$:

$$\\mathbf{r} = \\begin{pmatrix} 1 \\\\ 2 \\\\ 3 \\end{pmatrix} + \\lambda \\begin{pmatrix} 4 \\\\ 5 \\\\ 6 \\end{pmatrix}$$

---

### Vector equation of a plane

$$\\mathbf{r} = \\mathbf{a} + \\lambda\\mathbf{u} + \\mu\\mathbf{v}$$

or $\\mathbf{n} \\cdot (\\mathbf{r} - \\mathbf{a}) = 0$ where $\\mathbf{n}$ is normal to the plane.

**Cartesian form:** $ax + by + cz = d$ with $\\mathbf{n} = \\begin{pmatrix} a \\\\ b \\\\ c \\end{pmatrix}$.

**Example:** $2x - 3y + z = 7$ has normal $\\begin{pmatrix} 2 \\\\ -3 \\\\ 1 \\end{pmatrix}$.

---

### Distances

Point $(x_1,y_1,z_1)$ to plane $ax + by + cz + d = 0$:

$$D = \\frac{|ax_1 + by_1 + cz_1 + d|}{\\sqrt{a^2 + b^2 + c^2}}$$

---

### Angle between lines and planes

Angle between direction vectors $\\mathbf{d}_1$, $\\mathbf{d}_2$:

$$\\cos\\theta = \\frac{|\\mathbf{d}_1 \\cdot \\mathbf{d}_2|}{|\\mathbf{d}_1||\\mathbf{d}_2|}$$

Angle between planes: use normals $\\mathbf{n}_1$, $\\mathbf{n}_2$ the same way.

**VCE:** “Shortest distance” may mean point–line, point–plane, or skew lines — identify which formula applies.

---

### Theory: lines and planes in space

**Line:** $\\mathbf{r}=\\mathbf{a}+\\lambda\\mathbf{d}$ — point + scalar multiple of direction.

**Plane:** $\\mathbf{n}\\cdot(\\mathbf{r}-\\mathbf{a})=0$ or $ax+by+cz=d$ with normal $\\mathbf{n}=(a,b,c)$.

**Distance** point to plane uses projection of vector onto normal. **Angle** between planes = angle between normals (acute angle often taken).
`,Pe=`### Vector functions and motion

Position, velocity and acceleration as vector functions of time:

$$\\mathbf{r}(t), \\quad \\mathbf{v}(t) = \\frac{d\\mathbf{r}}{dt}, \\quad \\mathbf{a}(t) = \\frac{d\\mathbf{v}}{dt}$$

Differentiate and integrate **component-wise**. Speed is $|\\mathbf{v}(t)|$.

**Link to parametric curves:** if $x = f(t)$, $y = g(t)$,

$$\\frac{dy}{dx} = \\frac{dy/dt}{dx/dt}$$

Use for paths in the plane (circles, ellipses, projectiles) and 3D particle motion.

---

### Speed and arc length

Speed: $|\\mathbf{v}(t)| = \\sqrt{\\left(\\frac{dx}{dt}\\right)^2 + \\left(\\frac{dy}{dt}\\right)^2}$.

Arc length (from $t = a$ to $t = b$):

$$L = \\int_a^b \\sqrt{\\left(\\frac{dx}{dt}\\right)^2 + \\left(\\frac{dy}{dt}\\right)^2}\\,dt$$

**Tip:** Specialist motion questions may give $\\mathbf{r}(t)$ in 3D — differentiate each component; magnitude of velocity is speed.

---

### Theory: vector calculus on curves

$\\mathbf{r}(t)=(x(t),y(t),z(t))$ describes a path. **Tangent** vector $\\mathbf{r}'(t)$; **unit tangent** $\\hat{\\mathbf{T}}=\\mathbf{r}'/|\\mathbf{r}'|$.

**Arc length** accumulates speed: $L=\\int_a^b |\\mathbf{r}'(t)|\\,dt$.

In 2D, $\\frac{dy}{dx}=\\frac{dy/dt}{dx/dt}$ links parametric motion to slope of trajectory.
`,Fe=`### Random variables

A random variable assigns numbers to outcomes.

**Example:** $X$ = number of heads from two coins.

| Outcome | $X$ | $P(X=x)$ |
| --- | --- | --- |
| TT | 0 | $\\frac{1}{4}$ |
| HT, TH | 1 | $\\frac{1}{2}$ |
| HH | 2 | $\\frac{1}{4}$ |

---

### Expected value

$$E(X) = \\sum x\\,P(X=x)$$

**Example:** $E(X) = 0 \\cdot \\frac{1}{4} + 1 \\cdot \\frac{1}{2} + 2 \\cdot \\frac{1}{4} = 1$

---

### Variance and standard deviation

$$\\operatorname{Var}(X) = E(X^2) - [E(X)]^2, \\quad \\sigma = \\sqrt{\\operatorname{Var}(X)}$$

Expected value → **centre**; variance / SD → **spread**.

---

### Binomial distribution

Use when: fixed $n$, success/failure, constant $p$, independent trials.

$$X \\sim \\operatorname{Bin}(n,p), \\quad P(X=x) = \\binom{n}{x} p^x (1-p)^{n-x}$$

$$E(X) = np, \\quad \\operatorname{Var}(X) = np(1-p)$$

**Tip:** Be careful with $P(X=x)$, $P(X \\leq x)$, $P(X < x)$, $P(X \\geq x)$, $P(X > x)$ on CAS.

---

### Normal distribution

$$X \\sim N(\\mu, \\sigma^2)$$

Standardise: $Z = \\frac{X - \\mu}{\\sigma}$ where $Z \\sim N(0,1)$.

**Example:** $X \\sim N(50, 5^2)$, find $P(X < 60)$:

$$Z = \\frac{60 - 50}{5} = 2 \\quad \\Rightarrow \\quad P(X < 60) = P(Z < 2)$$

---

### Sample means

If $X \\sim N(\\mu, \\sigma^2)$, then $\\bar{X}$ has

$$E(\\bar{X}) = \\mu, \\quad \\operatorname{sd}(\\bar{X}) = \\frac{\\sigma}{\\sqrt{n}}, \\quad \\bar{X} \\sim N\\!\\left(\\mu, \\frac{\\sigma^2}{n}\\right)$$

Larger samples → less spread in $\\bar{X}$.

---

### Theory: distributions and the CLT idea

**PMF** (discrete) or **PDF** (continuous) encodes probabilities. **Expectation** is long-run average; **variance** measures spread.

**Binomial:** sum of independent Bernoulli trials.

**Normal:** symmetric bell curve; standardisation to $Z$.

For large $n$, sample mean $\\bar{X}$ is approximately normal about $\\mu$ with SD $\\sigma/\\sqrt{n}$ — foundation for confidence intervals on means (Specialist level).
`,Ie=`### Confidence intervals

$$\\bar{x} \\pm z\\,\\frac{\\sigma}{\\sqrt{n}}$$

| Confidence level | Approx. $z$ |
| --- | --- |
| 90% | 1.645 |
| 95% | 1.96 |
| 99% | 2.576 |

**Example:** $\\bar{x} = 50$, $\\sigma = 8$, $n = 64$, 95% CI:

$$50 \\pm 1.96 \\cdot \\frac{8}{\\sqrt{64}} = 50 \\pm 1.96 = (48.04,\\, 51.96)$$

**Interpretation:** We are 95% confident the true population mean lies in this interval.

**Tip:** Do not say “there is a 95% probability the mean is in this interval” unless your course allows that wording — the parameter is fixed; the interval varies from sample to sample.

---

### Theory: confidence intervals for a mean

When $\\sigma$ known (or large $n$ with $s$ substitute):

$$\\bar{x} \\pm z^* \\frac{\\sigma}{\\sqrt{n}}$$

Width $\\propto 1/\\sqrt{n}$. Higher confidence → larger $z^*$ → wider interval.

Interpretation: plausible values for population mean $\\mu$ consistent with sample and model assumptions.

---

### Exam 1 vs Exam 2

| Exam | Style |
| --- | --- |
| Exam 1 | Short-answer, less CAS, exact working matters |
| Exam 2 | MCQ + extended response, CAS allowed, more modelling |

---

### Common mistakes

1. **Domains** — e.g. $f(x) = \\frac{1}{x-2}$ requires $x \\neq 2$.
2. **Complex arguments** — $z = -1 + i$ is QII, not QIV; sketch the Argand diagram.
3. **$+C$** in indefinite integrals — $\\int 2x\\,dx = x^2 + C$.
4. **Variance vs SD** — $X \\sim N(10,4)$ means $\\mu = 10$, $\\sigma^2 = 4$, $\\sigma = 2$.
5. **Vectors** — dot product → scalar; cross product → vector.

---

### High-yield formula sheet

**Complex:** $z = a+bi$, $|z| = \\sqrt{a^2+b^2}$, $z = r\\operatorname{cis}(\\theta)$, De Moivre $[r\\operatorname{cis}(\\theta)]^n = r^n\\operatorname{cis}(n\\theta)$

**Vectors:** $\\mathbf{a}\\cdot\\mathbf{b} = |\\mathbf{a}||\\mathbf{b}|\\cos\\theta$, $|\\mathbf{a}\\times\\mathbf{b}| = |\\mathbf{a}||\\mathbf{b}|\\sin\\theta$, $\\mathbf{r} = \\mathbf{a} + \\lambda\\mathbf{d}$

**Calculus:** product, quotient, chain rules; $\\int u\\,dv = uv - \\int v\\,du$; $v = \\frac{dx}{dt}$, $a = \\frac{dv}{dt}$

**Probability:** $E(X) = \\sum xP(X=x)$, $\\operatorname{Var}(X) = E(X^2) - [E(X)]^2$, $\\bar{X} \\sim N(\\mu, \\sigma^2/n)$
`,Y=e=>String(e??``).trim().toLowerCase().replace(/\s+/g,` `),X={"proof and number":`Logic and proof`,"graph theory":`Logic and proof`,"logic and algorithms":`Logic and proof`,"complex numbers":`Complex numbers and algebra`,calculus:`Differential calculus`,statistics:`Random variables and sampling`,probability:`Random variables and sampling`,"probability and statistics: random variables and sampling":`Random variables and sampling`};function Z(e,t,n){return`${e}

**Area:** ${t}

---

${n}`}var Q={"Logic and proof":Z(`## Logic and proof`,`Discrete mathematics`,`Making mathematical arguments precise — statements, proof styles, and induction.

${Te}`),"Complex numbers and algebra":Z(`## Complex numbers and algebra`,`Algebra, number and structure`,`Complex arithmetic, polar form, De Moivre’s theorem, and roots.

${De}`),"Functions, relations and graphs":Z(`## Functions, relations and graphs`,`Functions, relations and graphs`,`Rational functions, partial fractions, parametric and polar graphs.

${Ee}`),"Differential calculus":Z(`## Differential calculus`,`Calculus`,`Advanced differentiation — rules, implicit differentiation, and related rates.

${Oe}`),"Integral calculus":Z(`## Integral calculus`,`Calculus`,`Integration techniques and when to use them.

${ke}`),"Differential equations":Z(`## Differential equations`,`Calculus`,`Equations involving derivatives — modelling and separable solutions.

${Ae}`),Kinematics:Z(`## Kinematics`,`Calculus / mechanics`,`Position, velocity and acceleration linked by calculus.

${je}`),"Vectors in two and three dimensions":Z(`## Vectors in two and three dimensions`,`Space and measurement`,`Vector operations, dot product, projection, and cross product.

${Me}`),"Lines and planes in 3D":Z(`## Lines and planes in 3D`,`Space and measurement`,`Lines and planes in 3D, normals, and distances.

${Ne}`),"Vector calculus":Z(`## Vector calculus`,`Space and measurement`,`Vector functions of time and parametric motion.

${Pe}`),"Random variables and sampling":Z(`## Random variables and sampling`,`Data analysis, probability and statistics`,`Random variables, binomial and normal models, and sample means.

${Fe}`),"Confidence intervals":Z(`## Confidence intervals`,`Data analysis, probability and statistics`,`Estimate a population mean — plus exam strategy and key formulas.

${Ie}`)};function Le(e){let t=String(e??``).trim();if(!t)return null;let n=S(t);if(Object.prototype.hasOwnProperty.call(Q,n))return Q[n];let r=Y(n),i=X[r]??X[Y(t)];if(i)return Q[i]??null;for(let e of v)if(Y(e)===r||Y(e)===Y(t))return Q[e];return null}function Re(e){return/math|methods|specialist|further/i.test(e)}function ze(e){return e===`A`?`### Section A — Analytical response to a text

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
- Summarise the text’s broader message`:e===`B`?`### Section B — Creating a text

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
- Main idea: protest does not always begin with grand gestures`:`### Section C — Analysis of argument and language

#### Where to find practice articles

For extra Section C practice, browse recent **opinion and analysis** pieces from:

- [The Guardian — Comment is free (Australia)](https://www.theguardian.com/au/commentisfree)
- [ABC News — Analysis & Opinion](https://www.abc.net.au/news/analysis-and-opinion)
- [The Australia Institute — Opinions](https://australiainstitute.org.au/news/category/opinions/)

Choose an article, identify the **contention**, map the main **arguments**, and practise analysing **language** (and **visuals** if present).

---

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
(+) evidence from the material  
(+) language choice / visual feature  
(+) intended effect on the audience  
(+) link to contention

**Example sentence style**

By describing the proposal as a “smarter investment”, the writer positions the audience to view the change as practical and responsible, strengthening support for their overall contention.`}function $(e){let t=e.subject?.name??e.subjectId;if(e.subjectId===`english`)return ze(e.englishSection??`A`);let n=(e.topic??`all`).trim();return!n||n===`all`?`### Your plan
- Pick a topic to focus your practice.
- Skim the overview (formulas / theory).
- Hit **Questions** to start.

**Subject:** ${t}`:e.subjectId===`methods`?we(n)||`### ${n}

No overview is defined for this label yet. Use one of the fourteen **Units 3 & 4 topics** (Functions and transformations, Differential calculus, …) with the exact spelling.

**Subject:** Mathematical Methods`:e.subjectId===`general-maths`||e.subjectId===`demo`?z(n)||`### ${n}

No overview is defined for this label yet. Use one of the four **Units 3 & 4 topics** (Data analysis; Recursion and financial modelling; Matrices; Networks and decision mathematics) with the exact spelling.

**Subject:** General Mathematics`:e.subjectId===`specialist-maths`?Le(n)||`### ${n}

No overview is defined for this label yet. Use one of the twelve **Units 3 & 4 topics** (Logic and proof, Complex numbers and algebra, Differential calculus, …) with the exact spelling.

**Subject:** Specialist Mathematics`:Re(t)?`### ${n}

Structured study-design notes for **${t}** are not bundled yet. Use your class materials, then start **Questions** when you’re ready.`:`### ${n}

**Quick overview for ${t}**
- Key definitions you should be able to say in one sentence
- 3 high‑yield facts / rules for this topic
- What a “full marks” answer usually includes

**Common traps**
- Vague explanations (be specific, use examples)
- Not linking evidence back to the question wording`}function Be(e){return Array.from(new Set(e.map(e=>e.trim()).filter(Boolean))).sort((e,t)=>e.localeCompare(t))}function Ve(){let{subjectId:n}=t(),i=r(),{user:o}=c(),u=s(o),g=ne(o),[_]=e();(0,k.useEffect)(()=>{String(n)===`demo`&&!u&&i(`/dashboard`,{replace:!0})},[n,u,i]);let v=(0,k.useMemo)(()=>u?de({isAdmin:u}):fe,[u]),b=(0,k.useMemo)(()=>v.find(e=>String(e.id)===String(n)),[v,n]),[S,w]=(0,k.useState)(!0),[O,j]=(0,k.useState)([]),M=String(n)===`english`,N=String(_.get(`topic`)??`all`),P=String(_.get(`section`)??`A`).toUpperCase()||`A`,[F,I]=(0,k.useState)(N||`all`),[L,R]=(0,k.useState)(P===`B`||P===`C`?P:`A`);(0,k.useEffect)(()=>{if(!n)return;let e=!1,t=T(n);if(t.length>0)j(t),w(!1);else if(o)w(!0);else{j(x([],n)),w(!1);return}if(o)return(async()=>{try{let t=await te(ee.bootstrap,{timeoutMs:ie});if(e)return;t.customQuestions&&localStorage.setItem(re.customQuestions,JSON.stringify(t.customQuestions)),j(x(C(t.customQuestions,n),n))}catch{if(e)return;j(T(n))}finally{e||w(!1)}})(),()=>{e=!0}},[n,o]);let z=String(n)===`methods`,B=String(n)===`general-maths`||String(n)===`demo`,V=String(n)===`specialist-maths`,H=(0,k.useMemo)(()=>M?[]:z?y():B?le():V?ue():[`all`,...Be(O.map(e=>e.topic??`General`))],[O,M,z,B,V]),U=(0,k.useMemo)(()=>H.filter(e=>e!==`all`),[H]),W=(0,k.useMemo)(()=>n?M?$({subjectId:n,subject:b,topic:F,englishSection:L}):!F||F===`all`?null:$({subjectId:n,subject:b,topic:F,englishSection:L}):null,[n,b,F,L,M]);return(0,k.useEffect)(()=>{M||H.length&&!H.includes(F)&&I(`all`)},[H,F,M]),(0,A.jsx)(l,{title:b?`${b.name} Practice`:`Practice`,subtitle:`Choose your focus, then start questions.`,edgeToEdgeHeader:!0,edgeToEdgeMain:!0,children:(0,A.jsxs)(`div`,{className:`mx-auto w-full max-w-6xl space-y-5 sm:space-y-6`,children:[(0,A.jsxs)(D,{className:`practice-card`,children:[(0,A.jsx)(`div`,{className:`practice-card-header`,children:(0,A.jsx)(`p`,{className:`practice-card-header-title`,children:`Practice setup`})}),(0,A.jsxs)(E,{className:`flex flex-col gap-4 bg-[#f3f4f6]/30 px-4 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6`,children:[(0,A.jsxs)(`div`,{className:`min-w-0`,children:[(0,A.jsx)(`p`,{className:`font-display text-lg font-semibold tracking-tight text-[#0b0f19] sm:text-xl`,children:b?.name??`Subject`}),(0,A.jsx)(`p`,{className:`mt-1 text-sm leading-relaxed text-muted-foreground`,children:`Pick a topic / section, then start questions.`})]}),(0,A.jsxs)(`div`,{className:`flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end lg:gap-3`,children:[S?(0,A.jsxs)(`div`,{className:`flex items-center gap-2 rounded-xl border border-black/8 bg-[#f3f4f6] px-4 py-3 text-sm text-muted-foreground`,children:[(0,A.jsx)(m,{className:`size-4 animate-spin`}),`Loading…`]}):M?(0,A.jsxs)(`div`,{className:`w-full min-w-0 space-y-2 sm:min-w-[260px]`,children:[(0,A.jsx)(`p`,{className:`text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground`,children:`English section`}),(0,A.jsxs)(se,{value:L,onValueChange:e=>R(e??`A`),children:[(0,A.jsx)(ae,{className:`h-11 rounded-xl border-brand-light/50 bg-brand-light/50 text-[#0b0f19]`,children:(0,A.jsx)(f,{placeholder:`Choose section`})}),(0,A.jsxs)(oe,{alignItemWithTrigger:!1,children:[(0,A.jsx)(p,{value:`A`,children:`Section A — Text response`}),(0,A.jsx)(p,{value:`B`,children:`Section B — Creative`}),(0,A.jsx)(p,{value:`C`,children:`Section C — Writing`})]})]})]}):(0,A.jsxs)(`div`,{className:`w-fit min-w-0 space-y-2`,children:[(0,A.jsx)(`p`,{className:`text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground`,children:`Topic`}),(0,A.jsx)(pe,{subjectId:n,value:F,onValueChange:I,topics:U,includeAllOption:!0,placeholder:`Choose topic`})]}),(0,A.jsxs)(`div`,{className:`flex w-full flex-col gap-2 sm:w-auto sm:flex-row`,children:[g?(0,A.jsxs)(a,{type:`button`,variant:`outline`,onClick:()=>i(`/practice/${n}/exams`),className:`h-11 w-full gap-2 rounded-xl sm:w-auto`,children:[(0,A.jsx)(ce,{className:`size-4`}),`Exams`,(0,A.jsx)(h,{className:`size-4`})]}):null,(0,A.jsxs)(a,{variant:`accent`,onClick:()=>{if(n){if(M){i(`/quiz/english?section=${encodeURIComponent(L)}`);return}i(`/quiz/${n}${F&&F!==`all`?`?topic=${encodeURIComponent(F)}`:``}`)}},className:`h-11 w-full gap-2 rounded-xl sm:w-auto`,children:[(0,A.jsx)(d,{className:`size-4`}),`Questions`,(0,A.jsx)(h,{className:`size-4`})]})]})]})]})]}),(0,A.jsxs)(D,{className:`practice-card`,children:[(0,A.jsx)(`div`,{className:`practice-card-header`,children:(0,A.jsx)(`p`,{className:`practice-card-header-title`,children:`Study overview`})}),(0,A.jsx)(E,{className:`px-4 py-5 sm:px-7 sm:py-6`,children:W?(0,A.jsx)(me,{markdown:W}):(0,A.jsx)(`div`,{className:`rounded-2xl border border-dashed border-black/15 bg-[#0b0f19]/[0.03] p-8 text-center`,children:(0,A.jsx)(`p`,{className:`text-sm font-medium text-muted-foreground`,children:`Choose a topic above to load overview notes.`})})})]})]})})}export{Ve as default};