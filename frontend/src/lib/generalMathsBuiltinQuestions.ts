import type { GeneralMathsAreaOfStudyTopic } from "@/lib/generalMathsAreaTopic";
import type { McqQuestion, Question, ShortQuestion } from "@/lib/subjects";

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
  ...DATA,
  ...RECURSION,
  ...MATRICES,
  ...NETWORKS,
];
