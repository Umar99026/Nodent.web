const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("nodent.db");

function parseJsonLoose(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    try {
      const fixed = t
        .replace(/[\u201c\u201d\u201e]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function normalizeAnswerEntry(value) {
  if (typeof value === "string") {
    const t = value.trim();
    if (!t || /object\s*object/i.test(t)) return "";
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      const parsed = parseJsonLoose(t);
      if (parsed != null) return normalizeAnswerEntry(parsed);
    }
    return t;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const out = value.map(normalizeAnswerEntry).filter(Boolean);
    return out[0] ?? "";
  }
  if (value && typeof value === "object") {
    const row = value;
    const candidate = row.answer ?? row.value ?? row.text ?? row.label;
    return normalizeAnswerEntry(candidate);
  }
  return "";
}

function parseFlexibleArray(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(normalizeAnswerEntry).filter(Boolean);
  const parsed = parseJsonLoose(raw);
  if (Array.isArray(parsed)) return parsed.map(normalizeAnswerEntry).filter(Boolean);
  const t = String(raw).trim();
  if (!t) return [];
  const candidate =
    t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1).trim() : t;
  const parts = candidate.includes("\n")
    ? candidate.split("\n")
    : candidate.includes("|")
      ? candidate.split("|")
      : candidate.includes(";")
        ? candidate.split(";")
        : candidate.includes(",")
          ? candidate.split(",")
          : [candidate];
  return parts
    .map((x) => normalizeAnswerEntry(String(x).trim().replace(/^["'`]+|["'`]+$/g, "")))
    .filter(Boolean);
}

function roundTo(value, dp) {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function formatNumeric(value, dp = 2) {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : roundTo(value, dp).toFixed(dp);
}

function computeExpectedAnswersFromQuestionText(questionRaw) {
  const question = String(questionRaw || "").replace(/\s+/g, " ").trim();
  if (!question) return [];

  const leastSquares = question.match(
    /price\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\*?\s*distance[\s\S]*?(\d+(?:\.\d+)?)\s*km[\s\S]*?sold\s*for\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (leastSquares) {
    const a = Number(leastSquares[1]);
    const b = Number(leastSquares[2]);
    const d = Number(leastSquares[3]);
    const sold = Number(leastSquares[4]);
    const predicted = a + b * d;
    const residual = sold - predicted;
    return [
      formatNumeric(predicted, 2),
      formatNumeric(residual, 2),
      residual >= 0 ? "under-predicted" : "over-predicted",
    ];
  }

  const weeklyLoan = question.match(
    /L\s*0\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,?\s*L\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\*?\s*L\s*\(\s*n\s*\)\s*-\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (weeklyLoan && /effective annual rate/i.test(question) && /L\s*52/i.test(question)) {
    const L0 = Number(weeklyLoan[1]);
    const r = Number(weeklyLoan[2]);
    const p = Number(weeklyLoan[3]);
    let L = L0;
    for (let i = 0; i < 52; i++) L = r * L - p;
    return [formatNumeric((r ** 52 - 1) * 100, 2), formatNumeric(L, 2)];
  }

  const paths = question.match(
    /path lengths:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (paths && /critical path length/i.test(question) && /crashed by 2 days/i.test(question)) {
    const values = [Number(paths[1]), Number(paths[2]), Number(paths[3])];
    const critical = Math.max(...values);
    const idx = values.indexOf(critical);
    const afterCrash = [...values];
    afterCrash[idx] -= 2;
    return [formatNumeric(critical, 0), formatNumeric(Math.max(...afterCrash), 0)];
  }

  const reducing = question.match(
    /starting balance\s*\$?\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?annual rate\s*([+-]?\d+(?:\.\d+)?)%\s*compounding monthly[\s\S]*?monthly repayment\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (reducing && /month-?1 interest/i.test(question) && /new balance/i.test(question)) {
    const balance = Number(reducing[1]);
    const annualPct = Number(reducing[2]);
    const repayment = Number(reducing[3]);
    const interest = balance * (annualPct / 100 / 12);
    return [formatNumeric(interest, 2), formatNumeric(balance + interest - repayment, 2)];
  }

  const particle = question.match(
    /initial velocity\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?acceleration\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?after\s*([+-]?\d+(?:\.\d+)?)\s*s/i,
  );
  if (particle && /displacement/i.test(question) && /reversed direction/i.test(question)) {
    const u = Number(particle[1]);
    const a = Number(particle[2]);
    const t = Number(particle[3]);
    const v = u + a * t;
    const s = u * t + 0.5 * a * t * t;
    const reversed = u !== 0 && Math.sign(u) !== Math.sign(v) ? "Yes" : "No";
    return [formatNumeric(v, 2), formatNumeric(s, 2), reversed];
  }

  const quadratic = question.match(
    /g\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\(\s*x\s*-\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\^?\s*2\s*\+\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?g\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)[\s\S]*?minimum value/i,
  );
  if (quadratic) {
    const a = Number(quadratic[1]);
    const h = Number(quadratic[2]);
    const k = Number(quadratic[3]);
    const x = Number(quadratic[4]);
    return [formatNumeric(a * (x - h) ** 2 + k, 2), formatNumeric(k, 2)];
  }

  const quadraticStd = question.match(
    /f\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*x\s*\^?\s*2\s*([+-])\s*(\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i,
  );
  if (quadraticStd && /axis of symmetry/i.test(question) && /minimum value/i.test(question)) {
    const a = Number(quadraticStd[1]);
    const b = Number(quadraticStd[3]) * (quadraticStd[2] === "-" ? -1 : 1);
    const c = Number(quadraticStd[5]) * (quadraticStd[4] === "-" ? -1 : 1);
    if (a !== 0) {
      const xVertex = -b / (2 * a);
      const yVertex = a * xVertex * xVertex + b * xVertex + c;
      return [formatNumeric(xVertex, 2), formatNumeric(yVertex, 2), formatNumeric(xVertex, 2)];
    }
  }

  const complexReciprocal = question.match(
    /express\s*1\s*\/\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*i\s*\)\s*in\s*the\s*form\s*p\s*\+\s*q\s*i/i,
  );
  if (complexReciprocal) {
    const a = Number(complexReciprocal[1]);
    const sign = complexReciprocal[2] === "-" ? -1 : 1;
    const b = Number(complexReciprocal[3]) * sign;
    const den = a * a + b * b;
    if (den !== 0) {
      const p = a / den;
      const q = -b / den;
      const qSign = q >= 0 ? "+" : "-";
      const qAbs = Math.abs(q);
      const decimal = `${formatNumeric(p, 4)}${qSign}${formatNumeric(qAbs, 4)}i`;
      const ai = Number.isInteger(a);
      const bi = Number.isInteger(Math.abs(b));
      const di = Number.isInteger(den);
      if (ai && bi && di) {
        const exact = `${a}/${den}${b >= 0 ? "-" : "+"}${Math.abs(b)}/${den}i`;
        return [exact, decimal];
      }
      return [decimal];
    }
  }

  return [];
}

db.all(
  "SELECT id, type, answer, question, accepted_answers FROM custom_questions ORDER BY id ASC",
  (err, rows) => {
    if (err) {
      console.error(err);
      process.exitCode = 1;
      db.close();
      return;
    }

    let updated = 0;
    let untouched = 0;
    let unresolved = 0;
    const updates = [];

    for (const row of rows) {
      const type = String(row.type || "").trim().toLowerCase();
      if (type === "mcq") {
        untouched += 1;
        continue;
      }

      const current = parseFlexibleArray(row.accepted_answers);
      const fromAnswer = normalizeAnswerEntry(row.answer);
      const computed = computeExpectedAnswersFromQuestionText(row.question);
      const next = computed.length ? computed : fromAnswer ? [fromAnswer] : current.length ? current : [];

      const currentJson = current.length ? JSON.stringify(current) : "";
      const nextJson = next.length ? JSON.stringify(next) : "";

      const needsRepair =
        !current.length ||
        /object\s*object/i.test(String(row.accepted_answers || "")) ||
        currentJson !== nextJson;

      if (!needsRepair) {
        untouched += 1;
        continue;
      }

      if (!next.length) {
        unresolved += 1;
        continue;
      }

      updates.push({ id: row.id, accepted: JSON.stringify(next) });
    }

    if (!updates.length) {
      console.log(`No updates needed. untouched=${untouched} unresolved=${unresolved}`);
      db.close();
      return;
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      const stmt = db.prepare("UPDATE custom_questions SET accepted_answers = ? WHERE id = ?");
      for (const u of updates) {
        stmt.run(u.accepted, u.id);
        updated += 1;
      }
      stmt.finalize();
      db.run("COMMIT", (commitErr) => {
        if (commitErr) {
          console.error(commitErr);
          process.exitCode = 1;
        } else {
          console.log(`Updated ${updated} rows. untouched=${untouched} unresolved=${unresolved}`);
        }
        db.close();
      });
    });
  },
);
