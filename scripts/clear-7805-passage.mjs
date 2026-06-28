/**
 * Remove passage text from demo question 7805 (oyster study).
 * Run: node scripts/clear-7805-passage.mjs
 */
const API = "http://127.0.0.1:8787";
const HEADERS = { "x-admin-key": "localdev", "Content-Type": "application/json" };
const QID = 7805;

async function main() {
  const listRes = await fetch(`${API}/api/admin/questions`, { headers: HEADERS });
  const rows = await listRes.json();
  const row = rows.find((r) => String(r.id) === String(QID));
  if (!row) throw new Error(`Question ${QID} not found`);

  console.log("Before passage:", (row.passage ?? "").slice(0, 80) + "...");

  const body = {
    subjectId: row.subjectId ?? "demo",
    type: row.type ?? "short_answer",
    topic: row.topic ?? "Matrices",
    question: row.question ?? "See figure.",
    passage: "",
    marks: row.marks ?? 13,
    acceptedAnswers: row.acceptedAnswers ?? [],
    answerParts: row.answerParts ?? [],
  };
  // Do NOT send imageUrls — partial update must not wipe figures.

  const putRes = await fetch(`${API}/api/admin/questions/${QID}`, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const putJson = await putRes.json();
  console.log("PUT", putRes.status, putJson);

  const listRes2 = await fetch(`${API}/api/admin/questions`, { headers: HEADERS });
  const rows2 = await listRes2.json();
  const after = rows2.find((r) => String(r.id) === String(QID));
  const passage = after?.passage ?? "";
  console.log("After passage:", passage ? `"${passage.slice(0, 80)}..."` : "(cleared)");
  if (passage.trim()) process.exit(1);
  console.log("Done — passage removed from question 7805.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
