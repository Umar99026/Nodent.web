/**
 * Fix demo general-maths multipart questions: descriptive part labels + context-only stems.
 *
 *   node scripts/fix-general-demo-multipart-labels.mjs           # dry-run
 *   node scripts/fix-general-demo-multipart-labels.mjs --apply
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const JSON_PATH = resolve(process.cwd(), "imports/general-demo-50-hard-vce-style.json");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim();
}

/** Match by unique substring in question stem. */
const PATCHES = [
  {
    match: "following ages of participants were recorded",
    question:
      "In a survey, the following ages of participants were recorded: $22, 25, 25, 30, 30, 30, 35, 40, 45$.",
    labels: ["Calculate the variance.", "Calculate the standard deviation."],
  },
  {
    match: "For the data set $2, 4, 4, 4, 5, 5, 7, 9$, calculate the following",
    question: "For the data set $2, 4, 4, 4, 5, 5, 7, 9$,",
    labels: ["Find the median.", "Find the range.", "Find the interquartile range (IQR)."],
  },
  {
    match: "Calculate the first quartile, the third quartile",
    question:
      "A dataset has the following values: $5, 7, 9, 10, 12, 14, 16, 18, 20$.",
    labels: ["Find the first quartile ($Q_1$).", "Find the third quartile ($Q_3$).", "Find the interquartile range (IQR)."],
  },
  {
    match: "hours studied and corresponding test scores",
    question:
      "A researcher collects data on the number of hours studied and corresponding test scores for 10 students. The data is as follows: $(1, 50)$, $(2, 55)$, $(3, 65)$, $(4, 70)$, $(5, 75)$, $(6, 80)$, $(7, 85)$, $(8, 90)$, $(9, 95)$, $(10, 100)$.",
    labels: [
      "Calculate the correlation coefficient $r$.",
      "Interpret the value of $r$ in context.",
    ],
  },
  {
    match: "dataset consists of the following scores: $56, 67",
    question: "A dataset consists of the following scores: $56, 67, 67, 70, 75, 80, 85, 90, 95$.",
    labels: ["Calculate the variance.", "Calculate the standard deviation."],
  },
  {
    match: "recurrence relation $R_0=25000$, $R_{n+1}=1.08R_n-200$",
    question:
      "A business invests $25000$ with a return defined by the recurrence relation $R_0=25000$, $R_{n+1}=1.08R_n-200$.",
    labels: [
      "Find the value of the investment after $4$ years.",
      "Find the total return over this period.",
    ],
  },
  {
    match: "loan balance is given by the recurrence relation $L_{n+1} = 1.005833L_n - 400$",
    question:
      "A loan amounting to $L_0 = 30000$ is taken at an annual interest rate of $7\\%$, with monthly repayments of $400$. The loan balance is given by the recurrence relation $L_{n+1} = 1.005833L_n - 400$, where $1.005833$ is the monthly interest factor.",
    labels: [
      "Find the loan balance after the first month.",
      "Find the total amount paid after $6$ months.",
      "Find the remaining loan balance after $6$ months.",
    ],
  },
  {
    match: "investment is increased by an additional $1000$ at the end of each year",
    question:
      "An investment of $10000$ earns interest at $5\\%$ per annum compounded quarterly. The investment is increased by an additional $1000$ at the end of each year.",
    labels: [
      "Find the total amount after $3$ years.",
      "Find the interest earned over $3$ years.",
    ],
  },
  {
    match: "monthly repayment of $1500$ and an interest rate of $0.5\\%$ per month. Find the loan balance after $4$ months",
    question:
      "A loan of $L_0=100000$ is taken with a monthly repayment of $1500$ and an interest rate of $0.5\\%$ per month. The balance follows $L_{n+1}=1.005L_n-1500$.",
    labels: ["Find the loan balance after $4$ months."],
    acceptedAnswers: ["94613.00", "$94613.00$"],
    marks: 2,
  },
  {
    match: "recurrence relation $P_{n+1} = 1.08P_n - 15000$",
    question:
      "A company invests $200{,}000$ in a project that generates a profit according to the recurrence relation $P_{n+1} = 1.08P_n - 15000$.",
    labels: [
      "Find the profit after the first year.",
      "Find the profit after the second year.",
      "Find the total profit generated after two years.",
    ],
  },
  {
    match: "Perform the following operations: a) Find $AB$",
    question:
      "Let $A=\\begin{bmatrix}1&2&3\\\\0&1&4\\\\5&6&0\\end{bmatrix}$ and $B=\\begin{bmatrix}1&0&2\\\\0&1&0\\\\1&1&1\\end{bmatrix}$.",
    labels: [
      "Find $AB$.",
      "Find the ranks of $A$ and $B$.",
      "State whether $A$ is invertible, with a reason.",
    ],
  },
  {
    match: "Find $AB$ and then determine if $AB$ is invertible",
    question:
      "Let $A=\\begin{bmatrix}1&2&3\\\\0&1&4\\\\5&6&0\\end{bmatrix}$ and $B=\\begin{bmatrix}1&0&2\\\\1&1&1\\\\0&1&0\\end{bmatrix}$.",
    labels: ["Find $AB$.", "Find $\\det(AB)$."],
  },
  {
    match: "Consider the matrices $E=\\begin{bmatrix}3&1",
    question:
      "Consider the matrices $E=\\begin{bmatrix}3&1\\\\2&4\\end{bmatrix}$ and $F=\\begin{bmatrix}1&2\\\\3&0\\end{bmatrix}$.",
    labels: ["Find $EF$.", "Find $E^{-1}F$."],
  },
  {
    match: "calculate the following: a) Find $AB$; b) Find $\\det(A)$",
    question:
      "Given the matrices $A=\\begin{bmatrix}1&2&3\\\\4&5&6\\\\7&8&9\\end{bmatrix}$ and $B=\\begin{bmatrix}1&0\\\\0&1\\\\1&1\\end{bmatrix}$,",
    labels: [
      "Find $AB$.",
      "Find $\\det(A)$.",
      "State whether $A$ is invertible.",
    ],
  },
  {
    match: "calculate the following: a) Find $AB$; b) Find the transpose of $AB$",
    question:
      "Given matrices $A=\\begin{bmatrix}1&2&3\\\\4&5&6\\end{bmatrix}$ and $B=\\begin{bmatrix}7&8\\\\9&10\\\\11&12\\end{bmatrix}$,",
    labels: [
      "Find $AB$.",
      "Find $(AB)^T$.",
      "Find $\\det\\big((AB)^T\\big)$.",
    ],
  },
  {
    match: "Determine the following: a) the number of edges in the network",
    question:
      "A network has 5 vertices with the following connections: Vertex A connects to B, C; Vertex B connects to C, D; Vertex C connects to D, E; Vertex D connects to A; Vertex E connects to A.",
    labels: ["Find the number of edges in the network.", "State the degree of each vertex."],
  },
  {
    match: "Find the minimum spanning tree of this network using Prim's algorithm",
    question:
      "A network consists of $6$ vertices connected by $9$ edges with the following weights: $(A, B)=3$, $(A, C)=5$, $(B, C)=2$, $(B, D)=4$, $(C, E)=6$, $(D, E)=1$, $(D, F)=2$, $(E, F)=4$, $(C, F)=3$.",
    labels: [
      "List the edges in a minimum spanning tree (Prim's algorithm from $A$).",
      "Find the total weight of the minimum spanning tree.",
    ],
  },
  {
    match: "Determine the minimum transportation cost and the optimal assignment",
    question:
      "A company needs to transport goods from 4 warehouses to 3 stores. The costs of transporting goods from each warehouse to each store are given in the matrix $\\begin{bmatrix} 4 & 6 & 8 \\\\ 2 & 3 & 7 \\\\ 5 & 2 & 4 \\\\ 7 & 5 & 6 \\end{bmatrix}$.",
    labels: [
      "Find the minimum transportation cost.",
      "State the optimal assignment of warehouses to stores.",
    ],
  },
  {
    match: "determine the following: a) Is the network connected",
    question:
      "A transport network consists of $6$ cities connected by roads. The degrees of cities $A$, $B$, $C$, $D$, $E$, and $F$ are $3$, $2$, $2$, $1$, $1$, and $0$ respectively.",
    labels: [
      "Is the network connected?",
      "Find the maximum number of edges in a simple graph with $6$ vertices.",
    ],
  },
  {
    match: "Represent this project as a directed graph, then perform a topological sort",
    question:
      "A project has 6 tasks with the following dependencies: Task A must be completed before Task B and Task C. Task B must be completed before Task D, and Task C must be completed before Task D and Task E. Task D must be completed before Task F. Task durations are: A: 2 days, B: 3 days, C: 1 day, D: 4 days, E: 2 days, F: 1 day.",
    labels: [
      "Give a topological sort of the tasks.",
      "Find the total duration of the critical path.",
    ],
  },
];

