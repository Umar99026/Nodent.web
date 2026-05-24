/**
 * VCE Methods Units 3 & 4 — detailed overview sections (cleaned markdown).
 * Composed into topic overviews in methodsCurriculumOverviews.ts.
 */

export type MethodsOverviewSectionId =
  | "polynomial-function-graphs"
  | "power-exp-log-graphs"
  | "circular-function-graphs"
  | "function-transformations"
  | "original-vs-transformed-graphs"
  | "graphs-combined-functions"
  | "modelling-with-functions"
  | "polynomial-equation-solutions"
  | "inverse-functions"
  | "composition-of-functions"
  | "solving-f-g-equations"
  | "literal-and-general-equations"
  | "simultaneous-linear-equations"
  | "derivative-antiderivative-graphs"
  | "derivatives-basic-functions"
  | "derivatives-combined-functions"
  | "differentiation-graph-sketching"
  | "antiderivatives"
  | "definite-integral-limit"
  | "ftc-antidifferentiation"
  | "properties-definite-integrals"
  | "applications-integration"
  | "random-variables-intro"
  | "discrete-random-variables"
  | "continuous-random-variables"
  | "normal-distribution"
  | "sample-proportions-inference"
  | "confidence-intervals-proportions"
  | "applications-of-differentiation";

