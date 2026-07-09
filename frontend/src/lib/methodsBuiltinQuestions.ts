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
    // Built-ins must be match-only (no API AI).
    useAiMarking: false,
  };
}

/**
 * Methods built-in bank: 10 hard short-answer questions per Methods topic.
 * Single final answer only so instant matching works cleanly.
 *
 * Topic labels must match `GOOGLE_SHEETS_TOPIC_LABELS.methods` exactly.
 */
const METHODS_BUILTIN_BANK: SingleShort[] = [
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
    accepted: ["$0\\le y\\le 3$", "0<=y<=3"],
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
    accepted: ["$\\pm 8$", "-8, 8", "-8 and 8", "-8", "8"],
  },
  {
    topic: "Polynomial, power and rational functions",
    question:
      "Find the remainder when $x^3+2x^2-5$ is divided by $x-1$.",
    accepted: ["-2", "$-2$"],
  },
  { topic: "Polynomial, power and rational functions", question: "Solve $\\dfrac{3}{x-1}=2$.", accepted: ["$\\frac{5}{2}$", "5/2"] },
  { topic: "Polynomial, power and rational functions", question: "Find the value of $k$ such that $x^2+kx+9$ has a repeated root.", accepted: ["$\\pm 6$", "-6, 6", "-6 and 6", "-6", "6"] },
  { topic: "Polynomial, power and rational functions", question: "Solve $x^4-5x^2+4=0$ for real $x$.", accepted: ["$\\pm 1,\\ \\pm 2$", "-2, -1, 1, 2", "-2", "-1", "1", "2"] },
  { topic: "Polynomial, power and rational functions", question: "If $f(x)=x^3-3x$, find all turning point $x$-values.", accepted: ["$\\pm 1$", "-1, 1", "-1 and 1", "-1", "1"] },
  { topic: "Polynomial, power and rational functions", question: "Solve $\\sqrt{x+5}=x-1$ for real $x$.", accepted: ["4", "$4$"] },
  { topic: "Polynomial, power and rational functions", question: "Find all real $x$ such that $|x^2-4|=0$.", accepted: ["$\\pm 2$", "-2, 2", "-2 and 2", "-2", "2"] },
  { topic: "Polynomial, power and rational functions", question: "Simplify $\\dfrac{x^2-9}{x^2-6x+9}$ for $x\\ne 3$.", accepted: ["$\\frac{x+3}{x-3}$", "(x+3)/(x-3)"] },

  // --- Exponential and logarithmic functions (10)
  { topic: "Exponential and logarithmic functions", question: "Solve for $x$: $\\log_2(x-1)+\\log_2(x-3)=3$.", accepted: ["5", "$5$"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $3^{2x-1}=27$.", accepted: ["2", "$2$"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $e^{x}=5$ for $x$.", accepted: ["$\\ln 5$", "ln 5"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $\\ln(x)+\\ln(x-2)=\\ln 3$.", accepted: ["3", "$3$"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $2^x=10$ for $x$ (exact form).", accepted: ["$\\log_2 10$", "log_2 10"] },
  { topic: "Exponential and logarithmic functions", question: "Simplify $\\log_a(a^3x)$ (assume $a>0$, $a\\ne 1$, $x>0$).", accepted: ["$3+\\log_a x$", "3+log_a x"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $\\log_{10}(x)=2-\\log_{10}(x)$.", accepted: ["10", "$10$"] },
  { topic: "Exponential and logarithmic functions", question: "If $\\log_3 2 = a$, express $\\log_3 8$ in terms of $a$.", accepted: ["$3a$", "3a"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $\\ln(x^2)=\\ln 9$ for real $x$.", accepted: ["$\\pm 3$", "-3, 3", "-3 and 3", "-3", "3"] },
  { topic: "Exponential and logarithmic functions", question: "Solve $5e^{2x}=20$.", accepted: ["$\\frac{\\ln 4}{2}$", "(ln 4)/2"] },

  // --- Circular functions (10)
  { topic: "Circular functions", question: "Solve for $x$ in $[0,2\\pi)$: $2\\sin x=\\sqrt{3}$.", accepted: ["$\\frac{\\pi}{3},\\ \\frac{2\\pi}{3}$", "\\pi/3, 2\\pi/3"] },
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
  { topic: "Algebra and equations", question: "Solve $\\frac{1}{x}+\\frac{1}{x-1}=1$.", accepted: ["$\\frac{1\\pm \\sqrt{5}}{2}$", "(1+sqrt(5))/2", "(1-sqrt(5))/2"] },
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
  { topic: "Applications of differentiation", question: "Find the stationary points of $f(x)=x^4-4x^2$ (give $x$ values only).", accepted: ["$-\\sqrt{2},\\ 0,\\ \\sqrt{2}$", "-sqrt(2), 0, sqrt(2)"] },
  { topic: "Applications of differentiation", question: "For $f(x)=\\sin x$ on $[0,2\\pi]$, how many stationary points are there?", accepted: ["2", "$2$"] },
  { topic: "Applications of differentiation", question: "A particle has velocity $v(t)=3t^2-12t+9$. Find the time when $v$ is minimum.", accepted: ["2", "$2$"] },
  { topic: "Applications of differentiation", question: "Find the maximum value of $f(x)=-x^2+6x-5$.", accepted: ["4", "$4$"] },
  { topic: "Applications of differentiation", question: "Find the smallest positive $x$ where the tangent to $y=x^2$ has gradient 10.", accepted: ["$\\sqrt{5}$", "sqrt(5)"] },

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

export const METHODS_BUILTIN_QUESTIONS: Question[] = METHODS_BUILTIN_BANK.map(shortOne);

/**
 * Tricky short-answer practice bank (148 questions). Generated — edit in place if needed.
 * @see scripts/generate-maths-builtin-short.mjs
 */
import type { MethodsTopic } from "@/lib/methodsAreaTopic";
import type { ShortQuestion } from "@/lib/subjects";

type Topic = MethodsTopic;

function short(
  topic: Topic,
  question: string,
  acceptedAnswers: string[],
  marks = 2,
): ShortQuestion {
  return { type: "short", topic, question, acceptedAnswers, marks };
}

const METHODS_TRICKY_BUILTIN_BANK: Question[] = [
  short("Functions and transformations", "If $f(x) = |2x - 6|$, find the minimum value of $f(x)$ on $\\mathbb{R}$.", ["0","0.0"], 2),
  short("Polynomial, power and rational functions", "Use the factor theorem: remainder when $P(x) = x^3 - 5x + 4$ is divided by $x-1$.", ["0","0.0"], 2),
  short("Circular functions", "Exact value: $\\sin\\!\\left(\\dfrac{\\pi}{6}\\right)$ (fraction).", ["1/2","0.5","0.50"], 2),
  short("Algebra and equations", "For $x^2 + kx + 16 = 0$ to have exactly one real solution, $|k| = $ ?", ["8","8.0"], 2),
  short("Differential calculus", "Differentiate $f(x) = x^6$. Coefficient of $x^5$ in $f'(x)$.", ["6","6.0"], 2),
  short("Applications of differentiation", "$f(x) = x^3 - 12x$ has stationary point at $x = 2$. Classify it: max or min? (one word)", ["min","minimum","local minimum"], 2),
  short("Integral calculus", "Antiderivative of $6x^2$ (no constant): coefficient of $x^3$.", ["2","2.0"], 2),
  short("Applications of integration", "Area between $y = x$ and $y = x^2$ on $[0,1]$ is $\\dfrac{1}{k}$. Find $k$.", ["6","6.0"], 2),
  short("Discrete random variables", "$X \\in \\{0,1\\}$ with $P(X=0)=0.7$, $P(X=1)=0.3$. Find $E(X)$.", ["0.3","0.30",".3"], 2),
  short("Continuous random variables", "PDF $f(x) = \\dfrac{1}{4}$ on $[2,6]$. Find $P(2 < X < 5)$.", ["0.75",".75","3/4"], 2),
  short("The normal distribution", "$X \\sim N(50, 10^2)$. Find $z$ for $x = 60$.", ["1","1.0"], 2),
  short("Sampling and sample proportions", "In a sample, $18$ successes in $80$ trials. Find $\\hat{p}$ (3 d.p.).", ["0.225",".225"], 2),
  short("Functions and transformations", "The graph of $y = f(x)$ is shifted **right** $4$ units. Write the rule.", ["f(x-4)","y=f(x-4)"], 2),
  short("Polynomial, power and rational functions", "For $P(x) = (x-2)^2(x+1)$, how many **distinct** real zeros?", ["2","2.0"], 2),
  short("Circular functions", "Exact value: $\\cos\\!\\left(\\dfrac{2\\pi}{3}\\right)$ (fraction).", ["-1/2","-0.5","-.5"], 2),
  short("Differential calculus", "Find $\\dfrac{d}{dx}(e^{4x})$ at $x = 0$.", ["4","4.0"], 2),
  short("Applications of differentiation", "Rectangle with perimeter $24$ cm. Side length (cm) for maximum area?", ["6","6.0"], 2),
  short("Applications of integration", "For $v(t) = 4t$, find the displacement from $t = 0$ to $t = 3$.", ["18","18.0"], 2),
  short("Discrete random variables", "$X \\sim \\operatorname{Bin}(10,0.2)$. Find $\\operatorname{Var}(X)$.", ["1.6","1.60"], 2),
  short("Continuous random variables", "Uniform on $[0,20]$. Median of $X$.", ["10","10.0"], 2),
  short("The normal distribution", "For standard normal $Z$, $P(Z < 0) = $ ?", ["0.5",".5","0.50"], 2),
  short("Sampling and sample proportions", "$\\hat{p} = 0.4$, $n = 100$. Standard error $\\sqrt{\\hat{p}(1-\\hat{p})/n}$ (3 d.p.).", ["0.049",".049","0.0490"], 2),
  short("Confidence intervals for proportions", "Margin of error $E = z\\times SE$. If $z=2$, $SE=0.03$, find $E$ (2 d.p.).", ["0.06",".06","0.060"], 2),
  short("Functions and transformations", "Find the domain of $f(x) = \\sqrt{7 - 2x}$ in interval notation: $(-\\infty, a]$. State $a$.", ["3.5","7/2","3.50"], 2),
  short("Polynomial, power and rational functions", "$y = \\dfrac{1}{x-3} + 2$ has vertical asymptote $x = $ ?", ["3","3.0"], 2),
  short("Exponential and logarithmic functions", "Simplify $\\ln(e^{7})$.", ["7","7.0"], 2),
  short("Circular functions", "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.", ["4","4.0"], 2),
  short("Differential calculus", "Gradient of tangent to $y = x^3$ at $x = -2$.", ["12","12.0"], 2),
  short("Applications of differentiation", "Tangent slope is $\\dfrac{1}{3}$. Normal slope is?", ["-3","-3.0"], 2),
  short("Integral calculus", "Area under $y = 2x$ from $x = 0$ to $x = 4$.", ["16","16.0"], 2),
  short("Applications of integration", "A valid PDF on $[0,1]$ with $f(x) = k$ must have $k = $ ?", ["1","1.0"], 2),
  short("Discrete random variables", "Fair coin tossed $3$ times. $P(\\text{at least one head})$ as a fraction.", ["7/8","0.875",".875"], 2),
  short("Continuous random variables", "$\\displaystyle\\int_{-\\infty}^{\\infty} f(x)\\,dx$ for a PDF equals?", ["1","1.0"], 2),
  short("The normal distribution", "Empirical rule: about what percent of data lies within one standard deviation of the mean? (integer)", ["68","68%"], 2),
  short("Sampling and sample proportions", "A sample of only Year 12 students estimates school-wide opinion. One-word bias type?", ["bias","biased","selection"], 2),
  short("Confidence intervals for proportions", "Wider confidence interval mainly means more or less uncertainty? (one word)", ["more","greater"], 2),
  short("Functions and transformations", "Thermometer converts $F = \\dfrac{9C}{5}+32$. If $C = 20$, find $F$.", ["68","68.0"], 2),
  short("Polynomial, power and rational functions", "Profit model $P(x) = -(x-5)^2 + 9$ ($x$ in thousands). Maximum profit (units)?", ["9","9.0"], 2),
  short("Exponential and logarithmic functions", "Population $P(t)=1200(0.92)^t$. Percent decrease per time step? (integer)", ["8","8%"], 2),
  short("Circular functions", "Ferris wheel height $h(t)=10\\sin\\!\\left(\\dfrac{\\pi t}{6}\\right)+12$ (metres). Minimum height?", ["2","2.0"], 2),
  short("Algebra and equations", "Parameter $k$: solve $kx + 3 = 2x + 11$ for $x$ in terms of $k$. If $k \\neq 2$, $x = \\dfrac{8}{k-2}$. For **no** solution, $k$ equals?", ["2","2.0"], 2),
  short("Differential calculus", "Curve $y = x^2 e^{-x}$. At $x = 2$, is gradient positive or negative? (one word)", ["negative","Negative","neg"], 2),
  short("Applications of differentiation", "For $s(t) = t^3 - 6t$, find the velocity at $t = 2$.", ["6","6.0"], 2),
  short("Applications of integration", "Average value of $f(x) = 8$ on $[2,6]$ is?", ["8","8.0"], 2),
  short("Continuous random variables", "CDF $F(3) = 0.6$ means $P(X \\le 3) = $ ?", ["0.6",".6","0.60"], 2),
  short("The normal distribution", "$X \\sim N(100, 15^2)$. $P(X > 100)$ equals $P(Z > ?)$. Enter the $z$ threshold.", ["0","0.0"], 2),
  short("Sampling and sample proportions", "In $80$ trials there are $18$ successes. How many failures?", ["62","62.0"], 2),
  short("Confidence intervals for proportions", "If $\\hat{p}=0.5$, $n=400$, $z=1.96$, approximate $E$ (2 d.p.).", ["0.05",".05","0.049","0.0490"], 2),
  short("Functions and transformations", "Reflect $y=\\sqrt{x}$ in the $y$-axis then shift right 1. New domain in form $x \\leq k$. Find $k$.", ["-1","-1.0"], 2),
  short("Polynomial, power and rational functions", "$P(x)=(x-1)^2(x+2)$. Number of **distinct** $x$-intercepts?", ["2","2.0"], 2),
  short("Exponential and logarithmic functions", "Half-life: $N(t)=N_0(0.5)^{t/3}$. After $t=9$, fraction of $N_0$ remaining?", ["0.125",".125","1/8"], 2),
  short("Circular functions", "Tide model $d(t)=2.5\\cos\\!\\left(\\dfrac{\\pi t}{6}\\right)+4$. Amplitude (metres)?", ["2.5","2.50"], 2),
  short("Algebra and equations", "Inequality $|2x-1|<5$. Smallest **integer** solution?", ["-2","-2.0"], 2),
  short("Differential calculus", "$f(x)=\\ln(x^2+1)$. $f'(0)=$ ?", ["0","0.0"], 2),
  short("Applications of differentiation", "Fence 30 m against a wall (no fence on wall). Rectangle area $A = x(30-2x)$. Maximise: optimal $x$?", ["7.5","7.50","15/2"], 2),
  short("Applications of integration", "PDF $f(x)=\\dfrac{2x}{9}$ on $[0,3]$. Find $P(X<1.5)$.", ["0.25",".25","1/4"], 2),
  short("Discrete random variables", "You win \\$4 with probability $0.2$ and lose \\$1 otherwise. Expected profit per play?", ["0.2","0.20",".2"], 2),
  short("Continuous random variables", "Triangular PDF on $[0,2]$ with peak at $x=1$, height 1. Total area must be 1 — is this valid without scaling? yes or no.", ["no","No"], 2),
  short("The normal distribution", "Exam scores $N(70,100)$. Pass mark 60. $z$-score for 60?", ["-1","-1.0"], 2),
  short("Confidence intervals for proportions", "Poll $\\hat{p}=0.62$, $n=500$, 95% uses $z=1.96$. Approx margin of error (2 d.p.)", ["0.04",".04","0.042"], 2),
  short("Functions and transformations", "$f(x) = 2x + 1$. If $f(a) = 9$, find $a$.", ["4","4.0"], 2),
  short("Polynomial, power and rational functions", "$y = x^3 - x$. How many **distinct** real zeros?", ["3","3.0"], 2),
  short("Circular functions", "$\\tan\\!\\left(\\dfrac{\\pi}{4}\\right) = $ ?", ["1","1.0"], 2),
  short("Differential calculus", "$y = \\sin(3x)$. Find $\\dfrac{dy}{dx}$ at $x = 0$.", ["3","3.0"], 2),
  short("Applications of differentiation", "$f(x) = x^2 - 4x + 5$. $x$-coordinate of the stationary point?", ["2","2.0"], 2),
  short("Integral calculus", "$\\displaystyle\\int x^3\\,dx$ (no $+C$): coefficient of $x^4$ is $\\dfrac{1}{k}$. Find $k$.", ["4","4.0"], 2),
  short("Applications of integration", "Evaluate $\\displaystyle\\int_0^3 x^2\\,dx$.", ["9","9.0"], 2),
  short("Discrete random variables", "$P(X=0)=0.5$, $P(X=1)=0.5$. Find $\\operatorname{Var}(X)$.", ["0.25",".25","1/4"], 2),
  short("Continuous random variables", "PDF $f(x)=2x$ on $[0,1]$. Find $P(X < 0.5)$.", ["0.25",".25","1/4"], 2),
  short("The normal distribution", "$X \\sim N(0,1)$. $P(Z < 1) + P(Z > 1)$ equals?", ["1","1.0"], 2),
  short("Sampling and sample proportions", "Larger sample size $n$ makes $\\hat{p}$ typically more or less variable? (one word)", ["less","lower"], 2),
  short("Polynomial, power and rational functions", "$y = 2x^{-1}$. As $x \\to \\infty$, $y \\to$ ?", ["0","0.0"], 2),
  short("Exponential and logarithmic functions", "$\\log_{10}(1000) = $ ?", ["3","3.0"], 2),
  short("Circular functions", "Period of $y = \\sin(4x)$ is $\\dfrac{\\pi}{k}$. Find $k$.", ["2","2.0"], 2),
  short("Algebra and equations", "$x^2 - 5x + 6 = 0$. Smaller root?", ["2","2.0"], 2),
  short("Differential calculus", "Product rule: $f(x) = x^2 e^x$. Find $f'(0)$.", ["0","0.0"], 2),
  short("Applications of differentiation", "$f(x) = x^3 - 3x$. Find $f''(-1)$.", ["-6","-6.0"], 2),
  short("Integral calculus", "Evaluate $\\displaystyle\\int_0^1 e^x\\,dx$ (2 d.p.).", ["1.72","1.718","e-1","1.7183"], 2),
  short("Applications of integration", "Evaluate $\\displaystyle\\int_0^1 (3x + 2)\\,dx$.", ["3.5","3.50","7/2"], 2),
  short("Discrete random variables", "$X \\sim \\operatorname{Bin}(5, 0.4)$. Expected value $E(X)$?", ["2","2.0"], 2),
  short("Continuous random variables", "CDF at lower bound: $F(a) = $ ? for $X$ on $[a,b]$.", ["0","0.0"], 2),
  short("The normal distribution", "A $z$-score of $-2$ means the value is how many standard deviations below the mean? (integer)", ["2","2.0"], 2),
  short("Sampling and sample proportions", "$n=200$, $60$ successes. $\\hat{p}$ as decimal?", ["0.3",".3","0.30"], 2),
  short("Confidence intervals for proportions", "A 95% CI for $p$ refers to the long-run success rate of the ___ (one word).", ["method","methods","procedure"], 2),
  short("Functions and transformations", "$f(x)=5-x^2$. Maximum value of $f$?", ["5","5.0"], 2),
  short("Polynomial, power and rational functions", "$P(x)=x^3-8$. Real zero?", ["2","2.0"], 2),
  short("Exponential and logarithmic functions", "$3^x=\\dfrac{1}{9}$. $x=$ ?", ["-2","-2.0"], 2),
  short("Circular functions", "$\\cos(0)=$ ?", ["1","1.0"], 2),
  short("Algebra and equations", "$|x-3|=7$. Larger solution?", ["10","10.0"], 2),
  short("Differential calculus", "$f(x) = \\ln x$. Find $f'(e)$ (exact).", ["1/e","0.368","0.3679"], 2),
  short("Applications of integration", "A particle moves with $v(t) = 5$ m/s. Find the displacement from $t = 0$ to $t = 4$ s.", ["20","20.0"], 2),
  short("Discrete random variables", "$P(X\\geq 2)$ for $X\\in\\{0,1,2\\}$ with equal prob. Answer as fraction.", ["1/3","0.333","0.33"], 2),
  short("Continuous random variables", "PDF $f(x)=1$ on $[0,5]$. $P(X>4)$?", ["0.2",".2","1/5"], 2),
  short("The normal distribution", "Standard normal: $P(-1<Z<1)$ is about what percent (integer)?", ["68","68%"], 2),
  short("Sampling and sample proportions", "True population proportion is $p$. Sample proportion is $\\hat{p}$. Is $p$ usually known? yes or no.", ["no","No"], 2),
  short("Confidence intervals for proportions", "Same $\\hat{p}$ and $n$: 99% CI is wider than 95%? yes or no.", ["yes","Yes"], 2),
  short("Functions and transformations", "Given $f(x)=x+1$ and $g(x)=x^2$, find $(f\\circ g)(2)$.", ["5","5.0"], 2),
  short("Polynomial, power and rational functions", "Degree of $P(x)=5x^4-2x+7$?", ["4","4.0"], 2),
  short("Exponential and logarithmic functions", "$\\log_3(27)=$ ?", ["3","3.0"], 2),
  short("Circular functions", "$\\sin\\!\\left(\\dfrac{\\pi}{2}\\right)=$ ?", ["1","1.0"], 2),
  short("Algebra and equations", "$2^x=32$. $x=$ ?", ["5","5.0"], 2),
  short("Differential calculus", "$f(x) = x^4$. Find $f''(2)$.", ["48","48.0"], 2),
  short("Applications of differentiation", "Rectangle with perimeter $20$ cm. Maximum area (cm$^2$)?", ["25","25.0"], 2),
  short("Integral calculus", "Evaluate $\\displaystyle\\int_1^2 4x\\,dx$.", ["6","6.0"], 2),
  short("Applications of integration", "Area under $y = 6$ from $x = 1$ to $x = 5$.", ["24","24.0"], 2),
  short("Discrete random variables", "For $n=4$, $p=0.5$, find $P(X=2)$ as a fraction.", ["3/8","0.375",".375"], 2),
  short("Continuous random variables", "Median of uniform $[2,10]$?", ["6","6.0"], 2),
  short("The normal distribution", "$\\mu=40$, $\\sigma=5$. $z$ for $x=45$?", ["1","1.0"], 2),
  short("Sampling and sample proportions", "Simple random sample: every individual has equal chance of selection. True or false?", ["true","True","yes"], 2),
  short("Confidence intervals for proportions", "Point estimate for population proportion is $\\hat{p}$ or $p$? (symbol)", ["p hat","phat","p̂","hat p"], 2),
  short("Functions and transformations", "$y=|x|+1$. Minimum value?", ["1","1.0"], 2),
  short("Polynomial, power and rational functions", "$y=x^{-2}$. As $x \\to 0^+$, $y \\to$ ?", ["infinity","∞","inf"], 2),
  short("Exponential and logarithmic functions", "$e^0=$ ?", ["1","1.0"], 2),
  short("Circular functions", "$\\sin(\\pi)=$ ?", ["0","0.0"], 2),
  short("Algebra and equations", "$\\sqrt{x}=5$. $x=$ ?", ["25","25.0"], 2),
  short("Differential calculus", "$y = \\dfrac{1}{x}$. Gradient of tangent at $x = 2$.", ["-0.25","-1/4","-.25"], 2),
  short("Applications of differentiation", "Tangent to $y = x^2$ at $x = 3$. Gradient?", ["6","6.0"], 2),
  short("Integral calculus", "Antiderivative of $\\dfrac{1}{x}$ (no constant) uses $\\ln|x|$ plus which letter?", ["C","c"], 2),
  short("Discrete random variables", "$E(X)=\\sum x\\,P(X=x)$. If always $X=3$, then $E(X)=$ ?", ["3","3.0"], 2),
  short("Sampling and sample proportions", "$\\hat{p}=0.12$ from $n=50$. Number of successes?", ["6","6.0"], 2),
  short("Differential calculus", "$y = (3x - 1)^5$. Find $\\dfrac{dy}{dx}$ at $x = 1$.", ["240","240.0"], 2),
  short("Applications of integration", "$f(x) = x$ on $[0, 4]$. Average value of $f$ on this interval?", ["2","2.0"], 2),
  short("Differential calculus", "$f(x) = \\cos x$. Find $f'(\\pi)$.", ["0","0.0"], 2),
  short("Applications of integration", "PDF $f(x) = 0.25$ on $[0, 4]$. Find $P(1 < X < 3)$.", ["0.5",".5","1/2"], 2),
  short("Differential calculus", "$f(x) = e^{2x}$. Find $f'(1)$ in form $ke^2$. Integer $k$?", ["2","2.0"], 2),
  short("Applications of integration", "Area between $y = 2$ and $y = x$ on $[0, 2]$.", ["2","2.0"], 2),
];

export const METHODS_TRICKY_BUILTIN_QUESTIONS: Question[] = METHODS_TRICKY_BUILTIN_BANK;
