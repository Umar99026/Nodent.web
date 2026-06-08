/**
 * Tricky short-answer practice bank (71 questions). Generated — edit in place if needed.
 * @see scripts/generate-maths-builtin-short.mjs
 */
import type { SpecialistMathsTopic } from "@/lib/specialistMathsAreaTopic";
import type { Question, ShortQuestion } from "@/lib/subjects";

type Topic = SpecialistMathsTopic;

function short(
  topic: Topic,
  question: string,
  acceptedAnswers: string[],
  marks = 2,
): ShortQuestion {
  return { type: "short", topic, question, acceptedAnswers, marks };
}

const BANK: Question[] = [
  short("Logic and proof", "Prove by exhaustion: $n^2 + n$ is even for integer $n$. Factorise $n^2+n$ as $n($ ___ $)$. Enter the bracket expression.", ["n+1","n + 1"], 2),
  short("Complex numbers and algebra", "$z = 3 + 4i$. Find $|z|$.", ["5","5.0"], 2),
  short("Functions, relations and graphs", "$y = \\dfrac{1}{x-2}$: vertical asymptote $x = $ ?", ["2","2.0"], 2),
  short("Differential calculus", "For $x^2 + y^2 = 25$, at $(3,4)$ find $k$ if $\\dfrac{dy}{dx} = -\\dfrac{3}{k}$.", ["4","4.0"], 2),
  short("Integral calculus", "Integration by parts $\\int x e^x\\,dx$ produces $e^x$ times a polynomial of degree ___ in $x$ after one step (degree of the non-$e^x$ factor left).", ["0","1","constant"], 2),
  short("Differential equations", "For $\\dfrac{dy}{dx} = 2y$, is the solution growth or decay? (one word)", ["growth","Growth"], 2),
  short("Kinematics", "For $s(t) = t^3 - 6t$, find the velocity at $t = 1$.", ["-3","-3.0"], 2),
  short("Vectors in two and three dimensions", "$\\mathbf{a} = (1,2,2)$, $\\mathbf{b} = (2,-1,0)$. $\\mathbf{a}\\cdot\\mathbf{b} = $ ?", ["0","0.0"], 2),
  short("Lines and planes in 3D", "Line $\\mathbf{r} = (1,2,3) + \\lambda(0,1,0)$: which coordinate stays constant?", ["x","X"], 2),
  short("Vector calculus", "For $\\mathbf{r}(t) = (t^2, t)$, the velocity vector at $t = 1$ has $x$-component?", ["2","2.0"], 2),
  short("Random variables and sampling", "Independent $X,Y$ with $\\operatorname{Var}(X)=4$, $\\operatorname{Var}(Y)=9$. $\\operatorname{Var}(X+Y)=$ ?", ["13","13.0"], 2),
  short("Confidence intervals", "95% CI for mean uses $z \\approx$ ? (2 d.p.)", ["1.96","1.960"], 2),
  short("Logic and proof", "Contrapositive of $P \\Rightarrow Q$ is $\\neg Q \\Rightarrow$ ___ ?", ["¬P","not P","neg P","\\neg P"], 2),
  short("Complex numbers and algebra", "If $z = 1 + i$, find $z^2$ in form $a+bi$: $a = $ ?", ["0","0.0"], 2),
  short("Functions, relations and graphs", "Partial fractions: $\\dfrac{1}{(x-1)(x+1)} = \\dfrac{A}{x-1} + \\dfrac{B}{x+1}$. Find $A$.", ["0.5","1/2",".5"], 2),
  short("Differential calculus", "Related rates: circle area $A = \\pi r^2$, $\\dfrac{dA}{dt} = 8\\pi$. Find $\\dfrac{dr}{dt}$ when $r = 2$.", ["2","2.0"], 2),
  short("Integral calculus", "Volume of revolution: disk about $x$-axis, $y = 2$ on $[0,1]$ gives $V = \\pi \\int_0^1 4\\,dx = $ ?", ["4pi","4π","12.566","12.57"], 2),
  short("Differential equations", "Does $y = Ce^{2x}$ satisfy $y' = 2y$ for any constant $C$? (true or false)", ["true","True","yes"], 2),
  short("Kinematics", "$v(t) = 6t - 4$. Acceleration at $t = 2$.", ["6","6.0"], 2),
  short("Vectors in two and three dimensions", "$|\\mathbf{i} + \\mathbf{j}| = \\sqrt{k}$. Find $k$.", ["2","2.0"], 2),
  short("Lines and planes in 3D", "Plane $2x - y + z = 6$: normal vector $x$-component?", ["2","2.0"], 2),
  short("Vector calculus", "Differentiate $\\mathbf{r}(t) = (\\cos t, \\sin t)$. Speed $|\\mathbf{v}(t)|$ is constant equal to?", ["1","1.0"], 2),
  short("Random variables and sampling", "$E(3X - 2) = 10$. Find $E(X)$.", ["4","4.0"], 2),
  short("Confidence intervals", "Margin of error $E = z \\dfrac{\\sigma}{\\sqrt{n}}$. If $\\sigma = 10$, $n = 25$, $z = 2$, find $E$.", ["4","4.0"], 2),
  short("Logic and proof", "The statement 'All primes are odd' is false. Give the smallest counterexample.", ["2","2.0"], 2),
  short("Complex numbers and algebra", "For $z = 2\\operatorname{cis}\\!\\left(\\dfrac{\\pi}{3}\\right)$, find the real part.", ["1","1.0"], 2),
  short("Functions, relations and graphs", "$y = |x-3|$ has minimum value?", ["0","0.0"], 2),
  short("Differential calculus", "Derivative of $\\tan x$ at $x = 0$.", ["1","1.0"], 2),
  short("Integral calculus", "$\\displaystyle\\int \\dfrac{1}{x}\\,dx$ (no constant) includes $\\ln|x|$ plus what symbol letter?", ["C","c"], 2),
  short("Differential equations", "Euler step: $y' = x$, $(x_0,y_0)=(0,1)$, $h=0.5$. Next $y_1 = y_0 + h y'$ at $x_0$.", ["1","1.0"], 2),
  short("Kinematics", "For $v(t) = 2t - 8$, find the time $t$ when the particle is at rest ($v = 0$).", ["4","4.0"], 2),
  short("Vectors in two and three dimensions", "Angle between parallel vectors is ___ degrees.", ["0","0.0"], 2),
  short("Lines and planes in 3D", "Distance from origin to plane $x = 5$ equals?", ["5","5.0"], 2),
  short("Vector calculus", "Displacement $\\int_0^1 \\mathbf{v}(t)\\,dt$ for constant $\\mathbf{v} = (3,0)$: $x$-component of displacement?", ["3","3.0"], 2),
  short("Random variables and sampling", "Sample mean $\\bar{X}$ has expected value equal to population ___ ?", ["mean","μ","mu","Mu"], 2),
  short("Confidence intervals", "Standard error of the mean decreases when $n$ increases — true or false?", ["true","True","yes"], 2),
  short("Logic and proof", "Mathematical induction on $n \\ge 1$ usually starts the base step at $n = $ ?", ["1","1.0"], 2),
  short("Complex numbers and algebra", "Solve $z^2 = -9$ in $\\mathbb{C}$: positive imaginary root $bi$. Find $b$.", ["3","3.0"], 2),
  short("Functions, relations and graphs", "Oblique asymptote of $y = \\dfrac{x^2+1}{x}$ as $x \\to \\infty$ behaves like $y = $ ?", ["x","y=x"], 2),
  short("Differential calculus", "Product rule: $\\dfrac{d}{dx}(x^2 e^x)$ at $x = 0$ equals?", ["0","0.0"], 2),
  short("Integral calculus", "Arc length setup uses $\\sqrt{1 + (y')^2}$. If $y' = 0$, integrand simplifies to?", ["1","1.0"], 2),
  short("Differential equations", "Slope field for $y' = x - y$ at point $(0,0)$: slope equals?", ["0","0.0"], 2),
  short("Kinematics", "Speed is the ___ of velocity. (one word)", ["magnitude","absolute","absolute value","modulus"], 2),
  short("Vectors in two and three dimensions", "$\\mathbf{a} \\times \\mathbf{a} = $ ?", ["0","0 vector","(0,0,0)","zero"], 2),
  short("Lines and planes in 3D", "Parallel planes have normals that are ___ (one word).", ["parallel","Parallel"], 2),
  short("Vector calculus", "If $\\mathbf{r}(0) = (0,0)$ and $\\mathbf{v}(t) = (2,2)$, position at $t = 1$ has sum of coordinates?", ["4","4.0"], 2),
  short("Random variables and sampling", "Independent $X,Y$ with $\\operatorname{Var}(X)=1$, $\\operatorname{Var}(Y)=4$. Find $\\operatorname{Var}(2X+3Y)$.", ["40","40.0"], 2),
  short("Confidence intervals", "Higher confidence level (99% vs 95%) makes the interval wider or narrower? (one word)", ["wider","Wider"], 2),
  short("Logic and proof", "Proof by contradiction assumes the negation of what we want to prove, then seeks a ___ (one word).", ["contradiction","Contradiction"], 2),
  short("Complex numbers and algebra", "Multiply $(1-i)(1+i)$. Real part of the product?", ["2","2.0"], 2),
  short("Functions, relations and graphs", "Graph $y=\\dfrac{x}{x^2-4}$. How many vertical asymptotes?", ["2","2.0"], 2),
  short("Differential calculus", "Ladder 5 m long slides: $x^2+y^2=25$, $\\dfrac{dx}{dt}=0.5$ at $x=3$, $y=4$. $\\dfrac{dy}{dt}$ (2 d.p.)", ["-0.38","-0.375","-3/8"], 2),
  short("Integral calculus", "$\\int_0^{\\pi/2} \\sin x\\,dx = $ ?", ["1","1.0"], 2),
  short("Differential equations", "A tank drains so $\\dfrac{dV}{dt}=-0.2V$ with $V(0)=500$. Find $V(5)$ to the nearest litre.", ["184","183.94","184.0"], 2),
  short("Kinematics", "Acceleration $a(t)=6t-4$, $v(0)=2$. $v(2)=$ ?", ["8","8.0"], 2),
  short("Vectors in two and three dimensions", "Work $W=\\mathbf{F}\\cdot\\mathbf{d}$ with $\\mathbf{F}=(5,0,0)$, $\\mathbf{d}=(2,3,0)$. $W=$ ?", ["10","10.0"], 2),
  short("Lines and planes in 3D", "Lines $\\mathbf{r}_1=(1,0,0)+\\lambda(1,1,0)$ and $\\mathbf{r}_2=(0,1,0)+\\mu(1,-1,0)$ in $xy$-plane. Do they intersect? yes or no.", ["yes","Yes"], 2),
  short("Vector calculus", "$\\mathbf{r}(t)=(t, t^2)$. Speed at $t=1$ equals $\\sqrt{5}$ — true or false?", ["true","True","yes"], 2),
  short("Random variables and sampling", "$X,Y$ independent, $E(X)=2$, $E(Y)=-1$. $E(2X-Y+5)=$ ?", ["10","10.0"], 2),
  short("Confidence intervals", "Sample $n=16$, $\\bar{x}=50$, $\\sigma=8$, 95% CI half-width $z\\sigma/\\sqrt{n}$. Find half-width.", ["3.92","3.920"], 2),
  short("Logic and proof", "Prove $n^3-n$ is divisible by 6 for all integers $n$. Factorise $n^3-n = n($ ___ $)$.", ["n^2-1","n^2 - 1","n²-1"], 2),
  short("Complex numbers and algebra", "$z=1+\\sqrt{3}i$. Write $|z|$.", ["2","2.0"], 2),
  short("Functions, relations and graphs", "$y=|x^2-4|$. Number of $x$-intercepts?", ["2","2.0"], 2),
  short("Differential calculus", "Inverse of $f(x)=x^3+1$ at point where $f(x)=9$: $f^{-1}(9)=$ ?", ["2","2.0"], 2),
  short("Integral calculus", "A solid is formed when the region under $y=x^2$ from 0 to 2 is rotated about the $x$-axis. In $\\pi\\int_0^2 x^4\\,dx$, what is the power of $x$ in the integrand?", ["4","4.0"], 2),
  short("Differential equations", "Logistic-style: carrying capacity 1000, $P(0)=100$. Long-term $P$ approaches?", ["1000","1000.0"], 2),
  short("Kinematics", "A particle has velocity $v(t)=3t^2-2$. Find the displacement from $t=1$ to $t=2$.", ["5","5.0"], 2),
  short("Vectors in two and three dimensions", "Unit vector in direction of $(3,4,0)$ has $x$-component $\\dfrac{3}{5}$. $y$-component?", ["0.8","4/5",".8","0.80"], 2),
  short("Logic and proof", "For 'If $n^2$ is even then $n$ is even', the contrapositive starts 'If $n$ is odd then …'. Complete: $n^2$ is ___ ?", ["odd","Odd"], 2),
  short("Complex numbers and algebra", "Roots of $z^3=1$ on unit circle are equally spaced by angle $\\dfrac{2\\pi}{k}$ radians. Find $k$.", ["3","3.0"], 2),
  short("Kinematics", "$s(t)=\\sin t$. First time $t>0$ when the particle is back at $s=0$ (exact radian answer).", ["pi","π","3.14159","3.14"], 2),
];

export const SPECIALIST_MATHS_BUILTIN_QUESTIONS: Question[] = BANK;
