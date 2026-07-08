import type { AnswerPart, LongQuestion, Question } from "@/lib/subjects";

/**
 * Built-in General Maths questions that ship with the app.
 * These were previously used for the Demo subject and are now part of the
 * normal General Maths bank (topic-labelled for filters/analytics).
 */
function longMultipart(
  topic: string,
  question: string,
  answerParts: AnswerPart[],
  marks?: number,
  guidance?: string,
): LongQuestion {
  return {
    type: "long",
    topic,
    question,
    answerParts,
    marks,
    guidance,
    useAiMarking: true,
    acceptedAnswers: answerParts
      .map((p) => String(p.acceptedAnswer ?? "").trim())
      .filter(Boolean),
  };
}

const GENERAL_MATHS_LONG_BUILTIN_QUESTIONS: Question[] = [
  longMultipart(
    "Data analysis",
    "A study of $12$ students records weekly study time $x$ (hours) and test score $y$ (%). Summary statistics are:\n\\[\\sum x = 96,\\quad \\sum y = 852,\\quad \\sum x^2 = 838,\\quad \\sum y^2 = 62\\,184,\\quad \\sum xy = 6\\,972,\\quad \\bar x = 8.\\]\nAssume a linear model is appropriate.",
    [
      {
        key: "a",
        label:
          "Calculate the correlation coefficient $r$, correct to 3 decimal places. Show full working.",
        marks: 2,
        placeholder: "Show formula and substitution…",
        acceptedAnswer: "$r=0.857$ (to 3 d.p.). Accept equivalent correct working.",
      },
      {
        key: "b",
        label:
          "Find the least-squares regression equation $\\hat y = a + bx$, giving $a$ and $b$ correct to 2 decimal places. Show working.",
        marks: 3,
        placeholder: "Find b first, then a…",
        acceptedAnswer: "$\\hat y = 45.40 + 3.85x$ (accept $a\\approx 45.40$, $b\\approx 3.85$).",
      },
      {
        key: "c",
        label:
          "A student studies $11$ hours and scores $68$%. Calculate the residual.",
        marks: 1,
        placeholder: "Residual = actual − predicted…",
        acceptedAnswer: "Residual $= 68 - (45.40+3.85\\times 11) = 68-87.75=-19.75$ (approx).",
      },
      {
        key: "d",
        label: "Interpret the residual from part (c) in context.",
        marks: 1,
        placeholder: "Say what the residual means…",
        acceptedAnswer:
          "The score is about 19.75 percentage points lower than the value predicted by the regression line for 11 hours of study.",
      },
      {
        key: "e",
        label:
          "Explain why predicting the score for $x=14$ hours may be unreliable.",
        marks: 1,
        placeholder: "Comment on extrapolation…",
        acceptedAnswer:
          "14 hours is outside (or at the extreme of) the observed range of $x$ (data mean 8 hours), so the prediction is an extrapolation and may be unreliable.",
      },
    ],
    8,
    "Use $r=\\frac{n\\sum xy-(\\sum x)(\\sum y)}{\\sqrt{[n\\sum x^2-(\\sum x)^2][n\\sum y^2-(\\sum y)^2]}}$. For regression, $b=\\frac{n\\sum xy-(\\sum x)(\\sum y)}{n\\sum x^2-(\\sum x)^2}$ and $a=\\bar y-b\\bar x$ with $\\bar y=71$. Award method marks for correct formulae/substitution even if arithmetic slips. Accept rounding close to model values.",
  ),
  longMultipart(
    "Recursion and financial modelling",
    "A business takes out a $\\$42\\,000$ loan with interest of $7.2\\%$ per annum compounded monthly. Repayments of $\\$720$ are made at the end of each month. The balance $B_n$ (in dollars) after $n$ months satisfies\n\\[B_{n+1} = 1.006\\,B_n - 720,\\quad B_0 = 42\\,000.\\]",
    [
      {
        key: "a",
        label: "Calculate $B_1$ and $B_2$, correct to the nearest cent.",
        marks: 2,
        placeholder: "Apply the recurrence twice…",
        acceptedAnswer: "$B_1=41532.00$, $B_2=41061.19$ (nearest cent).",
      },
      {
        key: "b",
        label: "Find the equilibrium balance $B$ for this recurrence.",
        marks: 1,
        placeholder: "Solve B = 1.006B − 720…",
        acceptedAnswer: "$B=120000$ (solve $B=1.006B-720$).",
      },
      {
        key: "c",
        label: "Explain what the equilibrium balance represents in this loan model.",
        marks: 1,
        placeholder: "Interpret in context…",
        acceptedAnswer:
          "It is the unpaid balance that would stay constant forever under this interest rate and repayment — here well above $0$, so the loan will never be paid off with $720$/month alone at this rate (unless payments increase / rate differs).",
      },
      {
        key: "d",
        label:
          "Determine the smallest month $n$ for which $B_n < 500$. Show enough recurrence working (or clear calculator listing).",
        marks: 4,
        placeholder: "Continue the recurrence until below 500…",
        acceptedAnswer:
          "Continue $B_{n+1}=1.006B_n-720$ from $B_0=42000$ until first $B_n<500$. Accept the correct smallest $n$ with consistent working (model target depends on exact cent rounding).",
      },
      {
        key: "e",
        label:
          "Calculate the total interest paid over the full term of the loan (to the nearest dollar).",
        marks: 3,
        placeholder: "Interest = (total repaid) − 42000…",
        acceptedAnswer:
          "Interest $=$ total repaid $-42000$. Accept a consistent method using the correct term length and final payment.",
      },
    ],
    11,
    "Equilibrium: $B=1.006B-720 \\Rightarrow B=120000$. Round money to cents. For lengthy recurrence, award marks for correct method and a coherent terminating month. Loan ends when balance reaches $0$ (or the final payment clears the loan).",
  ),
  longMultipart(
    "Matrices",
    "A species is modelled in three age classes (juvenile, adult, senior). The Leslie matrix is\n\\[L=\\begin{pmatrix}0&1.6&0.3\\\\0.55&0&0\\\\0&0.75&0.15\\end{pmatrix}\\]\nwhere $\\mathbf{x}_{n+1}=L\\mathbf{x}_n$ and $\\mathbf{x}_n=\\begin{pmatrix}J_n\\\\A_n\\\\S_n\\end{pmatrix}$ gives class counts after $n$ years.",
    [
      {
        key: "a",
        label:
          "Explain what the entries $1.6$ and $0.3$ in the first row represent in this population model.",
        marks: 2,
        placeholder: "Interpret as births per individual…",
        acceptedAnswer:
          "$1.6$ is the average number of juveniles produced per adult per year; $0.3$ is the average number of juveniles produced per senior per year.",
      },
      {
        key: "b",
        label:
          "If $\\mathbf{x}_0=\\begin{pmatrix}800\\\\500\\\\300\\end{pmatrix}$, find $\\mathbf{x}_1$ (round each entry to the nearest whole animal). Show matrix multiplication.",
        marks: 2,
        placeholder: "Compute L x0…",
        acceptedAnswer: "$\\mathbf{x}_1=\\begin{pmatrix}890\\\\440\\\\420\\end{pmatrix}$.",
      },
      {
        key: "c",
        label:
          "Using your result from part (b), find $\\mathbf{x}_2$ (round each entry to the nearest whole animal).",
        marks: 2,
        placeholder: "Compute L x1…",
        acceptedAnswer: "$\\mathbf{x}_2=\\begin{pmatrix}830\\\\490\\\\393\\end{pmatrix}$ (accept nearby consistent rounding).",
      },
      {
        key: "d",
        label:
          "Describe what the long-term yearly growth factor represents in this model.",
        marks: 2,
        placeholder: "Explain in words…",
        acceptedAnswer:
          "It is the dominant eigenvalue: in the long term the whole population multiplies by roughly this factor each year (stable age structure).",
      },
      {
        key: "e",
        label:
          "A disease reduces senior survival by $20\\%$. Which single entry of $L$ should change, and what is its new value?",
        marks: 2,
        placeholder: "Identify survival entry for seniors…",
        acceptedAnswer: "Entry $(3,3)$: $0.15\\to 0.12$ (20% reduction).",
      },
    ],
    10,
    "Column vectors: $\\mathbf{x}_{n+1}=L\\mathbf{x}_n$. Senior survival is the $(3,3)$ entry. Award marks for correct matrix multiplication even with minor rounding differences.",
  ),
  longMultipart(
    "Networks and decision mathematics",
    "A project has the following activities and immediate predecessors (durations in days):\n\n| Activity | Duration | Predecessors |\n|----------|----------|--------------|\n| A | 5 | — |\n| B | 4 | A |\n| C | 7 | A |\n| D | 3 | B |\n| E | 6 | B, C |\n| F | 4 | C |\n| G | 5 | D, E |\n| H | 2 | F |\n| I | 3 | G, H |\n\nAssume all activities start as soon as their predecessors finish.",
    [
      {
        key: "a",
        label:
          "Draw a network (activity-on-node or activity-on-arrow) showing the dependencies for this project.",
        marks: 3,
        placeholder: "Draw the network diagram…",
        acceptedAnswer:
          "Correct dependency network: A→B, A→C; B→D, B→E; C→E, C→F; D→G; E→G; F→H; G→I; H→I. Accept clear AoN or AoA with correct predecessors.",
      },
      {
        key: "b",
        label:
          "Complete a forward pass and list the earliest start (ES) and earliest finish (EF) of each activity A–I.",
        marks: 3,
        placeholder: "List ES/EF for A–I…",
        acceptedAnswer:
          "A: ES0 EF5; B: ES5 EF9; C: ES5 EF12; D: ES9 EF12; E: ES12 EF18; F: ES12 EF16; G: ES18 EF23; H: ES16 EF18; I: ES23 EF26.",
      },
      {
        key: "c",
        label: "State the minimum project completion time.",
        marks: 1,
        placeholder: "Project duration…",
        acceptedAnswer: "26 days.",
      },
      {
        key: "d",
        label: "State the critical path.",
        marks: 2,
        placeholder: "List activities on the critical path…",
        acceptedAnswer: "A–C–E–G–I.",
      },
      {
        key: "e",
        label: "Calculate the total float for activity F.",
        marks: 1,
        placeholder: "Float = LS − ES (or LF − EF)…",
        acceptedAnswer: "Total float of F is 5 days.",
      },
      {
        key: "f",
        label: "Calculate the total float for activity D.",
        marks: 1,
        placeholder: "Float = LS − ES (or LF − EF)…",
        acceptedAnswer: "Total float of D is 6 days.",
      },
      {
        key: "g",
        label:
          "If activity F is delayed by 3 days, does the project completion time change? Give a one-sentence reason.",
        marks: 1,
        placeholder: "Use the float from part (e)…",
        acceptedAnswer:
          "No — a 3-day delay is within F’s 5-day float, so the 26-day project duration is unchanged.",
      },
    ],
    12,
    "Critical path A–C–E–G–I with duration 26. Critical activities have zero total float. Mark the drawn network for correct nodes/arcs and predecessor logic (layout may differ). Use ES/EF table and float = LS−ES or LF−EF.",
  ),
];

