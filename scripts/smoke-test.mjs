/**
 * Local smoke tests — run with API up: npx wrangler dev --port 8787
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const BASE = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");

const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function req(path, options = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { _raw: text.slice(0, 200) };
  }
  return { status: res.status, json, headers: res.headers };
}

async function main() {
  console.log(`\nNodent smoke tests → ${BASE}\n`);

  // --- Public / health ---
  try {
    const ping = await req("/api/ping");
    if (ping.status === 200 && ping.json?.ok) pass("GET /api/ping");
    else fail("GET /api/ping", `status ${ping.status}`);
  } catch (e) {
    fail("GET /api/ping", String(e.message || e));
  }

  try {
    const health = await req("/api/health");
    if (health.status === 200 && health.json?.ok) {
      pass("GET /api/health (DB)", `users=${health.json.users ?? "?"}`);
    } else {
      fail("GET /api/health", health.json?.error || `status ${health.status}`);
    }
  } catch (e) {
    fail("GET /api/health", String(e.message || e));
  }

  // --- Auth guards ---
  const bootNoAuth = await req("/api/bootstrap");
  if (bootNoAuth.status === 401) pass("GET /api/bootstrap without token → 401");
  else fail("GET /api/bootstrap without token", `expected 401, got ${bootNoAuth.status}`);

  const adminNoAuth = await req("/api/admin/questions");
  if (adminNoAuth.status === 403 || adminNoAuth.status === 401) {
    pass("GET /api/admin/questions without auth → denied");
  } else fail("GET /api/admin/questions without auth", `got ${adminNoAuth.status}`);

  const adminBadKey = await req("/api/admin/questions", {
    headers: { "x-admin-key": "definitely-wrong-key-00000000" },
  });
  if (adminBadKey.status === 403 || adminBadKey.status === 401) {
    pass("GET /api/admin/questions with wrong admin key → denied");
  } else fail("GET /api/admin/questions wrong key", `got ${adminBadKey.status}`);

  // --- Signup / login / storage flow ---
  const tag = `smoke_${Date.now()}`;
  const email = `${tag}@nodent-smoke.test`;
  const password = "SmokeTest99!";
  const username = `smoke_${tag.slice(-6)}`;

  const signup = await req("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, username, password, rememberMe: true }),
  });
  let token = signup.json?.token;
  if (signup.status === 200 && token) {
    pass("POST /api/auth/signup", `user id ${signup.json?.user?.id}`);
  } else {
    fail("POST /api/auth/signup", signup.json?.error || `status ${signup.status}`);
  }

  const login = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (login.status === 200 && login.json?.token) {
    token = login.json.token;
    pass("POST /api/auth/login");
  } else {
    fail("POST /api/auth/login", login.json?.error || `status ${login.status}`);
  }

  if (!token) {
    console.log("\nSkipping authenticated tests (no token).\n");
    summarize();
    process.exit(1);
  }

  const auth = { Authorization: `Bearer ${token}` };

  const bootstrap = await req("/api/bootstrap", { headers: auth });
  if (bootstrap.status === 200 && bootstrap.json?.user?.email === email) {
    const cq = bootstrap.json?.customQuestions ?? {};
    const keys = Object.keys(cq);
    pass("GET /api/bootstrap", `subjects with questions: ${keys.length}`);
  } else {
    fail("GET /api/bootstrap", bootstrap.json?.error || `status ${bootstrap.status}`);
  }

  // Persist subjects
  const putSubj = await req("/api/subjects/my", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ subjectIds: ["methods", "english"] }),
  });
  if (putSubj.status === 200 && Array.isArray(putSubj.json?.subjectIds)) {
    pass("PUT /api/subjects/my");
  } else {
    fail("PUT /api/subjects/my", putSubj.json?.error || `status ${putSubj.status}`);
  }

  const getSubj = await req("/api/subjects/my", { headers: auth });
  if (
    getSubj.status === 200 &&
    getSubj.json?.subjectIds?.includes("methods") &&
    getSubj.json?.subjectIds?.includes("english")
  ) {
    pass("GET /api/subjects/my (persisted)");
  } else {
    fail("GET /api/subjects/my", JSON.stringify(getSubj.json?.subjectIds));
  }

  // Competition answer storage (practice progress)
  const qKey = `smoke_q_${tag}`;
  const ans = await req("/api/competition/answer", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      subjectId: "methods",
      questionKey: qKey,
      topic: "Differential calculus",
      marks: 2,
      isCorrect: true,
    }),
  });
  if (ans.status === 200 && ans.json?.ok) pass("POST /api/competition/answer (store attempt)");
  else fail("POST /api/competition/answer", ans.json?.error || `status ${ans.status}`);

  const stats = await req("/api/competition/methods/stats?range=all", { headers: auth });
  if (stats.status === 200 && stats.json?.questionStats) {
    const found = (stats.json.questionStats || []).some((q) => q.questionKey === qKey);
    if (found) pass("GET /api/competition/.../stats (attempt visible)");
    else fail("GET /api/competition/stats", "stored questionKey not in stats");
  } else {
    fail("GET /api/competition/stats", stats.json?.error || `status ${stats.status}`);
  }

  // Study sync
  const studySync = await req("/api/study/sync", {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      sessions: [{ subjectId: "methods", seconds: 120, endedAt: new Date().toISOString() }],
      daily: { date: new Date().toISOString().slice(0, 10), seconds: 120 },
    }),
  });
  if (studySync.status === 200) pass("POST /api/study/sync");
  else fail("POST /api/study/sync", studySync.json?.error || `status ${studySync.status}`);

  const studyHist = await req("/api/study/history", { headers: auth });
  if (studyHist.status === 200) pass("GET /api/study/history");
  else fail("GET /api/study/history", `status ${studyHist.status}`);

  // Written response
  const written = await req("/api/written/methods/smoke_written_key", {
    method: "PUT",
    headers: auth,
    body: JSON.stringify({ responseText: "Smoke test written answer." }),
  });
  if (written.status === 200) pass("PUT /api/written/... (store written)");
  else fail("PUT /api/written", written.json?.error || `status ${written.status}`);

  const writtenGet = await req("/api/written/methods/smoke_written_key", { headers: auth });
  const writtenText = writtenGet.json?.response?.text ?? writtenGet.json?.responseText;
  if (writtenGet.status === 200 && writtenText?.includes("Smoke test")) {
    pass("GET /api/written/... (read back)");
  } else {
    fail("GET /api/written", writtenGet.json?.error || `status ${writtenGet.status}, body=${JSON.stringify(writtenGet.json)}`);
  }

  // Invalid login
  const badLogin = await req("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: "wrong-password-xyz" }),
  });
  if (badLogin.status === 400) pass("POST /api/auth/login wrong password → 400");
  else fail("POST /api/auth/login wrong password", `got ${badLogin.status}`);

  // Logout
  const logout = await req("/api/auth/logout", { method: "POST", headers: auth });
  if (logout.status === 200) pass("POST /api/auth/logout");
  else fail("POST /api/auth/logout", `status ${logout.status}`);

  const bootAfterLogout = await req("/api/bootstrap", { headers: auth });
  if (bootAfterLogout.status === 401) pass("GET /api/bootstrap after logout → 401");
  else fail("GET /api/bootstrap after logout", `expected 401, got ${bootAfterLogout.status}`);

  summarize();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function summarize() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