function isBarePartLabel(label) {
  return /^[a-z]\)?$/i.test(String(label ?? "").trim());
}

function applyPatch(q, patch) {
  const labels = patch.labels ?? [];
  const parts = (q.answerParts ?? []).slice(0, labels.length);
  if (!labels.length || !parts.length) return q;
  const next = { ...q, question: patch.question ?? q.question };
  if (patch.acceptedAnswers) next.acceptedAnswers = patch.acceptedAnswers;
  else next.acceptedAnswers = (q.acceptedAnswers ?? []).slice(0, labels.length);
  if (patch.marks != null) next.marks = patch.marks;
  else if (parts.length) {
    next.marks = parts.reduce((s, p, i) => s + (patch.marksPerPart?.[i] ?? p.marks ?? 1), 0);
  }
  next.answerParts = parts.map((p, i) => ({
    ...p,
    label: labels[i],
    placeholder: p.placeholder?.trim() ? p.placeholder : "Type your answer…",
  }));
  return next;
}

const payload = JSON.parse(readFileSync(JSON_PATH, "utf8"));
const questions = payload.questions ?? [];
let fixed = 0;

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  if (!q.answerParts?.length) continue;
  const patch = PATCHES.find((p) => String(q.question ?? "").includes(p.match));
  if (!patch) {
    console.warn("No patch for:", String(q.question).slice(0, 80));
    continue;
  }
  questions[i] = applyPatch(q, patch);
  fixed++;
  console.log("Fixed:", patch.match.slice(0, 60));
}

