/**
 * Detailed General Mathematics overview sections (KaTeX-friendly markdown).
 * Composed per topic in generalMathsCurriculumOverviews.ts.
 */

export const GENERAL_OVERVIEW_BIG_PICTURE = `General Maths is about using maths to model **real-life situations**:

| Area | Focus |
| --- | --- |
| **DATA** | Analyse trends, relationships, predictions |
| **FINANCE** | Loans, investments, depreciation, annuities |
| **MATRICES** | Transitions, networks, systems, transformations |
| **NETWORKS** | Paths, trees, scheduling, optimisation |

The course is very **application-based** — the key skill is not just knowing formulas, but knowing **which method fits the question**.

| Topic | Main idea |
| --- | --- |
| Data analysis | Interpret, summarise, model and predict from data |
| Recursion and finance | Use recurrence relations for growth, loans and investments |
| Matrices | Use tables of numbers to model changes, networks and transitions |
| Networks | Use graphs to solve shortest path, spanning tree and scheduling problems |
`;

export const GENERAL_OVERVIEW_DATA = `### Types of data

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
`;

export const GENERAL_OVERVIEW_RECURSION = `### Recurrence relations

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
`;

export const GENERAL_OVERVIEW_MATRICES = `### Matrix order

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
`;

export const GENERAL_OVERVIEW_NETWORKS = `### Basic network terms

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
`;
