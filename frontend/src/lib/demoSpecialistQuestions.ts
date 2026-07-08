import type { Question } from "@/lib/subjects";

type SingleShort = {
  topic: string;
  question: string;
  accepted: string | string[];
  marks?: number;
  guidance?: string;
};

function shortOne(input: SingleShort): Question {
  const acceptedAnswers = Array.isArray(input.accepted)
    ? input.accepted
    : [input.accepted];
  return {
    type: "short",
    topic: input.topic,
    question: input.question,
    marks: input.marks ?? 1,
    guidance: input.guidance,
    acceptedAnswers: acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean),
    // Demo must be mark-by-match only (no API AI).
    useAiMarking: false,
  };
}

/**
 * Demo subject: Specialist Maths — 10 hard, single-answer questions per topic.
 * Topic labels must match `SPECIALIST_MATHS_TOPICS` exactly.
 */
const BANK: SingleShort[] = [
  // ---------------- Logic and proof (10)
  {
    topic: "Logic and proof",
    question:
      "Negate the statement: $\\forall x\\in\\mathbb{R},\\ x^2+1>0$.",
    accepted: ["$\\exists x\\in\\mathbb{R}\\text{ such that }x^2+1\\le 0$"],
  },
  {
    topic: "Logic and proof",
    question:
      "Write the contrapositive of: If $n$ is divisible by 4 then $n$ is even.",
    accepted: ["If $n$ is not even then $n$ is not divisible by 4."],
  },
  {
    topic: "Logic and proof",
    question:
      "Simplify using logical equivalence: $\\neg(P\\lor Q)$.",
    accepted: ["$\\neg P\\land \\neg Q$", "¬P ∧ ¬Q"],
  },
  {
    topic: "Logic and proof",
    question:
      "Determine whether the argument is valid: $(P\\Rightarrow Q),\\ (Q\\Rightarrow R)\\ \\therefore\\ (P\\Rightarrow R)$.",
    accepted: ["Valid"],
  },
  {
    topic: "Logic and proof",
    question:
      "Find a counterexample to the claim: If $a,b\\in\\mathbb{R}$ then $\\sqrt{a+b}=\\sqrt a+\\sqrt b$.",
    accepted: ["$a=1,\\ b=1$", "a=1, b=1"],
  },
  {
    topic: "Logic and proof",
    question:
      "State whether the statement is true or false: If $ab=0$ then $a=0$ and $b=0$.",
    accepted: ["False"],
  },
  {
    topic: "Logic and proof",
    question:
      "Rewrite: $P\\Rightarrow Q$ using only $\\lor$ and $\\neg$.",
    accepted: ["$\\neg P\\lor Q$", "¬P ∨ Q"],
  },
  {
    topic: "Logic and proof",
    question:
      "Evaluate the truth value: $(P\\land \\neg P)\\Rightarrow Q$.",
    accepted: ["True"],
  },
  {
    topic: "Logic and proof",
    question:
      "Negate: $\\exists x>0\\text{ such that }x^2<2$.",
    accepted: ["$\\forall x>0,\\ x^2\\ge 2$"],
  },
  {
    topic: "Logic and proof",
    question:
      "Is the statement always true? If $n$ is odd, then $n^2$ is odd.",
    accepted: ["True"],
  },

  // ---------------- Complex numbers and algebra (10)
  {
    topic: "Complex numbers and algebra",
    question:
      "Write $z=\\frac{1-i}{1+i}$ in the form $a+bi$.",
    accepted: ["$-i$", "-i"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "If $z=3-4i$, find $|z|$.",
    accepted: ["5", "$5$"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Find $\\overline{(2-5i)(1+i)}$ in the form $a+bi$.",
    accepted: ["$-7+3i$", "-7+3i"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Solve $z^2=-16$ for $z$ (give both solutions).",
    accepted: ["$\\pm 4i$", "±4i", "4i, -4i"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "If $z=2(\\cos\\tfrac{\\pi}{3}+i\\sin\\tfrac{\\pi}{3})$, find $z^3$ in exact form.",
    accepted: ["$8(\\cos\\pi+i\\sin\\pi)=-8$", "-8", "$-8$"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Express $\\frac{1}{2- i}$ in the form $a+bi$.",
    accepted: ["$\\frac{2}{5}+\\frac{1}{5}i$", "2/5+1/5 i"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "If $z=\\cos\\theta+i\\sin\\theta$, find $\\frac{1}{z}$ in terms of $\\theta$.",
    accepted: ["$\\cos\\theta-i\\sin\\theta$"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Find the argument of $z=-\\sqrt{3}+i$ (principal value).",
    accepted: ["$\\frac{5\\pi}{6}$", "5\\pi/6"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Solve $z+\\overline z=6$ where $z$ is complex. Express the condition on $\\Re(z)$.",
    accepted: ["$\\Re(z)=3$", "Re(z)=3"],
  },
  {
    topic: "Complex numbers and algebra",
    question:
      "Find all cube roots of $8$ (in complex form).",
    accepted: ["$2,\\ -1+\\sqrt{3}i,\\ -1-\\sqrt{3}i$"],
  },

  // ---------------- Functions, relations and graphs (10)
  {
    topic: "Functions, relations and graphs",
    question:
      "Decompose into partial fractions: $\\frac{5}{(x-1)(x+2)}$.",
    accepted: ["$\\frac{1}{x-1}-\\frac{1}{x+2}$"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the vertical asymptote(s) of $f(x)=\\frac{x^2-1}{x^2-4x+3}$.",
    accepted: ["$x=3$", "3"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the horizontal asymptote of $f(x)=\\frac{3x^2+1}{-6x^2+5}$.",
    accepted: ["$y=-\\frac{1}{2}$", "-1/2"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Solve for $x$: $\\frac{1}{x-1}+\\frac{1}{x+1}=\\frac{3}{2}$.",
    accepted: ["$x=\\pm \\frac{5}{3}$", "±5/3"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "If $f(x)=\\frac{x}{x-1}$, compute $f(f(x))$ and simplify.",
    accepted: ["$x$", "x"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the range of $f(x)=\\frac{1}{x^2+1}$.",
    accepted: ["$0<y\\le 1$", "0<y<=1"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the domain of $f(x)=\\ln\\left(\\frac{x-2}{x+1}\\right)$.",
    accepted: ["$x<-1\\text{ or }x>2$"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Let $f(x)=|x|$ and $g(x)=x^2-1$. Find the number of solutions to $f(x)=g(x)$.",
    accepted: ["3", "$3$"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the inverse of $f(x)=\\frac{2x+1}{x-3}$.",
    accepted: ["$f^{-1}(x)=\\frac{3x+1}{x-2}$"],
  },
  {
    topic: "Functions, relations and graphs",
    question:
      "Find the value of $k$ so that $y=kx+4$ is tangent to $y=x^2$.",
    accepted: ["$k=\\pm 4$", "±4"],
  },

  // ---------------- Differential calculus (10)
  { topic: "Differential calculus", question: "Differentiate: $y=\\sqrt{1-x^2}$.", accepted: ["$y'=-\\frac{x}{\\sqrt{1-x^2}}$"] },
  { topic: "Differential calculus", question: "Differentiate: $y=\\ln(x^2+1)$.", accepted: ["$\\frac{2x}{x^2+1}$", "2x/(x^2+1)"] },
  { topic: "Differential calculus", question: "Differentiate: $y=e^{x^2}$.", accepted: ["$2xe^{x^2}$"] },
  { topic: "Differential calculus", question: "Find $\\frac{d}{dx}(\\arcsin x)$.", accepted: ["$\\frac{1}{\\sqrt{1-x^2}}$"] },
  { topic: "Differential calculus", question: "If $y=x\\sin x$, find $y'$.", accepted: ["$\\sin x+x\\cos x$"] },
  { topic: "Differential calculus", question: "Differentiate implicitly: $x^2+y^2=1$ to find $\\frac{dy}{dx}$.", accepted: ["$-\\frac{x}{y}$"] },
  { topic: "Differential calculus", question: "Find the second derivative of $y=\\ln x$.", accepted: ["$-\\frac{1}{x^2}$"] },
  { topic: "Differential calculus", question: "Compute $\\left.\\frac{d}{dx}(x^3e^x)\\right|_{x=0}$.", accepted: ["0", "$0$"] },
  { topic: "Differential calculus", question: "If $f(x)=\\tan x$, find $f'(x)$.", accepted: ["$\\sec^2 x$"] },
  { topic: "Differential calculus", question: "If $y=\\frac{1}{\\sqrt{x}}$, find $\\frac{dy}{dx}$.", accepted: ["$-\\frac{1}{2x^{3/2}}$"] },

  // ---------------- Integral calculus (10)
  { topic: "Integral calculus", question: "Evaluate $\\int \\frac{1}{1+x^2}\\,dx$.", accepted: ["$\\arctan x + C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int x e^{x}\\,dx$.", accepted: ["$e^x(x-1)+C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int \\sec^2 x\\,dx$.", accepted: ["$\\tan x + C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int_0^1 (3x^2-2x)\\,dx$.", accepted: ["0", "$0$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int \\frac{2x}{x^2+9}\\,dx$.", accepted: ["$\\ln(x^2+9)+C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int e^{2x}\\sin(2x)\\,dx$.", accepted: ["$\\frac{1}{4}e^{2x}(\\sin 2x-\\cos 2x)+C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int \\frac{1}{x^2}\\,dx$.", accepted: ["$-\\frac{1}{x}+C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int_0^{\\pi/2} \\cos x\\,dx$.", accepted: ["1", "$1$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int \\ln x\\,dx$.", accepted: ["$x\\ln x-x+C$"] },
  { topic: "Integral calculus", question: "Evaluate $\\int \\frac{1}{\\sqrt{1-x^2}}\\,dx$.", accepted: ["$\\arcsin x + C$"] },

  // ---------------- Differential equations (10)
  { topic: "Differential equations", question: "Solve $\\frac{dy}{dx}=3x^2$ with $y(0)=2$.", accepted: ["$y=x^3+2$"] },
  { topic: "Differential equations", question: "Verify $y=e^{2x}$ satisfies $y'=2y$ (answer True/False).", accepted: ["True"] },
  { topic: "Differential equations", question: "Solve $\\frac{dy}{dx}=\\frac{2y}{x}$ for $y>0$ (general solution).", accepted: ["$y=Cx^2$"] },
  { topic: "Differential equations", question: "Solve $y'=-y$ with $y(0)=5$.", accepted: ["$y=5e^{-x}$"] },
  { topic: "Differential equations", question: "Solve $\\frac{dy}{dx}=e^{x}$ with $y(0)=1$.", accepted: ["$y=e^x$"] },
  { topic: "Differential equations", question: "Solve $y'=4x$ with $y(1)=3$.", accepted: ["$y=2x^2+1$"] },
  { topic: "Differential equations", question: "For $y'=xy$, find $\\frac{d}{dx}(\\ln y)$.", accepted: ["$x$"] },
  { topic: "Differential equations", question: "Solve $\\frac{dy}{dx}=\\frac{1}{x}$ with $y(1)=0$.", accepted: ["$y=\\ln x$"] },
  { topic: "Differential equations", question: "Solve $y'=6y$ with $y(0)=2$.", accepted: ["$y=2e^{6x}$"] },
  { topic: "Differential equations", question: "Solve $\\frac{dy}{dx}=\\cos x$ with $y(0)=3$.", accepted: ["$y=\\sin x+3$"] },

  // ---------------- Kinematics (10)
  { topic: "Kinematics", question: "A particle has $v(t)=6t-4$. Find the time when it is at rest.", accepted: ["$\\frac{2}{3}$", "2/3"] },
  { topic: "Kinematics", question: "If $a(t)=12t$ and $v(0)=3$, find $v(t)$.", accepted: ["$v=6t^2+3$"] },
  { topic: "Kinematics", question: "If $v(t)=3t^2$ and $s(0)=0$, find $s(2)$.", accepted: ["8", "$8$"] },
  { topic: "Kinematics", question: "A particle has $s(t)=t^3-3t$. Find $a(1)$.", accepted: ["6", "$6$"] },
  { topic: "Kinematics", question: "If $v(t)=4\\sin t$ and $s(0)=2$, find $s(t)$.", accepted: ["$s=-4\\cos t+6$"] },
  { topic: "Kinematics", question: "Given $v(t)=t-1$ on $[0,3]$, find displacement.", accepted: ["$\\frac{3}{2}$", "3/2"] },
  { topic: "Kinematics", question: "A particle has $a(t)=-9.8$ and $v(0)=19.6$. Find $v(1)$.", accepted: ["9.8", "$9.8$"] },
  { topic: "Kinematics", question: "If $s(t)=\\ln(t+1)$, find $v(0)$.", accepted: ["1", "$1$"] },
  { topic: "Kinematics", question: "If $v(t)=2t+5$, find the distance travelled from $t=0$ to $t=3$.", accepted: ["24", "$24$"] },
  { topic: "Kinematics", question: "A particle has $v(t)=t^2-4t+3$. Find the minimum value of $v(t)$.", accepted: ["-1", "$-1$"] },

  // ---------------- Vectors in two and three dimensions (10)
  { topic: "Vectors in two and three dimensions", question: "Let $\\mathbf{a}=(1,2,2)$ and $\\mathbf{b}=(2,0,-1)$. Find $\\mathbf{a}\\cdot\\mathbf{b}$.", accepted: ["0", "$0$"] },
  { topic: "Vectors in two and three dimensions", question: "Find the magnitude of $\\mathbf{v}=(3,-4,12)$.", accepted: ["13", "$13$"] },
  { topic: "Vectors in two and three dimensions", question: "Find a unit vector in the direction of $(6,8)$.", accepted: ["$\\left(\\frac{3}{5},\\frac{4}{5}\\right)$"] },
  { topic: "Vectors in two and three dimensions", question: "If $\\mathbf{a}=(1,0,1)$ and $\\mathbf{b}=(0,1,1)$, find the angle between them (cosine form).", accepted: ["$\\cos\\theta=\\frac{1}{2}$"] },
  { topic: "Vectors in two and three dimensions", question: "Compute $\\mathbf{i}\\times \\mathbf{j}$.", accepted: ["$\\mathbf{k}$", "k"] },
  { topic: "Vectors in two and three dimensions", question: "Compute $(1,2,3)\\times(0,1,0)$.", accepted: ["$(-3,0,1)$", "(-3, 0, 1)"] },
  { topic: "Vectors in two and three dimensions", question: "Find the projection of $(3,4)$ onto $(1,0)$.", accepted: ["$(3,0)$", "(3, 0)"] },
  { topic: "Vectors in two and three dimensions", question: "Find the area of the parallelogram with sides $(1,2,2)$ and $(2,0,-1)$.", accepted: ["$\\sqrt{45}$", "√45"] },
  { topic: "Vectors in two and three dimensions", question: "Find $\\mathbf{a}\\cdot(2\\mathbf{a})$ if $|\\mathbf{a}|=5$.", accepted: ["50", "$50$"] },
  { topic: "Vectors in two and three dimensions", question: "Find a vector perpendicular to both $(1,0,0)$ and $(0,1,0)$.", accepted: ["$(0,0,1)$", "(0, 0, 1)"] },

  // ---------------- Lines and planes in 3D (10)
  { topic: "Lines and planes in 3D", question: "Find the cartesian equation of the plane with normal $(1,2,3)$ through $(1,0,0)$.", accepted: ["$x+2y+3z=1$"] },
  { topic: "Lines and planes in 3D", question: "Find the distance from $(0,0,0)$ to the plane $x+2y+2z=6$.", accepted: ["2", "$2$"] },
  { topic: "Lines and planes in 3D", question: "Find the angle between the planes $x+y+z=1$ and $2x-y+2z=3$ (give $\\cos\\theta$).", accepted: ["$\\cos\\theta=\\frac{3}{\\sqrt{3}\\sqrt{9}}=\\frac{1}{\\sqrt{3}}$"] },
  { topic: "Lines and planes in 3D", question: "Find the direction vector of the line of intersection of planes with normals $\\mathbf{n}_1=(1,0,1)$ and $\\mathbf{n}_2=(0,1,1)$.", accepted: ["$(-1,-1,1)$", "(-1, -1, 1)"] },
  { topic: "Lines and planes in 3D", question: "Write the vector equation of the line through $(1,2,3)$ with direction $(2,-1,0)$.", accepted: ["$\\mathbf{r}=(1,2,3)+t(2,-1,0)$"] },
  { topic: "Lines and planes in 3D", question: "Does the point $(1,1,1)$ lie on the plane $x-2y+z=0$? (Yes/No)", accepted: ["Yes"] },
  { topic: "Lines and planes in 3D", question: "Find the parameter value $t$ when $(1,2,3)+t(1,1,1)$ has $z=0$.", accepted: ["-3", "$-3$"] },
  { topic: "Lines and planes in 3D", question: "Find the normal vector to the plane through points $(0,0,0)$, $(1,0,0)$, $(0,1,0)$.", accepted: ["$(0,0,1)$", "(0, 0, 1)"] },
  { topic: "Lines and planes in 3D", question: "Find the acute angle between line direction $(1,2,2)$ and plane $x+y+z=0$ (give $\\sin\\theta$).", accepted: ["$\\sin\\theta=\\frac{|1+2+2|}{\\sqrt{9}\\sqrt{3}}=\\frac{5}{3\\sqrt{3}}$"] },
  { topic: "Lines and planes in 3D", question: "Find the point where the line $\\mathbf{r}=(0,0,0)+t(1,2,3)$ meets the plane $z=6$.", accepted: ["$(2,4,6)$", "(2, 4, 6)"] },

  // ---------------- Vector calculus (10)
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(t, t^2, \\sin t)$, find $\\mathbf{r}'(t)$.", accepted: ["$(1,2t,\\cos t)$"] },
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(t, t^2, \\sin t)$, find $\\mathbf{r}''(t)$.", accepted: ["$(0,2,-\\sin t)$"] },
  { topic: "Vector calculus", question: "If $\\mathbf{v}(t)=(3t,4)$ in 2D, find speed $|\\mathbf{v}(t)|$.", accepted: ["$\\sqrt{9t^2+16}$"] },
  { topic: "Vector calculus", question: "If $\\mathbf{a}(t)=(0,-9.8)$ and $\\mathbf{v}(0)=(10,0)$, find $\\mathbf{v}(t)$.", accepted: ["$(10,-9.8t)$"] },
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(\\cos t,\\sin t)$, find $|\\mathbf{r}'(t)|$.", accepted: ["1", "$1$"] },
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(t^2,t^3)$, find $\\frac{dy}{dx}$ in terms of $t$.", accepted: ["$\\frac{3t^2}{2t}=\\frac{3t}{2}$", "3t/2"] },
  { topic: "Vector calculus", question: "If $\\mathbf{r}(t)=(e^t, e^{-t})$, find $\\mathbf{r}'(t)$.", accepted: ["$(e^t,-e^{-t})$"] },
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(t,\\ln t)$ ($t>0$), find curvature numerator $|x'y''-y'x''|$.", accepted: ["$\\frac{1}{t^2}$"] },
  { topic: "Vector calculus", question: "If $\\mathbf{r}(t)=(t, t^2)$, find the tangent vector at $t=1$.", accepted: ["$(1,2)$"] },
  { topic: "Vector calculus", question: "Given $\\mathbf{r}(t)=(t^3, t)$, find $\\frac{dx}{dt}$ at $t=2$.", accepted: ["12", "$12$"] },

  // ---------------- Random variables and sampling (10)
  { topic: "Random variables and sampling", question: "If $X$ and $Y$ are independent with $\\mathbb{E}[X]=2$, $\\mathbb{E}[Y]=5$, find $\\mathbb{E}[3X-2Y]$.", accepted: ["-4", "$-4$"] },
  { topic: "Random variables and sampling", question: "If $\\mathrm{Var}(X)=4$ and $\\mathrm{Var}(Y)=9$ independent, find $\\mathrm{Var}(X+Y)$.", accepted: ["13", "$13$"] },
  { topic: "Random variables and sampling", question: "If $\\mathrm{Var}(X)=4$, find $\\mathrm{Var}(5X)$.", accepted: ["100", "$100$"] },
  { topic: "Random variables and sampling", question: "If $\\mathbb{E}[X]=3$, $\\mathrm{Var}(X)=16$, find $\\mathbb{E}[X^2]$.", accepted: ["25", "$25$"] },
  { topic: "Random variables and sampling", question: "If $\\bar X$ is sample mean of size $n=64$ from population with $\\sigma=8$, find $\\mathrm{SD}(\\bar X)$.", accepted: ["1", "$1$"] },
  { topic: "Random variables and sampling", question: "If $\\bar X$ has SD 2 and population SD is 10, find $n$.", accepted: ["25", "$25$"] },
  { topic: "Random variables and sampling", question: "If $X\\sim N(\\mu,\\sigma^2)$, what is the distribution of $\\bar X$ for sample size $n$?", accepted: ["$N\\left(\\mu,\\frac{\\sigma^2}{n}\\right)$"] },
  { topic: "Random variables and sampling", question: "If $X$ and $Y$ independent with SDs 3 and 4, find SD of $2X-Y$.", accepted: ["$\\sqrt{(2^2)(3^2)+4^2}=\\sqrt{52}$", "√52"] },
  { topic: "Random variables and sampling", question: "If $\\Pr(Z<1.28)=0.8997$ for $Z\\sim N(0,1)$, find $\\Pr(Z>1.28)$.", accepted: ["0.1003"] },
  { topic: "Random variables and sampling", question: "If $\\Pr(Z<z)=0.975$, state $z$.", accepted: ["1.96", "$1.96$"] },

  // ---------------- Confidence intervals (10)
  { topic: "Confidence intervals", question: "A 95% CI for mean is $(12,18)$. Find the point estimate.", accepted: ["15", "$15$"] },
  { topic: "Confidence intervals", question: "A 95% CI for mean is $(12,18)$. Find the margin of error.", accepted: ["3", "$3$"] },
  { topic: "Confidence intervals", question: "If $\\bar x=20$, $s=8$, $n=64$, find the standard error $s/\\sqrt{n}$.", accepted: ["1", "$1$"] },
  { topic: "Confidence intervals", question: "For 95% CI, $z=1.96$. If SE = 2, find margin of error.", accepted: ["3.92"] },
  { topic: "Confidence intervals", question: "If a 95% CI is $\\bar x\\pm 4.9$ and $z=1.96$, find SE.", accepted: ["2.5", "2.50"] },
  { topic: "Confidence intervals", question: "If a 95% CI for $p$ is $(0.30,0.42)$, find $\\hat p$.", accepted: ["0.36"] },
  { topic: "Confidence intervals", question: "If a 95% CI for $p$ is $(0.30,0.42)$, find margin of error.", accepted: ["0.06"] },
  { topic: "Confidence intervals", question: "If a 99% CI uses $z=2.576$ and SE=1, find margin of error.", accepted: ["2.576"] },
  { topic: "Confidence intervals", question: "Planning for a proportion CI, worst-case $\\hat p$ is what value?", accepted: ["0.5", "$0.5$"] },
  { topic: "Confidence intervals", question: "If $\\hat p=0.5$ and $n=2500$, find SE for $\\hat p$ (3 d.p.).", accepted: ["0.010", "0.01"] },
];

export const SPECIALIST_BUILTIN_QUESTIONS: Question[] = BANK.map(shortOne);

/** @deprecated Use SPECIALIST_BUILTIN_QUESTIONS (Demo is no longer the owner). */
export const DEMO_SPECIALIST_QUESTIONS: Question[] = SPECIALIST_BUILTIN_QUESTIONS;