writeFileSync(JSON_PATH, JSON.stringify({ questions }, null, 2));
console.log(`\nUpdated ${fixed} question(s) in ${JSON_PATH}`);

if (!APPLY) {
  console.log("Dry run — pass --apply to update demo rows in DB.");
  process.exit(0);
}

const sql = neon(loadDatabaseUrl());
const demoRows = await sql`
  SELECT id, question, answer_parts_json, accepted_answers, marks
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
`;

let dbUpdated = 0;
for (const row of demoRows) {
  const patch = PATCHES.find((p) => String(row.question ?? "").includes(p.match));
  if (!patch) continue;
  const q = applyPatch(
    {
      question: row.question,
      answerParts: row.answer_parts_json ? JSON.parse(row.answer_parts_json) : [],
      acceptedAnswers: row.accepted_answers ? JSON.parse(row.accepted_answers) : [],
      marks: row.marks,
    },
    patch,
  );
  await sql`
    UPDATE custom_questions
    SET
      question = ${q.question},
      answer_parts_json = ${JSON.stringify(q.answerParts)},
      accepted_answers = ${JSON.stringify(q.acceptedAnswers)},
      marks = ${q.marks ?? row.marks}
    WHERE id = ${row.id}
  `;
  dbUpdated++;
}

console.log(`Updated ${dbUpdated} demo row(s) in database.`);
