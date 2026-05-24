/**
 * One-off generator for 50 short-answer built-in questions per maths subject.
 * Run: node scripts/generate-maths-builtin-short.mjs
 */
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib");

/** @typedef {{ topic: string, q: string, a: string[], marks?: number }} Row */

function emitFile(
  filename,
  importTopicType,
  topicTypeName,
  exportName,
  rows,
) {
  const body = rows
    .map(
      ({ topic, q, a, marks = 2 }) =>
        `  short(${JSON.stringify(topic)}, ${JSON.stringify(q)}, ${JSON.stringify(a)}, ${marks}),`,
    )
    .join("\n");

  const src = `/**
 * Tricky short-answer practice bank (${rows.length} questions). Generated — edit in place if needed.
 * @see scripts/generate-maths-builtin-short.mjs
 */
import type { ${topicTypeName} } from "@/lib/${importTopicType}";
import type { Question, ShortQuestion } from "@/lib/subjects";

type Topic = ${topicTypeName};

function short(
  topic: Topic,
  question: string,
  acceptedAnswers: string[],
  marks = 2,
): ShortQuestion {
  return { type: "short", topic, question, acceptedAnswers, marks };
}

const BANK: Question[] = [
${body}
];

export const ${exportName}: Question[] = BANK;
`;
  writeFileSync(join(root, filename), src, "utf8");
  console.log(`Wrote ${filename} (${rows.length} questions)`);
}

