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
    // Critical: keep this match-only (no API AI).
    useAiMarking: false,
  };
}

/**
 * Demo subject: 10 very hard Methods questions per Methods topic.
 * Single-answer only so it can be marked by keyword/exact matching (no AI).
 *
 * Topic labels must match `GOOGLE_SHEETS_TOPIC_LABELS.methods` exactly.
 */
const DEMO_METHODS_BANK: SingleShort[] = [
  // --- Functions and transformations (10)
  {
    topic: "Functions and transformations",
    question:
      "Let $f(x)=\\sqrt{x-1}$. Find the inverse function $f^{-1}(x)$ with its domain stated.",
    accepted: ["$f^{-1}(x)=x^2+1,\\ x\\ge 0$", "$f^{-1}(x)=x^2+1, x\\ge 0"],
  },
  {
    topic: "Functions and transformations",
    question:
      "Let $g(x)=\\frac{2}{x-3}$. Write $g(1-x)$ in simplest form.",
    accepted: ["$-\\frac{2}{x+2}$", "-2/(x+2)"],
  },
  {
    topic: "Functions and transformations",
    question:
      "A function $h$ satisfies $h(x)=f(x-4)+2$ where $f(x)=x^2$. State the coordinates of the vertex of $h$.",
    accepted: ["$(4,2)$", "(4, 2)"],
  },
  {
    topic: "Functions and transformations",
    question:
      "Given $f(x)=\\ln(2-x)$, state the domain of $f$.",
    accepted: ["$x<2$", "x<2"],
  },
  {
    topic: "Functions and transformations",
    question:
      "If $f(x)=|x-3|$ and $g(x)=f(x)+f(-x)$, find $g(2)$.",
    accepted: ["6", "$6$"],
  },
  {
    topic: "Functions and transformations",
    question:
      "Let $f(x)=\\frac{1}{x}$. Find the equation of the image of $y=f(x)$ after reflection in the $y$-axis then translation up 2 units.",
    accepted: ["$y=-\\frac{1}{x}+2$", "y=-1/x+2"],
  },
  {
    topic: "Functions and transformations",
    question:
      "For $f(x)=\\sqrt{9-x^2}$, state the range of $f$.",
    accepted: ["$0\\le y\\le 3$", "0<=y<=3", "0 ≤ y ≤ 3"],
  },
  {
    topic: "Functions and transformations",
    question:
      "If $f(x)=x^3$ and $g(x)=\\sqrt[3]{x}$, state $f(g(x))$.",
    accepted: ["$x$", "x"],
  },
  {
    topic: "Functions and transformations",
    question:
      "Let $f(x)=\\sin x$ on $[0,\\pi]$. Find $\\max f(x)$ on this interval.",
    accepted: ["1", "$1$"],
  },
  {
    topic: "Functions and transformations",
    question:
      "If $f(x)=\\frac{x-1}{x+1}$, find $f^{-1}(x)$.",
    accepted: ["$\\frac{1+x}{1-x}$", "(1+x)/(1-x)"],
  },

  // --- Polynomial, power and rational functions (10)
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Find all real values of $x$ such that $\\dfrac{x^2-5x+6}{x^2-4}=0$.",
    accepted: ["3", "$3$"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Solve $x^{2/3}=4$ for real $x$.",
    accepted: ["$\\pm 8$", "±8", "-8, 8", "(-8, 8)"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Find the remainder when $x^3+2x^2-5$ is divided by $x-1$.",
    accepted: ["-2", "$-2$"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Solve $\\dfrac{3}{x-1}=2$.",
    accepted: ["$\\frac{5}{2}$", "5/2"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Find the value of $k$ such that $x^2+kx+9$ has a repeated root.",
    accepted: ["$\\pm 6$", "±6", "-6, 6"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Solve $x^4-5x^2+4=0$ for real $x$.",
    accepted: ["$\\pm 1,\\ \\pm 2$", "±1, ±2", "-2, -1, 1, 2"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "If $f(x)=x^3-3x$, find all turning point $x$-values.",
    accepted: ["$\\pm 1$", "±1", "-1, 1"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Solve $\\sqrt{x+5}=x-1$ for real $x$.",
    accepted: ["4", "$4$"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Find all real $x$ such that $|x^2-4|=0$.",
    accepted: ["$\\pm 2$", "±2", "-2, 2"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Simplify $\\dfrac{x^2-9}{x^2-6x+9}$ for $x\\ne 3$.",
    accepted: ["$\\frac{x+3}{x-3}$", "(x+3)/(x-3)"],
  },

  // --- Exponential and logarithmic functions (10)
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve for $x$: $\\log_2(x-1)+\\log_2(x-3)=3$.",
    accepted: ["5", "$5$"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $3^{2x-1}=27$.",
    accepted: ["2", "$2$"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $e^{x}=5$ for $x$.",
    accepted: ["$\\ln 5$", "ln 5"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $\\ln(x)+\\ln(x-2)=\\ln 3$.",
    accepted: ["3", "$3$"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $2^x=10$ for $x$ (exact form).",
    accepted: ["$\\log_2 10$", "log_2 10"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Simplify $\\log_a(a^3x)$ (assume $a>0$, $a\\ne 1$, $x>0$).",
    accepted: ["$3+\\log_a x$", "3+log_a x"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $\\log_{10}(x)=2-\\log_{10}(x)$.",
    accepted: ["10", "$10$"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "If $\\log_3 2 = a$, express $\\log_3 8$ in terms of $a$.",
    accepted: ["$3a$", "3a"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $\\ln(x^2)=\\ln 9$ for real $x$.",
    accepted: ["$\\pm 3$", "±3", "-3, 3"],
  },
  {
    topic: "Exponential and logarithmic functions",
    question:
      "Solve $5e^{2x}=20$.",
    accepted: ["$\\frac{\\ln 4}{2}$", "(ln 4)/2"],
  },

  // --- Circular functions (10)
  {
    topic: "Circular functions",
    question:
      "Solve for $x$ in $[0,2\\pi)$: $2\\sin x=\\sqrt{3}$.",
    accepted: ["$\\frac{\\pi}{3},\\ \\frac{2\\pi}{3}$", "\\pi/3, 2\\pi/3"],
  },
  { topic: "Circular functions", question: "Solve $\\cos x=0$ for $x\\in[0,2\\pi)$.", accepted: ["$\\frac{\\pi}{2},\\ \\frac{3\\pi}{2}$", "\\pi/2, 3\\pi/2"] },
  { topic: "Circular functions", question: "Find the exact value of $\\sin(\\pi/6)\\cos(\\pi/3)$.", accepted: ["$\\frac{1}{4}$", "1/4"] },
  { topic: "Circular functions", question: "Solve $\\tan x=1$ for $x\\in[0,2\\pi)$.", accepted: ["$\\frac{\\pi}{4},\\ \\frac{5\\pi}{4}$", "\\pi/4, 5\\pi/4"] },
  { topic: "Circular functions", question: "Solve $\\sin x= -\\frac{1}{2}$ for $x\\in[0,2\\pi)$.", accepted: ["$\\frac{7\\pi}{6},\\ \\frac{11\\pi}{6}$", "7\\pi/6, 11\\pi/6"] },
  { topic: "Circular functions", question: "Find the exact value of $\\cos(2\\cdot \\pi/3)$.", accepted: ["$-\\frac{1}{2}$", "-1/2"] },
  { topic: "Circular functions", question: "Solve $2\\cos x=1$ for $x\\in[0,2\\pi)$.", accepted: ["$\\frac{\\pi}{3},\\ \\frac{5\\pi}{3}$", "\\pi/3, 5\\pi/3"] },
  { topic: "Circular functions", question: "Find all $x\\in[0,2\\pi)$ such that $\\sin x=\\cos x$.", accepted: ["$\\frac{\\pi}{4},\\ \\frac{5\\pi}{4}$", "\\pi/4, 5\\pi/4"] },
  { topic: "Circular functions", question: "Evaluate $\\sin^2(\\pi/4)$ exactly.", accepted: ["$\\frac{1}{2}$", "1/2"] },
  { topic: "Circular functions", question: "Solve $\\cos x=\\sqrt{2}/2$ for $x\\in[0,2\\pi)$.", accepted: ["$\\frac{\\pi}{4},\\ \\frac{7\\pi}{4}$", "\\pi/4, 7\\pi/4"] },

  // --- Algebra and equations (10)
  { topic: "Algebra and equations", question: "Solve for $x$: $|2x-3|=|x+5|$.", accepted: ["$-2,\\ \\frac{8}{3}$", "-2, 8/3"] },
  { topic: "Algebra and equations", question: "Solve $x^2-7x+12=0$.", accepted: ["3, 4", "$3,\\ 4$"] },
  { topic: "Algebra and equations", question: "Solve $\\frac{1}{x}+\\frac{1}{x-1}=1$.", accepted: ["$\\frac{1\\pm \\sqrt{5}}{2}$", "(1±√5)/2"] },
  { topic: "Algebra and equations", question: "Solve $2^{x+1}=8$.", accepted: ["2", "$2$"] },
  { topic: "Algebra and equations", question: "Solve $\\sqrt{2x+3}=x$ for real $x$.", accepted: ["3", "$3$"] },
  { topic: "Algebra and equations", question: "Solve $|x-1|+|x+1|=4$.", accepted: ["$[-3,-1]\\cup[1,3]$", "[-3,-1] U [1,3]"] },
  { topic: "Algebra and equations", question: "If $a+b=5$ and $ab=6$, find $a^2+b^2$.", accepted: ["13", "$13$"] },
  { topic: "Algebra and equations", question: "Solve $\\ln(x)=\\ln(2x-3)$.", accepted: ["3", "$3$"] },
  { topic: "Algebra and equations", question: "Solve $\\frac{x-2}{x+2}=3$.", accepted: ["-4", "$-4$"] },
  { topic: "Algebra and equations", question: "Solve $x^{\\log_2 8}=16$.", accepted: ["2", "$2$"] },

  // --- Differential calculus (10)
  { topic: "Differential calculus", question: "For $f(x)=x^x$ (with $x>0$), find $f'(e)$.", accepted: ["$2e^e$", "2e^e"] },
  { topic: "Differential calculus", question: "Differentiate $f(x)=\\ln(\\sin x)$ and find $f'(\\pi/3)$.", accepted: ["$\\frac{1}{\\sqrt{3}}$", "1/√3"] },
  { topic: "Differential calculus", question: "If $y=\\frac{1}{x^2+1}$, find $\\frac{dy}{dx}$.", accepted: ["$-\\frac{2x}{(x^2+1)^2}$", "-2x/(x^2+1)^2"] },
  { topic: "Differential calculus", question: "Find $\\frac{d}{dx}(\\sqrt{x}+\\frac{1}{\\sqrt{x}})$ for $x>0$.", accepted: ["$\\frac{1}{2\\sqrt{x}}-\\frac{1}{2x^{3/2}}$", "1/(2√x)-1/(2x^(3/2))"] },
  { topic: "Differential calculus", question: "If $y=e^{3x}\\sin x$, find $y'$.", accepted: ["$e^{3x}(3\\sin x+\\cos x)$", "e^(3x)(3sin x+cos x)"] },
  { topic: "Differential calculus", question: "If $y=\\arctan x$, find $y'$.", accepted: ["$\\frac{1}{1+x^2}$", "1/(1+x^2)"] },
  { topic: "Differential calculus", question: "Find the gradient of the tangent to $y=x^3-3x$ at $x=2$.", accepted: ["9", "$9$"] },
  { topic: "Differential calculus", question: "Differentiate $y=\\ln(x^2+1)$.", accepted: ["$\\frac{2x}{x^2+1}$", "2x/(x^2+1)"] },
  { topic: "Differential calculus", question: "If $f(x)=x\\ln x$, find $f'(x)$.", accepted: ["$\\ln x+1$", "ln x + 1"] },
  { topic: "Differential calculus", question: "Find $\\frac{d}{dx}(\\cos(2x))$.", accepted: ["$-2\\sin(2x)$", "-2sin(2x)"] },

  // --- Applications of differentiation (10)
  { topic: "Applications of differentiation", question: "A particle moves on a line with $s(t)=t^3-6t^2+9t$ (metres). Find the total distance travelled for $0\\le t\\le 4$.", accepted: ["20", "$20$"] },
  { topic: "Applications of differentiation", question: "Find the $x$-coordinate of the local maximum of $f(x)=x^3-3x^2+1$.", accepted: ["0", "$0$"] },
  { topic: "Applications of differentiation", question: "For $f(x)=x+\\frac{1}{x}$ ($x>0$), find the minimum value of $f(x)$.", accepted: ["2", "$2$"] },
  { topic: "Applications of differentiation", question: "Find the equation of the tangent to $y=\\ln x$ at $x=1$.", accepted: ["$y=x-1$", "y=x-1"] },
  { topic: "Applications of differentiation", question: "A rectangle has perimeter 20. Find the maximum possible area.", accepted: ["25", "$25$"] },
  { topic: "Applications of differentiation", question: "Find the stationary points of $f(x)=x^4-4x^2$ (give $x$ values only).", accepted: ["$-\\sqrt{2},\\ 0,\\ \\sqrt{2}$", "-√2, 0, √2"] },
  { topic: "Applications of differentiation", question: "For $f(x)=\\sin x$ on $[0,2\\pi]$, how many stationary points are there?", accepted: ["2", "$2$"] },
  { topic: "Applications of differentiation", question: "A particle has velocity $v(t)=3t^2-12t+9$. Find the time when $v$ is minimum.", accepted: ["2", "$2$"] },
  { topic: "Applications of differentiation", question: "Find the maximum value of $f(x)=-x^2+6x-5$.", accepted: ["4", "$4$"] },
  { topic: "Applications of differentiation", question: "Find the smallest positive $x$ where the tangent to $y=x^2$ has gradient 10.", accepted: ["$\\sqrt{5}$", "√5"] },

  // --- Integral calculus (10)
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int_0^1 \\frac{1}{1+x^2}\\,dx$ exactly.", accepted: ["$\\frac{\\pi}{4}$", "\\pi/4"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int 3x^2\\,dx$.", accepted: ["$x^3+C$", "x^3 + C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int e^{2x}\\,dx$.", accepted: ["$\\frac{1}{2}e^{2x}+C$", "(1/2)e^(2x)+C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int \\cos(3x)\\,dx$.", accepted: ["$\\frac{1}{3}\\sin(3x)+C$", "(1/3)sin(3x)+C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int \\frac{1}{x}\\,dx$.", accepted: ["$\\ln|x|+C$", "ln|x|+C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int (2x-5)\\,dx$.", accepted: ["$x^2-5x+C$", "x^2-5x+C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int \\frac{1}{(x+1)^2}\\,dx$.", accepted: ["$-\\frac{1}{x+1}+C$", "-1/(x+1)+C"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int_0^{\\pi} \\sin x\\,dx$.", accepted: ["2", "$2$"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int_0^1 4x^3\\,dx$.", accepted: ["1", "$1$"] },
  { topic: "Integral calculus", question: "Evaluate $\\displaystyle\\int \\frac{2x}{x^2+1}\\,dx$.", accepted: ["$\\ln(x^2+1)+C$", "ln(x^2+1)+C"] },

  // --- Applications of integration (10)
  { topic: "Applications of integration", question: "Find the area enclosed by $y=x^2-4x$ and the $x$-axis.", accepted: ["$\\frac{32}{3}$", "32/3"] },
  { topic: "Applications of integration", question: "Find the area between $y=x$ and $y=x^2$ for $0\\le x\\le 1$.", accepted: ["$\\frac{1}{6}$", "1/6"] },
  { topic: "Applications of integration", question: "Find the average value of $f(x)=x^2$ on $[0,2]$.", accepted: ["$\\frac{4}{3}$", "4/3"] },
  { topic: "Applications of integration", question: "Find the area between $y=\\sin x$ and the $x$-axis on $[0,\\pi]$.", accepted: ["2", "$2$"] },
  { topic: "Applications of integration", question: "Find $\\int_0^2 (3x+1)\\,dx$.", accepted: ["8", "$8$"] },
  { topic: "Applications of integration", question: "Find the area between $y=4-x^2$ and the $x$-axis.", accepted: ["$\\frac{32}{3}$", "32/3"] },
  { topic: "Applications of integration", question: "A velocity is $v(t)=6t$ for $0\\le t\\le 3$. Find displacement.", accepted: ["27", "$27$"] },
  { topic: "Applications of integration", question: "Find the volume when the region under $y=x$ from 0 to 2 is rotated about the $x$-axis.", accepted: ["$\\frac{8\\pi}{3}$", "8\\pi/3"] },
  { topic: "Applications of integration", question: "Find the area between $y=\\ln x$ and the $x$-axis from $x=1$ to $x=e$.", accepted: ["1", "$1$"] },
  { topic: "Applications of integration", question: "If $f'(x)=2x$ and $f(0)=3$, find $f(2)$.", accepted: ["7", "$7$"] },

  // --- Discrete random variables (10)
  {
    topic: "Discrete random variables",
    question:
      "A biased coin shows heads with probability $p$. Two tosses are made. Given $\\Pr(\\text{exactly one head})=\\frac{3}{8}$, find $p$.",
    accepted: ["$\\frac{1}{4}$", "$\\frac{3}{4}$", "1/4", "3/4"],
    guidance:
      "There are two valid $p$ values because $2p(1-p)=3/8$ is symmetric about $p=1/2$.",
  },
  { topic: "Discrete random variables", question: "Let $X\\sim\\text{Bin}(10,0.2)$. Find $\\mathbb{E}[X]$.", accepted: ["2", "$2$"] },
  { topic: "Discrete random variables", question: "If $X\\sim\\text{Bin}(n,0.5)$ and $\\mathbb{E}[X]=6$, find $n$.", accepted: ["12", "$12$"] },
  { topic: "Discrete random variables", question: "A fair die is rolled. Find $\\Pr(X\\ge 5)$.", accepted: ["$\\frac{1}{3}$", "1/3"] },
  { topic: "Discrete random variables", question: "Let $X$ take values 0,1,2 with probabilities 0.2,0.5,0.3. Find $\\mathbb{E}[X]$.", accepted: ["1.1", "$1.1$"] },
  { topic: "Discrete random variables", question: "For $X\\sim\\text{Geom}(p)$ with support $1,2,3,\\dots$, find $\\Pr(X=1)$.", accepted: ["$p$", "p"] },
  { topic: "Discrete random variables", question: "If $X\\sim\\text{Poisson}(\\lambda)$ and $\\Pr(X=0)=e^{-2}$, find $\\lambda$.", accepted: ["2", "$2$"] },
  { topic: "Discrete random variables", question: "If $\\Pr(X=0)=0.1$ for $X\\sim\\text{Poisson}(\\lambda)$, write $\\lambda$ in exact form.", accepted: ["$-\\ln 0.1$", "-ln 0.1"] },
  { topic: "Discrete random variables", question: "For $X\\sim\\text{Bin}(5,0.3)$, find $\\Pr(X=0)$.", accepted: ["0.16807", "0.1681", "$0.16807$"] },
  { topic: "Discrete random variables", question: "Two cards are drawn without replacement from a standard deck. Find $\\Pr(\\text{both aces})$.", accepted: ["$\\frac{1}{221}$", "1/221"] },

  // --- Continuous random variables (10)
  { topic: "Continuous random variables", question: "A continuous random variable has pdf $f(x)=kx(1-x)$ for $0\\le x\\le 1$. Find $k$.", accepted: ["6", "$6$"] },
  { topic: "Continuous random variables", question: "If $X\\sim U(2,8)$, find $\\mathbb{E}[X]$.", accepted: ["5", "$5$"] },
  { topic: "Continuous random variables", question: "If $X\\sim U(2,8)$, find $\\Pr(X>7)$.", accepted: ["$\\frac{1}{6}$", "1/6"] },
  { topic: "Continuous random variables", question: "A pdf is $f(x)=2x$ for $0\\le x\\le 1$. Find $\\Pr(X<0.5)$.", accepted: ["$\\frac{1}{4}$", "1/4"] },
  { topic: "Continuous random variables", question: "A pdf is $f(x)=ce^{-cx}$ for $x\\ge 0$ ($c>0$). Find $\\Pr(X>1)$.", accepted: ["$e^{-c}$", "e^{-c}"] },
  { topic: "Continuous random variables", question: "If $f(x)=k(1-x)$ on $0\\le x\\le 1$, find $k$.", accepted: ["2", "$2$"] },
  { topic: "Continuous random variables", question: "If $f(x)=3x^2$ on $0\\le x\\le 1$, find the median $m$ (solve $\\Pr(X\\le m)=0.5$).", accepted: ["$\\sqrt[3]{\\frac{1}{2}}$", "(1/2)^(1/3)"] },
  { topic: "Continuous random variables", question: "For $f(x)=2x$ on $[0,1]$, find $\\mathbb{E}[X]$.", accepted: ["$\\frac{2}{3}$", "2/3"] },
  { topic: "Continuous random variables", question: "For $f(x)=2x$ on $[0,1]$, find $\\mathrm{Var}(X)$.", accepted: ["$\\frac{1}{18}$", "1/18"] },
  { topic: "Continuous random variables", question: "If $X\\sim U(a,b)$ and $\\mathbb{E}[X]=4$ and $b-a=6$, find $a$.", accepted: ["1", "$1$"] },

  // --- The normal distribution (10)
  { topic: "The normal distribution", question: "If $Z\\sim N(0,1)$, find $\\Pr(|Z|\\le 1.96)$ correct to 4 decimal places.", accepted: ["0.9500", "$0.9500$"] },
  { topic: "The normal distribution", question: "If $Z\\sim N(0,1)$, find $\\Pr(Z>1.96)$ (4 d.p.).", accepted: ["0.0250", "0.025"] },
  { topic: "The normal distribution", question: "If $Z\\sim N(0,1)$, find $\\Pr(Z<0)$.", accepted: ["0.5", "0.5000", "$0.5$"] },
  { topic: "The normal distribution", question: "If $X\\sim N(10,4)$, find $\\Pr(X<10)$.", accepted: ["0.5", "0.5000", "$0.5$"] },
  { topic: "The normal distribution", question: "If $X\\sim N(50,9)$, find $\\Pr(X>53)$ (3 d.p.).", accepted: ["0.159", "$0.159$"] },
  { topic: "The normal distribution", question: "If $X\\sim N(0,1)$, find the 97.5th percentile.", accepted: ["1.96", "$1.96$"] },
  { topic: "The normal distribution", question: "If $X\\sim N(100,16)$, find $\\Pr(92<X<108)$ (3 d.p.).", accepted: ["0.954", "$0.954$"] },
  { topic: "The normal distribution", question: "If $Z\\sim N(0,1)$, find $\\Pr(|Z|\\le 1)$ (3 d.p.).", accepted: ["0.683", "$0.683$"] },
  { topic: "The normal distribution", question: "If $X\\sim N(30,25)$, find the $z$-score for $x=40$.", accepted: ["2", "$2$"] },
  { topic: "The normal distribution", question: "If $Z\\sim N(0,1)$, find $\\Pr(Z< -1.28)$ (2 d.p.).", accepted: ["0.10", "0.1000", "0.10"] },

  // --- Sampling and sample proportions (10)
  { topic: "Sampling and sample proportions", question: "A population has proportion $p=0.40$. A sample of size $n=200$ is taken. Using a normal approximation, find $\\Pr(\\hat p>0.46)$ correct to 3 decimal places.", accepted: ["0.041", "$0.041$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.25$ and $n=100$, find $\\mathbb{E}[\\hat p]$.", accepted: ["0.25", "$0.25$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.25$ and $n=100$, find $\\mathrm{SD}(\\hat p)$ (3 d.p.).", accepted: ["0.043", "$0.043$"] },
  { topic: "Sampling and sample proportions", question: "For $p=0.60$, what is $\\Pr(\\hat p < 0.60)$ approximately?", accepted: ["0.5", "$0.5$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.50$, $n=400$, find $\\Pr(\\hat p>0.55)$ (3 d.p.).", accepted: ["0.023", "$0.023$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.10$, $n=200$, find $\\Pr(\\hat p>0.14)$ (3 d.p.).", accepted: ["0.022", "$0.022$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.30$, $n=500$, find $\\Pr(\\hat p<0.27)$ (3 d.p.).", accepted: ["0.066", "$0.066$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.80$, $n=100$, find $\\Pr(\\hat p>0.86)$ (3 d.p.).", accepted: ["0.055", "$0.055$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.40$, find $n$ such that $\\mathrm{SD}(\\hat p)=0.02$.", accepted: ["600", "$600$"] },
  { topic: "Sampling and sample proportions", question: "If $p=0.5$, $n=100$, find $\\Pr(0.45<\\hat p<0.55)$ (3 d.p.).", accepted: ["0.683", "$0.683$"] },

  // --- Confidence intervals for proportions (10)
  { topic: "Confidence intervals for proportions", question: "In a sample of $n=400$, a proportion $\\hat p=0.58$ is observed. Find the 95% confidence interval for $p$ (to 3 d.p.). Use $z=1.96$.", accepted: ["$(0.532,\\ 0.628)$", "(0.532, 0.628)"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.50$ and $n=100$, find the 95% CI half-width (margin of error) (3 d.p.).", accepted: ["0.098", "$0.098$"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.20$ and $n=500$, find the 95% CI half-width (3 d.p.).", accepted: ["0.035", "$0.035$"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.75$ and $n=400$, find the 95% CI (3 d.p.).", accepted: ["$(0.708,\\ 0.792)$", "(0.708, 0.792)"] },
  { topic: "Confidence intervals for proportions", question: "Find the required $n$ for margin of error 0.03 at 95% confidence when planning with $\\hat p=0.5$.", accepted: ["1068", "$1068$"] },
  { topic: "Confidence intervals for proportions", question: "If a 95% CI for $p$ is $(0.40,0.50)$, state the point estimate $\\hat p$.", accepted: ["0.45", "$0.45$"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.10$, $n=200$, find the 95% CI (3 d.p.).", accepted: ["$(0.058,\\ 0.142)$", "(0.058, 0.142)"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.65$, $n=900$, find the 95% CI half-width (3 d.p.).", accepted: ["0.031", "$0.031$"] },
  { topic: "Confidence intervals for proportions", question: "If the 95% CI half-width is 0.02 with planning value $\\hat p=0.5$, find $n$.", accepted: ["2401", "$2401$"] },
  { topic: "Confidence intervals for proportions", question: "If $\\hat p=0.30$, $n=1000$, find the 95% CI (3 d.p.).", accepted: ["$(0.272,\\ 0.328)$", "(0.272, 0.328)"] },
];

/** @deprecated Demo no longer hosts Methods questions. */
export const DEMO_METHODS_QUESTIONS: Question[] = [];