import type { GeneralMathsAreaOfStudyTopic } from "@/lib/generalMathsAreaTopic";
import type { McqQuestion, ShortQuestion } from "@/lib/subjects";

type Topic = GeneralMathsAreaOfStudyTopic;

function mcq(
  topic: Topic,
  question: string,
  options: string[],
  answer: string,
  marks = 1,
): McqQuestion {
  return { type: "mcq", topic, question, options, answer, marks };
}

function short(
  topic: Topic,
  question: string,
  acceptedAnswers: string[],
  marks = 1,
): ShortQuestion {
  return { type: "short", topic, question, acceptedAnswers, marks };
}

const DATA: Question[] = [
  mcq(
    "Data analysis",
    "Which variable is categorical?",
    ["Height of students", "Number of pets", "Eye colour", "Test score"],
    "Eye colour",
  ),
  mcq(
    "Data analysis",
    "A dataset has Q1 = 12, Q3 = 20. What is the IQR?",
    ["6", "8", "16", "32"],
    "8",
  ),
  mcq(
    "Data analysis",
    "In a boxplot, an outlier is typically defined as a value outside:",
    ["Q1 − 1.5×IQR or Q3 + 1.5×IQR", "Mean ± 1 SD only", "Median ± range", "Mode ± 2"],
    "Q1 − 1.5×IQR or Q3 + 1.5×IQR",
  ),
  mcq(
    "Data analysis",
    "A scatterplot shows points rising from left to right in a tight band. The association is best described as:",
    ["Strong positive linear", "Strong negative linear", "No association", "Circular"],
    "Strong positive linear",
  ),
  mcq(
    "Data analysis",
    "Correlation r = −0.91 suggests:",
    ["Strong negative linear association", "Weak association", "No linear association", "Positive association"],
    "Strong negative linear association",
  ),
  mcq(
    "Data analysis",
    "A regression line is y = 4 + 2.5x where x is study hours and y is test score. The slope means:",
    ["Score increases by 2.5 per extra hour on average", "Score starts at 2.5", "Hours increase by 2.5 per point", "Intercept is hours"],
    "Score increases by 2.5 per extra hour on average",
  ),
  mcq(
    "Data analysis",
    "Using a regression line to predict y when x is far outside the original data range is called:",
    ["Extrapolation", "Interpolation", "Residual analysis", "Seasonal adjustment"],
    "Extrapolation",
  ),
  mcq(
    "Data analysis",
    "A residual plot shows a clear curved pattern. This suggests:",
    ["A linear model may be inappropriate", "The linear model is perfect", "r must equal 1", "There is no association"],
    "A linear model may be inappropriate",
  ),
  mcq(
    "Data analysis",
    "Which measure of centre is most resistant to outliers?",
    ["Median", "Mean", "Mode", "Range"],
    "Median",
  ),
  mcq(
    "Data analysis",
    "In a time series, regular peaks every 12 months most likely indicate:",
    ["Seasonality", "A negative trend only", "Zero correlation", "An Eulerian circuit"],
    "Seasonality",
  ),
  short("Data analysis", "Write the formula for a residual.", ["actual − predicted", "actual-predicted", "actual - predicted", "y - ŷ", "y-yhat"]),
  short("Data analysis", "State the correlation r value closest to ‘no linear relationship’.", ["0", "0.0", "near 0"]),
  short("Data analysis", "Name two features you compare when describing boxplots for two groups.", ["centre and spread", "median and iqr", "median and range"]),
];