export const METHODS_OVERVIEW_SECTIONS: Record<MethodsOverviewSectionId, string> = {
  "polynomial-function-graphs": `## Polynomial function graphs

### Introduction

Polynomial functions are central to Mathematical Methods. A polynomial can be written as:

\`\`\`
P(x) = a_n x^n + a_{n-1} x^{n-1} + ... + a_1 x + a_0
\`\`\`

where **n** is a non-negative integer (the **degree**), **a_n ≠ 0**, and coefficients are real.

### Key features

| Feature | Meaning |
| --- | --- |
| **Degree** | Highest power of x; shapes end behaviour |
| **Leading coefficient** | Coefficient of x^n; affects end behaviour and vertical stretch |
| **Roots / zeros** | Values where P(x) = 0 (x-intercepts) |
| **y-intercept** | P(0) = constant term a_0 |
| **Turning points** | Local max/min; at most **n − 1** for degree n |
| **End behaviour** | Behaviour as x → ±∞ (degree + leading sign) |

### End behaviour (summary)

| Degree | Leading coeff. | As x → +∞ | As x → −∞ |
| --- | --- | --- | --- |
| Even | + | y → +∞ | y → +∞ |
| Even | − | y → −∞ | y → −∞ |
| Odd | + | y → +∞ | y → −∞ |
| Odd | − | y → −∞ | y → +∞ |

### Common types

- **Linear** (n = 1): y = mx + c — straight line  
- **Quadratic** (n = 2): parabola; vertex form y = a(x − h)² + k  
- **Cubic** (n = 3): up to two turning points  
- **Quartic** (n = 4): up to three turning points  

### Transformations

- Dilation from x-axis: y = a·P(x)  
- Dilation from y-axis: y = P(nx)  
- Translation: y = P(x − b) + c  
- Reflections: y = −P(x), y = P(−x)  

### Rule from a graph

1. **x-intercepts:** if the graph **crosses** at x = r, then (x − r) is a factor  
2. If it **touches** and turns at x = r, use (x − r)² (or higher even power for a flatter touch)  
3. General factored form: P(x) = k·(factors)  
4. Use the **y-intercept** or another known point to find **k**  

### Worked example (cubic)

Roots at x = −2 (crosses), x = 1 (touches), y-intercept at (0, 4).

- Factors: (x + 2) and (x − 1)²  
- General form: P(x) = k(x + 2)(x − 1)²  
- y-intercept: P(0) = k(2)(1) = 2k = 4 → **k = 2**  
- Final rule: **P(x) = 2(x + 2)(x − 1)²**  

### Sign diagrams

1. Find all roots  
2. Mark them on a number line  
3. Pick a test value in each interval; evaluate the sign of P(x)  
4. Sketch above the x-axis where P(x) > 0 and below where P(x) < 0  
`,

  "power-exp-log-graphs": `## Power, exponential and logarithmic graphs

### Power functions: y = x^n

| n | Shape notes |
| --- | --- |
| Positive integer | Through (0,0) and (1,1); even n → symmetry about y-axis |
| Negative integer | Vertical asymptote x = 0; horizontal asymptote y = 0 |
| n = 1/2 | Square root; x ≥ 0 |
| n = 1/3 | Cube root; all real x |

### Exponential: y = a^x  (a > 0, a ≠ 1)

- Passes through **(0, 1)**  
- **a > 1**: growth; **0 < a < 1**: decay  
- Horizontal asymptote **y = 0**  
- Domain: ℝ; range: (0, ∞)  
- **y = e^x**: natural exponential; derivative is itself  

### Logarithmic: y = log_a(x)

- Inverse of exponential (reflection in y = x)  
- Passes through **(1, 0)**  
- Vertical asymptote **x = 0**  
- Domain: (0, ∞); range: ℝ  
- **ln x**: natural log (base e); **log₁₀ x**: common log  

### Comparison table

| Function | Key feature |
| --- | --- |
| y = x² | Parabola, vertex (0,0) |
| y = x³ | Inflection at origin |
| y = 1/x | Hyperbola, asymptotes axes |
| y = √x | x ≥ 0, increasing |
| y = ∛x | All reals, increasing |
`,

  "circular-function-graphs": `## Circular (trigonometric) functions

### Sine: y = sin(x)

- Domain: ℝ; range: [−1, 1]  
- Period: **2π**; amplitude: **1**  
- **Odd** function: sin(−x) = −sin(x)  

### Cosine: y = cos(x)

- Domain: ℝ; range: [−1, 1]  
- Period: **2π**  
- **Even** function: cos(−x) = cos(x)  

### Tangent: y = tan(x)

- Domain: x ≠ π/2 + kπ  
- Period: **π**  
- Vertical asymptotes where cos(x) = 0  
- Odd function  

### Transformed form

\`\`\`
y = a·sin(n(x − b)) + c
y = a·cos(n(x − b)) + c
\`\`\`

| Parameter | Effect |
| --- | --- |
| **a** | Amplitude \|a\| |
| **n** | Period = 2π/n (sine/cosine) |
| **b** | Phase shift (horizontal) |
| **c** | Vertical shift |

### Modelling

Use for tides, temperature cycles, seasonal patterns, any **periodic** phenomenon.
`,

  "function-transformations": `## Function transformations: y = a·f(n(x − b)) + c

### Key ideas

| Transformation | Effect |
| --- | --- |
| **Dilation** | Stretch/compress (vertical from x-axis, horizontal from y-axis) |
| **Reflection** | Flip over x-axis or y-axis |
| **Translation** | Shift horizontally or vertically |

### Parameters

| Parameter | Role |
| --- | --- |
| **A (a)** | Vertical dilation; reflection in x-axis if a < 0 |
| **n** | Horizontal dilation; reflection in y-axis if n < 0 |
| **b** | Horizontal translation (right if b > 0 in (x − b)) |
| **c** | Vertical translation |

### General form

\`\`\`
y = a · f(n(x − b)) + c
\`\`\`

### Order of application (recommended)

1. **Dilations and reflections** (A and n)  
2. **Translations** (b and c)  

Applying in the wrong order usually gives a different graph.

### Inverse transformation (summary)

If y = A·f(n(x − b)) + c, reverse by: subtract c → divide by A → apply f⁻¹ → divide by n → add b.

### Mapping notation

Point (x, y) on y = f(x) maps to:

\`\`\`
( (x − b) / n ,  a·y + c )
\`\`\`

on the transformed graph.

### Examples

| Start | Transform | Result |
| --- | --- | --- |
| y = x² | a = 2, b = 1, c = 3 | Vertical stretch ×2, right 1, up 3 |
| y = √x | a = −1, n = −1 | Reflect x-axis and y-axis |

### Inverse transformations

Reverse dilations/reflections first, then reverse translations, to recover the original point from a transformed graph.
`,

  "original-vs-transformed-graphs": `## Original vs transformed graphs

### Form (alternative notation)

\`\`\`
y = a · f(bx − h) + k
\`\`\`

| Symbol | Typical meaning |
| --- | --- |
| **a** | Vertical scale / reflection (x-axis) |
| **b** | Horizontal scale / reflection (y-axis) |
| **h** | Horizontal shift |
| **k** | Vertical shift |

### Dilations

- **Vertical** (from x-axis): y = a·f(x) — stretch if \|a\| > 1, compress if \|a\| < 1  
- **Horizontal** (from y-axis): y = f(bx) — x-coordinates divided by b  

### Reflections

- **x-axis**: y = −f(x)  
- **y-axis**: y = −f(−x) or f(−x) with appropriate scaling  

### Translations

- **Horizontal**: y = f(x − h) — right if h > 0  
- **Vertical**: y = f(x) + k — up if k > 0  

### Order

Common reliable order: **reflections → dilations → translations** (read parameters carefully from the given rule).

### Key features under transformation

| Feature | Affected by |
| --- | --- |
| x-intercepts | Horizontal scale/shift, y-reflection |
| y-intercept | Vertical scale/shift, x-reflection |
| Turning points | All transformation types |
| Asymptotes | Horizontal shifts/scales vs vertical shifts/scales |

### Families of curves

Varying one parameter (e.g. k in y = x² + k) produces a **family** of graphs — useful for comparing effects.
`,

  "graphs-combined-functions": `## Graphs of combined functions

### Sum: (f + g)(x) = f(x) + g(x)

- Domain: intersection of domains of f and g  
- Graph: **addition of ordinates** — add y-values at each x  

### Difference: (f − g)(x) = f(x) − g(x)

- Same domain rule  
- Subtract ordinates  

### Product: (f · g)(x) = f(x)·g(x)

- Domain: intersection  
- Use signs of f and g on intervals; mark zeros of each factor  

### Composition: (f ∘ g)(x) = f(g(x))

- Apply **g** first, then **f**  
- Domain: all x in domain of g such that g(x) is in domain of f  
- **Generally f ∘ g ≠ g ∘ f**  

### Summary

| Operation | Rule | Domain |
| --- | --- | --- |
| Sum | f + g | dom(f) ∩ dom(g) |
| Difference | f − g | dom(f) ∩ dom(g) |
| Product | f·g | dom(f) ∩ dom(g) |
| Composition | f(g(x)) | x where g(x) ∈ dom(f) |

### Tips

- Track transformations when combining  
- Find domain and range for composites carefully  
- Use technology to verify sketches  
`,

  "modelling-with-functions": `## Modelling with functions

### Polynomial models

Trajectory, cost functions, approximating curves — use degree, roots, turning points, end behaviour.

### Power models

Relationships like force ∝ 1/r² (inverse square), scaling laws.

### Circular models

\`\`\`
y = A·sin(B(x − C)) + D
\`\`\`

For periodic data (seasonal, waves).

### Exponential models

\`\`\`
y = A·e^{kx}   or   y = A·a^x
\`\`\`

Population, decay, compound growth — asymptote y = 0 (or shifted).

### Logarithmic models

Inverse of exponential; Richter scale, decibels — rate of change decreases.

### Piecewise (hybrid) functions

\`\`\`
f(x) = { rule₁  if x ≤ a
       { rule₂  if x > a
\`\`\`

Tax brackets, tiered pricing, step behaviour — graph each piece on its domain.
`,

  "polynomial-equation-solutions": `## Polynomial equation solutions

### Key ideas

- Degree **n** → at most **n** real solutions (counting multiplicity)  
- Coefficients real → complex roots come in conjugate pairs when applicable  
- Use **algebra** when possible; **numerics/CAS** when not  

### Factorisation

- If r is a root, **(x − r)** is a factor (Factor theorem)  
- Remainder theorem: remainder when dividing by (x − r) is P(r)  

### Rational root theorem

If p/q is a rational root (in lowest terms) of a polynomial with integer coefficients, then **p** divides constant term and **q** divides leading coefficient.

### After one root

Divide (long or synthetic division) to reduce degree, then solve the quotient (quadratic formula, etc.).

### Numerical methods

- Graph y = P(x); read x-intercepts  
- CAS **solve** / root finder  
- **Newton’s method** (iterative): x_{n+1} = x_n − f(x_n)/f′(x_n)  

### Cubics and quartics

- Cubic: test rational roots → factor → quadratic  
- Quartic: factor if possible; else numerical methods  
`,

  "inverse-functions": `## Inverse functions

### Definition

If f(a) = b, then **f⁻¹(b) = a**. The inverse **undoes** f.

- Exists only if f is **one-to-one** (horizontal line test)  
- Restrict domain if needed (e.g. y = x², x ≥ 0)  

### Finding f⁻¹

1. Write y = f(x)  
2. Swap x and y  
3. Solve for y → that is **f⁻¹(x)**  
4. State domain/range:  
   - dom(f⁻¹) = range(f)  
   - range(f⁻¹) = dom(f)  

### Graphs

Graph of **f⁻¹** is reflection of **f** in the line **y = x**.

### Composition

f(f⁻¹(x)) = x and f⁻¹(f(x)) = x on appropriate domains.

### Common inverses

| f(x) | f⁻¹(x) | Notes |
| --- | --- | --- |
| e^x | ln x | x > 0 for ln |
| ln x | e^x | |
| a^x | log_a(x) | |
| sin x (restricted) | sin⁻¹ x | Principal values |
| x^n (n odd) | x^(1/n) | |

### Solving equations

Example: 2^x = 10 → x = log₂(10) = ln(10)/ln(2).

Trig equations: use inverse trig for principal solution, then find all solutions in the given interval using symmetry.
`,

  "composition-of-functions": `## Composition of functions

### Definition

\`\`\`
(f ∘ g)(x) = f(g(x))
\`\`\`

Apply **g** first, then **f**.

### Condition

Range of g must lie inside domain of f.

### Domain of f ∘ g

All x in dom(g) such that g(x) ∈ dom(f).

### Example

f(x) = √x, g(x) = x − 3 → (f ∘ g)(x) = √(x − 3), domain x ≥ 3.

f(x) = x − 3, g(x) = √x → (f ∘ g)(x) = √x − 3, domain x ≥ 0.

**Order matters:** f ∘ g and g ∘ f are usually different.

### Finding the rule

Substitute g(x) everywhere x appears in f(x).

### Domain and range

Solve domain condition first; then find range of the composite from the rule.
`,

  "solving-f-g-equations": `## Solving equations f(x) = g(x)

### Graphical

Plot **y = f(x)** and **y = g(x)**; x-coordinates of intersections are solutions.

### Numerical

Rewrite as **h(x) = f(x) − g(x) = 0**; use CAS solve or root finder.

### Algebraic

- Factorise when possible  
- Substitution for disguised quadratics/exponentials  
- Apply inverse functions (e.g. ln both sides)  
- Quadratic formula after rearranging  

### Checks

- Respect **domain** of each function  
- Only accept solutions in any given **interval**  
- Multiple intersections → multiple solutions  

| Method | Best when |
| --- | --- |
| Graphical | Any functions; see number of solutions |
| Numerical | Messy algebra |
| Algebraic | Simple or factorisable forms |
`,

  "literal-and-general-equations": `## Literal and general equations

### Literal equations

Equation with **pronumerals** as coefficients; solve for one variable in terms of others.

Example: solve **v = u + at** for **t**:

\`\`\`
t = (v − u) / a   (a ≠ 0)
\`\`\`

### Linear literals

Expand → collect terms with the target variable → factorise → divide.

### Simultaneous literal equations

Use **substitution** or **elimination** as with numerical systems.

### Non-linear literals

May need quadratic formula; state restrictions on parameters (e.g. discriminant ≥ 0 for real solutions).

### General solutions with a parameter

Express answer in terms of the parameter; note when expressions are undefined.
`,

  "simultaneous-linear-equations": `## Simultaneous linear equations

### Two variables — methods

- **Substitution**  
- **Elimination**  

### Geometric meaning (2D)

| Case | Lines | Solutions |
| --- | --- | --- |
| Unique | Intersect once | One point |
| Infinite | Coincident | Infinitely many |
| None | Parallel distinct | No solution |

### Three variables

Planes in 3D:

| Case | Typical geometry |
| --- | --- |
| Unique | One point of intersection |
| Infinite | Line of intersection or same plane |
| None | Parallel planes / no common point |

Use elimination to reduce 3×3 → 2×2 → 1 variable.

### Inconsistent vs dependent

- **Inconsistent**: e.g. 0 = 1 after elimination  
- **Dependent**: one equation is a multiple of another  
`,

  "derivative-antiderivative-graphs": `## Derivative and anti-derivative graphs

### From f to f′ (derivative graph)

| On f | On f′ |
| --- | --- |
| Stationary point | f′ = 0 (x-intercept) |
| Increasing | f′ > 0 |
| Decreasing | f′ < 0 |
| Concave up | f′ increasing |
| Concave down | f′ decreasing |
| Point of inflection on f | local max/min on f′ |

**Steps:** Mark stationary points of f → sign of f′ on intervals → shape of f′ from concavity.

### From f′ to f (anti-derivative sketch)

| On f′ | On f (general shape) |
| --- | --- |
| f′ = 0 | stationary on f |
| f′ > 0 | f increasing |
| f′ < 0 | f decreasing |

Anti-derivative is **not unique**: vertical shift by constant **C** unless an initial condition is given.
`,

  "derivatives-basic-functions": `## Derivatives of basic functions

### Power rule

\`\`\`
d/dx (x^n) = n·x^{n−1}   (n ∈ ℚ, n ≠ 0)
\`\`\`

### Exponential and log

\`\`\`
d/dx (e^x) = e^x
d/dx (ln x) = 1/x   (x > 0)
\`\`\`

### Trigonometric

\`\`\`
d/dx (sin x) = cos x
d/dx (cos x) = −sin x
d/dx (tan x) = sec² x
\`\`\`

### Summary table

| f(x) | f′(x) |
| --- | --- |
| x^n | n·x^{n−1} |
| e^x | e^x |
| ln x | 1/x |
| sin x | cos x |
| cos x | −sin x |
| tan x | sec² x |
`,

  "derivatives-combined-functions": `## Derivatives of combined functions

### Sum / difference

\`\`\`
(f ± g)′ = f′ ± g′
\`\`\`

### Product rule

\`\`\`
(fg)′ = f′g + fg′
\`\`\`

“First d-second plus second d-first.”

### Quotient rule

\`\`\`
(f/g)′ = (f′g − fg′) / g²
\`\`\`

“Low d-high minus high d-low, over low squared.”

### Chain rule

\`\`\`
(f ∘ g)′(x) = f′(g(x)) · g′(x)
\`\`\`

“Derivative of outside (at inside) × derivative of inside.”

### Examples

| f(x) | f′(x) |
| --- | --- |
| x²·sin x | product rule |
| (3x+1)⁵ | chain rule |
| e^{2x} | chain rule |
| ln(x²+1) | chain rule |
`,

  "differentiation-graph-sketching": `## Differentiation for graph sketching

### Stationary points

Where **f′(x) = 0** (or undefined).

| Test | Result |
| --- | --- |
| f′ changes + to − | Local maximum |
| f′ changes − to + | Local minimum |
| f′ same sign both sides | Stationary inflection |

**Second derivative test:** f″(c) > 0 → min; f″(c) < 0 → max; f″(c) = 0 → inconclusive.

### Points of inflection

Concavity changes; often where **f″(x) = 0** (check sign change).

- f″ > 0 → concave up  
- f″ < 0 → concave down  

### Increasing / decreasing

| f′ | f |
| --- | --- |
| f′ > 0 | increasing |
| f′ < 0 | decreasing |

### Sketching checklist

1. Domain, intercepts  
2. Stationary points + nature  
3. Inflection points  
4. Intervals of increase/decrease  
5. Concavity  
6. End behaviour  

### Applications

Optimisation: form function → find critical points on domain → test max/min → interpret with units.
`,

  "antiderivatives": `## Anti-derivatives (indefinite integrals)

### Definition

If F′(x) = f(x), then **F(x) + c** is an anti-derivative of f.

\`\`\`
∫ f(x) dx = F(x) + c
\`\`\`

**c** = constant of integration (family of curves).

### Power rule

\`\`\`
∫ x^n dx = x^{n+1}/(n+1) + c   (n ≠ −1)
∫ x^{−1} dx = ln|x| + c
\`\`\`

### Standard forms

| f(x) | ∫ f(x) dx |
| --- | --- |
| e^x | e^x + c |
| cos x | sin x + c |
| sin x | −cos x + c |
| 1/x | ln|x| + c |

### Initial conditions

Use a point (x₀, y₀) on the curve to find **c**.

### Applications

- Velocity → displacement: s = ∫ v dt  
- Acceleration → velocity: v = ∫ a dt  
`,

  "definite-integral-limit": `## Definite integral as a limit

### Riemann sum

Split [a, b] into subintervals; sum areas of rectangles:

\`\`\`
Σ f(x_i*) · Δx  →  ∫_a^b f(x) dx   as Δx → 0
\`\`\`

### Trapezium rule

\`\`\`
∫_a^b f(x) dx ≈ (Δx/2) · [f(x₀) + 2f(x₁) + ... + 2f(x_{n−1}) + f(x_n)]
\`\`\`

where Δx = (b − a)/n.

- More strips → usually better accuracy  
- Concave up → trapezium **overestimates** (for increasing f on [0,π/2] type examples)  

### Signed area

- Area above x-axis: **positive** contribution  
- Area below: **negative**  
- **Total area** may need splitting at x-intercepts and using \|integral\| on negative pieces  
`,

  "ftc-antidifferentiation": `## Fundamental Theorem of Calculus

### Part 2 (evaluation)

If F′(x) = f(x), then:

\`\`\`
∫_a^b f(x) dx = F(b) − F(a)
\`\`\`

### Steps

1. Find anti-derivative F  
2. Evaluate F(b) − F(a)  

### Geometric meaning

If f(x) ≥ 0 on [a, b], integral = **area under curve** (signed if f changes sign).

### Area between curves

\`\`\`
Area = ∫_a^b (top − bottom) dx
\`\`\`

Split at intersection points if curves cross.

### Average value

\`\`\`
Average = (1/(b−a)) · ∫_a^b f(x) dx
\`\`\`
`,

  "properties-definite-integrals": `## Properties of definite integrals

| Property | Formula |
| --- | --- |
| Additivity | ∫_a^c = ∫_a^b + ∫_b^c |
| Constant multiple | ∫ k·f = k·∫ f |
| Sum/difference | ∫ (f ± g) = ∫ f ± ∫ g |
| Reversing limits | ∫_a^b = −∫_b^a |
| Zero width | ∫_a^a = 0 |

### Even / odd functions

- **Even** f: ∫_{−a}^{a} f(x) dx = 2∫_0^a f(x) dx  
- **Odd** f: ∫_{−a}^{a} f(x) dx = **0**  

### Area applications

- Under one curve  
- Between two curves  
- Average value of f on [a, b]  
`,

  "applications-integration": `## Applications of integration

### Area

- Under y = f(x): ∫ f(x) dx (watch sign)  
- Between curves: ∫ (upper − lower) dx  

### Rate → total change

If F′(t) = rate(t), then **change** = ∫ rate dt.

Example: water leaking at R(t) L/min → total leaked in 10 min = ∫₀¹⁰ R(t) dt.

### Probability link

For PDF f(x): ∫ f(x) dx = 1; P(a < X < b) = ∫_a^b f(x) dx.

### Finding a function from rate

Integrate rate; use initial condition to find constant.
`,

  "random-variables-intro": `## Random variables

### Definition

A **random variable** assigns a **number** to each outcome in a sample space.

### Types

| Type | Values | Examples |
| --- | --- | --- |
| **Discrete** | Countable | Heads in 10 flips, number of cars |
| **Continuous** | Any value in an interval | Height, time, temperature |

### Probability

- Discrete: P(X = x) from PMF  
- Continuous: P(a < X < b) = area under PDF  

### Notation

- Random variable: **X**, **Y**  
- Value: **x**, **y**  
`,

  "discrete-random-variables": `## Discrete random variables

### Specifying distributions

- Table of x and P(X = x)  
- Bar graph  
- PMF: p(x) with 0 ≤ p(x) ≤ 1 and Σ p(x) = 1  

### Mean and spread

\`\`\`
E(X) = μ = Σ x·p(x)
Var(X) = σ² = Σ (x − μ)²·p(x)
SD(X) = σ = √Var(X)
\`\`\`

### Binomial: X ~ Bin(n, p)

n independent trials, two outcomes, constant p.

\`\`\`
P(X = k) = C(n,k) · p^k · (1−p)^{n−k}
E(X) = np
Var(X) = np(1−p)
\`\`\`

### Conditional probability

\`\`\`
P(A|B) = P(A ∩ B) / P(B)
\`\`\`
`,

  "continuous-random-variables": `## Continuous random variables

### PDF f(x)

- f(x) ≥ 0  
- ∫ f(x) dx = 1 over domain  
- P(a < X < b) = ∫_a^b f(x) dx  
- P(X = exact value) = 0  

### Mean and variance

\`\`\`
μ = ∫ x·f(x) dx
σ² = ∫ (x − μ)²·f(x) dx
\`\`\`

### Normal distribution X ~ N(μ, σ²)

\`\`\`
z = (x − μ) / σ
\`\`\`

Standard normal Z ~ N(0, 1) used with tables/CAS.

| Change | Effect on graph |
| --- | --- |
| Increase μ | Shift right |
| Increase σ | Wider, flatter |

### Conditional probability (continuous)

Restrict to interval B; renormalise probability over B.
`,

  "sample-proportions-inference": `## Sampling and sample proportions

### Population vs sample

| | Population | Sample |
| --- | --- | --- |
| Proportion | **p** (usually unknown) | **p̂** (calculated) |
| Notation | Greek | Roman |

### Sample proportion

\`\`\`
p̂ = x / n
\`\`\`

x = count with attribute; n = sample size.

### Approximate normality of p̂

When **np ≥ 10** and **n(1−p) ≥ 10** (rule of thumb):

\`\`\`
p̂ ≈ N( p , p(1−p)/n )
\`\`\`

Mean of p̂ is p; SD is √(p(1−p)/n).

### Simulation

Repeated samples show distribution of p̂ centred near p; larger **n** → narrower spread.
`,

  "applications-of-differentiation": `## Applications of differentiation

### Optimisation

1. Define variables and write a **function** to maximise or minimise  
2. State a sensible **domain** (e.g. lengths > 0)  
3. Find **f′(x) = 0** and endpoints of domain  
4. Classify critical points (sign chart or second derivative)  
5. Answer in context with **units**  

### Rates of change

- If s(t) is position, **v(t) = s′(t)** and **a(t) = v′(t)**  
- Given a rate, differentiate to find when rate is greatest/smallest  
- Interpret **f′(c)** as instantaneous rate at x = c  

### Tangents and normals

- Tangent at x = a: use **m = f′(a)** and point (a, f(a))  
- Normal is perpendicular: slope **−1/f′(a)** (if f′(a) ≠ 0)  

### Modelling contexts

- Maximum area/volume, minimum cost, profit  
- Population or concentration models with constraints  
- Always justify that the critical point gives a max or min on the domain  
`,

  "normal-distribution": `## The normal distribution

### X ~ N(μ, σ²)

- Bell-shaped, symmetric about **μ**  
- Spread controlled by **σ** (standard deviation)  
- Total area under curve = 1  

### Standardisation

\`\`\`
z = (x − μ) / σ
\`\`\`

If X ~ N(μ, σ²), then **Z = (X − μ)/σ ~ N(0, 1)**.

Use standard normal tables or CAS for P(Z < z).

### Typical calculations

- P(X < a), P(a < X < b)  
- Inverse: find x given a probability (percentiles)  
- Compare two groups by comparing z-scores  

### Parameter effects

| Change | Graph |
| --- | --- |
| μ increases | Shifts right |
| σ increases | Wider and flatter |
| σ decreases | Narrower and taller |

### Assumptions

Many real measurements are **approximately** normal. For sample proportions, use normal approximation when **np** and **n(1−p)** are large enough.
`,

  "confidence-intervals-proportions": `## Confidence intervals for proportions

### Formula (approximate)

\`\`\`
p̂ ± z* · √( p̂(1−p̂) / n )
\`\`\`

z* from standard normal (e.g. 1.96 for 95%).

### Interpretation (correct)

“We are **95% confident** the true population proportion lies in this interval” means: if we repeated sampling many times, about **95%** of intervals built this way would contain **p**.

**Not:** “95% chance p is in this interval” for one fixed interval.

### Width factors

| Factor | Effect |
| --- | --- |
| Larger **n** | Narrower interval |
| Higher confidence level | Wider interval |
| p̂ near 0 or 1 | Slightly narrower SE than p̂ = 0.5 |

### Example

n = 500, p̂ = 0.55 → 95% CI ≈ 0.506 to 0.594 (use CAS for z*·SE).

Survey: 55% of 500 voters support a candidate → we are 95% confident the true population proportion is between about **50.6%** and **59.4%**.
`,
};
