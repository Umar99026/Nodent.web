/**
 * VCE Mathematical Methods study-guide sections (KaTeX-friendly markdown).
 * Composed per topic in methodsCurriculumOverviews.ts.
 */

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

---

### Theory: integral as signed area and accumulation

$$\\int_a^b f(x)\\,dx$$

- **Net signed area** between graph and $x$-axis.
- **Total area** requires splitting where $f$ crosses zero and summing absolute contributions.

Between curves $f$ and $g$: area $= \\int_a^b |f(x)-g(x)|\\,dx$ on intervals where you know which is above.

**Kinematics link:** displacement $= \\int v\\,dt$; distance $= \\int |v|\\,dt$; velocity from acceleration is another accumulation.
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

---

### Theory: probability axioms and random variables

**Kolmogorov axioms (Methods level):** $0 \\leq P(A) \\leq 1$, $P(\\Omega)=1$, countable additivity for disjoint events.

**Conditional probability** reweights the sample space to $B$:

$$P(A|B) = \\frac{P(A\\cap B)}{P(B)}, \\quad P(B)>0$$

**Independence:** $P(A\\cap B)=P(A)P(B)$ — knowing $B$ does not change $P(A)$.

A **discrete random variable** $X$ has PMF $p(x)=P(X=x)$ with $\\sum_x p(x)=1$.

**Linearity of expectation:** $E(aX+b)=aE(X)+b$. For independent $X,Y$: $\\operatorname{Var}(X+Y)=\\operatorname{Var}(X)+\\operatorname{Var}(Y)$.

**Binomial** counts successes in $n$ Bernoulli trials: $X=\\sum_{i=1}^n I_i$ with $P(I_i=1)=p$.
`;

export const METHODS_CONTINUOUS = `### Continuous random variables

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
`;

export const METHODS_NORMAL = `### Normal distribution

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
`;

export const METHODS_SAMPLING = `### Sample proportions

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
`;

export const METHODS_CI_AND_EXAM = `### Confidence intervals for proportions

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
`;