const RECURSION: Question[] = [
  mcq(
    "Recursion and financial modelling",
    "An arithmetic sequence has first term 100 and common difference 50. The fourth term is:",
    ["250", "200", "150", "300"],
    "250",
  ),
  mcq(
    "Recursion and financial modelling",
    "A geometric sequence has first term 100 and ratio 1.1. The third term is:",
    ["121", "110", "133.1", "100"],
    "121",
  ),
  mcq(
    "Recursion and financial modelling",
    "$8\\,000 is invested at 6% p.a. compounded yearly for 3 years. The final amount is closest to:",
    ["$9\\,520", "$8\\,480", "$8\\,000", "$10\\,200"],
    "$9\\,520",
  ),
  mcq(
    "Recursion and financial modelling",
    "Which recurrence represents compound interest with no deposits?",
    ["A_{n+1} = A_n(1+r)", "A_{n+1} = A_n + r", "A_{n+1} = A_n − r", "A_{n+1} = A_n + D"],
    "A_{n+1} = A_n(1+r)",
  ),
  mcq(
    "Recursion and financial modelling",
    "A reducing-balance loan has balance recurrence B_{n+1} = B_n(1+r) − R. Here R is:",
    ["Repayment per period", "Interest rate", "Principal", "Deposit"],
    "Repayment per period",
  ),
  mcq(
    "Recursion and financial modelling",
    "Flat-rate depreciation $V_{n+1} = V_n − d$ means:",
    ["Value drops by a fixed amount each period", "Value drops by a fixed percentage", "Value grows geometrically", "Value is constant"],
    "Value drops by a fixed amount each period",
  ),
  mcq(
    "Recursion and financial modelling",
    "An investment with regular deposits is commonly modelled as:",
    ["A_{n+1} = A_n(1+r) + D", "A_{n+1} = A_n − D", "A_{n+1} = A_n + r only", "A_{n+1} = D only"],
    "A_{n+1} = A_n(1+r) + D",
  ),
  mcq(
    "Recursion and financial modelling",
    "$P = 5\\,000$, $r = 0.04$ per year, $n = 2$ years. Using $A = P(1+r)^n$, $A$ is:",
    ["$5\\,408", "$5\\,400", "$5\\,200", "$5\\,040"],
    "$5\\,408",
  ),
  mcq(
    "Recursion and financial modelling",
    "Which sequence is geometric?",
    ["100, 110, 121, 133.1", "100, 150, 200, 250", "5, 10, 15, 20", "1, 4, 9, 16"],
    "100, 110, 121, 133.1",
  ),
  mcq(
    "Recursion and financial modelling",
    "First-order linear recurrence is often used to model:",
    ["Discrete growth or decay with a constant rate of change", "Matrix multiplication", "Eulerian trails", "Boxplot fences"],
    "Discrete growth or decay with a constant rate of change",
  ),
  short("Recursion and financial modelling", "Write the compound interest formula.", ["A=P(1+r)^n", "A = P(1+r)^n"]),
  short("Recursion and financial modelling", "A recurrence is A_{n+1} = A_n + 50 with A_1 = 200. Find A_4.", ["350", "350.0"]),
  short("Recursion and financial modelling", "Name one difference between arithmetic and geometric growth.", ["adds constant amount vs multiplies by constant ratio", "common difference vs common ratio"]),
];