/** @type {Row[]} */
const general = [
  // Data analysis (13)
  {
    topic: "Data analysis",
    q: "A five-number summary has $Q_1 = 8$, $Q_3 = 20$. Find the IQR.",
    a: ["12", "12.0"],
  },
  {
    topic: "Data analysis",
    q: "For the data set $4, 7, 7, 8, 12$, find the mean (1 d.p.).",
    a: ["7.6", "7.60"],
  },
  {
    topic: "Data analysis",
    q: "A scatterplot has $r = -0.92$. In one word, is the linear association strong or weak?",
    a: ["strong", "Strong"],
  },
  {
    topic: "Data analysis",
    q: "A least-squares line is $\\hat{y} = 40 + 2.5x$ where $x$ is hours studied. Predict $\\hat{y}$ when $x = 12$.",
    a: ["70", "70.0"],
  },
  {
    topic: "Data analysis",
    q: "A residual is $\\text{actual} - \\text{predicted}$. If actual $= 31$ and predicted $= 27$, find the residual.",
    a: ["4", "4.0"],
  },
  {
    topic: "Data analysis",
    q: "Outliers lie outside $Q_1 - 1.5\\times\\text{IQR}$ or $Q_3 + 1.5\\times\\text{IQR}$. With $Q_1 = 10$, $Q_3 = 22$, find the **upper** fence.",
    a: ["40", "40.0"],
  },
  {
    topic: "Data analysis",
    q: "A seasonal index of $1.20$ means the observation is what percent **above** the seasonal average? (whole number)",
    a: ["20", "20%"],
  },
  {
    topic: "Data analysis",
    q: "Deseasonalised value $= \\dfrac{\\text{actual}}{\\text{seasonal index}}$. If actual $= 276$ and index $= 1.15$, give the deseasonalised value (2 d.p.).",
    a: ["240", "240.00", "240.0"],
  },
  {
    topic: "Data analysis",
    q: "$n = 25$ and $\\sum x = 450$. Find $\\bar{x}$.",
    a: ["18", "18.0"],
  },
  {
    topic: "Data analysis",
    q: "Correlation $r = 0.04$ is closest to which type of linear relationship: none, weak, or strong?",
    a: ["none", "no", "no linear", "weak"],
  },
  {
    topic: "Data analysis",
    q: "A moving-average smooth mainly reduces which component of a time series: trend, seasonality, or irregular?",
    a: ["irregular", "random", "noise"],
  },
  {
    topic: "Data analysis",
    q: "On a boxplot the median sits much closer to $Q_3$ than $Q_1$. The distribution is skewed to the low or high end? (one word)",
    a: ["low", "negative", "left"],
  },
  {
    topic: "Data analysis",
    q: "For a regression with $r^2 = 0.64$, what fraction of the variation in $y$ is **not** explained by the linear model? (decimal)",
    a: ["0.36", ".36"],
  },
  // Recursion and financial modelling (13)
  {
    topic: "Recursion and financial modelling",
    q: "An arithmetic sequence has $u_1 = 15$, $d = -4$. Find $u_6$.",
    a: ["-5", "-5.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "A geometric sequence has $u_1 = 3$, $r = 2$. Find $u_5$.",
    a: ["48", "48.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "$\\$5\\,000$ is invested at $4\\%$ p.a. compounded annually for $3$ years. Find the balance (nearest dollar).",
    a: ["5624", "5624.32", "$5624", "5624.3"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Flat-rate depreciation: $V_0 = \\$18\\,000$, fixed drop $\\$2\\,000$ per year. Find $V_3$ after three years.",
    a: ["12000", "$12000", "12000.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Compound interest with no deposits uses the recurrence $A_{n+1} = A_n(1+r)$. If the monthly rate is $r = 0.06$, write the monthly multiplier as a decimal.",
    a: ["1.06", "1.060"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Perpetuity: annual payment $\\$4\\,800$ at $5\\%$ p.a. Find present value (nearest dollar).",
    a: ["96000", "$96000", "96000.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "A geometric sequence goes from $125$ to $180$ in two steps ($u_1 \\to u_2 \\to u_3$). Find the common ratio $r$ (3 d.p.).",
    a: ["1.200", "1.2", "1.20"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Arithmetic series: $n = 12$, $a = 4$, $d = 3$. Find $S_{12}$.",
    a: ["246", "246.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Reducing-balance loan: $B_0 = 200\\,000$, monthly $r = 0.004$, repayment $R = 1500$. After **one** payment, $B_1$ is closest to (nearest dollar)?",
    a: ["199300", "199300.0", "199300.00"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Steady state for $A_{n+1} = A_n(1+r) + D$ with $r = 0.05$, $D = 250$. Find $A$ (2 d.p.).",
    a: ["5000", "5000.00", "5000.0"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Nominal $6\\%$ p.a. compounded quarterly. Effective annual rate as a **percent** (2 d.p.).",
    a: ["6.14", "6.14%", "6.136"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "An annuity immediate: $\\$300$ deposited at **end** of each month, $r = 0.01$, $n = 4$ deposits. Future value after 4th deposit (nearest dollar).",
    a: ["1218", "1218.12", "1218.1"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "Asset value halves every $4$ years under geometric depreciation. Annual depreciation **rate** as a percent (2 d.p.).",
    a: ["15.91", "15.91%", "15.9"],
  },
  // Matrices (12)
  {
    topic: "Matrices",
    q: "Find $\\det\\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$.",
    a: ["10", "10.0"],
  },
  {
    topic: "Matrices",
    q: "Multiply $(2\\times 3)(3\\times 2)$. How many rows does the product have?",
    a: ["2", "2.0"],
  },
  {
    topic: "Matrices",
    q: "In a standard row-stochastic transition matrix, each **row** sum must equal what number?",
    a: ["1", "1.0", "one"],
  },
  {
    topic: "Matrices",
    q: "Compute the $(1,1)$ entry of $3\\begin{pmatrix} 2 & 5 \\\\ 1 & 4 \\end{pmatrix}$.",
    a: ["6", "6.0"],
  },
  {
    topic: "Matrices",
    q: "$\\begin{pmatrix} 1 & 2 \\end{pmatrix}\\begin{pmatrix} 3 \\\\ 4 \\end{pmatrix} = ?$",
    a: ["11", "11.0"],
  },
  {
    topic: "Matrices",
    q: "Inverse of $\\begin{pmatrix} 5 & 0 \\\\ 0 & 2 \\end{pmatrix}$: state the $(2,2)$ entry of $A^{-1}$.",
    a: ["0.5", "1/2", ".5"],
  },
  {
    topic: "Matrices",
    q: "For $T = \\begin{pmatrix} 0.7 & 0.3 \\\\ 0.2 & 0.8 \\end{pmatrix}$ and state $\\mathbf{s} = \\begin{pmatrix} p \\\\ 1-p \\end{pmatrix}$, steady state satisfies $\\mathbf{s} = \\mathbf{s}T$. Find $p$ (2 d.p.).",
    a: ["0.40", "0.4", ".4", "0.400"],
  },
  {
    topic: "Matrices",
    q: "A Leslie matrix is mainly used to model what kind of change over time?",
    a: ["population", "populations", "age structure", "age groups"],
  },
  {
    topic: "Matrices",
    q: "$\\begin{pmatrix} 3 & 2 \\\\ 6 & 4 \\end{pmatrix}$ is singular. Its determinant is?",
    a: ["0", "0.0"],
  },
  {
    topic: "Matrices",
    q: "Order of matrix multiplication $(m\\times n)(n\\times p)$: the inner dimensions $n$ must be what?",
    a: ["equal", "the same", "same"],
  },
  {
    topic: "Matrices",
    q: "If $AB = I$ for $2\\times 2$ matrices, then $B$ is the ___ of $A$. (one word)",
    a: ["inverse", "Inverse"],
  },
  {
    topic: "Matrices",
    q: "Transition matrix entry $t_{ij}$ often means: probability of moving from state ___ to state $j$. Fill the blank (letter $i$ or word 'i').",
    a: ["i", "I"],
  },
  // Networks (12)
  {
    topic: "Networks and decision mathematics",
    q: "An Eulerian **circuit** exists in a connected graph when every vertex has even degree. How many vertices of **odd** degree are allowed?",
    a: ["0", "zero", "none"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "A connected graph has $8$ vertices. A spanning tree has how many edges?",
    a: ["7", "7.0"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Critical path length in an activity network equals the project's minimum ___ time. (one word)",
    a: ["completion", "project", "duration"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Activity float $= LS - ES$. If float is $0$, the activity lies on the ___ path. (two words)",
    a: ["critical path", "critical"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Kruskal's algorithm builds a minimum ___ tree. (two words)",
    a: ["spanning tree", "spanning"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "A Hamiltonian path visits each ___ exactly once. (one word)",
    a: ["vertex", "vertices", "node", "nodes"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "In a bipartite graph, vertices split into two ___ with edges only between them. (one word)",
    a: ["sets", "partitions", "classes"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Dijkstra's algorithm finds a shortest ___ from a source vertex. (one word)",
    a: ["path", "paths"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Weighted edge $12$ on a road network most likely represents distance, time, or colour?",
    a: ["distance", "time", "cost"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "An activity-on-arc network: an arrow from $A$ to $B$ means $B$ cannot start until $A$ has ___. (one word)",
    a: ["finished", "completed", "ended", "finished."],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Graph has vertices of degrees $3,3,2,2$. Can it have an Eulerian **trail** (not necessarily a circuit)? Answer yes or no.",
    a: ["yes", "Yes"],
  },
  {
    topic: "Networks and decision mathematics",
    q: "Prim's algorithm always grows one ___ tree. (one word)",
    a: ["spanning", "minimum spanning"],
  },
];

/** @type {Row[]} */
const methods = [
  { topic: "Functions and transformations", q: "If $f(x) = |2x - 6|$, find the minimum value of $f(x)$ on $\\mathbb{R}$.", a: ["0", "0.0"] },
  { topic: "Functions and transformations", q: "The graph of $y = f(x)$ is shifted **right** $4$ units. Write the rule.", a: ["f(x-4)", "y=f(x-4)"] },
  { topic: "Functions and transformations", q: "Find the domain of $f(x) = \\sqrt{7 - 2x}$ in interval notation: $(-\\infty, a]$. State $a$.", a: ["3.5", "7/2", "3.50"] },
  { topic: "Polynomial, power and rational functions", q: "Use the factor theorem: remainder when $P(x) = x^3 - 5x + 4$ is divided by $x-1$.", a: ["0", "0.0"] },
  { topic: "Polynomial, power and rational functions", q: "For $P(x) = (x-2)^2(x+1)$, how many **distinct** real zeros?", a: ["2", "2.0"] },
  { topic: "Polynomial, power and rational functions", q: "$y = \\dfrac{1}{x-3} + 2$ has vertical asymptote $x = $ ?", a: ["3", "3.0"] },
  { topic: "Exponential and logarithmic functions", q: "Evaluate $\\log_2(64)$.", a: ["6", "6.0"] },
  { topic: "Exponential and logarithmic functions", q: "Solve $5^x = 625$ for $x$.", a: ["4", "4.0"] },
  { topic: "Exponential and logarithmic functions", q: "Simplify $\\ln(e^{7})$.", a: ["7", "7.0"] },
  { topic: "Circular functions", q: "Exact value: $\\sin\\!\\left(\\dfrac{\\pi}{6}\\right)$ (fraction).", a: ["1/2", "0.5", "0.50"] },
  { topic: "Circular functions", q: "Exact value: $\\cos\\!\\left(\\dfrac{2\\pi}{3}\\right)$ (fraction).", a: ["-1/2", "-0.5", "-.5"] },
  { topic: "Circular functions", q: "Smallest positive solution to $\\sin x = \\dfrac{\\sqrt{2}}{2}$ on $[0,2\\pi)$ in radians: $\\dfrac{\\pi}{k}$. Find $k$.", a: ["4", "4.0"] },
  { topic: "Algebra and equations", q: "For $x^2 + kx + 16 = 0$ to have exactly one real solution, $|k| = $ ?", a: ["8", "8.0"] },
  { topic: "Algebra and equations", q: "Solve $2x + y = 11$ and $x - y = 1$. Find $x$.", a: ["4", "4.0"] },
  { topic: "Algebra and equations", q: "Solve $x^2 - 9 > 0$. Smallest integer satisfying it?", a: ["4", "-4"] },
  { topic: "Differential calculus", q: "Differentiate $f(x) = x^6$. Coefficient of $x^5$ in $f'(x)$.", a: ["6", "6.0"] },
  { topic: "Differential calculus", q: "Find $\\dfrac{d}{dx}(e^{4x})$ at $x = 0$.", a: ["4", "4.0"] },
  { topic: "Differential calculus", q: "Gradient of tangent to $y = x^3$ at $x = -2$.", a: ["12", "12.0"] },
  { topic: "Applications of differentiation", q: "$f(x) = x^3 - 12x$ has stationary point at $x = 2$. Classify it: max or min? (one word)", a: ["min", "minimum", "local minimum"] },
  { topic: "Applications of differentiation", q: "Rectangle with perimeter $24$ cm. Side length (cm) for maximum area?", a: ["6", "6.0"] },
  { topic: "Applications of differentiation", q: "Tangent slope is $\\dfrac{1}{3}$. Normal slope is?", a: ["-3", "-3.0"] },
  { topic: "Applications of differentiation", q: "$s(t) = t^3 - 6t$. Velocity at $t = 2$.", a: ["6", "6.0"] },
  { topic: "Integral calculus", q: "Antiderivative of $6x^2$ (no constant): coefficient of $x^3$.", a: ["2", "2.0"] },
  { topic: "Integral calculus", q: "Evaluate $\\displaystyle\\int_0^2 3x\\,dx$.", a: ["6", "6.0"] },
  { topic: "Integral calculus", q: "Area under $y = 2x$ from $x = 0$ to $x = 4$.", a: ["16", "16.0"] },
  { topic: "Integral calculus", q: "$\\displaystyle\\int \\cos x\\,dx$ includes which function? (one word)", a: ["sin", "sin(x)", "sine"] },
  { topic: "Applications of integration", q: "Area between $y = x$ and $y = x^2$ on $[0,1]$ is $\\dfrac{1}{k}$. Find $k$.", a: ["6", "6.0"] },
  { topic: "Applications of integration", q: "Velocity $v(t) = 4t$. Displacement from $t = 0$ to $t = 3$.", a: ["18", "18.0"] },
  { topic: "Applications of integration", q: "A valid PDF on $[0,1]$ with $f(x) = k$ must have $k = $ ?", a: ["1", "1.0"] },
  { topic: "Applications of integration", q: "Average value of $f(x) = 8$ on $[2,6]$ is?", a: ["8", "8.0"] },
  { topic: "Discrete random variables", q: "$X \\in \\{0,1\\}$ with $P(X=0)=0.7$, $P(X=1)=0.3$. Find $E(X)$.", a: ["0.3", "0.30", ".3"] },
  { topic: "Discrete random variables", q: "$X \\sim \\operatorname{Bin}(10,0.2)$. Find $\\operatorname{Var}(X)$.", a: ["1.6", "1.60"] },
  { topic: "Discrete random variables", q: "Fair coin tossed $3$ times. $P(\\text{at least one head})$ as a fraction.", a: ["7/8", "0.875", ".875"] },
  { topic: "Discrete random variables", q: "Invalid probability: $P(A) = -0.1$. Is this allowed? yes or no.", a: ["no", "No"] },
  { topic: "Continuous random variables", q: "PDF $f(x) = \\dfrac{1}{4}$ on $[2,6]$. Find $P(2 < X < 5)$.", a: ["0.75", ".75", "3/4"] },
  { topic: "Continuous random variables", q: "Uniform on $[0,20]$. Median of $X$.", a: ["10", "10.0"] },
  { topic: "Continuous random variables", q: "$\\displaystyle\\int_{-\\infty}^{\\infty} f(x)\\,dx$ for a PDF equals?", a: ["1", "1.0"] },
  { topic: "Continuous random variables", q: "CDF $F(3) = 0.6$ means $P(X \\le 3) = $ ?", a: ["0.6", ".6", "0.60"] },
  { topic: "The normal distribution", q: "$X \\sim N(50, 10^2)$. Find $z$ for $x = 60$.", a: ["1", "1.0"] },
  { topic: "The normal distribution", q: "For standard normal $Z$, $P(Z < 0) = $ ?", a: ["0.5", ".5", "0.50"] },
  { topic: "The normal distribution", q: "Empirical rule: about what percent of data lies within one standard deviation of the mean? (integer)",
    a: ["68", "68%"] },
  { topic: "The normal distribution", q: "$X \\sim N(100, 15^2)$. $P(X > 100)$ equals $P(Z > ?)$. Enter the $z$ threshold.", a: ["0", "0.0"] },
  { topic: "Sampling and sample proportions", q: "Sample: $18$ successes in $80$ trials. $\\hat{p} = $ ? (3 d.p.)", a: ["0.225", ".225"] },
  { topic: "Sampling and sample proportions", q: "$\\hat{p} = 0.4$, $n = 100$. Standard error $\\sqrt{\\hat{p}(1-\\hat{p})/n}$ (3 d.p.).", a: ["0.049", ".049", "0.0490"] },
  { topic: "Sampling and sample proportions", q: "A sample of only Year 12 students estimates school-wide opinion. One-word bias type?", a: ["bias", "biased", "selection"] },
  { topic: "Sampling and sample proportions", q: "In $80$ trials there are $18$ successes. How many failures?", a: ["62", "62.0"] },
  { topic: "Confidence intervals for proportions", q: "95% confidence uses $z \\approx$ ? (2 d.p.)", a: ["1.96", "1.960"] },
  { topic: "Confidence intervals for proportions", q: "Margin of error $E = z\\times SE$. If $z=2$, $SE=0.03$, find $E$ (2 d.p.).", a: ["0.06", ".06", "0.060"] },
  { topic: "Confidence intervals for proportions", q: "Wider confidence interval mainly means more or less uncertainty? (one word)", a: ["more", "greater"] },
  { topic: "Confidence intervals for proportions", q: "If $\\hat{p}=0.5$, $n=400$, $z=1.96$, approximate $E$ (2 d.p.).", a: ["0.05", ".05", "0.049", "0.0490"] },
];

/** Extra Methods rows — heavier on calculus topics that were only ~5 each. */
/** @type {Row[]} */
const methodsTopicBoost = [
  { topic: "Differential calculus", q: "$y = \\sin(3x)$. Find $\\dfrac{dy}{dx}$ at $x = 0$.", a: ["3", "3.0"] },
  { topic: "Differential calculus", q: "Product rule: $f(x) = x^2 e^x$. Find $f'(0)$.", a: ["0", "0.0"] },
  { topic: "Differential calculus", q: "$f(x) = \\ln x$. Find $f'(e)$ (exact).", a: ["1/e", "0.368", "0.3679"] },
  { topic: "Differential calculus", q: "$f(x) = x^4$. Find $f''(2)$.", a: ["48", "48.0"] },
  { topic: "Differential calculus", q: "$y = \\dfrac{1}{x}$. Gradient of tangent at $x = 2$.", a: ["-0.25", "-1/4", "-.25"] },
  { topic: "Differential calculus", q: "$y = (3x - 1)^5$. Find $\\dfrac{dy}{dx}$ at $x = 1$.", a: ["240", "240.0"] },
  { topic: "Differential calculus", q: "$f(x) = \\cos x$. Find $f'(\\pi)$.", a: ["0", "0.0"] },
  { topic: "Differential calculus", q: "$f(x) = e^{2x}$. Find $f'(1)$ in form $ke^2$. Integer $k$?", a: ["2", "2.0"] },
  { topic: "Applications of integration", q: "Evaluate $\\displaystyle\\int_0^3 x^2\\,dx$.", a: ["9", "9.0"] },
  { topic: "Applications of integration", q: "Evaluate $\\displaystyle\\int_0^1 (3x + 2)\\,dx$.", a: ["3.5", "3.50", "7/2"] },
  { topic: "Applications of integration", q: "Constant velocity $v(t) = 5$ m/s. Displacement from $t = 0$ to $t = 4$ s?", a: ["20", "20.0"] },
  { topic: "Applications of integration", q: "Area under $y = 6$ from $x = 1$ to $x = 5$.", a: ["24", "24.0"] },
  { topic: "Applications of integration", q: "Evaluate $\\displaystyle\\int_0^{\\pi} \\sin x\\,dx$.", a: ["2", "2.0"] },
  { topic: "Applications of integration", q: "$f(x) = x$ on $[0, 4]$. Average value of $f$ on this interval?", a: ["2", "2.0"] },
  { topic: "Applications of integration", q: "PDF $f(x) = 0.25$ on $[0, 4]$. Find $P(1 < X < 3)$.", a: ["0.5", ".5", "1/2"] },
  { topic: "Applications of integration", q: "Area between $y = 2$ and $y = x$ on $[0, 2]$.", a: ["2", "2.0"] },
  { topic: "Integral calculus", q: "$\\displaystyle\\int x^3\\,dx$ (no $+C$): coefficient of $x^4$ is $\\dfrac{1}{k}$. Find $k$.", a: ["4", "4.0"] },
  { topic: "Integral calculus", q: "Evaluate $\\displaystyle\\int_0^1 e^x\\,dx$ (2 d.p.).", a: ["1.72", "1.718", "e-1", "1.7183"] },
  { topic: "Integral calculus", q: "Evaluate $\\displaystyle\\int_0^{\\pi/2} \\cos x\\,dx$.", a: ["1", "1.0"] },
  { topic: "Integral calculus", q: "Evaluate $\\displaystyle\\int_1^2 4x\\,dx$.", a: ["6", "6.0"] },
  { topic: "Integral calculus", q: "Antiderivative of $\\dfrac{1}{x}$ (no constant) uses $\\ln|x|$ plus which letter?", a: ["C", "c"] },
  { topic: "Applications of differentiation", q: "$f(x) = x^2 - 4x + 5$. $x$-coordinate of the stationary point?", a: ["2", "2.0"] },
  { topic: "Applications of differentiation", q: "$f(x) = x^3 - 3x$. Find $f''(-1)$.", a: ["-6", "-6.0"] },
  { topic: "Applications of differentiation", q: "$f(x) = x^3 - 3x$. At $x = 2$, is $f$ increasing or decreasing? (one word)", a: ["increasing", "Increasing"] },
  { topic: "Applications of differentiation", q: "Rectangle with perimeter $20$ cm. Maximum area (cm$^2$)?", a: ["25", "25.0"] },
  { topic: "Applications of differentiation", q: "Tangent to $y = x^2$ at $x = 3$. Gradient?", a: ["6", "6.0"] },
  { topic: "Functions and transformations", q: "$f(x) = 2x + 1$. If $f(a) = 9$, find $a$.", a: ["4", "4.0"] },
  { topic: "Functions and transformations", q: "$g(x) = x^2$ with domain $x \\geq 0$. Is $g$ one-to-one? yes or no.", a: ["yes", "Yes"] },
  { topic: "Polynomial, power and rational functions", q: "$y = x^3 - x$. How many **distinct** real zeros?", a: ["3", "3.0"] },
  { topic: "Polynomial, power and rational functions", q: "$y = 2x^{-1}$. As $x \\to \\infty$, $y \\to$ ?", a: ["0", "0.0"] },
  { topic: "Exponential and logarithmic functions", q: "Solve $2^{x+1} = 8$ for $x$.", a: ["2", "2.0"] },
  { topic: "Exponential and logarithmic functions", q: "$\\log_{10}(1000) = $ ?", a: ["3", "3.0"] },
  { topic: "Circular functions", q: "$\\tan\\!\\left(\\dfrac{\\pi}{4}\\right) = $ ?", a: ["1", "1.0"] },
  { topic: "Circular functions", q: "Period of $y = \\sin(4x)$ is $\\dfrac{\\pi}{k}$. Find $k$.", a: ["2", "2.0"] },
  { topic: "Algebra and equations", q: "Solve $3^{2x} = 81$ for $x$.", a: ["2", "2.0"] },
  { topic: "Algebra and equations", q: "$x^2 - 5x + 6 = 0$. Smaller root?", a: ["2", "2.0"] },
  { topic: "Discrete random variables", q: "$P(X=0)=0.5$, $P(X=1)=0.5$. Find $\\operatorname{Var}(X)$.", a: ["0.25", ".25", "1/4"] },
  { topic: "Discrete random variables", q: "$X \\sim \\operatorname{Bin}(5, 0.4)$. Expected value $E(X)$?", a: ["2", "2.0"] },
  { topic: "Continuous random variables", q: "PDF $f(x)=2x$ on $[0,1]$. Find $P(X < 0.5)$.", a: ["0.25", ".25", "1/4"] },
  { topic: "Continuous random variables", q: "CDF at lower bound: $F(a) = $ ? for $X$ on $[a,b]$.", a: ["0", "0.0"] },
  { topic: "The normal distribution", q: "$X \\sim N(0,1)$. $P(Z < 1) + P(Z > 1)$ equals?", a: ["1", "1.0"] },
  { topic: "The normal distribution", q: "A $z$-score of $-2$ means the value is how many standard deviations below the mean? (integer)", a: ["2", "2.0"] },
  { topic: "Sampling and sample proportions", q: "Larger sample size $n$ makes $\\hat{p}$ typically more or less variable? (one word)", a: ["less", "lower"] },
  { topic: "Sampling and sample proportions", q: "$n=200$, $60$ successes. $\\hat{p}$ as decimal?", a: ["0.3", ".3", "0.30"] },
  { topic: "Confidence intervals for proportions", q: "90% confidence uses $z \\approx$ ? (2 d.p.)", a: ["1.645", "1.65"] },
  { topic: "Confidence intervals for proportions", q: "A 95% CI for $p$ refers to the long-run success rate of the ___ (one word).", a: ["method", "methods", "procedure"] },
  // Top up non-calculus topics to minimum 10 each
  { topic: "Functions and transformations", q: "$f(x)=5-x^2$. Maximum value of $f$?", a: ["5", "5.0"] },
  { topic: "Functions and transformations", q: "Composite: $f(x)=x+1$, $g(x)=x^2$. Find $(f\\circ g)(2)$.", a: ["5", "5.0"] },
  { topic: "Polynomial, power and rational functions", q: "$P(x)=x^3-8$. Real zero?", a: ["2", "2.0"] },
  { topic: "Exponential and logarithmic functions", q: "$3^x=\\dfrac{1}{9}$. $x=$ ?", a: ["-2", "-2.0"] },
  { topic: "Circular functions", q: "$\\cos(0)=$ ?", a: ["1", "1.0"] },
  { topic: "Algebra and equations", q: "$|x-3|=7$. Larger solution?", a: ["10", "10.0"] },
  { topic: "Discrete random variables", q: "$P(X\\geq 2)$ for $X\\in\\{0,1,2\\}$ with equal prob. Answer as fraction.", a: ["1/3", "0.333", "0.33"] },
  { topic: "Continuous random variables", q: "PDF $f(x)=1$ on $[0,5]$. $P(X>4)$?", a: ["0.2", ".2", "1/5"] },
  { topic: "The normal distribution", q: "Standard normal: $P(-1<Z<1)$ is about what percent (integer)?", a: ["68", "68%"] },
  { topic: "Sampling and sample proportions", q: "True population proportion is $p$. Sample proportion is $\\hat{p}$. Is $p$ usually known? yes or no.", a: ["no", "No"] },
  { topic: "Confidence intervals for proportions", q: "Same $\\hat{p}$ and $n$: 99% CI is wider than 95%? yes or no.", a: ["yes", "Yes"] },
  { topic: "Functions and transformations", q: "$y=|x|+1$. Minimum value?", a: ["1", "1.0"] },
  { topic: "Polynomial, power and rational functions", q: "Degree of $P(x)=5x^4-2x+7$?", a: ["4", "4.0"] },
  { topic: "Exponential and logarithmic functions", q: "$\\log_3(27)=$ ?", a: ["3", "3.0"] },
  { topic: "Circular functions", q: "$\\sin\\!\\left(\\dfrac{\\pi}{2}\\right)=$ ?", a: ["1", "1.0"] },
  { topic: "Algebra and equations", q: "$2^x=32$. $x=$ ?", a: ["5", "5.0"] },
  { topic: "Discrete random variables", q: "Binomial: $n=4$, $p=0.5$. $P(X=2)$ as fraction?", a: ["3/8", "0.375", ".375"] },
  { topic: "Continuous random variables", q: "Median of uniform $[2,10]$?", a: ["6", "6.0"] },
  { topic: "The normal distribution", q: "$\\mu=40$, $\\sigma=5$. $z$ for $x=45$?", a: ["1", "1.0"] },
  { topic: "Sampling and sample proportions", q: "Simple random sample: every individual has equal chance of selection. True or false?", a: ["true", "True", "yes"] },
  { topic: "Confidence intervals for proportions", q: "Point estimate for population proportion is $\\hat{p}$ or $p$? (symbol)", a: ["p hat", "phat", "p̂", "hat p"] },
  { topic: "Polynomial, power and rational functions", q: "$y=x^{-2}$. As $x \\to 0^+$, $y \\to$ ?", a: ["infinity", "∞", "inf"] },
  { topic: "Exponential and logarithmic functions", q: "$e^0=$ ?", a: ["1", "1.0"] },
  { topic: "Circular functions", q: "$\\sin(\\pi)=$ ?", a: ["0", "0.0"] },
  { topic: "Algebra and equations", q: "$\\sqrt{x}=5$. $x=$ ?", a: ["25", "25.0"] },
  { topic: "Discrete random variables", q: "$E(X)=\\sum x\\,P(X=x)$. If always $X=3$, then $E(X)=$ ?", a: ["3", "3.0"] },
  { topic: "Continuous random variables", q: "For PDF, $f(x)\\geq 0$ everywhere. True or false?", a: ["true", "True", "yes"] },
  { topic: "The normal distribution", q: "Bell-shaped, symmetric about the ___ . (one word)", a: ["mean", "Mean", "mu"] },
  { topic: "Sampling and sample proportions", q: "$\\hat{p}=0.12$ from $n=50$. Number of successes?", a: ["6", "6.0"] },
  { topic: "Confidence intervals for proportions", q: "Margin of error shrinks when $n$ increases — true or false?", a: ["true", "True", "yes"] },
];

/** @type {Row[]} */
const specialist = [
  { topic: "Logic and proof", q: "Prove by exhaustion: $n^2 + n$ is even for integer $n$. Factorise $n^2+n$ as $n($ ___ $)$. Enter the bracket expression.", a: ["n+1", "n + 1"] },
  { topic: "Logic and proof", q: "Contrapositive of $P \\Rightarrow Q$ is $\\neg Q \\Rightarrow$ ___ ?", a: ["¬P", "not P", "neg P", "\\neg P"] },
  { topic: "Logic and proof", q: "Statement: 'All primes are odd.' One counterexample (smallest prime)?", a: ["2", "2.0"] },
  { topic: "Logic and proof", q: "Mathematical induction on $n \\ge 1$ usually starts the base step at $n = $ ?", a: ["1", "1.0"] },
  { topic: "Complex numbers and algebra", q: "$z = 3 + 4i$. Find $|z|$.", a: ["5", "5.0"] },
  { topic: "Complex numbers and algebra", q: "If $z = 1 + i$, find $z^2$ in form $a+bi$: $a = $ ?", a: ["0", "0.0"] },
  { topic: "Complex numbers and algebra", q: "Polar: $z = 2\\operatorname{cis}\\!\\left(\\dfrac{\\pi}{3}\\right)$. Real part?", a: ["1", "1.0"] },
  { topic: "Complex numbers and algebra", q: "Solve $z^2 = -9$ in $\\mathbb{C}$: positive imaginary root $bi$. Find $b$.", a: ["3", "3.0"] },
  { topic: "Functions, relations and graphs", q: "$y = \\dfrac{1}{x-2}$: vertical asymptote $x = $ ?", a: ["2", "2.0"] },
  { topic: "Functions, relations and graphs", q: "Partial fractions: $\\dfrac{1}{(x-1)(x+1)} = \\dfrac{A}{x-1} + \\dfrac{B}{x+1}$. Find $A$.", a: ["0.5", "1/2", ".5"] },
  { topic: "Functions, relations and graphs", q: "$y = |x-3|$ has minimum value?", a: ["0", "0.0"] },
  { topic: "Functions, relations and graphs", q: "Oblique asymptote of $y = \\dfrac{x^2+1}{x}$ as $x \\to \\infty$ behaves like $y = $ ?", a: ["x", "y=x"] },
  { topic: "Differential calculus", q: "Implicit: $x^2 + y^2 = 25$. At $(3,4)$, $\\dfrac{dy}{dx} = -\\dfrac{3}{k}$. Find $k$.", a: ["4", "4.0"] },
  { topic: "Differential calculus", q: "Related rates: circle area $A = \\pi r^2$, $\\dfrac{dA}{dt} = 8\\pi$. Find $\\dfrac{dr}{dt}$ when $r = 2$.", a: ["2", "2.0"] },
  { topic: "Differential calculus", q: "Derivative of $\\tan x$ at $x = 0$.", a: ["1", "1.0"] },
  { topic: "Differential calculus", q: "Product rule: $\\dfrac{d}{dx}(x^2 e^x)$ at $x = 0$ equals?", a: ["0", "0.0"] },
  { topic: "Integral calculus", q: "Integration by parts $\\int x e^x\\,dx$ produces $e^x$ times a polynomial of degree ___ in $x$ after one step (degree of the non-$e^x$ factor left).", a: ["0", "1", "constant"] },
  { topic: "Integral calculus", q: "Volume of revolution: disk about $x$-axis, $y = 2$ on $[0,1]$ gives $V = \\pi \\int_0^1 4\\,dx = $ ?", a: ["4pi", "4π", "12.566", "12.57"] },
  { topic: "Integral calculus", q: "$\\displaystyle\\int \\dfrac{1}{x}\\,dx$ (no constant) includes $\\ln|x|$ plus what symbol letter?", a: ["C", "c"] },
  { topic: "Integral calculus", q: "Arc length setup uses $\\sqrt{1 + (y')^2}$. If $y' = 0$, integrand simplifies to?", a: ["1", "1.0"] },
  { topic: "Differential equations", q: "Separable: $\\dfrac{dy}{dx} = 2y$. Growth or decay? (one word)", a: ["growth", "Growth"] },
  { topic: "Differential equations", q: "Verify: $y = Ce^{2x}$ satisfies $y' = 2y$. Derivative $y'$ equals $2y$ when $C$ is any constant — true or false?", a: ["true", "True", "yes"] },
  { topic: "Differential equations", q: "Euler step: $y' = x$, $(x_0,y_0)=(0,1)$, $h=0.5$. Next $y_1 = y_0 + h y'$ at $x_0$.", a: ["1", "1.0"] },
  { topic: "Differential equations", q: "Slope field for $y' = x - y$ at point $(0,0)$: slope equals?", a: ["0", "0.0"] },
  { topic: "Kinematics", q: "$s(t) = t^3 - 6t$. Velocity at $t = 1$.", a: ["-3", "-3.0"] },
  { topic: "Kinematics", q: "$v(t) = 6t - 4$. Acceleration at $t = 2$.", a: ["6", "6.0"] },
  { topic: "Kinematics", q: "Particle at rest when $v(t) = 0$. For $v(t) = 2t - 8$, find $t$.", a: ["4", "4.0"] },
  { topic: "Kinematics", q: "Speed is the ___ of velocity. (one word)", a: ["magnitude", "absolute", "absolute value", "modulus"] },
  { topic: "Vectors in two and three dimensions", q: "$\\mathbf{a} = (1,2,2)$, $\\mathbf{b} = (2,-1,0)$. $\\mathbf{a}\\cdot\\mathbf{b} = $ ?", a: ["0", "0.0"] },
  { topic: "Vectors in two and three dimensions", q: "$|\\mathbf{i} + \\mathbf{j}| = \\sqrt{k}$. Find $k$.", a: ["2", "2.0"] },
  { topic: "Vectors in two and three dimensions", q: "Angle between parallel vectors is ___ degrees.", a: ["0", "0.0"] },
  { topic: "Vectors in two and three dimensions", q: "$\\mathbf{a} \\times \\mathbf{a} = $ ?", a: ["0", "0 vector", "(0,0,0)", "zero"] },
  { topic: "Lines and planes in 3D", q: "Line $\\mathbf{r} = (1,2,3) + \\lambda(0,1,0)$: which coordinate stays constant?", a: ["x", "X"] },
  { topic: "Lines and planes in 3D", q: "Plane $2x - y + z = 6$: normal vector $x$-component?", a: ["2", "2.0"] },
  { topic: "Lines and planes in 3D", q: "Distance from origin to plane $x = 5$ equals?", a: ["5", "5.0"] },
  { topic: "Lines and planes in 3D", q: "Parallel planes have normals that are ___ (one word).", a: ["parallel", "Parallel"] },
  { topic: "Vector calculus", q: "$\\mathbf{r}(t) = (t^2, t)$. Velocity vector at $t = 1$ has $x$-component?", a: ["2", "2.0"] },
  { topic: "Vector calculus", q: "Differentiate $\\mathbf{r}(t) = (\\cos t, \\sin t)$. Speed $|\\mathbf{v}(t)|$ is constant equal to?", a: ["1", "1.0"] },
  { topic: "Vector calculus", q: "Displacement $\\int_0^1 \\mathbf{v}(t)\\,dt$ for constant $\\mathbf{v} = (3,0)$: $x$-component of displacement?", a: ["3", "3.0"] },
  { topic: "Vector calculus", q: "If $\\mathbf{r}(0) = (0,0)$ and $\\mathbf{v}(t) = (2,2)$, position at $t = 1$ has sum of coordinates?", a: ["4", "4.0"] },
  { topic: "Random variables and sampling", q: "Independent $X,Y$ with $\\operatorname{Var}(X)=4$, $\\operatorname{Var}(Y)=9$. $\\operatorname{Var}(X+Y)=$ ?", a: ["13", "13.0"] },
  { topic: "Random variables and sampling", q: "$E(3X - 2) = 10$. Find $E(X)$.", a: ["4", "4.0"] },
  { topic: "Random variables and sampling", q: "Sample mean $\\bar{X}$ has expected value equal to population ___ ?", a: ["mean", "μ", "mu", "Mu"] },
  { topic: "Random variables and sampling", q: "Independent $X,Y$ with $\\operatorname{Var}(X)=1$, $\\operatorname{Var}(Y)=4$. Find $\\operatorname{Var}(2X+3Y)$.", a: ["40", "40.0"] },
  { topic: "Confidence intervals", q: "95% CI for mean uses $z \\approx$ ? (2 d.p.)", a: ["1.96", "1.960"] },
  { topic: "Confidence intervals", q: "Margin of error $E = z \\dfrac{\\sigma}{\\sqrt{n}}$. If $\\sigma = 10$, $n = 25$, $z = 2$, find $E$.", a: ["4", "4.0"] },
  { topic: "Confidence intervals", q: "Standard error of the mean decreases when $n$ increases — true or false?", a: ["true", "True", "yes"] },
  { topic: "Confidence intervals", q: "Higher confidence level (99% vs 95%) makes the interval wider or narrower? (one word)", a: ["wider", "Wider"] },
  { topic: "Logic and proof", q: "Proof by contradiction assumes the negation of what we want to prove, then seeks a ___ (one word).", a: ["contradiction", "Contradiction"] },
  { topic: "Complex numbers and algebra", q: "Multiply $(1-i)(1+i)$. Real part of the product?", a: ["2", "2.0"] },
];

/** Round-robin by topic so the bank is not one big block per topic before shuffle. */
function interleaveByTopic(rows) {
  const buckets = new Map();
  for (const r of rows) {
    if (!buckets.has(r.topic)) buckets.set(r.topic, []);
    buckets.get(r.topic).push(r);
  }
  const keys = [...buckets.keys()];
  const out = [];
  let more = true;
  while (more) {
    more = false;
    for (const k of keys) {
      const b = buckets.get(k);
      if (b?.length) {
        out.push(b.shift());
        more = true;
      }
    }
  }
  return out;
}

/** @type {Row[]} */
const generalUnique = [
  { topic: "Data analysis", q: "A café logs drink sales: flat white 42, latte 38, long black 15, other 5. What **percent** of drinks sold were latte? (1 d.p.)", a: ["38.0", "38", "38%"] },
  { topic: "Recursion and financial modelling", q: "Phone plan: \\$45/month plus \\$0.10 per minute over 200. You used 247 minutes. Total bill (nearest cent as dollars)?", a: ["49.70", "49.7", "$49.70"] },
  { topic: "Matrices", q: "Town A sends 80% of commuters to B and 20% stay. Everyone starts in A. After **one** transition, what fraction is in B? (decimal)", a: ["0.8", ".8", "0.80"] },
  { topic: "Networks and decision mathematics", q: "Tasks: A(3)→B(2)→D(4) and A→C(1)→D. Critical path duration?", a: ["9", "9.0"] },
  { topic: "Data analysis", q: "Regression for ice-cream sales vs temperature has $r = 0.15$ in winter data only. Reliable for predicting summer sales? yes or no.", a: ["no", "No"] },
  { topic: "Recursion and financial modelling", q: "Nominal 12% p.a. compounded **monthly**. Monthly rate as a decimal (4 d.p.).", a: ["0.01", "0.0100", ".01"] },
  { topic: "Matrices", q: "Encoding shift uses matrix $\\begin{pmatrix}1&1\\\\0&1\\end{pmatrix}$ on column $\\begin{pmatrix}3\\\\5\\end{pmatrix}$. Second entry of result?", a: ["8", "8.0"] },
  { topic: "Networks and decision mathematics", q: "Graph has 6 vertices all degree 3. Total number of edges? (handshake lemma: sum degrees / 2)", a: ["9", "9.0"] },
  { topic: "Data analysis", q: "Five-number summary shows median 50, max 200, min 10, Q3 80, Q1 40. Is 200 flagged as outlier by 1.5×IQR rule? yes or no.", a: ["yes", "Yes"] },
  { topic: "Recursion and financial modelling", q: "Asset \\$12\\,000, reducing balance 15% p.a. once per year. Value after **one** year (nearest dollar)?", a: ["10200", "$10200", "10200.0"] },
  { topic: "Matrices", q: "2×2 matrix swaps rows of identity then doubles row 2. Determinant?", a: ["-2", "-2.0"] },
  { topic: "Networks and decision mathematics", q: "Activity network: earliest finish of project is 18. Activity G has duration 5 and latest finish 18, earliest start 13. Float of G?", a: ["0", "0.0"] },
  { topic: "Data analysis", q: "Time-series spike every 7 days in app logins most likely indicates: daily, weekly, or yearly seasonality? (one word)", a: ["weekly", "Weekly"] },
  { topic: "Recursion and financial modelling", q: "Rule $u_{n+1} = 1.08 u_n - 500$ with $u_0 = 10\\,000$. After one step $u_1$ nearest dollar?", a: ["10300", "10300.0", "$10300"] },
  { topic: "Matrices", q: "Matrix equation $AX = B$ with $A$ invertible. Solve for $X$ in words: $X = A^{?} B$. Power symbol?", a: ["-1", "inverse"] },
  { topic: "Networks and decision mathematics", q: "Travelling salesman wants a closed route visiting every city once. Hamiltonian circuit or Eulerian circuit? (one word)", a: ["hamiltonian", "Hamiltonian"] },
  { topic: "Data analysis", q: "Two variables: hours slept vs reaction time. Expected sign of $r$? (positive or negative)", a: ["negative", "Negative", "neg"] },
  { topic: "Recursion and financial modelling", q: "Rule $F_{n+1} = F_n + F_{n-1}$ with $F_1=1$, $F_2=1$. Find $F_6$.", a: ["8", "8.0"] },
  {
    topic: "Recursion and financial modelling",
    q: "A reducing-balance loan has starting balance $128\\,300$, annual rate $6.1\\%$ compounding monthly, monthly repayment $1\\,829$. Find the month-1 interest charge ($, 2 d.p.).",
    a: ["652.19", "652.20", "652.19"],
  },
  {
    topic: "Recursion and financial modelling",
    q: "A loan follows $L_0 = 48\\,800$, $L_{n+1} = 1.0048\\,L_n - 656$. Determine $L_{52}$ (2 d.p.).",
    a: ["23956.08", "23956.08"],
  },
  { topic: "Matrices", q: "Leslie matrix applied to population vector $\\mathbf{p}$ gives next year $\\mathbf{p}' = L\\mathbf{p}$. Dimensions: if $\\mathbf{p}$ is 3×1, $L$ is ?×3. First number only.", a: ["3", "3.0"] },
  { topic: "Networks and decision mathematics", q: "Dijkstra from S: edge S–A(4), S–B(2), A–T(1), B–T(5). Shortest distance S to T?", a: ["7", "7.0"] },
];

/** @type {Row[]} */
const methodsUnique = [
  { topic: "Functions and transformations", q: "Thermometer converts $F = \\dfrac{9C}{5}+32$. If $C = 20$, find $F$.", a: ["68", "68.0"] },
  { topic: "Polynomial, power and rational functions", q: "Profit model $P(x) = -(x-5)^2 + 9$ ($x$ in thousands). Maximum profit (units)?", a: ["9", "9.0"] },
  { topic: "Exponential and logarithmic functions", q: "Population $P(t)=1200(0.92)^t$. Percent decrease per time step? (integer)", a: ["8", "8%"] },
  { topic: "Circular functions", q: "Ferris wheel height $h(t)=10\\sin\\!\\left(\\dfrac{\\pi t}{6}\\right)+12$ (metres). Minimum height?", a: ["2", "2.0"] },
  { topic: "Algebra and equations", q: "Parameter $k$: solve $kx + 3 = 2x + 11$ for $x$ in terms of $k$. If $k \\neq 2$, $x = \\dfrac{8}{k-2}$. For **no** solution, $k$ equals?", a: ["2", "2.0"] },
  { topic: "Differential calculus", q: "Curve $y = x^2 e^{-x}$. At $x = 2$, is gradient positive or negative? (one word)", a: ["negative", "Negative", "neg"] },
  { topic: "Applications of differentiation", q: "Fence 30 m against a wall (no fence on wall). Rectangle area $A = x(30-2x)$. Maximise: optimal $x$?", a: ["7.5", "7.50", "15/2"] },
  { topic: "Integral calculus", q: "Particle: $v(t)=3t^2-2$. Displacement from $t=1$ to $t=2$?", a: ["5", "5.0"] },
  { topic: "Applications of integration", q: "PDF $f(x)=\\dfrac{2x}{9}$ on $[0,3]$. Find $P(X<1.5)$.", a: ["0.25", ".25", "1/4"] },
  { topic: "Discrete random variables", q: "Game: win \\$4 with prob 0.2, lose \\$1 otherwise. Expected profit per play?", a: ["0.2", "0.20", ".2"] },
  { topic: "Continuous random variables", q: "Triangular PDF on $[0,2]$ with peak at $x=1$, height 1. Total area must be 1 — is this valid without scaling? yes or no.", a: ["no", "No"] },
  { topic: "The normal distribution", q: "Exam scores $N(70,100)$. Pass mark 60. $z$-score for 60?", a: ["-1", "-1.0"] },
  { topic: "Sampling and sample proportions", q: "Survey 40% yes from $n=25$. Is $\\hat{p}=0.40$? yes or no.", a: ["yes", "Yes"] },
  { topic: "Confidence intervals for proportions", q: "Poll $\\hat{p}=0.62$, $n=500$, 95% uses $z=1.96$. Approx margin of error (2 d.p.)", a: ["0.04", ".04", "0.042"] },
  { topic: "Functions and transformations", q: "Reflect $y=\\sqrt{x}$ in the $y$-axis then shift right 1. New domain in form $x \\leq k$. Find $k$.", a: ["-1", "-1.0"] },
  { topic: "Polynomial, power and rational functions", q: "$P(x)=(x-1)^2(x+2)$. Number of **distinct** $x$-intercepts?", a: ["2", "2.0"] },
  { topic: "Exponential and logarithmic functions", q: "Half-life: $N(t)=N_0(0.5)^{t/3}$. After $t=9$, fraction of $N_0$ remaining?", a: ["0.125", ".125", "1/8"] },
  { topic: "Circular functions", q: "Tide model $d(t)=2.5\\cos\\!\\left(\\dfrac{\\pi t}{6}\\right)+4$. Amplitude (metres)?", a: ["2.5", "2.50"] },
  { topic: "Algebra and equations", q: "Inequality $|2x-1|<5$. Smallest **integer** solution?", a: ["-2", "-2.0"] },
  { topic: "Differential calculus", q: "$f(x)=\\ln(x^2+1)$. $f'(0)=$ ?", a: ["0", "0.0"] },
];

/** @type {Row[]} */
const specialistUnique = [
  { topic: "Logic and proof", q: "Prove $n^3-n$ is divisible by 6 for all integers $n$. Factorise $n^3-n = n($ ___ $)$.", a: ["n^2-1", "n^2 - 1", "n²-1"] },
  { topic: "Complex numbers and algebra", q: "$z=1+\\sqrt{3}i$. Write $|z|$.", a: ["2", "2.0"] },
  { topic: "Functions, relations and graphs", q: "Graph $y=\\dfrac{x}{x^2-4}$. How many vertical asymptotes?", a: ["2", "2.0"] },
  { topic: "Differential calculus", q: "Ladder 5 m long slides: $x^2+y^2=25$, $\\dfrac{dx}{dt}=0.5$ at $x=3$, $y=4$. $\\dfrac{dy}{dt}$ (2 d.p.)", a: ["-0.38", "-0.375", "-3/8"] },
  { topic: "Integral calculus", q: "$\\int_0^{\\pi/2} \\sin x\\,dx = $ ?", a: ["1", "1.0"] },
  { topic: "Differential equations", q: "Tank: $\\dfrac{dV}{dt}=-0.2V$, $V(0)=500$. $V(5)$ nearest litre?", a: ["184", "183.94", "184.0"] },
  { topic: "Kinematics", q: "Acceleration $a(t)=6t-4$, $v(0)=2$. $v(2)=$ ?", a: ["8", "8.0"] },
  { topic: "Vectors in two and three dimensions", q: "Work $W=\\mathbf{F}\\cdot\\mathbf{d}$ with $\\mathbf{F}=(5,0,0)$, $\\mathbf{d}=(2,3,0)$. $W=$ ?", a: ["10", "10.0"] },
  { topic: "Lines and planes in 3D", q: "Lines $\\mathbf{r}_1=(1,0,0)+\\lambda(1,1,0)$ and $\\mathbf{r}_2=(0,1,0)+\\mu(1,-1,0)$ in $xy$-plane. Do they intersect? yes or no.", a: ["yes", "Yes"] },
  { topic: "Vector calculus", q: "$\\mathbf{r}(t)=(t, t^2)$. Speed at $t=1$ equals $\\sqrt{5}$ — true or false?", a: ["true", "True", "yes"] },
  { topic: "Random variables and sampling", q: "$X,Y$ independent, $E(X)=2$, $E(Y)=-1$. $E(2X-Y+5)=$ ?", a: ["10", "10.0"] },
  { topic: "Confidence intervals", q: "Sample $n=16$, $\\bar{x}=50$, $\\sigma=8$, 95% CI half-width $z\\sigma/\\sqrt{n}$. Find half-width.", a: ["3.92", "3.920"] },
  { topic: "Logic and proof", q: "Statement: 'If $n^2$ is even then $n$ is even.' Contrapositive starts: 'If $n$ is odd then …' Complete: $n^2$ is ___ ?", a: ["odd", "Odd"] },
  { topic: "Complex numbers and algebra", q: "Roots of $z^3=1$ on unit circle are equally spaced by angle $\\dfrac{2\\pi}{k}$ radians. Find $k$.", a: ["3", "3.0"] },
  { topic: "Functions, relations and graphs", q: "$y=|x^2-4|$. Number of $x$-intercepts?", a: ["2", "2.0"] },
  { topic: "Differential calculus", q: "Inverse of $f(x)=x^3+1$ at point where $f(x)=9$: $f^{-1}(9)=$ ?", a: ["2", "2.0"] },
  { topic: "Integral calculus", q: "Solid: region under $y=x^2$ from 0 to 2 rotated about $x$-axis. Setup factor $\\pi\\int_0^2 x^4\\,dx$ — integrand power of $x$ is?", a: ["4", "4.0"] },
  { topic: "Differential equations", q: "Logistic-style: carrying capacity 1000, $P(0)=100$. Long-term $P$ approaches?", a: ["1000", "1000.0"] },
  { topic: "Kinematics", q: "$s(t)=\\sin t$. First time $t>0$ when the particle is back at $s=0$ (exact radian answer).", a: ["pi", "π", "3.14159", "3.14"] },
  { topic: "Vectors in two and three dimensions", q: "Unit vector in direction of $(3,4,0)$ has $x$-component $\\dfrac{3}{5}$. $y$-component?", a: ["0.8", "4/5", ".8", "0.80"] },
];

function assertCount(name, rows, expected) {
  if (rows.length !== expected) {
    throw new Error(`${name}: expected ${expected} questions, got ${rows.length}`);
  }
}

const METHODS_TOPICS = [
  "Functions and transformations",
  "Polynomial, power and rational functions",
  "Exponential and logarithmic functions",
  "Circular functions",
  "Algebra and equations",
  "Differential calculus",
  "Applications of differentiation",
  "Integral calculus",
  "Applications of integration",
  "Discrete random variables",
  "Continuous random variables",
  "The normal distribution",
  "Sampling and sample proportions",
  "Confidence intervals for proportions",
];

const METHODS_MIN_PER_TOPIC = 10;

function countByTopic(rows) {
  const c = Object.fromEntries(METHODS_TOPICS.map((t) => [t, 0]));
  for (const r of rows) {
    c[r.topic] = (c[r.topic] ?? 0) + 1;
  }
  return c;
}

function assertMethodsTopicMinimum(rows, min) {
  const c = countByTopic(rows);
  const low = METHODS_TOPICS.filter((t) => (c[t] ?? 0) < min);
  if (low.length) {
    throw new Error(
      `Methods topics below ${min}: ${low.map((t) => `${t} (${c[t]})`).join(", ")}`,
    );
  }
}

const generalAll = interleaveByTopic([...general, ...generalUnique]);
const methodsAll = interleaveByTopic([
  ...methods,
  ...methodsUnique,
  ...methodsTopicBoost,
]);
const specialistAll = interleaveByTopic([...specialist, ...specialistUnique]);

assertCount("general", generalAll, 72);
assertMethodsTopicMinimum(methodsAll, METHODS_MIN_PER_TOPIC);
assertCount("specialist", specialistAll, 70);

console.log(
  "Methods per topic:",
  Object.entries(countByTopic(methodsAll))
    .map(([t, n]) => `${n} ${t}`)
    .join("; "),
);
console.log("Methods total:", methodsAll.length);

emitFile(
  "generalMathsBuiltinShortTricky.ts",
  "generalMathsAreaTopic",
  "GeneralMathsAreaOfStudyTopic",
  "GENERAL_MATHS_BUILTIN_SHORT_TRICKY",
  generalAll,
);
emitFile(
  "methodsBuiltinQuestions.ts",
  "methodsAreaTopic",
  "MethodsTopic",
  "METHODS_BUILTIN_QUESTIONS",
  methodsAll,
);
emitFile(
  "specialistMathsBuiltinQuestions.ts",
  "specialistMathsAreaTopic",
  "SpecialistMathsTopic",
  "SPECIALIST_MATHS_BUILTIN_QUESTIONS",
  specialistAll,
);

console.log("Done.");
