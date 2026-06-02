const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const adminKey = process.env.ADMIN_KEY || process.env.NODENT_ADMIN_KEY;
const listRes = await fetch(`${base}/api/admin/questions`, {
  headers: { "X-Admin-Key": adminKey },
});
const list = await listRes.json();

function hasDollarMath(s) {
  return /\$[^$]+\$/.test(s) || /\$\$[\s\S]+?\$\$/.test(s);
}

function needsMathFormat(t) {
  const s = String(t ?? "");
  if (!s.trim()) return false;
  if (/∫/.test(s) && !/\\int/.test(s)) return true;
  if (/e\^\(|e\^[0-9]/.test(s) && !hasDollarMath(s)) return true;
  if (/\\\\{2,}(frac|int|sqrt)/.test(s)) return true;
  if (/\b(sin|cos|tan|log)\s*\(/.test(s) && !hasDollarMath(s) && !/\\(sin|cos|tan|log)/.test(s))
    return true;
  if (/\bd\/dx\b|\bdy\/dx\b/i.test(s) && !hasDollarMath(s)) return true;
  if (/[0-9a-zA-Z]\^[\d({]/.test(s) && !hasDollarMath(s)) return true;
  if (/\\int[^_$]/.test(s) && !/\\int_/.test(s)) return true;
  if (/Evaluate\s*∫/i.test(s)) return true;
  if (/\\frac|\\sqrt|\\int/.test(s) && !hasDollarMath(s)) return true;
  return false;
}

function noDollarButMath(s) {
  return !hasDollarMath(s) && /[\^∫]|\\int|\\frac|d\/dx|sin\s*\(|cos\s*\(|log\s*\(/i.test(s);
}

for (const sid of ["methods", "specialist", "general"]) {
  const qs = list.filter((q) => q.subjectId === sid);
  const bad = qs.filter((q) => needsMathFormat(q.question));
  const plain = qs.filter((q) => noDollarButMath(q.question));
  console.log(`${sid}: ${bad.length}/${qs.length} need format, ${plain.length} no-$ math`);
  for (const q of bad.slice(0, 5)) {
    console.log(`  [${q.id}] ${String(q.question).slice(0, 100)}`);
  }
}