const MATRICES: Question[] = [
  mcq(
    "Matrices",
    "A matrix with 2 rows and 3 columns has order:",
    ["2×3", "3×2", "2+3", "6×1"],
    "2×3",
  ),
  mcq(
    "Matrices",
    "Which sum is defined?",
    [
      "[1 2] + [3 4] (both 1×2)",
      "[1 2] + [3 4 5]",
      "[1] + [2 3]",
      "Cannot add any matrices",
    ],
    "[1 2] + [3 4] (both 1×2)",
  ),
  mcq(
    "Matrices",
    "2 × [1 3; 2 4] equals:",
    ["[2 6; 4 8]", "[3 5; 4 6]", "[1 6; 2 8]", "[2 3; 2 4]"],
    "[2 6; 4 8]",
  ),
  mcq(
    "Matrices",
    "For matrix multiplication AB, the number of columns of A must equal:",
    ["Number of rows of B", "Number of columns of B", "Number of rows of A", "Order of B"],
    "Number of rows of B",
  ),
  mcq(
    "Matrices",
    "If A is 2×3 and B is 3×4, the product AB has order:",
    ["2×4", "3×3", "2×3", "4×2"],
    "2×4",
  ),
  mcq(
    "Matrices",
    "The identity matrix I has the property that:",
    ["AI = A and IA = A (when products are defined)", "AI = 0", "IA = I only", "A + I = 0"],
    "AI = A and IA = A (when products are defined)",
  ),
  mcq(
    "Matrices",
    "A transition matrix is mainly used to:",
    ["Model movement between states over time", "Find shortest paths", "Draw boxplots", "Calculate compound interest"],
    "Model movement between states over time",
  ),
  mcq(
    "Matrices",
    "Leslie matrices are associated with:",
    ["Population modelling by age groups", "Loan repayments", "Residual plots", "Seasonal indices"],
    "Population modelling by age groups",
  ),
  mcq(
    "Matrices",
    "[1 2; 0 1] + [3 0; 1 2] =",
    ["[4 2; 1 3]", "[4 2; 0 3]", "[3 2; 1 1]", "[2 2; 1 3]"],
    "[4 2; 1 3]",
  ),
  mcq(
    "Matrices",
    "Row-by-column multiplication means entry (i,j) of AB is found by:",
    ["Multiplying row i of A with column j of B and summing", "Adding all entries of A and B", "Multiplying corresponding entries only", "Using the largest entry in each row"],
    "Multiplying row i of A with column j of B and summing",
  ),
  short("Matrices", "State the order of a matrix with 3 rows and 2 columns.", ["3×2", "3x2", "3 by 2"]),
  short("Matrices", "What does a steady state often describe in transition matrix models?", ["long-term proportions in each state", "long term distribution", "equilibrium state"]),
  short("Matrices", "Can you add a 2×2 matrix to a 2×3 matrix? Answer yes or no.", ["no", "No"]),
];

