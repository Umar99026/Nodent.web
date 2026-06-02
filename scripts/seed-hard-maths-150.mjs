/**
 * Seed 150 hard short-answer questions (Methods / Specialist / General).
 * Usage: ADMIN_KEY=localdev node scripts/seed-hard-maths-150.mjs [baseUrl]
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const adminKey = process.env.ADMIN_KEY || process.env.NODENT_ADMIN_KEY;

function ans(...values) {
  return values.map((v) => String(v).trim()).filter(Boolean);
}

function q(subjectId, topic, question, accepted, marks = 2) {
  const acceptedAnswers = ans(...(Array.isArray(accepted) ? accepted : [accepted]));
  return {
    subjectId,
    type: "short_answer",
    topic,
    question,
    acceptedAnswers,
    answer: acceptedAnswers[0],
    marks,
  };
}

const methods = [
  // Functions, algebra, graphs (1–10)
  q("methods", "Polynomial, power and rational functions", "Let $f(x)=x^3-3x^2+k$. The tangent at $x=2$ passes through $(0,4)$. Find $k$.", "k=8"),
  q("methods", "Exponential and logarithmic functions", "Solve $\\log_2(x-1)+\\log_2(x+3)=3$.", ["x=-1+2√3", "x=-1+2*sqrt(3)", "-1+2√3"]),
  q("methods", "Functions and transformations", "If $f(x)=\\frac{2x-1}{x+3}$, find $f^{-1}(x)$.", ["f^{-1}(x)=(1+3x)/(2-x)", "(1+3x)/(2-x)"]),
  q("methods", "Exponential and logarithmic functions", "Find the range of $f(x)=3-2e^{-x^2}$.", ["[1,3)", "1≤y<3"]),
  q("methods", "Exponential and logarithmic functions", "Solve $e^{2x}-5e^x+6=0$.", ["x=ln2", "x=ln3", "ln2", "ln3"]),
  q("methods", "Algebra and equations", "Find all $a$ such that $y=x^2+ax+4$ has no real $x$-intercepts.", ["-4<a<4", "-4 < a < 4"]),
  q("methods", "Functions and transformations", "If $f(x)=\\sqrt{9-x^2}$, state its maximal domain and range.", ["Domain [-3,3], range [0,3]", "domain [-3,3] range [0,3]"]),
  q("methods", "Circular functions", "Solve $\\sin(2x)=\\cos x$ for $0\\le x\\le 2\\pi$.", ["π/6", "5π/6", "2π/3", "x=π/6,5π/6,2π/3"]),
  q("methods", "Functions and transformations", "Find the equation of $y=x^2$ after dilation by factor 3 from the $x$-axis, reflection in the $y$-axis, then translation 2 right and 5 down.", "y=3(x-2)^2-5"),
  q("methods", "Applications of differentiation", "Find the values of $m$ for which $y=mx+1$ is tangent to $y=x^2-3x+4$.", ["m=1±2√3", "m=1+2√3", "m=1-2√3"]),
  // Calculus (11–20)
  q("methods", "Differential calculus", "Find $\\frac{d}{dx}(x^2 e^{-3x})$.", ["e^{-3x}(2x-3x^2)", "e^(-3x)(2x-3x^2)"]),
  q("methods", "Applications of differentiation", "Find the stationary points of $f(x)=x^3-6x^2+9x+1$.", ["(1,5) local maximum", "(3,1) local minimum", "(1,5)", "(3,1)"]),
  q("methods", "Integral calculus", "Evaluate $\\int_0^2 (3x^2-4x+1)\\,dx$.", "2"),
  q("methods", "Integral calculus", "Find $\\int x e^{x^2}\\,dx$.", ["(1/2)e^{x^2}+C", "e^{x^2}/2+C"]),
  q("methods", "Integral calculus", "A curve has gradient $6x-4$ and passes through $(2,5)$. Find its equation.", "y=3x^2-4x+1"),
  q("methods", "Applications of integration", "Find the area between $y=x^2$ and $y=2x$.", "4/3"),
  q("methods", "Applications of differentiation", "For $f(x)=x^4-8x^2$, find the nature of the stationary point at $x=0$.", "Local maximum"),
  q("methods", "Integral calculus", "Find the exact value of $\\int_0^{\\pi/2}\\sin^3 x\\,dx$.", "2/3"),
  q("methods", "Applications of differentiation", "Find the maximum value of $f(x)=x\\sqrt{16-x^2}$, $0\\le x\\le 4$.", ["8 at x=2√2", "8", "x=2√2"]),
  q("methods", "Differential calculus", "If $y=\\ln(3x^2+1)$, find $\\frac{dy}{dx}$.", ["6x/(3x^2+1)", "6x/(3x^2+1)"]),
  // Probability and statistics (21–30)
  q("methods", "Discrete random variables", "A biased coin has $P(H)=0.7$. Find the probability of exactly 3 heads in 5 tosses.", ["0.3087", "0.30870"]),
  q("methods", "Discrete random variables", "If $X\\sim\\text{Bin}(8,0.25)$, find $P(X\\ge 7)$.", ["25/65536", "0.000381"]),
  q("methods", "The normal distribution", "If $X\\sim N(50,6^2)$, find $P(44<X<62)$.", ["≈0.8186", "0.8186", "P(-1<Z<2)≈0.8186"]),
  q("methods", "Discrete random variables", "If $P(A)=0.6$, $P(B)=0.5$, $P(A\\cap B)=0.2$, find $P(A\\cup B)$.", "0.9"),
  q("methods", "Discrete random variables", "Events $A$ and $B$ are independent with $P(A)=0.4$, $P(A\\cup B)=0.7$. Find $P(B)$.", "0.5"),
  q("methods", "Continuous random variables", "A random variable has pdf $f(x)=kx^2$, $0\\le x\\le 3$. Find $k$.", ["k=1/9", "1/9"]),
  q("methods", "Continuous random variables", "For the pdf in the previous style ($f(x)=kx^2$ on $[0,3]$ with $k=1/9$), find $P(X>2)$.", ["19/27", "0.7037"]),
  q("methods", "The normal distribution", "If $X\\sim N(20,4^2)$, find $a$ such that $P(X<a)=0.975$.", ["a≈27.84", "27.84"]),
  q("methods", "Discrete random variables", "A test has sensitivity 0.95, specificity 0.90, and disease prevalence 0.02. Find $P(\\text{disease}\\mid\\text{positive})$.", ["≈0.162", "0.162", "0.019/0.117"]),
  q("methods", "Discrete random variables", "If $X\\sim\\text{Bin}(20,0.4)$, find $E(X)$ and $\\text{Var}(X)$.", ["E(X)=8, Var(X)=4.8", "E=8, Var=4.8"]),
  // Mixed hard application (31–50)
  q("methods", "Exponential and logarithmic functions", "A population follows $P(t)=500e^{0.08t}$. Find when it first exceeds 1000.", ["t=ln(2)/0.08", "t≈8.66", "8.66"]),
  q("methods", "Exponential and logarithmic functions", "The half-life of a substance is 12 hours. Find $k$ in $M(t)=M_0 e^{-kt}$.", ["k=ln(2)/12", "ln2/12"]),
  q("methods", "Exponential and logarithmic functions", "Solve $2\\ln x=\\ln(3x+10)$.", "x=5"),
  q("methods", "Integral calculus", "Find the exact area under $y=\\frac{1}{x+1}$ from $x=0$ to $x=3$.", "ln4"),
  q("methods", "Applications of differentiation", "Find the equation of the normal to $y=e^{2x}$ at $x=0$.", "y=-(1/2)x+1"),
  q("methods", "Integral calculus", "Find $a>0$ such that $\\int_0^a 2x\\,dx=18$.", ["a=3√2", "3√2", "a=3*sqrt(2)"]),
  q("methods", "Applications of differentiation", "Find the turning point of $y=e^x(2-x)$.", ["(1,e) local maximum", "(1,e)"]),
  q("methods", "Algebra and equations", "Solve $\\frac{x-1}{x+2}>2$.", ["-5<x<-2", "-5 < x < -2"]),
  q("methods", "Exponential and logarithmic functions", "Find the exact solution of $3^{x+1}=7$.", ["x=log_3(7)-1", "log_3(7)-1"]),
  q("methods", "Differential calculus", "If $f'(x)=12x^2-12x$, find where $f$ is increasing.", ["x<0 or x>1", "(-∞,0)∪(1,∞)"]),
  q("methods", "Algebra and equations", "Find the coordinates where $y=x^3$ and $y=4x$ intersect.", ["(-2,-8),(0,0),(2,8)", "(-2,-8)", "(2,8)"]),
  q("methods", "Applications of integration", "Find the area enclosed by $y=4x$ and $y=x^3$.", "8"),
  q("methods", "Functions and transformations", "If $f(x)=\\frac{x}{x^2-1}$, $x\\ne 1$, state the removable discontinuity.", "Hole at (1,1/2)"),
  q("methods", "Polynomial, power and rational functions", "Find the asymptotes of $y=\\frac{3x+1}{x-2}$.", ["x=2, y=3", "x=2 y=3"]),
  q("methods", "Applications of differentiation", "Find the minimum value of $x+\\frac{9}{x}$, $x>0$.", "6"),
  q("methods", "Circular functions", "Solve $\\cos x=\\frac{1}{2}$ for $0\\le x\\le 2\\pi$.", ["π/3", "5π/3", "π/3,5π/3"]),
  q("methods", "Differential calculus", "If $f(x)=\\sin^{-1}(x)$, find $f'(1/2)$.", ["√3/2", "sqrt(3)/2"]),
  q("methods", "Continuous random variables", "Find the median of a continuous distribution with pdf $f(x)=2x$, $0\\le x\\le 1$.", ["1/√2", "√2/2", "0.707"]),
  q("methods", "Continuous random variables", "If $P(X\\le x)=1-e^{-0.4x}$, $x\\ge 0$, find $P(X>5)$.", ["e^{-2}", "e^-2"]),
  q("methods", "Exponential and logarithmic functions", "Find $x$ if $\\ln(x+4)-\\ln x=\\ln 3$.", "x=2"),
];

const specialist = [
  q("specialist-maths", "Complex numbers and algebra", "Express $(1+i)^6$ in Cartesian form.", "-8i"),
  q("specialist-maths", "Complex numbers and algebra", "Solve $z^2+4z+13=0$.", ["z=-2±3i", "-2+3i", "-2-3i"]),
  q("specialist-maths", "Complex numbers and algebra", "Find the modulus and argument of $-3+3\\sqrt{3}\\,i$.", ["Modulus 6, argument 2π/3", "6, 2π/3"]),
  q("specialist-maths", "Complex numbers and algebra", "Find all cube roots of $8\\operatorname{cis}(\\pi/3)$.", ["2cis(π/9),2cis(7π/9),2cis(13π/9)"]),
  q("specialist-maths", "Complex numbers and algebra", "If $z+\\bar{z}=6$ and $z\\bar{z}=13$, find $z$.", ["z=3±2i", "3+2i", "3-2i"]),
  q("specialist-maths", "Complex numbers and algebra", "Find the locus of $z$ satisfying $|z-2i|=3$.", "Circle centre (0,2), radius 3"),
  q("specialist-maths", "Complex numbers and algebra", "Find the locus of $z=x+iy$ satisfying $|z-1|=|z+3|$.", "x=-1"),
  q("specialist-maths", "Complex numbers and algebra", "Evaluate $\\frac{3+4i}{1-2i}$.", "-1+2i"),
  q("specialist-maths", "Complex numbers and algebra", "Find $z$ if $iz=4-3i$.", "-3-4i"),
  q("specialist-maths", "Complex numbers and algebra", "Solve $z^4=16$.", ["2,-2,2i,-2i", "±2", "±2i"]),
  q("specialist-maths", "Vectors in two and three dimensions", "Find the angle between $\\mathbf{a}=(1,2,2)$ and $\\mathbf{b}=(3,0,4)$.", ["cos^{-1}(11/15)", "arccos(11/15)"]),
  q("specialist-maths", "Vectors in two and three dimensions", "Find $\\mathbf{a}\\times\\mathbf{b}$ for $\\mathbf{a}=(1,2,3)$, $\\mathbf{b}=(4,-1,2)$.", "(7,10,-9)"),
  q("specialist-maths", "Lines and planes in 3D", "Find the equation of the plane through $(1,0,2)$ with normal $(3,-1,4)$.", "3x-y+4z=11"),
  q("specialist-maths", "Lines and planes in 3D", "Find the shortest distance from $(2,1,0)$ to the plane $x+2y-2z=5$.", "1/3"),
  q("specialist-maths", "Lines and planes in 3D", "Find the intersection of $\\mathbf{r}=(1,2,3)+\\lambda(2,-1,1)$ with $x+y+z=10$.", "(5,0,5)"),
  q("specialist-maths", "Vectors in two and three dimensions", "Find the projection of $(3,4,0)$ onto $(1,2,2)$.", "(11/9)(1,2,2)"),
  q("specialist-maths", "Vectors in two and three dimensions", "Determine whether $(1,2,3)$, $(3,0,5)$, $(5,-2,7)$ are collinear.", "Yes"),
  q("specialist-maths", "Vectors in two and three dimensions", "Find the area of the triangle with vertices $A(0,0,0)$, $B(1,2,0)$, $C(3,1,4)$.", "√89/2"),
  q("specialist-maths", "Vectors in two and three dimensions", "Find the scalar resolute of $(2,3,6)$ in the direction $(1,2,2)$.", "20/3"),
  q("specialist-maths", "Vectors in two and three dimensions", "Find $k$ if $(1,k,2)$ is perpendicular to $(3,-2,5)$.", "k=13/2"),
  q("specialist-maths", "Differential equations", "Solve $\\frac{dy}{dx}=3y$, $y(0)=4$.", "y=4e^{3x}"),
  q("specialist-maths", "Differential equations", "Solve $\\frac{dy}{dx}=xy^2$, $y(0)=1$.", "y=1/(1-x^2/2)"),
  q("specialist-maths", "Integral calculus", "Find $\\int x\\ln x\\,dx$.", ["(x^2/2)ln x - x^2/4 + C"]),
  q("specialist-maths", "Integral calculus", "Find $\\int \\frac{1}{x^2+4}\\,dx$.", ["(1/2)tan^{-1}(x/2)+C"]),
  q("specialist-maths", "Differential calculus", "Find $\\frac{d}{dx}(\\tan^{-1}(3x))$.", "3/(1+9x^2)"),
  q("specialist-maths", "Integral calculus", "Evaluate $\\int_0^1 \\frac{2x}{x^2+1}\\,dx$.", "ln2"),
  q("specialist-maths", "Differential equations", "Find the general solution of $y''+4y=0$.", "y=Acos2x+Bsin2x"),
  q("specialist-maths", "Differential equations", "Solve $y''-3y'+2y=0$.", "y=Ae^x+Be^{2x}"),
  q("specialist-maths", "Differential equations", "Find the particular solution of $y''+y=0$, $y(0)=2$, $y'(0)=3$.", "y=2cos x+3sin x"),
  q("specialist-maths", "Integral calculus", "Find $\\int e^{2x}\\cos x\\,dx$.", ["(e^{2x}/5)(2cos x+sin x)+C"]),
  q("specialist-maths", "Kinematics", "A particle has position $x(t)=t^3-6t^2+9t$. Find when it is at rest.", "t=1,3"),
  q("specialist-maths", "Kinematics", "For $x(t)=t^3-6t^2+9t$, find acceleration at $t=3$.", "6"),
  q("specialist-maths", "Kinematics", "A particle has $a=6t-4$, $v=3$ at $t=0$. Find $v(t)$.", "v=3t^2-4t+3"),
  q("specialist-maths", "Kinematics", "If $v(t)=e^{-t}(2-t)$, find when the particle changes direction.", "t=2"),
  q("specialist-maths", "Kinematics", "A force $\\mathbf{F}=(3,4)$ moves an object through displacement $\\mathbf{s}=(5,-2)$. Find work done.", "7"),
  q("specialist-maths", "Kinematics", "A mass of 2 kg experiences force $(6,-8)$ N. Find acceleration.", "(3,-4) m/s^2"),
  q("specialist-maths", "Kinematics", "A projectile is launched with speed 20 m/s at $30^\\circ$. Find time of flight using $g=10$.", "2 s"),
  q("specialist-maths", "Kinematics", "For the projectile above ($u=20$, $\\theta=30^\\circ$, $g=10$), find maximum height.", "5 m"),
  q("specialist-maths", "Kinematics", "A particle moves in a circle of radius 4 with angular speed 3. Find speed and centripetal acceleration.", ["Speed 12, acceleration 36", "12, 36"]),
  q("specialist-maths", "Kinematics", "A particle has $\\mathbf{v}=(2t,3t^2)$. Find displacement from $t=0$ to $t=2$.", "(4,8)"),
  q("specialist-maths", "Integral calculus", "Find the exact value of $\\int_0^\\pi x\\sin x\\,dx$.", "π"),
  q("specialist-maths", "Functions, relations and graphs", "Write the Maclaurin polynomial for $e^x$ up to the $x^3$ term.", "1+x+x^2/2+x^3/6"),
  q("specialist-maths", "Functions, relations and graphs", "Find the first three non-zero terms of $\\sin(2x)$.", "2x-4x^3/3+4x^5/15"),
  q("specialist-maths", "Functions, relations and graphs", "Convert $x^2+y^2-4x+6y=12$ to centre-radius form.", "(x-2)^2+(y+3)^2=25"),
  q("specialist-maths", "Functions, relations and graphs", "Find the equation of the tangent to $x^2+y^2=25$ at $(3,4)$.", "3x+4y=25"),
  q("specialist-maths", "Functions, relations and graphs", "Find the eccentricity of $\\frac{x^2}{25}+\\frac{y^2}{9}=1$.", "4/5"),
  q("specialist-maths", "Functions, relations and graphs", "Find the foci of $\\frac{x^2}{25}+\\frac{y^2}{9}=1$.", "(±4,0)"),
  q("specialist-maths", "Functions, relations and graphs", "Find the asymptotes of $\\frac{x^2}{9}-\\frac{y^2}{16}=1$.", "y=±(4/3)x"),
  q("specialist-maths", "Differential equations", "Solve $\\frac{d^2y}{dx^2}=12x$, $y(0)=1$, $y'(0)=2$.", "y=2x^3+2x+1"),
  q("specialist-maths", "Lines and planes in 3D", "Find the distance between skew lines $\\mathbf{r}=(0,0,0)+s(1,1,0)$ and $\\mathbf{r}=(0,0,1)+t(1,0,1)$.", "1/√3"),
];

const general = [
  q("general-maths", "Data analysis", "A dataset has mean 72 and standard deviation 8. Find the z-score for 90.", "2.25"),
  q("general-maths", "Data analysis", "The least-squares line is $y=4.2x+15$. Predict $y$ when $x=12$.", "65.4"),
  q("general-maths", "Data analysis", "If $r=-0.84$, describe the association.", "Strong negative linear association"),
  q("general-maths", "Data analysis", "A student's residual is $-6$. Interpret it.", "Actual value is 6 below predicted value"),
  q("general-maths", "Data analysis", "If $Q_1=42$, $Q_3=68$, find the upper outlier fence.", "107"),
  q("general-maths", "Data analysis", "For the same data ($Q_1=42$, $Q_3=68$), find the lower outlier fence.", "3"),
  q("general-maths", "Data analysis", "A seasonal index is 1.18 and deseasonalised value is 240. Find actual value.", "283.2"),
  q("general-maths", "Data analysis", "A time series has trend line $T=3.5t+80$. If seasonal index is 0.92, estimate value at $t=20$.", "138"),
  q("general-maths", "Data analysis", "If $r=0.7$, find $r^2$ and interpret it.", ["0.49", "49% of variation explained"]),
  q("general-maths", "Data analysis", "A data point has actual 124, predicted 131. Find residual.", "-7"),
  q("general-maths", "Recursion and financial modelling", "A loan of \\$20\\,000 has monthly interest 0.5% and monthly repayment \\$450. Write the recurrence.", "B_{n+1}=1.005B_n-450, B_0=20000"),
  q("general-maths", "Recursion and financial modelling", "For $B_{n+1}=1.005B_n-450$, $B_0=20000$, find $B_1$.", "$19650"),
  q("general-maths", "Recursion and financial modelling", "An investment follows $A_{n+1}=1.04A_n+500$, $A_0=2000$. Find $A_2$.", "$3123.20"),
  q("general-maths", "Recursion and financial modelling", "Find the future value of \\$6000 at 5% p.a. compound interest for 4 years.", "$7293.04"),
  q("general-maths", "Recursion and financial modelling", "Find the effective annual interest rate for 1.5% per quarter.", "6.14%"),
  q("general-maths", "Recursion and financial modelling", "A perpetuity pays \\$1200 annually at 6%. Find present value.", "$20000"),
  q("general-maths", "Recursion and financial modelling", "A reducing-balance loan has $B_{n+1}=1.01B_n-300$, $B_0=5000$. Find $B_3$.", "$4212.98"),
  q("general-maths", "Recursion and financial modelling", "An annuity earns 0.4% monthly. Deposits of \\$250 monthly for 24 months. Find future value (approx.).", "$6288.36"),
  q("general-maths", "Recursion and financial modelling", "A car depreciates 18% p.a. from \\$35\\,000. Find value after 5 years (approx.).", "$12970.66"),
  q("general-maths", "Recursion and financial modelling", "An asset depreciates linearly from \\$48\\,000 to \\$9000 over 6 years. Find annual depreciation.", "$6500 per year"),
  q("general-maths", "Matrices", "If $A=\\begin{pmatrix}2&1\\\\3&4\\end{pmatrix}$, find $\\det A$.", "5"),
  q("general-maths", "Matrices", "Find $A^{-1}$ for $A=\\begin{pmatrix}2&1\\\\3&4\\end{pmatrix}$.", "(1/5)[[4,-1],[-3,2]]"),
  q("general-maths", "Matrices", "Solve $\\begin{pmatrix}2&1\\\\3&4\\end{pmatrix}\\begin{pmatrix}x\\\\y\\end{pmatrix}=\\begin{pmatrix}7\\\\18\\end{pmatrix}$.", "x=2, y=3"),
  q("general-maths", "Matrices", "If $T=\\begin{pmatrix}0.8&0.2\\\\0.3&0.7\\end{pmatrix}$ and initial state $\\begin{pmatrix}100\\\\50\\end{pmatrix}$, find next state.", "(95,55)"),
  q("general-maths", "Matrices", "A transition matrix has columns summing to 1. What type of matrix is it?", "Stochastic matrix"),
  q("general-maths", "Matrices", "Find the steady state for $T=\\begin{pmatrix}0.9&0.1\\\\0.2&0.8\\end{pmatrix}$.", "(2/3,1/3)"),
  q("general-maths", "Matrices", "If $A$ is $3\\times 2$ and $B$ is $2\\times 4$, state the order of $AB$.", "3×4"),
  q("general-maths", "Matrices", "Find $AB$ where $A=\\begin{pmatrix}1&2\\\\0&3\\end{pmatrix}$, $B=\\begin{pmatrix}4&2\\\\-1&5\\end{pmatrix}$.", "[[8,12],[9,15]]"),
  q("general-maths", "Matrices", "Find the image of $(3,4)$ under $\\begin{pmatrix}0&1\\\\-1&0\\end{pmatrix}$.", "(-4,3)"),
  q("general-maths", "Matrices", "A matrix transformation sends $(x,y)$ to $(2x+y,x-y)$. Give the matrix.", "[[2,1],[1,-1]]"),
  q("general-maths", "Networks and decision mathematics", "A connected planar graph has 8 vertices and 12 edges. Find the number of faces.", "6"),
  q("general-maths", "Networks and decision mathematics", "A tree has 15 vertices. How many edges?", "14"),
  q("general-maths", "Networks and decision mathematics", "A connected graph has exactly two odd vertices. What does this imply?", "Euler trail but not Euler circuit"),
  q("general-maths", "Networks and decision mathematics", "A connected graph has all vertices even. What does this imply?", "Euler circuit"),
  q("general-maths", "Networks and decision mathematics", "A minimum spanning tree connects 9 vertices. How many edges?", "8"),
  q("general-maths", "Networks and decision mathematics", "Shortest path $A\\to F$ is $A$–$C$–$D$–$F$ with weights 5, 7, 4. Find total length.", "16"),
  q("general-maths", "Networks and decision mathematics", "Critical path duration is 31 days. A non-critical activity has float 6 and is delayed 4 days. Effect on project duration?", "No change"),
  q("general-maths", "Networks and decision mathematics", "Earliest start is 8, latest start is 13. Find float.", "5"),
  q("general-maths", "Networks and decision mathematics", "Seven applicants, seven jobs; matching assigns 6. Maximal or complete?", "Maximal but not complete"),
  q("general-maths", "Networks and decision mathematics", "A Hamiltonian cycle visits 10 vertices. How many edges in the cycle?", "10"),
  q("general-maths", "Data analysis", "A boxplot has median 62, $Q_1=50$, $Q_3=74$. Find IQR.", "24"),
  q("general-maths", "Data analysis", "A residual plot shows a curved pattern. What does this suggest?", "Linear model may be inappropriate"),
  q("general-maths", "Data analysis", "If $\\log_{10}(y)$ vs $x$ is linear, what model may fit original data?", "Exponential model"),
  q("general-maths", "Recursion and financial modelling", "An arithmetic sequence has $u_4=19$, $u_{10}=43$. Find $u_1$.", "7"),
  q("general-maths", "Recursion and financial modelling", "A geometric sequence has $u_2=12$, $u_5=324$. Find common ratio.", "3"),
  q("general-maths", "Networks and decision mathematics", "A network has vertex degrees 2,2,3,3,4,4. Can it have an Euler circuit?", "No, two odd vertices"),
  q("general-maths", "Networks and decision mathematics", "A flow network has cuts of capacities 18, 22, 15, 19. Maximum possible flow?", "At most 15"),
  q("general-maths", "Recursion and financial modelling", "A recurrence is $A_{n+1}=0.85A_n+120$. Find steady-state value.", "800"),
  q("general-maths", "Recursion and financial modelling", "Loan: $B_{n+1}=1.006B_n-500$. Largest $B_0$ so balance does not increase after first payment?", "$83333.33"),
  q("general-maths", "Data analysis", "Seasonal index for Q4 is 1.32. Actual sales 924. Find deseasonalised sales.", "700"),
];

const questions = [...methods, ...specialist, ...general];

if (questions.length !== 150) {
  console.error(`Expected 150 questions, got ${questions.length}`);
  process.exit(1);
}

const outPath = resolve("imports/admin-bulk-hard-maths-150.json");
writeFileSync(outPath, JSON.stringify({ questions }, null, 2), "utf8");
console.log(`Wrote ${questions.length} questions → ${outPath}`);

if (!adminKey) {
  console.log("Set ADMIN_KEY to import into the database.");
  process.exit(0);
}

const res = await fetch(`${base}/api/admin/questions/bulk`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  },
  body: JSON.stringify({ questions }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Bulk import failed:", res.status, json);
  process.exit(1);
}

console.log(`Imported ${json.imported ?? 0} question(s) into the database.`);
if (json.errors?.length) {
  console.error("Errors (first 5):", json.errors.slice(0, 5));
  process.exit(1);
}

// Verify counts in DB via admin list
const listRes = await fetch(`${base}/api/admin/questions`, {
  headers: { "X-Admin-Key": adminKey },
  signal: AbortSignal.timeout(30_000),
});
const list = await listRes.json();
if (listRes.ok && Array.isArray(list)) {
  for (const sid of ["methods", "specialist-maths", "general-maths"]) {
    const n = list.filter((r) => String(r.subjectId) === sid).length;
    console.log(`  ${sid}: ${n} total in admin`);
  }
}
