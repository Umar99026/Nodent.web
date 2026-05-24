/**
 * VCE Mathematical Methods study-guide sections (KaTeX-friendly markdown).
 * Composed per topic in methodsCurriculumOverviews.ts.
 */

export const METHODS_BIG_PICTURE = `Methods is about using **functions** to model change and uncertainty.

| Area | Focus |
| --- | --- |
| **FUNCTIONS** | Describe relationships |
| **ALGEBRA** | Solve equations and manipulate expressions |
| **CALCULUS** | Rates of change, gradients, areas |
| **PROBABILITY** | Chance, distributions, expected values |

| Topic area | Main idea |
| --- | --- |
| Functions and graphs | Understand, transform and analyse graphs |
| Algebra | Solve equations, inequalities and simplify expressions |
| Calculus | Differentiate and integrate functions |
| Probability and statistics | Work with chance, distributions and random variables |
`;

export const METHODS_FUNCTIONS_TRANSFORMATIONS = `A function takes an input $x$ and gives exactly one output $y$: $y = f(x)$.

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
`;

export const METHODS_POLYNOMIAL = `### Polynomial functions

| Function | Shape |
| --- | --- |
| $y = x$ | straight line |
| $y = x^2$ | parabola |
| $y = x^3$ | cubic |
| $y = x^4$ | quartic |

**Quadratic:** $y = ax^2 + bx + c$ or vertex form $y = a(x-h)^2 + k$ with turning point $(h,k)$.

**Example:** $y = 2(x-3)^2 + 1$ has turning point $(3,1)$; opens up since $a = 2 > 0$.
`;

export const METHODS_EXP_LOG = `### Exponential functions

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
`;

export const METHODS_CIRCULAR = `### Circular functions

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
`;

export const METHODS_ALGEBRA = `### Composite functions

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
`;

export const METHODS_DIFF_CALC = `Calculus studies **change** (differentiation) and **accumulation** (integration).

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
`;

export const METHODS_APP_DIFF = `### Tangents and normals

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
`;

export const METHODS_INTEGRAL = `### Antidifferentiation

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
`;

export const METHODS_APP_INTEGRAL = `### Definite integrals and area

$$\\int_a^b f(x)\\,dx$$

Area above the $x$-axis is positive; below is negative. For **total area**, split where the graph crosses the axis.

**Example:** $\\int_0^2 x^2\\,dx = \\left[\\frac{x^3}{3}\\right]_0^2 = \\frac{8}{3}$.

---

### Kinematics

$$v(t) = x'(t), \\quad a(t) = v'(t) = x''(t)$$
$$x(t) = \\int v(t)\\,dt, \\quad v(t) = \\int a(t)\\,dt$$

**Example:** $x(t) = t^3 - 6t \\Rightarrow v(t) = 3t^2 - 6$, $a(t) = 6t$.

**Tip:** $v = 0$ → momentarily at rest; **speed** $= |v|$; **distance travelled** $\\neq$ displacement.
`;

export const METHODS_DISCRETE = `### Basic probability

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
`;

export const METHODS_CONTINUOUS = `### Continuous random variables

PDF $f(x)$ with $f(x) \\geq 0$ and $\\int_{-\\infty}^{\\infty} f(x)\\,dx = 1$.

$$P(a \\leq X \\leq b) = \\int_a^b f(x)\\,dx$$

For continuous $X$: $P(X = a) = 0$.

---

### Expected value and variance

$$E(X) = \\int_{-\\infty}^{\\infty} x f(x)\\,dx$$
$$E(X^2) = \\int_{-\\infty}^{\\infty} x^2 f(x)\\,dx, \\quad \\operatorname{Var}(X) = E(X^2) - [E(X)]^2$$
`;

export const METHODS_NORMAL = `### Normal distribution

$$X \\sim N(\\mu, \\sigma^2)$$

Standardise: $Z = \\frac{X - \\mu}{\\sigma}$ where $Z \\sim N(0,1)$.

**Example:** $X \\sim N(50, 5^2)$, find $P(X < 60)$: $Z = \\frac{60-50}{5} = 2$, so $P(X < 60) = P(Z < 2)$.
`;

export const METHODS_SAMPLING = `### Sample proportions

$$\\hat{P} \\sim N\\!\\left(p, \\frac{p(1-p)}{n}\\right)$$

$$E(\\hat{P}) = p, \\quad \\operatorname{sd}(\\hat{P}) = \\sqrt{\\frac{p(1-p)}{n}}$$

Larger $n$ → smaller spread.
`;

export const METHODS_CI_AND_EXAM = `### Confidence intervals for proportions

Estimate an unknown population proportion from sample data (structure similar to Methods inference topics).

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
`;