const NETWORKS: Question[] = [
  mcq(
    "Networks and decision mathematics",
    "In a graph, the degree of a vertex is:",
    ["The number of edges connected to it", "The weight of the vertex", "The number of vertices", "The longest path"],
    "The number of edges connected to it",
  ),
  mcq(
    "Networks and decision mathematics",
    "An Eulerian circuit exists in a connected graph when:",
    ["All vertices have even degree", "Exactly two vertices have odd degree", "All vertices have odd degree", "The graph has no edges"],
    "All vertices have even degree",
  ),
  mcq(
    "Networks and decision mathematics",
    "An Eulerian trail (not necessarily a circuit) in a connected graph requires:",
    ["Exactly zero or two vertices of odd degree", "All vertices even", "All vertices odd", "A Hamiltonian cycle"],
    "Exactly zero or two vertices of odd degree",
  ),
  mcq(
    "Networks and decision mathematics",
    "A Hamiltonian path is:",
    ["A path visiting every vertex exactly once", "A path using every edge exactly once", "A tree with minimum weight", "A critical activity"],
    "A path visiting every vertex exactly once",
  ),
  mcq(
    "Networks and decision mathematics",
    "Dijkstra’s algorithm is used for:",
    ["Shortest path problems", "Minimum spanning trees only", "Compound interest", "Matrix inversion"],
    "Shortest path problems",
  ),
  mcq(
    "Networks and decision mathematics",
    "Prim’s and Kruskal’s algorithms find:",
    ["A minimum spanning tree", "An Eulerian circuit", "A regression line", "Seasonal indices"],
    "A minimum spanning tree",
  ),
  mcq(
    "Networks and decision mathematics",
    "A spanning tree of a connected graph:",
    ["Connects all vertices with no cycles", "Uses every edge twice", "Must include a loop at every vertex", "Has the maximum possible weight"],
    "Connects all vertices with no cycles",
  ),
  mcq(
    "Networks and decision mathematics",
    "In critical path analysis, activities on the critical path have:",
    ["Zero total float (slack)", "Maximum float", "No duration", "Negative weight"],
    "Zero total float (slack)",
  ),
  mcq(
    "Networks and decision mathematics",
    "Float (slack) on an activity is:",
    ["Latest start − earliest start (for that activity)", "Earliest finish only", "Sum of all edge weights", "Number of vertices"],
    "Latest start − earliest start (for that activity)",
  ),
  mcq(
    "Networks and decision mathematics",
    "A weighted graph is used when:",
    ["Edges have costs, distances, or times", "All vertices have degree 2", "The graph must be bipartite only", "There are no edges"],
    "Edges have costs, distances, or times",
  ),
  short("Networks and decision mathematics", "State the condition on vertex degrees for an Eulerian circuit.", ["all even", "all vertices even degree", "every vertex even"]),
  short("Networks and decision mathematics", "Name one algorithm for a minimum spanning tree.", ["prim", "kruskal", "Prim's", "Kruskal's"]),
  short("Networks and decision mathematics", "What does the critical path determine in a project network?", ["minimum completion time", "minimum project duration", "shortest path between two towns"]),
];

/** Built-in Units 3 & 4 practice bank (merged with sheet/DB questions; deduped by stem). */
export const GENERAL_MATHS_BUILTIN_QUESTIONS: Question[] = [
  ...GENERAL_MATHS_LONG_BUILTIN_QUESTIONS,
  ...DATA,
  ...RECURSION,
  ...MATRICES,
  ...NETWORKS,
];
