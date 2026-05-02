const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const devVars = fs.readFileSync(path.resolve(__dirname, "..", ".dev.vars"), "utf8");
  const match = devVars.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in backend/.dev.vars");
  return match[1].trim();
}

function parseJsonLoose(raw) {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    try {
      const fixed = t.replace(/[\u201c\u201d\u201e]/g, '"').replace(/[\u2018\u2019]/g, "'");
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
  if (Array.isArray(value)) return value.map(normalizeAnswerEntry).find(Boolean) || "";
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
  const candidate = t.startsWith("[") && t.endsWith("]") ? t.slice(1, -1).trim() : t;
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
function normalCdf(z) {
  // Abramowitz-Stegun approximation via erf polynomial
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
    return [formatNumeric(predicted, 2), formatNumeric(residual, 2), residual >= 0 ? "under-predicted" : "over-predicted"];
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
      if (Number.isInteger(a) && Number.isInteger(Math.abs(b)) && Number.isInteger(den)) {
        return [`${a}/${den}${b >= 0 ? "-" : "+"}${Math.abs(b)}/${den}i`, decimal];
      }
      return [decimal];
    }
  }

  const reciprocalPoly = question.match(
    /f\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\/\s*x\s*\+\s*([+-]?\d+(?:\.\d+)?)\s*x\s*\^?\s*2[\s\S]*?find\s*f\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*and\s*f'\s*\(\s*\3\s*\)/i,
  );
  if (reciprocalPoly) {
    const a = Number(reciprocalPoly[1]);
    const b = Number(reciprocalPoly[2]);
    const x = Number(reciprocalPoly[3]);
    if (x !== 0) {
      const fx = a / x + b * x * x;
      const fpx = -a / (x * x) + 2 * b * x;
      return [formatNumeric(fx, 2), formatNumeric(fpx, 2)];
    }
  }

  const definiteIntegral = question.match(
    /integral\s*[^(]*\(?\s*from\s*([+-]?\d+(?:\.\d+)?)\s*to\s*([+-]?\d+(?:\.\d+)?)\s*\)?\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*x\^?2\s*-\s*([+-]?\d+(?:\.\d+)?)\s*x\s*\)/i,
  );
  if (definiteIntegral) {
    const lo = Number(definiteIntegral[1]);
    const hi = Number(definiteIntegral[2]);
    const a = Number(definiteIntegral[3]);
    const b = Number(definiteIntegral[4]);
    const F = (x) => (a / 3) * x ** 3 - (b / 2) * x ** 2;
    const area = F(hi) - F(lo);
    return [formatNumeric(area, 2), area >= 0 ? "positive net area" : "negative net area"];
  }

  const rootsMonic = question.match(
    /roots?\s*([+-]?\d+(?:\.\d+)?)\s*and\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?monic quadratic/i,
  );
  if (rootsMonic) {
    const r1 = Number(rootsMonic[1]);
    const r2 = Number(rootsMonic[2]);
    const sum = r1 + r2;
    const prod = r1 * r2;
    const eq = `x^2${sum >= 0 ? "-" : "+"}${formatNumeric(Math.abs(sum), 2)}x${prod >= 0 ? "+" : "-"}${formatNumeric(Math.abs(prod), 2)}=0`;
    return [eq];
  }

  const solveQuadratic = question.match(
    /solve\s*([+-]?\d+(?:\.\d+)?)x\^?2\s*([+-])\s*(\d+(?:\.\d+)?)x\s*([+-])\s*(\d+(?:\.\d+)?)\s*=\s*0/i,
  );
  if (solveQuadratic && /approximate roots to 3 d\.?p/i.test(question)) {
    const a = Number(solveQuadratic[1]);
    const b = Number(solveQuadratic[3]) * (solveQuadratic[2] === "-" ? -1 : 1);
    const c = Number(solveQuadratic[5]) * (solveQuadratic[4] === "-" ? -1 : 1);
    const disc = b * b - 4 * a * c;
    if (a !== 0 && disc >= 0) {
      const r1 = (-b + Math.sqrt(disc)) / (2 * a);
      const r2 = (-b - Math.sqrt(disc)) / (2 * a);
      return [formatNumeric(r1, 3), formatNumeric(r2, 3)];
    }
  }

  const binVar = question.match(
    /X\s*~\s*Bi\s*\(\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)[\s\S]*?Var\s*\(\s*X\s*\)/i,
  );
  if (binVar) {
    const n = Number(binVar[1]);
    const p = Number(binVar[2]);
    return [formatNumeric(n * p * (1 - p), 3)];
  }

  const binESdPr = question.match(
    /X\s*~\s*Bi\s*\(\s*(\d+)\s*,\s*([0-9]*\.?[0-9]+)\s*\)[\s\S]*?E\s*\(\s*X\s*\)[\s\S]*?sd\s*\(\s*X\s*\)[\s\S]*?Pr\s*\(\s*X\s*>=\s*(\d+)\s*\)/i,
  );
  if (binESdPr) {
    const n = Number(binESdPr[1]);
    const p = Number(binESdPr[2]);
    const k = Number(binESdPr[3]);
    const mean = n * p;
    const sd = Math.sqrt(n * p * (1 - p));
    if (sd > 0) {
      const z = (k - 0.5 - mean) / sd;
      const prob = 1 - normalCdf(z);
      return [formatNumeric(mean, 3), formatNumeric(sd, 3), formatNumeric(prob, 3)];
    }
  }

  const pHatSe = question.match(
    /p-?hat\s*=\s*([0-9]*\.?[0-9]+)[\s\S]*?n\s*=\s*(\d+)[\s\S]*?standard error/i,
  );
  if (pHatSe) {
    const p = Number(pHatSe[1]);
    const n = Number(pHatSe[2]);
    if (n > 0) return [formatNumeric(Math.sqrt((p * (1 - p)) / n), 3)];
  }

  const sampleMeanZ = question.match(
    /population has mean\s*([+-]?\d+(?:\.\d+)?)\s*,\s*sd\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?sample size\s*(\d+)[\s\S]*?sample mean\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (sampleMeanZ) {
    const mu = Number(sampleMeanZ[1]);
    const sigma = Number(sampleMeanZ[2]);
    const n = Number(sampleMeanZ[3]);
    const xbar = Number(sampleMeanZ[4]);
    if (n > 0 && sigma > 0) {
      const se = sigma / Math.sqrt(n);
      const z = (xbar - mu) / se;
      return [formatNumeric(mu, 3), formatNumeric(se, 3), formatNumeric(z, 3)];
    }
  }

  const cisForm = question.match(
    /z\s*=\s*([+-]?\d+(?:\.\d+)?)\s*cis\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)[\s\S]*?z\^?2/i,
  );
  if (cisForm) {
    const r = Number(cisForm[1]);
    const th = Number(cisForm[2]);
    const a = r * Math.cos(th);
    const b = r * Math.sin(th);
    const z2a = r * r * Math.cos(2 * th);
    const z2b = r * r * Math.sin(2 * th);
    return [
      `${formatNumeric(a, 3)}${b >= 0 ? "+" : "-"}${formatNumeric(Math.abs(b), 3)}i`,
      `${formatNumeric(z2a, 3)}${z2b >= 0 ? "+" : "-"}${formatNumeric(Math.abs(z2b), 3)}i`,
    ];
  }

  const dotSimple = question.match(
    /a=\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*and\s*b=\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\)/i,
  );
  if (dotSimple && /find\s*a\?b/i.test(question)) {
    const a1 = Number(dotSimple[1]);
    const a2 = Number(dotSimple[2]);
    const a3 = Number(dotSimple[3]);
    const b1 = Number(dotSimple[4]);
    const b2 = Number(dotSimple[5]);
    const b3 = Number(dotSimple[6]);
    return [formatNumeric(a1 * b1 + a2 * b2 + a3 * b3, 3)];
  }

  const dotMagCos = question.match(
    /a=\[\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\]\s*and\s*b=\[\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*\]/i,
  );
  if (dotMagCos && /find\s*\|a\|[\s\S]*\|b\|[\s\S]*cos/i.test(question)) {
    const a1 = Number(dotMagCos[1]);
    const a2 = Number(dotMagCos[2]);
    const a3 = Number(dotMagCos[3]);
    const b1 = Number(dotMagCos[4]);
    const b2 = Number(dotMagCos[5]);
    const b3 = Number(dotMagCos[6]);
    const amag = Math.sqrt(a1 * a1 + a2 * a2 + a3 * a3);
    const bmag = Math.sqrt(b1 * b1 + b2 * b2 + b3 * b3);
    const dot = a1 * b1 + a2 * b2 + a3 * b3;
    const cos = amag > 0 && bmag > 0 ? dot / (amag * bmag) : 0;
    return [formatNumeric(amag, 3), formatNumeric(bmag, 3), formatNumeric(dot, 3), formatNumeric(cos, 3)];
  }

  const timeStop = question.match(
    /u\s*=\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?acceleration\s*([+-]?\d+(?:\.\d+)?)\s*m\/s\^?2[\s\S]*?time to stop/i,
  );
  if (timeStop) {
    const u = Number(timeStop[1]);
    const a = Number(timeStop[2]);
    if (a !== 0) return [formatNumeric(-u / a, 3)];
  }

  const suvat = question.match(
    /u\s*=\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?acceleration\s*([+-]?\d+(?:\.\d+)?)\s*m\/s\^?2[\s\S]*?after\s*([+-]?\d+(?:\.\d+)?)\s*s/i,
  );
  if (suvat && /displacement[\s\S]*velocity/i.test(question)) {
    const u = Number(suvat[1]);
    const a = Number(suvat[2]);
    const t = Number(suvat[3]);
    const s = u * t + 0.5 * a * t * t;
    const v = u + a * t;
    const reversed = u !== 0 && Math.sign(u) !== Math.sign(v) ? "Yes" : "No";
    return [formatNumeric(s, 3), formatNumeric(v, 3), reversed];
  }

  const logDeriv = question.match(
    /d\/dx\s*\[\s*xln\(x\)\s*-\s*([+-]?\d+(?:\.\d+)?)ln\(x\)\s*\][\s\S]*?x\s*=\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (logDeriv) {
    const k = Number(logDeriv[1]);
    const x = Number(logDeriv[2]);
    if (x > 0) {
      const val = Math.log(x) + 1 - k / x;
      return [formatNumeric(val, 3)];
    }
  }

  const expIntegral = question.match(
    /(?:evaluate exactly and approximately)[\s\S]*?\(\s*0\s*to\s*1\s*\)[\s\S]*?\(\s*e\^\(?\s*([+-]?\d+(?:\.\d+)?)x\s*\)?\s*-\s*([+-]?\d+(?:\.\d+)?)x\s*\)/i,
  );
  if (expIntegral) {
    const a = Number(expIntegral[1]);
    const b = Number(expIntegral[2]);
    if (a !== 0) {
      const exactVal = (Math.exp(a) - 1) / a - b / 2;
      const exact = `(e^${formatNumeric(a, 0)}-1)/${formatNumeric(a, 0)}-${formatNumeric(b, 0)}/2`;
      return [exact, formatNumeric(exactVal, 4)];
    }
  }

  const sepDy = question.match(
    /dy\/dx\s*=\s*-?\s*([+-]?\d+(?:\.\d+)?)\s*y[\s\S]*?y\s*\(\s*0\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?y\s*\(\s*2\s*\)/i,
  );
  if (sepDy) {
    const kAbs = Math.abs(Number(sepDy[1]));
    const y0 = Number(sepDy[2]);
    const y2 = y0 * Math.exp(-kAbs * 2);
    return [formatNumeric(y2, 4)];
  }

  const linDy = question.match(
    /dy\/dx\s*\+\s*([+-]?\d+(?:\.\d+)?)y\s*=\s*0[\s\S]*?y\s*\(\s*0\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?y\s*\(\s*2\s*\)/i,
  );
  if (linDy) {
    const k = Number(linDy[1]);
    const y0 = Number(linDy[2]);
    const y2 = y0 * Math.exp(-k * 2);
    return [formatNumeric(y2, 4)];
  }

  return [];
}

async function main() {
  const sql = neon(readDatabaseUrl());
  const rows = await sql`select id, type, question, answer, accepted_answers from custom_questions order by id asc`;
  let updated = 0;
  let unresolved = 0;
  for (const row of rows) {
    const type = String(row.type || "").toLowerCase();
    if (type === "mcq") continue;
    const current = parseFlexibleArray(row.accepted_answers);
    const fallback = normalizeAnswerEntry(row.answer);
    const computed = computeExpectedAnswersFromQuestionText(row.question);
    const next = computed.length ? computed : fallback ? [fallback] : current.length ? current : [];
    if (!next.length) {
      unresolved++;
      continue;
    }
    if (JSON.stringify(current) === JSON.stringify(next)) continue;
    await sql`update custom_questions set accepted_answers = ${JSON.stringify(next)} where id = ${row.id}`;
    updated++;
  }
  console.log(`Updated ${updated} rows; unresolved ${unresolved}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
