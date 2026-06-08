/**
 * Tricky short-answer practice bank (72 questions). Generated — edit in place if needed.
 * @see scripts/generate-maths-builtin-short.mjs
 */
import type { GeneralMathsAreaOfStudyTopic } from "@/lib/generalMathsAreaTopic";
import type { Question, ShortQuestion } from "@/lib/subjects";

type Topic = GeneralMathsAreaOfStudyTopic;

function short(
  topic: Topic,
  question: string,
  acceptedAnswers: string[],
  marks = 2,
): ShortQuestion {
  return { type: "short", topic, question, acceptedAnswers, marks };
}

const BANK: Question[] = [
  short("Data analysis", "A five-number summary has $Q_1 = 8$, $Q_3 = 20$. Find the IQR.", ["12","12.0"], 2),
  short("Recursion and financial modelling", "An arithmetic sequence has $u_1 = 15$, $d = -4$. Find $u_6$.", ["-5","-5.0"], 2),
  short("Matrices", "Find $\\det\\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$.", ["10","10.0"], 2),
  short("Networks and decision mathematics", "An Eulerian **circuit** exists in a connected graph when every vertex has even degree. How many vertices of **odd** degree are allowed?", ["0","zero","none"], 2),
  short("Data analysis", "For the data set $4, 7, 7, 8, 12$, find the mean (1 d.p.).", ["7.6","7.60"], 2),
  short("Recursion and financial modelling", "A geometric sequence has $u_1 = 3$, $r = 2$. Find $u_5$.", ["48","48.0"], 2),
  short("Matrices", "Multiply $(2\\times 3)(3\\times 2)$. How many rows does the product have?", ["2","2.0"], 2),
  short("Networks and decision mathematics", "A connected graph has $8$ vertices. A spanning tree has how many edges?", ["7","7.0"], 2),
  short("Data analysis", "A scatterplot has $r = -0.92$. In one word, is the linear association strong or weak?", ["strong","Strong"], 2),
  short("Recursion and financial modelling", "$\\$5\\,000$ is invested at $4\\%$ p.a. compounded annually for $3$ years. Find the balance (nearest dollar).", ["5624","5624.32","$5624","5624.3"], 2),
  short("Matrices", "In a standard row-stochastic transition matrix, each **row** sum must equal what number?", ["1","1.0","one"], 2),
  short("Networks and decision mathematics", "Critical path length in an activity network equals the project's minimum ___ time. (one word)", ["completion","project","duration"], 2),
  short("Data analysis", "A least-squares line is $\\hat{y} = 40 + 2.5x$ where $x$ is hours studied. Predict $\\hat{y}$ when $x = 12$.", ["70","70.0"], 2),
  short("Recursion and financial modelling", "Flat-rate depreciation: $V_0 = \\$18\\,000$, fixed drop $\\$2\\,000$ per year. Find $V_3$ after three years.", ["12000","$12000","12000.0"], 2),
  short("Matrices", "Compute the $(1,1)$ entry of $3\\begin{pmatrix} 2 & 5 \\\\ 1 & 4 \\end{pmatrix}$.", ["6","6.0"], 2),
  short("Networks and decision mathematics", "Activity float $= LS - ES$. If float is $0$, the activity lies on the ___ path. (two words)", ["critical path","critical"], 2),
  short("Data analysis", "A residual is $\\text{actual} - \\text{predicted}$. If actual $= 31$ and predicted $= 27$, find the residual.", ["4","4.0"], 2),
  short("Recursion and financial modelling", "Compound interest with no deposits uses the recurrence $A_{n+1} = A_n(1+r)$. If the monthly rate is $r = 0.06$, write the monthly multiplier as a decimal.", ["1.06","1.060"], 2),
  short("Matrices", "$\\begin{pmatrix} 1 & 2 \\end{pmatrix}\\begin{pmatrix} 3 \\\\ 4 \\end{pmatrix} = ?$", ["11","11.0"], 2),
  short("Networks and decision mathematics", "Kruskal's algorithm builds a minimum ___ tree. (two words)", ["spanning tree","spanning"], 2),
  short("Data analysis", "Outliers lie outside $Q_1 - 1.5\\times\\text{IQR}$ or $Q_3 + 1.5\\times\\text{IQR}$. With $Q_1 = 10$, $Q_3 = 22$, find the **upper** fence.", ["40","40.0"], 2),
  short("Recursion and financial modelling", "For a perpetuity with annual payment $\\$4\\,800$ at $5\\%$ p.a., find the present value (nearest dollar).", ["96000","$96000","96000.0"], 2),
  short("Matrices", "Inverse of $\\begin{pmatrix} 5 & 0 \\\\ 0 & 2 \\end{pmatrix}$: state the $(2,2)$ entry of $A^{-1}$.", ["0.5","1/2",".5"], 2),
  short("Networks and decision mathematics", "A Hamiltonian path visits each ___ exactly once. (one word)", ["vertex","vertices","node","nodes"], 2),
  short("Data analysis", "A seasonal index of $1.20$ means the observation is what percent **above** the seasonal average? (whole number)", ["20","20%"], 2),
  short("Recursion and financial modelling", "A geometric sequence goes from $125$ to $180$ in two steps ($u_1 \\to u_2 \\to u_3$). Find the common ratio $r$ (3 d.p.).", ["1.200","1.2","1.20"], 2),
  short("Matrices", "For $T = \\begin{pmatrix} 0.7 & 0.3 \\\\ 0.2 & 0.8 \\end{pmatrix}$ and state $\\mathbf{s} = \\begin{pmatrix} p \\\\ 1-p \\end{pmatrix}$, steady state satisfies $\\mathbf{s} = \\mathbf{s}T$. Find $p$ (2 d.p.).", ["0.40","0.4",".4","0.400"], 2),
  short("Networks and decision mathematics", "In a bipartite graph, vertices split into two ___ with edges only between them. (one word)", ["sets","partitions","classes"], 2),
  short("Data analysis", "Deseasonalised value $= \\dfrac{\\text{actual}}{\\text{seasonal index}}$. If actual $= 276$ and index $= 1.15$, give the deseasonalised value (2 d.p.).", ["240","240.00","240.0"], 2),
  short("Recursion and financial modelling", "Arithmetic series: $n = 12$, $a = 4$, $d = 3$. Find $S_{12}$.", ["246","246.0"], 2),
  short("Matrices", "A Leslie matrix is mainly used to model what kind of change over time?", ["population","populations","age structure","age groups"], 2),
  short("Networks and decision mathematics", "Dijkstra's algorithm finds a shortest ___ from a source vertex. (one word)", ["path","paths"], 2),
  short("Data analysis", "$n = 25$ and $\\sum x = 450$. Find $\\bar{x}$.", ["18","18.0"], 2),
  short("Recursion and financial modelling", "Reducing-balance loan: $B_0 = 200\\,000$, monthly $r = 0.004$, repayment $R = 1500$. After **one** payment, $B_1$ is closest to (nearest dollar)?", ["199300","199300.0","199300.00"], 2),
  short("Matrices", "$\\begin{pmatrix} 3 & 2 \\\\ 6 & 4 \\end{pmatrix}$ is singular. Its determinant is?", ["0","0.0"], 2),
  short("Networks and decision mathematics", "Weighted edge $12$ on a road network most likely represents distance, time, or colour?", ["distance","time","cost"], 2),
  short("Data analysis", "Correlation $r = 0.04$ is closest to which type of linear relationship: none, weak, or strong?", ["none","no","no linear","weak"], 2),
  short("Recursion and financial modelling", "Steady state for $A_{n+1} = A_n(1+r) + D$ with $r = 0.05$, $D = 250$. Find $A$ (2 d.p.).", ["5000","5000.00","5000.0"], 2),
  short("Matrices", "Order of matrix multiplication $(m\\times n)(n\\times p)$: the inner dimensions $n$ must be what?", ["equal","the same","same"], 2),
  short("Networks and decision mathematics", "An activity-on-arc network: an arrow from $A$ to $B$ means $B$ cannot start until $A$ has ___. (one word)", ["finished","completed","ended","finished."], 2),
  short("Data analysis", "A moving-average smooth mainly reduces which component of a time series: trend, seasonality, or irregular?", ["irregular","random","noise"], 2),
  short("Recursion and financial modelling", "Nominal $6\\%$ p.a. compounded quarterly. Effective annual rate as a **percent** (2 d.p.).", ["6.14","6.14%","6.136"], 2),
  short("Matrices", "If $AB = I$ for $2\\times 2$ matrices, then $B$ is the ___ of $A$. (one word)", ["inverse","Inverse"], 2),
  short("Networks and decision mathematics", "Graph has vertices of degrees $3,3,2,2$. Can it have an Eulerian **trail** (not necessarily a circuit)? Answer yes or no.", ["yes","Yes"], 2),
  short("Data analysis", "On a boxplot the median sits much closer to $Q_3$ than $Q_1$. The distribution is skewed to the low or high end? (one word)", ["low","negative","left"], 2),
  short("Recursion and financial modelling", "An annuity immediate: $\\$300$ deposited at **end** of each month, $r = 0.01$, $n = 4$ deposits. Future value after 4th deposit (nearest dollar).", ["1218","1218.12","1218.1"], 2),
  short("Matrices", "Transition matrix entry $t_{ij}$ often means: probability of moving from state ___ to state $j$. Fill the blank (letter $i$ or word 'i').", ["i","I"], 2),
  short("Networks and decision mathematics", "Prim's algorithm always grows one ___ tree. (one word)", ["spanning","minimum spanning"], 2),
  short("Data analysis", "For a regression with $r^2 = 0.64$, what fraction of the variation in $y$ is **not** explained by the linear model? (decimal)", ["0.36",".36"], 2),
  short("Recursion and financial modelling", "Asset value halves every $4$ years under geometric depreciation. Annual depreciation **rate** as a percent (2 d.p.).", ["15.91","15.91%","15.9"], 2),
  short("Matrices", "Town A sends 80% of commuters to B and 20% stay. Everyone starts in A. After **one** transition, what fraction is in B? (decimal)", ["0.8",".8","0.80"], 2),
  short("Networks and decision mathematics", "In a project network, tasks follow A(3)→B(2)→D(4) and A→C(1)→D. What is the critical path duration?", ["9","9.0"], 2),
  short("Data analysis", "A café logs drink sales: flat white 42, latte 38, long black 15, other 5. What **percent** of drinks sold were latte? (1 d.p.)", ["38.0","38","38%"], 2),
  short("Recursion and financial modelling", "Phone plan: \\$45/month plus \\$0.10 per minute over 200. You used 247 minutes. Total bill (nearest cent as dollars)?", ["49.70","49.7","$49.70"], 2),
  short("Matrices", "Encoding shift uses matrix $\\begin{pmatrix}1&1\\\\0&1\\end{pmatrix}$ on column $\\begin{pmatrix}3\\\\5\\end{pmatrix}$. Second entry of result?", ["8","8.0"], 2),
  short("Networks and decision mathematics", "Graph has 6 vertices all degree 3. Total number of edges? (handshake lemma: sum degrees / 2)", ["9","9.0"], 2),
  short("Data analysis", "Regression for ice-cream sales vs temperature has $r = 0.15$ in winter data only. Reliable for predicting summer sales? yes or no.", ["no","No"], 2),
  short("Recursion and financial modelling", "Nominal 12% p.a. compounded **monthly**. Monthly rate as a decimal (4 d.p.).", ["0.01","0.0100",".01"], 2),
  short("Matrices", "2×2 matrix swaps rows of identity then doubles row 2. Determinant?", ["-2","-2.0"], 2),
  short("Networks and decision mathematics", "Activity network: earliest finish of project is 18. Activity G has duration 5 and latest finish 18, earliest start 13. Float of G?", ["0","0.0"], 2),
  short("Data analysis", "Five-number summary shows median 50, max 200, min 10, Q3 80, Q1 40. Is 200 flagged as outlier by 1.5×IQR rule? yes or no.", ["yes","Yes"], 2),
  short("Recursion and financial modelling", "Asset \\$12\\,000, reducing balance 15% p.a. once per year. Value after **one** year (nearest dollar)?", ["10200","$10200","10200.0"], 2),
  short("Matrices", "Matrix equation $AX = B$ with $A$ invertible. Solve for $X$ in words: $X = A^{?} B$. Power symbol?", ["-1","inverse"], 2),
  short("Networks and decision mathematics", "Travelling salesman wants a closed route visiting every city once. Hamiltonian circuit or Eulerian circuit? (one word)", ["hamiltonian","Hamiltonian"], 2),
  short("Data analysis", "Time-series spike every 7 days in app logins most likely indicates: daily, weekly, or yearly seasonality? (one word)", ["weekly","Weekly"], 2),
  short("Recursion and financial modelling", "Rule $u_{n+1} = 1.08 u_n - 500$ with $u_0 = 10\\,000$. After one step $u_1$ nearest dollar?", ["10300","10300.0","$10300"], 2),
  short("Matrices", "Leslie matrix applied to population vector $\\mathbf{p}$ gives next year $\\mathbf{p}' = L\\mathbf{p}$. Dimensions: if $\\mathbf{p}$ is 3×1, $L$ is ?×3. First number only.", ["3","3.0"], 2),
  short("Networks and decision mathematics", "Dijkstra from S: edge S–A(4), S–B(2), A–T(1), B–T(5). Shortest distance S to T?", ["7","7.0"], 2),
  short("Data analysis", "Two variables: hours slept vs reaction time. Expected sign of $r$? (positive or negative)", ["negative","Negative","neg"], 2),
  short("Recursion and financial modelling", "Rule $F_{n+1} = F_n + F_{n-1}$ with $F_1=1$, $F_2=1$. Find $F_6$.", ["8","8.0"], 2),
  short("Recursion and financial modelling", "A reducing-balance loan has starting balance $128\\,300$, annual rate $6.1\\%$ compounding monthly, monthly repayment $1\\,829$. Find the month-1 interest charge ($, 2 d.p.).", ["652.19","652.20","652.19"], 2),
  short("Recursion and financial modelling", "A loan follows $L_0 = 48\\,800$, $L_{n+1} = 1.0048\\,L_n - 656$. Determine $L_{52}$ (2 d.p.).", ["23956.08","23956.08"], 2),
];

export const GENERAL_MATHS_BUILTIN_SHORT_TRICKY: Question[] = BANK;
