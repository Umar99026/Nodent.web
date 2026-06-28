/**
 * End-to-end save + cache simulation (no browser).
 * Run: node scripts/check-save-flow.mjs
 */
const API = "http://127.0.0.1:8787";
const VITE = "http://127.0.0.1:5173";
const ADMIN_HEADERS = { "x-admin-key": "localdev", "Content-Type": "application/json" };
const QID = 7808;

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...ADMIN_HEADERS, ...options.headers },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function canonicalSubjectId(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "general maths" || s === "general-maths" || s === "generalm maths") return "general-maths";
  if (s === "specialist maths" || s === "specialist-maths") return "specialist-maths";
  if (s === "math methods" || s === "methods") return "methods";
  return s;
}

function patchCache(map, questionId, draft, subjectId) {
  const sid = canonicalSubjectId(subjectId);
  const wantId = String(questionId);
  let changed = false;
  for (const [key, arr] of Object.entries(map)) {
    if (!Array.isArray(arr) || canonicalSubjectId(key) !== sid) continue;
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (!r || typeof r !== "object") continue;
      if (String(r.id ?? "") !== wantId) continue;
      arr[i] = { ...r, question: draft.question.trim(), topic: draft.topic };
      changed = true;
      break;
    }
    if (changed) break;
  }
  return changed;
}

function findInBank(map, subjectId, questionId) {
  const sid = canonicalSubjectId(subjectId);
  const wantId = String(questionId);
  for (const [key, arr] of Object.entries(map ?? {})) {
    if (!Array.isArray(arr) || canonicalSubjectId(key) !== sid) continue;
    for (const r of arr) {
      if (r && String(r.id ?? "") === wantId) return r;
    }
  }
  return null;
}

async function main() {
  console.log("\n=== Nodent save-flow check ===\n");

  // 1. Dev servers
  for (const [name, url] of [
    ["Frontend (Vite)", `${VITE}/`],
    ["API (Wrangler)", `${API}/api/bootstrap`],
  ]) {
    try {
      const r = await fetch(url);
      console.log(`${name}: HTTP ${r.status} ${r.ok || r.status === 401 ? "OK" : "FAIL"}`);
    } catch (e) {
      console.log(`${name}: DOWN — ${e.message}`);
      process.exit(1);
    }
  }

  // 2. Vite proxy
  try {
    const r = await fetch(`${VITE}/api/bootstrap`);
    console.log(`Vite proxy /api → 8787: HTTP ${r.status} (401 expected without login)`);
  } catch (e) {
    console.log(`Vite proxy: FAIL — ${e.message}`);
  }

  // 3. Save test
  const marker = `flow-check-${Date.now()}`;
  const draft = {
    topic: "Matrices",
    question: marker,
    type: "long_answer",
    subjectId: "demo",
    marks: 1,
    acceptedAnswers: ["1"],
    imageUrls: [],
  };

  const put = await req(`${API}/api/admin/questions/${QID}`, {
    method: "PUT",
    body: JSON.stringify(draft),
  });
  console.log(`\nPUT /api/admin/questions/${QID}: ${put.status}`, put.json);

  if (put.status !== 200 || !put.json?.ok) {
    console.error("\nSave failed — this is why UI changes do not stick.");
    process.exit(1);
  }

  // 4. Read back via admin list (same as refreshQuestionBankAfterSave)
  const list = await req(`${API}/api/admin/questions`);
  if (list.status !== 200) {
    console.error("Admin list failed:", list.status, list.json);
    process.exit(1);
  }
  const rows = Array.isArray(list.json) ? list.json : [];
  const row = rows.find((r) => String(r.id) === String(QID));
  const adminMatch = row?.question === marker;
  console.log(`Admin read-back id=${QID}: question="${row?.question?.slice(0, 60)}"`);
  console.log(`Admin DB match: ${adminMatch ? "YES" : "NO"}`);

  // 5. Simulate localStorage cache patch (refreshQuestionBankAfterSave shape)
  const grouped = {};
  for (const r of rows) {
    const sid = canonicalSubjectId(String(r.subjectId ?? r.subject_id ?? ""));
    if (!sid) continue;
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push({
      ...r,
      id: typeof r.id === "number" ? r.id : Number(r.id) || r.id,
      subjectId: sid,
    });
  }

  const before = findInBank(grouped, "demo", QID)?.question;
  const patched = patchCache(grouped, QID, { question: marker + "-patched", topic: "Matrices" }, "demo");
  const afterPatch = findInBank(grouped, "demo", QID)?.question;

  console.log(`\nCache patch simulation:`);
  console.log(`  found in demo cache: ${before != null ? "YES" : "NO"}`);
  console.log(`  patch changed row: ${patched ? "YES" : "NO"}`);
  console.log(`  after patch text: "${afterPatch?.slice(0, 60)}"`);

  // 6. Id format check
  const demoRows = grouped.demo ?? [];
  const idTypes = [...new Set(demoRows.slice(0, 5).map((r) => typeof r.id))];
  console.log(`\nDemo cache id types (sample): ${idTypes.join(", ") || "empty"}`);
  console.log(`Question ${QID} in demo bank: ${row ? "YES" : "NO — wrong subject page?"}`);

  console.log("\n=== Summary ===");
  if (adminMatch) {
    console.log("Backend save WORKS — DB has your edit.");
    if (!row) {
      console.log("UI issue: question not in expected subject bucket.");
    } else {
      console.log("If browser still shows old text:");
      console.log("  1) Hard refresh Ctrl+Shift+R on http://localhost:5173");
      console.log("  2) Confirm you are on /quiz/demo (question is subjectId=demo)");
      console.log("  3) Check Network tab on Save — look for 409/500 on PUT");
    }
  } else {
    console.log("Backend save did NOT persist — investigate API/DB.");
  }
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
