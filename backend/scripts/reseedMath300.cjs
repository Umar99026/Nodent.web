const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const { neon } = require("@neondatabase/serverless");

const TARGET_SUBJECTS = ["methods", "general-maths", "specialist-maths"];

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const devVars = fs.readFileSync(path.resolve(__dirname, "..", ".dev.vars"), "utf8");
  const match = devVars.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in backend/.dev.vars");
  return match[1].trim();
}

function roundTo(value, dp) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function fmt(value, dp = 3) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-12) return String(Math.round(value));
  return roundTo(value, dp).toFixed(dp);
}

function normalCdf(z) {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

function makeQuestion(subjectId, topic, question, answers, marks = 2) {
  const accepted = (Array.isArray(answers) ? answers : [answers])
    .map((x) => String(x).trim())
    .filter(Boolean);
  if (!accepted.length) throw new Error(`No answer for question: ${question}`);
  return {
    subject_id: subjectId,
    type: "short_answer",
    topic,
    question,
    image_urls: null,
    options: null,
    answer: accepted[0],
    accepted_answers: JSON.stringify(accepted),
    guidance: null,
    passage: null,
    marks,
    created_at: new Date().toISOString(),
  };
}

function generateMethods() {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const a = 2 + i;
    const b = 0.15 + i * 0.02;
    const c = 6 + i;
    const x0 = 1 + i * 0.2;
    const deriv = a * b * Math.exp(b * x0) + c / x0;
    out.push(
      makeQuestion(
        "methods",
        "Advanced Differentiation",
        `Let f(x)=${a}e^(${fmt(b, 2)}x)+${c}ln(x). Find f'(${fmt(x0, 1)}) to 3 d.p.`,
        fmt(deriv, 3),
        3,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const a = 2 + i;
    const b = 1 + i;
    const val = (Math.exp(a) - 1) / a - b / 2;
    out.push(
      makeQuestion(
        "methods",
        "Definite Integrals",
        `Evaluate ∫(0 to 1) (e^(${a}x)-${b}x) dx. Give your answer to 4 d.p.`,
        fmt(val, 4),
        3,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const n = 18 + i;
    const p = 0.2 + i * 0.015;
    const variance = n * p * (1 - p);
    out.push(
      makeQuestion(
        "methods",
        "Binomial Distribution",
        `If X~Bi(${n},${fmt(p, 3)}), find Var(X) to 3 d.p.`,
        fmt(variance, 3),
        2,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const pHat = 0.35 + i * 0.012;
    const n = 120 + i * 10;
    const se = Math.sqrt((pHat * (1 - pHat)) / n);
    out.push(
      makeQuestion(
        "methods",
        "Sampling Distributions",
        `For sample proportion p-hat=${fmt(pHat, 3)} with n=${n}, find the standard error to 3 d.p.`,
        fmt(se, 3),
        2,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const a = 2 + i;
    const b = -(7 + i);
    const c = 6 + i;
    const xv = -b / (2 * a);
    const yv = a * xv * xv + b * xv + c;
    out.push(
      makeQuestion(
        "methods",
        "Quadratic Optimisation",
        `For f(x)=${a}x^2${b >= 0 ? "+" : ""}${b}x+${c}, find the minimum value to 3 d.p.`,
        fmt(yv, 3),
        2,
      ),
    );
  }
  return out;
}

function generateGeneralMaths() {
  const out = [];
  for (let i = 1; i <= 25; i++) {
    const bal = 80000 + i * 2100;
    const annual = 4.6 + (i % 6) * 0.3;
    const repay = 1300 + i * 23;
    const interest = bal * (annual / 100 / 12);
    out.push(
      makeQuestion(
        "general-maths",
        "Finance",
        `A reducing-balance loan has starting balance $${bal}, annual rate ${fmt(annual, 1)}% compounding monthly, and monthly repayment $${repay}. Find month-1 interest.`,
        fmt(interest, 2),
        2,
      ),
    );
  }
  for (let i = 1; i <= 25; i++) {
    const L0 = 42000 + i * 1700;
    const r = 1.0038 + i * 0.00025;
    const p = 620 + i * 9;
    let L = L0;
    for (let k = 0; k < 52; k++) L = r * L - p;
    out.push(
      makeQuestion(
        "general-maths",
        "Recurrence Loans",
        `A loan follows L0=${L0}, L(n+1)=${fmt(r, 6)}*L(n)-${p}. Determine L52 to 2 d.p.`,
        fmt(L, 2),
        3,
      ),
    );
  }
  for (let i = 1; i <= 25; i++) {
    const a = 880000 + i * 14500;
    const b = -38000 - i * 900;
    const d = 6 + (i % 9);
    const predicted = a + b * d;
    out.push(
      makeQuestion(
        "general-maths",
        "Regression",
        `A least-squares model is price=${a}+(${b})*distance. Find the predicted price for distance ${d} km.`,
        fmt(predicted, 2),
        2,
      ),
    );
  }
  for (let i = 1; i <= 25; i++) {
    const p1 = 18 + (i % 7);
    const p2 = 20 + (i % 8);
    const p3 = 22 + (i % 9);
    const arr = [p1, p2, p3];
    const idx = arr.indexOf(Math.max(...arr));
    arr[idx] -= 2;
    out.push(
      makeQuestion(
        "general-maths",
        "Networks",
        `A project has start-to-finish path lengths ${p1}, ${p2}, ${p3} days. If one critical activity is crashed by 2 days, find the new minimum project duration.`,
        fmt(Math.max(...arr), 0),
        2,
      ),
    );
  }
  return out;
}

function generateSpecialist() {
  const out = [];
  for (let i = 1; i <= 20; i++) {
    const a = 3 + i;
    const b = 1 + (i % 8);
    const den = a * a + b * b;
    const p = a / den;
    const q = -b / den;
    const ans = `${fmt(p, 4)}${q >= 0 ? "+" : ""}${fmt(q, 4)}i`;
    out.push(
      makeQuestion(
        "specialist-maths",
        "Complex Numbers",
        `Express 1/(${a}+${b}i) in the form p+qi (to 4 d.p.).`,
        ans,
        3,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const r = 2 + i * 0.4;
    const th = 0.35 + i * 0.07;
    const reZ2 = r * r * Math.cos(2 * th);
    out.push(
      makeQuestion(
        "specialist-maths",
        "Complex Polar Form",
        `Let z=${fmt(r, 3)}cis(${fmt(th, 3)}). Find Re(z^2) to 3 d.p.`,
        fmt(reZ2, 3),
        3,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const a1 = 1 + i;
    const a2 = -2 + (i % 6);
    const a3 = 3 + (i % 5);
    const b1 = 2 + (i % 7);
    const b2 = 1 + i;
    const b3 = -1 - (i % 4);
    const dot = a1 * b1 + a2 * b2 + a3 * b3;
    out.push(
      makeQuestion(
        "specialist-maths",
        "Vectors",
        `Find a·b for a=(${a1},${a2},${a3}) and b=(${b1},${b2},${b3}).`,
        fmt(dot, 0),
        2,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const u = 10 + i;
    const acc = -1.5 - (i % 6) * 0.4;
    const tStop = -u / acc;
    out.push(
      makeQuestion(
        "specialist-maths",
        "Kinematics",
        `A particle has u=${u} m/s and constant acceleration ${fmt(acc, 1)} m/s^2. Find time to stop.`,
        fmt(tStop, 3),
        2,
      ),
    );
  }
  for (let i = 1; i <= 20; i++) {
    const k = 2 + (i % 8);
    const y0 = 3 + i;
    const y2 = y0 * Math.exp(-2 * k);
    out.push(
      makeQuestion(
        "specialist-maths",
        "Differential Equations",
        `Solve dy/dx + ${k}y = 0 with y(0)=${y0}, then find y(2).`,
        fmt(y2, 4),
        3,
      ),
    );
  }
  return out;
}

function runSqlite(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function main() {
  const methods = generateMethods();
  const general = generateGeneralMaths();
  const specialist = generateSpecialist();
  const allRows = [...methods, ...general, ...specialist];
  if (methods.length !== 100 || general.length !== 100 || specialist.length !== 100) {
    throw new Error("Generation count mismatch.");
  }

  // Local SQLite
  const sqlitePath = path.resolve(__dirname, "..", "..", "nodent.db");
  const sqliteDb = new sqlite3.Database(sqlitePath);
  await runSqlite(sqliteDb, "BEGIN TRANSACTION");
  try {
    await runSqlite(
      sqliteDb,
      `DELETE FROM custom_questions WHERE subject_id IN (${TARGET_SUBJECTS.map(() => "?").join(",")})`,
      TARGET_SUBJECTS,
    );
    const insertSql = `INSERT INTO custom_questions
      (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    for (const r of allRows) {
      await runSqlite(sqliteDb, insertSql, [
        r.subject_id,
        r.type,
        r.topic,
        r.question,
        r.image_urls,
        r.options,
        r.answer,
        r.accepted_answers,
        r.guidance,
        r.passage,
        r.marks,
        r.created_at,
      ]);
    }
    await runSqlite(sqliteDb, "COMMIT");
  } catch (e) {
    await runSqlite(sqliteDb, "ROLLBACK");
    sqliteDb.close();
    throw e;
  }
  sqliteDb.close();

  // Neon
  const sql = neon(readDatabaseUrl());
  await sql`begin`;
  try {
    await sql`delete from custom_questions where subject_id in (${TARGET_SUBJECTS[0]}, ${TARGET_SUBJECTS[1]}, ${TARGET_SUBJECTS[2]})`;
    for (const r of allRows) {
      await sql`
        insert into custom_questions
          (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
        values
          (${r.subject_id}, ${r.type}, ${r.topic}, ${r.question}, ${r.image_urls}, ${r.options}, ${r.answer}, ${r.accepted_answers}, ${r.guidance}, ${r.passage}, ${r.marks}, ${r.created_at})
      `;
    }
    await sql`commit`;
  } catch (e) {
    await sql`rollback`;
    throw e;
  }

  const counts = await sql`
    select subject_id, count(*)::int as c
    from custom_questions
    where subject_id in (${TARGET_SUBJECTS[0]}, ${TARGET_SUBJECTS[1]}, ${TARGET_SUBJECTS[2]})
    group by subject_id
    order by subject_id
  `;
  console.log("Reseed complete:", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
