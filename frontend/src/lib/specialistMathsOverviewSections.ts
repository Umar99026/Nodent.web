/**
 * Detailed Specialist Mathematics overview sections (KaTeX-friendly markdown).
 * Composed per topic in specialistMathsCurriculumOverviews.ts.
 */

export const SPECIALIST_OVERVIEW_LOGIC = `### Logic and statements

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
`;

export const SPECIALIST_OVERVIEW_FUNCTIONS = `### Rational functions

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
`;

export const SPECIALIST_OVERVIEW_COMPLEX = `### Complex numbers

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
`;

export const SPECIALIST_OVERVIEW_DIFF_CALC = `### Differentiation basics

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
`;

export const SPECIALIST_OVERVIEW_INTEGRAL = `### Integration

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
`;

export const SPECIALIST_OVERVIEW_DE = `### Differential equations

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
`;

export const SPECIALIST_OVERVIEW_KINEMATICS = `### Kinematics with calculus

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
`;

export const SPECIALIST_OVERVIEW_VECTORS = `### Vectors

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
`;

export const SPECIALIST_OVERVIEW_LINES_PLANES = `### Vector equation of a line

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
`;

export const SPECIALIST_OVERVIEW_VECTOR_CALC = `### Vector functions and motion

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
`;

export const SPECIALIST_OVERVIEW_RANDOM = `### Random variables

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
`;

export const SPECIALIST_OVERVIEW_CI = `### Confidence intervals

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
`;
