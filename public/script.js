const app = document.getElementById("app");

const STORAGE_KEYS = {
  currentUser: "nodent_current_user",
  authToken: "nodent_auth_token",
  rememberLogin: "nodent_remember_login",
  practiceStatePrefix: "nodent_practice_state_",
  mySubjectsPrefix: "nodent_my_subjects_",
  chats: "nodent_public_chats",
  studyPrefix: "nodent_study_",
  writtenResponses: "nodent_written_responses",
  quizComments: "nodent_quiz_comments",
  customQuestions: "nodent_custom_questions",
  uiPrefs: "nodent_ui_prefs",
  studyModePrefix: "nodent_study_mode_",
  studyModeAnswers: "nodent_study_mode_answers"
};

const LOGO_PATH = "logo.png";

let studyTicker = null;
let studyModeTicker = null;
let inactivityTimeout = null;
let adminUnlocked = false;

const API = {
  bootstrap: "/api/bootstrap",
  authLogin: "/api/auth/login",
  authSignup: "/api/auth/signup",
  authLogout: "/api/auth/logout",
  mySubjects: "/api/my-subjects",
  studyToday: "/api/study/today",
  quizSubmit: "/api/quiz/submit",
  leaderboard: (subjectId) => `/api/leaderboard/${encodeURIComponent(subjectId)}`,
  comments: (subjectId, questionKey) =>
    `/api/comments/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`,
  written: (subjectId, questionKey) =>
    `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`
};

const baseSubjects = [
  {
    id: "english",
    name: "English",
    category: "VCE",
    description: "Text response, argument analysis, comparative writing, and language development.",
    quiz: [
      {
        type: "long",
        question:
          "Read the passage below and explain how language choices shape the reader’s response. Refer closely to tone, persuasive devices, and intended audience.",
        passage:
          `'We cannot keep calling these changes temporary when they are already shaping the future of entire communities. Every season of delay comes with another cost, another loss, another opportunity abandoned. The question is no longer whether action is necessary, but whether we are prepared to act with courage rather than convenience.'`,
        guidance:
          "Write a sustained analytical response. Aim for a clear contention, close analysis of language, and logical paragraphing."
      },
      {
        type: "long",
        question: "Discuss how a strong introduction establishes the direction of an English essay.",
        guidance:
          "Write an essay-style response with a clear central argument and developed explanation."
      },
      {
        type: "short",
        question: "What is the main purpose of a thesis statement?",
        acceptedAnswers: [
          "to provide a clear central argument",
          "to state the main argument",
          "to present the main argument",
          "to establish the essay's argument"
        ]
      },
      {
        type: "mcq",
        question: "Argument analysis mainly focuses on:",
        options: [
          "Counting paragraphs only",
          "How persuasive techniques shape the reader",
          "Memorising every sentence",
          "Ignoring tone and contention"
        ],
        answer: "How persuasive techniques shape the reader"
      },
      {
        type: "mcq",
        question: "A metaphor is best described as:",
        options: [
          "A direct comparison",
          "A punctuation mark",
          "A summary paragraph",
          "A topic sentence"
        ],
        answer: "A direct comparison"
      }
    ]
  },
  {
    id: "methods",
    name: "Mathematical Methods",
    category: "VCE",
    description: "Functions, calculus, probability, algebra, graphs, and mathematical modelling.",
    quiz: [
      { type: "mcq", question: "What is the derivative of x²?", options: ["x", "2x", "x²", "2"], answer: "2x" },
      { type: "short", question: "State the gradient of a horizontal line.", acceptedAnswers: ["0", "zero"] },
      { type: "mcq", question: "What is sin(90°)?", options: ["0", "1", "-1", "0.5"], answer: "1" },
      { type: "mcq", question: "3 + 5 × 2 equals:", options: ["16", "13", "10", "8"], answer: "13" }
    ]
  },
  {
    id: "general-maths",
    name: "General Mathematics",
    category: "VCE",
    description: "Statistics, finance, networks, matrices, measurement, and applied problem solving.",
    quiz: [
      { type: "mcq", question: "25% of 200 is:", options: ["25", "50", "75", "100"], answer: "50" },
      { type: "short", question: "What is the mean of 4, 6 and 8?", acceptedAnswers: ["6", "6.0"] },
      { type: "mcq", question: "Angles in a triangle add to:", options: ["90°", "180°", "270°", "360°"], answer: "180°" }
    ]
  },
  {
    id: "biology",
    name: "Biology",
    category: "VCE",
    description: "Cells, genetics, evolution, immunity, and biological systems.",
    quiz: [
      { type: "mcq", question: "The basic unit of life is the:", options: ["Cell", "Organ", "Tissue", "Atom"], answer: "Cell" },
      { type: "short", question: "What molecule carries genetic information in most organisms?", acceptedAnswers: ["dna", "deoxyribonucleic acid"] },
      {
        type: "long",
        question: "Explain how structure supports function in one biological organelle of your choice.",
        guidance: "Use a developed scientific explanation with correct terminology."
      }
    ]
  }
];

/* -------------------------------- helpers -------------------------------- */

function getJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:()'"`]/g, "");
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "Unknown time";
  }
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getQuestionTypeLabel(type) {
  if (type === "mcq") return "Multiple Choice";
  if (type === "short") return "Short Answer";
  if (type === "long") return "Extended Response";
  return "Question";
}

/* -------------------------------- auth -------------------------------- */

function getAuthToken() {
  return localStorage.getItem(STORAGE_KEYS.authToken) || "";
}

function setAuthToken(token) {
  localStorage.setItem(STORAGE_KEYS.authToken, token);
}

function clearAuthToken() {
  localStorage.removeItem(STORAGE_KEYS.authToken);
}

function getCurrentUser() {
  return getJson(STORAGE_KEYS.currentUser, null);
}

function setCurrentUser(user) {
  setJson(STORAGE_KEYS.currentUser, user);
}

function clearCurrentUser() {
  localStorage.removeItem(STORAGE_KEYS.currentUser);
}

function getLoggedIn() {
  return Boolean(getAuthToken() && getCurrentUser());
}

function getRememberLogin() {
  return localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true";
}

function setRememberLogin(value) {
  localStorage.setItem(STORAGE_KEYS.rememberLogin, String(Boolean(value)));
}

function getUserEmail() {
  return getCurrentUser()?.email || "";
}

function getUserId() {
  return getCurrentUser()?.id || null;
}

async function apiFetch(url, options = {}) {
  const token = getAuthToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    credentials: "include"
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function hydrateSession() {
  try {
    const data = await apiFetch(API.bootstrap);
    if (data?.user) setCurrentUser(data.user);
    if (data?.customQuestions) {
      setJson(STORAGE_KEYS.customQuestions, data.customQuestions);
    }
  } catch {
    clearAuthToken();
    clearCurrentUser();
  }
}

async function login(email, password, remember) {
  const data = await apiFetch(API.authLogin, {
    method: "POST",
    body: JSON.stringify({ email, password, remember })
  });

  if (data.token) setAuthToken(data.token);
  setCurrentUser(data.user);
  setRememberLogin(remember);

  if (data.customQuestions) {
    setJson(STORAGE_KEYS.customQuestions, data.customQuestions);
  }
}

async function signup(email, password, remember) {
  const data = await apiFetch(API.authSignup, {
    method: "POST",
    body: JSON.stringify({ email, password, remember })
  });

  if (data.token) setAuthToken(data.token);
  setCurrentUser(data.user);
  setRememberLogin(remember);

  if (data.customQuestions) {
    setJson(STORAGE_KEYS.customQuestions, data.customQuestions);
  }
}

async function logout() {
  try {
    await apiFetch(API.authLogout, { method: "POST" });
  } catch {}
  clearAuthToken();
  clearCurrentUser();
  window.location.hash = "#login";
  render();
}

/* -------------------------------- data -------------------------------- */

function getCustomQuestions() {
  return getJson(STORAGE_KEYS.customQuestions, {});
}

function getSubjects() {
  const customQuestions = getCustomQuestions();
  return baseSubjects.map((subject) => ({
    ...subject,
    quiz: [...subject.quiz, ...(customQuestions[subject.id] || [])]
  }));
}

function getSubjectById(subjectId) {
  return getSubjects().find((subject) => subject.id === subjectId);
}

/* ----------------------------- subject prefs ----------------------------- */

const defaultSubjects = ["english", "methods", "general-maths", "biology"];

function getMySubjectsKey() {
  return `${STORAGE_KEYS.mySubjectsPrefix}${getUserId() || "guest"}`;
}

function getMySubjects() {
  return getJson(getMySubjectsKey(), defaultSubjects);
}

function setMySubjects(list) {
  setJson(getMySubjectsKey(), list);
}

function addMySubjectLocal(subjectId) {
  const latest = getMySubjects();
  const updated = [...new Set([...latest, subjectId])];
  setMySubjects(updated);
  return updated;
}

function removeMySubjectLocal(subjectId) {
  const latest = getMySubjects();
  const updated = latest.filter((id) => id !== subjectId);
  setMySubjects(updated);
  return updated;
}

/* -------------------------------- chats -------------------------------- */

function getChats() {
  return getJson(STORAGE_KEYS.chats, {});
}

function setChats(chats) {
  setJson(STORAGE_KEYS.chats, chats);
}

/* --------------------------- written responses --------------------------- */

function getWrittenResponses() {
  return getJson(STORAGE_KEYS.writtenResponses, {});
}

function setWrittenResponses(responses) {
  setJson(STORAGE_KEYS.writtenResponses, responses);
}

function getWrittenResponse(subjectId, questionText) {
  const responses = getWrittenResponses();
  return responses[`${subjectId}__${questionText}`] || null;
}

function saveWrittenResponseLocal(subjectId, questionText, response) {
  const responses = getWrittenResponses();
  responses[`${subjectId}__${questionText}`] = {
    response,
    time: new Date().toISOString()
  };
  setWrittenResponses(responses);
}

async function loadWrittenResponse(subjectId, questionKey) {
  try {
    const data = await apiFetch(API.written(subjectId, questionKey), { method: "GET" });
    return data.response || null;
  } catch {
    return getWrittenResponse(subjectId, questionKey);
  }
}

async function saveWrittenResponse(subjectId, questionKey, responseText) {
  try {
    await apiFetch(API.written(subjectId, questionKey), {
      method: "PUT",
      body: JSON.stringify({ responseText })
    });
  } catch {
    saveWrittenResponseLocal(subjectId, questionKey, responseText);
  }
}

/* -------------------------------- comments -------------------------------- */

function getQuizComments() {
  return getJson(STORAGE_KEYS.quizComments, {});
}

function setQuizComments(comments) {
  setJson(STORAGE_KEYS.quizComments, comments);
}

async function fetchQuestionComments(subjectId, questionKey) {
  try {
    const data = await apiFetch(API.comments(subjectId, questionKey), { method: "GET" });
    return data.comments || [];
  } catch {
    const comments = getQuizComments();
    return comments[`${subjectId}__${questionKey}`] || [];
  }
}

async function createQuestionComment(subjectId, questionKey, text, parentCommentId = null) {
  try {
    const data = await apiFetch(API.comments(subjectId, questionKey), {
      method: "POST",
      body: JSON.stringify({ text, parentCommentId })
    });
    return data.comment;
  } catch {
    const comments = getQuizComments();
    const key = `${subjectId}__${questionKey}`;
    if (!comments[key]) comments[key] = [];
    const created = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      parentCommentId,
      text,
      time: new Date().toISOString(),
      userEmail: getUserEmail(),
      userId: getUserId()
    };
    comments[key].push(created);
    setQuizComments(comments);
    return created;
  }
}

function buildCommentTree(flatComments) {
  const map = new Map();
  const roots = [];

  flatComments.forEach((comment) => {
    map.set(comment.id, { ...comment, replies: [] });
  });

  flatComments.forEach((comment) => {
    const item = map.get(comment.id);

    if (comment.parentCommentId) {
      const parent = map.get(comment.parentCommentId);
      if (parent) parent.replies.push(item);
      else roots.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
}

function renderCommentTree(commentTree) {
  if (!commentTree.length) {
    return `<div class="comment-empty">No comments on this question yet.</div>`;
  }

  return commentTree
    .map(
      (comment) => `
      <div class="comment-item">
        <div class="comment-meta">${escapeHtml(comment.userEmail)} • ${escapeHtml(
        formatDateTime(comment.time)
      )}</div>
        <div class="comment-text">${escapeHtml(comment.text)}</div>

        <div class="comment-actions">
          <button class="btn-secondary quiz-reply-toggle" data-comment-id="${comment.id}" type="button">Reply</button>
        </div>

        <form class="reply-form" id="replyForm_${comment.id}" style="display:none;">
          <input id="replyInput_${comment.id}" type="text" placeholder="Write a reply..." required />
          <button class="btn-secondary" type="submit">Post Reply</button>
        </form>

        ${
          comment.replies.length
            ? `
          <div class="reply-list">
            ${comment.replies
              .map(
                (reply) => `
              <div class="reply-item">
                <div class="reply-meta">${escapeHtml(reply.userEmail)} • ${escapeHtml(
                  formatDateTime(reply.time)
                )}</div>
                <div class="comment-text">${escapeHtml(reply.text)}</div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `
    )
    .join("");
}

/* ----------------------------- practice state ----------------------------- */

function getPracticeStateKey(subjectId) {
  return `${STORAGE_KEYS.practiceStatePrefix}${getUserId() || "guest"}_${subjectId}`;
}

function getPracticeState(subjectId) {
  return getJson(getPracticeStateKey(subjectId), {
    completedQuestionKeys: [],
    answers: {},
    score: 0,
    autoMarkedCount: 0,
    summaryOpen: false
  });
}

function setPracticeState(subjectId, state) {
  setJson(getPracticeStateKey(subjectId), state);
}

function resetPracticeState(subjectId) {
  localStorage.removeItem(getPracticeStateKey(subjectId));
}

/* ----------------------------- study tracker ----------------------------- */

function getTodayKey() {
  return new Date().toDateString();
}

function getStudyKey() {
  return `${STORAGE_KEYS.studyPrefix}${getUserId() || "guest"}_${getTodayKey()}`;
}

function getStudyData() {
  return getJson(getStudyKey(), {
    dailySeconds: 0,
    goalMinutes: 120,
    sessionMinutes: 25,
    sessionsCompleted: 0,
    remainingSeconds: 25 * 60,
    isRunning: false,
    pausedForInactivity: false
  });
}

function setStudyData(data) {
  setJson(getStudyKey(), data);
}

function clearTimerInterval() {
  if (studyTicker) {
    clearInterval(studyTicker);
    studyTicker = null;
  }
}

function startTimerTick() {
  clearTimerInterval();

  const tick = () => {
    const latest = getStudyData();

    if (!latest.isRunning) {
      clearTimerInterval();
      return;
    }

    latest.dailySeconds += 1;

    if (latest.remainingSeconds > 0) {
      latest.remainingSeconds -= 1;
    } else {
      latest.sessionsCompleted += 1;
      latest.remainingSeconds = latest.sessionMinutes * 60;
    }

    setStudyData(latest);

    const timerDisplay = document.getElementById("timerDisplay");
    if (timerDisplay) {
      timerDisplay.textContent = formatSeconds(latest.remainingSeconds);
    }
  };

  studyTicker = setInterval(tick, 1000);
}

/* ----------------------------- inactivity ----------------------------- */

function closeInactivityModal() {
  const existing = document.getElementById("inactivityOverlay");
  if (existing) existing.remove();
}

function pausePracticeTimerForInactivity() {
  const data = getStudyData();
  if (!data.isRunning) return;
  data.isRunning = false;
  data.pausedForInactivity = true;
  setStudyData(data);
  clearTimerInterval();
  openInactivityModal();
}

function openInactivityModal() {
  if (document.getElementById("inactivityOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "admin-overlay";
  overlay.id = "inactivityOverlay";
  overlay.innerHTML = `
    <div class="admin-modal inactivity-card">
      <h2>Are you there still?</h2>
      <p>Your practice timer has been paused because there was no activity for 10 minutes.</p>
      <div class="admin-actions" style="justify-content:center;">
        <button class="btn-primary" id="resumeAfterIdleBtn" type="button">Yes, keep studying</button>
        <button class="btn-secondary" id="stayPausedBtn" type="button">Stay paused</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("resumeAfterIdleBtn").addEventListener("click", () => {
    const data = getStudyData();
    data.isRunning = true;
    data.pausedForInactivity = false;
    setStudyData(data);
    closeInactivityModal();
    resetPracticeInactivityTimer();
    startTimerTick();
  });

  document.getElementById("stayPausedBtn").addEventListener("click", () => {
    const data = getStudyData();
    data.isRunning = false;
    data.pausedForInactivity = false;
    setStudyData(data);
    closeInactivityModal();
  });
}

function resetPracticeInactivityTimer() {
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  closeInactivityModal();

  if (!window.location.hash.startsWith("#quiz/")) return;

  const data = getStudyData();
  if (!data.isRunning) return;

  inactivityTimeout = setTimeout(() => {
    if (window.location.hash.startsWith("#quiz/")) {
      pausePracticeTimerForInactivity();
    }
  }, 10 * 60 * 1000);
}

function bindPracticeActivityListeners() {
  if (window.__practiceActivityBound) return;
  window.__practiceActivityBound = true;

  ["click", "keydown", "mousemove", "mousedown", "touchstart", "scroll"].forEach((eventName) => {
    window.addEventListener(
      eventName,
      () => {
        if (window.location.hash.startsWith("#quiz/")) {
          resetPracticeInactivityTimer();
        }
      },
      { passive: true }
    );
  });
}

function ensurePracticeTimerStarted() {
  const data = getStudyData();
  if (!data.isRunning) {
    data.isRunning = true;
    data.pausedForInactivity = false;
    setStudyData(data);
  }
  bindPracticeActivityListeners();
  resetPracticeInactivityTimer();
  startTimerTick();
}

/* ------------------------------ study mode ------------------------------- */

function getStudyModeKey(subjectId) {
  return `${STORAGE_KEYS.studyModePrefix}${getUserId() || "guest"}_${subjectId}`;
}

function getStudyModeState(subjectId) {
  return getJson(getStudyModeKey(subjectId), {
    index: 0,
    durationMinutes: 30,
    remainingSeconds: 30 * 60,
    running: false
  });
}

function setStudyModeState(subjectId, value) {
  setJson(getStudyModeKey(subjectId), value);
}

function clearStudyModeInterval() {
  if (studyModeTicker) {
    clearInterval(studyModeTicker);
    studyModeTicker = null;
  }
}

function getStudyModeAnswers() {
  return getJson(STORAGE_KEYS.studyModeAnswers, {});
}

function setStudyModeAnswers(answers) {
  setJson(STORAGE_KEYS.studyModeAnswers, answers);
}

function getStudyModeQuestionKey(subjectId, question) {
  return `${subjectId}__${question.id ? `custom_${question.id}` : question.question}`;
}

function saveStudyModeAnswer(subjectId, question, value) {
  const answers = getStudyModeAnswers();
  answers[getStudyModeQuestionKey(subjectId, question)] = value;
  setStudyModeAnswers(answers);
}

function getStudyModeAnswer(subjectId, question) {
  const answers = getStudyModeAnswers();
  return answers[getStudyModeQuestionKey(subjectId, question)] || "";
}

/* ----------------------------- subject flyout ----------------------------- */

function buildSubjectFlyout(subjects, mySubjects) {
  const available = subjects.filter((subject) => !mySubjects.includes(subject.id));

  return `
    <div class="subject-flyout">
      <button class="subject-flyout-trigger" type="button" aria-label="Add subject">⌕</button>
      <div class="subject-flyout-panel">
        <div class="subject-search-all-header">Add a subject</div>
        <div class="subject-search-list">
          ${
            available.length
              ? available
                  .map(
                    (subject) => `
                <div class="subject-search-item">
                  <div>
                    <h4>${escapeHtml(subject.name)}</h4>
                    <p>${escapeHtml(subject.description)}</p>
                  </div>
                  <button class="btn-primary add-subject-btn" data-subject="${subject.id}" type="button">Add</button>
                </div>
              `
                  )
                  .join("")
              : `<div class="subject-search-empty">You already added every available subject.</div>`
          }
        </div>
      </div>
    </div>
  `;
}

function attachSubjectSearchLogic(mySubjects) {
  document.querySelectorAll(".add-subject-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addMySubjectLocal(button.dataset.subject);
      renderDashboard();
    });
  });
}

/* ----------------------------- layout builder ----------------------------- */

function buildAppLayout(activePage, content, heading, subheading, extraTopLeft = "") {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <img src="${LOGO_PATH}" alt="Nodent logo" class="sidebar-logo" />
            <div class="sidebar-brand-text">
              <h2>Nodent</h2>
              <p>Focused student workspace</p>
            </div>
          </div>

          <nav class="nav">
            <button class="nav-btn ${activePage === "dashboard" ? "active" : ""}" id="navDashboard">
              <span>▣</span>
              <span class="nav-label">Dashboard</span>
            </button>

            <button class="nav-btn ${activePage === "track-study" ? "active" : ""}" id="navTrack">
              <span>◔</span>
              <span class="nav-label">Track My Study</span>
            </button>
          </nav>
        </div>

        <div class="user-card">
          <div class="small">Signed in as</div>
          <div class="email">${escapeHtml(getUserEmail())}</div>
          <button class="btn-danger w-full" id="logoutBtn">Log out</button>
        </div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="topbar-left">
            ${extraTopLeft}
            <div>
              <h1>${escapeHtml(heading)}</h1>
              <p>${escapeHtml(subheading)}</p>
            </div>
          </div>
          <div class="top-pill">Accounts and scores saved locally</div>
        </div>
        ${content}
      </main>
    </div>
  `;

  document.getElementById("navDashboard").addEventListener("click", () => {
    window.location.hash = "#dashboard";
  });

  document.getElementById("navTrack").addEventListener("click", () => {
    window.location.hash = "#track-study";
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

/* -------------------------------- login -------------------------------- */

function renderLogin() {
  const rememberedEmail = getRememberLogin() ? getCurrentUser()?.email || "" : "";

  app.innerHTML = `
    <section class="auth-page">
      <div class="auth-left">
        <div class="brand-row">
          <img src="${LOGO_PATH}" alt="Nodent logo" class="brand-logo-large" />
          <div>
            <div class="brand-title">Nodent</div>
            <div class="brand-sub">Focused student workspace</div>
          </div>
        </div>

        <h1 class="hero-title">Study cleaner. Revise sharper.</h1>
        <p class="hero-text">
          Practise VCE-style questions, track your study time, store written responses, and discuss subject questions in a cleaner interface.
        </p>
      </div>

      <div class="auth-right">
        <div class="login-panel">
          <h2>Welcome back</h2>
          <p class="subtext">Log in or create an account to continue where you left off.</p>

          <form id="authForm">
            <div class="form-group">
              <label class="label" for="email">Email</label>
              <input id="email" type="email" placeholder="your@email.com" value="${escapeHtml(
                rememberedEmail
              )}" required />
            </div>

            <div class="form-group">
              <label class="label" for="password">Password</label>
              <input id="password" type="password" placeholder="••••••••" required />
            </div>

            <label class="checkbox-line">
              <input id="rememberLogin" type="checkbox" ${getRememberLogin() ? "checked" : ""} />
              Keep me signed in
            </label>

            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <button class="btn-primary" type="submit">Log In</button>
              <button class="btn-secondary" type="button" id="signupBtn">Create Account</button>
            </div>

            <div class="error-message" id="authError"></div>
          </form>
        </div>
      </div>
    </section>
  `;

  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const authError = document.getElementById("authError");
    authError.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("rememberLogin").checked;

    try {
      await login(email, password, remember);
      window.location.hash = "#dashboard";
      render();
    } catch (error) {
      authError.textContent = error.message;
    }
  });

  document.getElementById("signupBtn").addEventListener("click", async () => {
    const authError = document.getElementById("authError");
    authError.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const remember = document.getElementById("rememberLogin").checked;

    try {
      await signup(email, password, remember);
      window.location.hash = "#dashboard";
      render();
    } catch (error) {
      authError.textContent = error.message;
    }
  });
}

/* ------------------------------- dashboard ------------------------------- */

function renderDashboard() {
  const subjects = getSubjects();
  const mySubjects = getMySubjects();
  const currentSubjects = subjects.filter((subject) => mySubjects.includes(subject.id));

  const content = `
    <div class="dashboard-grid">
      <section class="panel">
        <h3>My Subjects</h3>
        <div class="panel-text">
          Open the search icon in the top-left to add more VCE subjects.
        </div>

        <div class="subject-grid">
          ${
            currentSubjects.length
              ? currentSubjects
                  .map(
                    (subject) => `
                <article class="subject-card">
                  <div class="subject-head">
                    <h4>${escapeHtml(subject.name)}</h4>
                    <div class="subject-head-actions">
                      <span class="tag">${escapeHtml(subject.category)}</span>
                      <button class="subject-remove-btn" data-remove="${subject.id}" type="button" aria-label="Remove ${escapeHtml(
                      subject.name
                    )}" title="Remove ${escapeHtml(subject.name)}">×</button>
                    </div>
                  </div>
                  <div class="subject-desc">${escapeHtml(subject.description)}</div>
                  <div class="subject-actions">
                    <button class="btn-primary" data-quiz="${subject.id}" type="button">Quiz</button>
                    <button class="btn-secondary" data-summary="${subject.id}" type="button">Completed Summary</button>
                    <button class="btn-success" data-chat="${subject.id}" type="button">Public Chat</button>
                  </div>
                </article>
              `
                  )
                  .join("")
              : `<div class="empty">No subjects on your dashboard yet.</div>`
          }
        </div>
      </section>
    </div>
  `;

  buildAppLayout(
    "dashboard",
    content,
    "Dashboard",
    "Manage your study subjects, launch quizzes, and open subject discussion spaces.",
    buildSubjectFlyout(subjects, mySubjects)
  );

  attachSubjectSearchLogic(mySubjects);

  document.querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      removeMySubjectLocal(button.getAttribute("data-remove"));
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-quiz]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#quiz/${button.getAttribute("data-quiz")}`;
    });
  });

  document.querySelectorAll("[data-summary]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#quiz/${button.getAttribute("data-summary")}?summary=1`;
    });
  });

  document.querySelectorAll("[data-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      window.location.hash = `#chat/${button.getAttribute("data-chat")}`;
    });
  });
}

/* ------------------------------ study timer ------------------------------ */

function renderTrackStudy() {
  const state = getStudyData();
  const progressPercent = Math.min(
    100,
    Math.round((state.dailySeconds / Math.max(1, state.goalMinutes * 60)) * 100)
  );

  const content = `
    <div class="study-grid">
      <section class="timer-card">
        <h2>Study Timer</h2>
        <p class="muted">This timer tracks your study total for today.</p>

        <div class="timer-status">${state.isRunning ? "Running" : "Paused"}</div>
        <div class="timer-display" id="timerDisplay">${formatSeconds(state.remainingSeconds)}</div>

        <div class="timer-controls">
          <button class="btn-primary" id="timerToggleBtn" type="button">${
            state.isRunning ? "Pause" : "Start"
          }</button>
          <button class="btn-secondary" id="timerResetBtn" type="button">Reset</button>
          <button class="btn-amber" id="timerSaveBtn" type="button">Save Settings</button>
        </div>

        <div class="timer-settings">
          <div>
            <label class="label">Goal minutes</label>
            <input id="goalMinutesInput" type="number" min="15" value="${state.goalMinutes}" />
          </div>
          <div>
            <label class="label">Session minutes</label>
            <input id="sessionMinutesInput" type="number" min="5" value="${state.sessionMinutes}" />
          </div>
        </div>
      </section>

      <section class="progress-card">
        <h2>Today’s Progress</h2>

        <div class="progress-ring-panel">
          <div class="progress-circle" style="--progress:${progressPercent}">
            <div class="progress-circle-inner">
              <strong>${progressPercent}%</strong>
              <span>Daily goal</span>
            </div>
          </div>
        </div>

        <div class="daily-progress-bar">
          <div class="daily-progress-fill" style="width:${progressPercent}%"></div>
        </div>

        <div class="stat-list">
          <div class="stat-row">
            <span>Study time today</span>
            <strong>${Math.round(state.dailySeconds / 60)} min</strong>
          </div>
          <div class="stat-row">
            <span>Completed sessions</span>
            <strong>${state.sessionsCompleted}</strong>
          </div>
          <div class="stat-row">
            <span>Goal</span>
            <strong>${state.goalMinutes} min</strong>
          </div>
          <div class="stat-row">
            <span>Session length</span>
            <strong>${state.sessionMinutes} min</strong>
          </div>
        </div>
      </section>
    </div>
  `;

  buildAppLayout(
    "track-study",
    content,
    "Track Study",
    "Keep your daily study time moving with a dedicated timer."
  );

  const goalMinutesInput = document.getElementById("goalMinutesInput");
  const sessionMinutesInput = document.getElementById("sessionMinutesInput");

  document.getElementById("timerToggleBtn").addEventListener("click", () => {
    const latest = getStudyData();
    latest.isRunning = !latest.isRunning;
    setStudyData(latest);
    renderTrackStudy();
  });

  document.getElementById("timerResetBtn").addEventListener("click", () => {
    const latest = getStudyData();
    latest.isRunning = false;
    latest.remainingSeconds = latest.sessionMinutes * 60;
    setStudyData(latest);
    renderTrackStudy();
  });

  document.getElementById("timerSaveBtn").addEventListener("click", () => {
    const latest = getStudyData();
    latest.goalMinutes = Math.max(15, Number(goalMinutesInput.value) || 120);
    latest.sessionMinutes = Math.max(5, Number(sessionMinutesInput.value) || 25);
    if (!latest.isRunning) {
      latest.remainingSeconds = latest.sessionMinutes * 60;
    }
    setStudyData(latest);
    renderTrackStudy();
  });

  clearTimerInterval();

  if (state.isRunning) {
    startTimerTick();
  }
}

/* ------------------------------- summary -------------------------------- */

function renderCompletedSummary(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) {
    window.location.hash = "#dashboard";
    return;
  }

  const state = getPracticeState(subjectId);
  const questions = subject.quiz;
  const completedQuestions = questions.filter((question) =>
    state.completedQuestionKeys.includes(question.question)
  );

  const content = `
    <div class="page-wide">
      <div class="back-row practice-top-actions">
        <button class="btn-secondary" id="backBtn" type="button">← Back to Dashboard</button>
        <div class="practice-top-actions-right">
          <button class="btn-primary" id="backToPracticeBtn" type="button">Continue Practice</button>
          <button class="btn-secondary" id="restartPracticeBtn" type="button">Restart Completed List</button>
        </div>
      </div>

      <section class="panel">
        <div class="practice-summary-head">
          <div>
            <h3>${escapeHtml(subject.name)} Practice Summary</h3>
            <p class="panel-text">Review your completed questions and continue the ongoing practice whenever you are ready.</p>
          </div>
        </div>

        ${
          completedQuestions.length
            ? `<div class="practice-summary-list">
                ${completedQuestions
                  .map((question, index) => {
                    const savedResponse = getWrittenResponse(subjectId, question.question);
                    const answerState = state.answers?.[question.question];
                    const statusLabel =
                      answerState?.isCorrect === true
                        ? "Correct"
                        : answerState?.isCorrect === false
                          ? "Incorrect"
                          : "Saved";

                    const statusClass =
                      answerState?.isCorrect === true
                        ? "correct"
                        : answerState?.isCorrect === false
                          ? "incorrect"
                          : "saved";

                    return `
                      <article class="practice-summary-item">
                        <div class="practice-summary-number">${index + 1}</div>
                        <div>
                          <div class="quiz-type-badge">${escapeHtml(getQuestionTypeLabel(question.type || "mcq"))}</div>
                          <h4>${escapeHtml(question.question)}</h4>
                          <div class="quiz-feedback ${statusClass}" style="display:inline-block; margin-top:10px;">
                            ${statusLabel}
                          </div>
                          ${
                            savedResponse
                              ? `<div class="saved-response"><strong>Your response:</strong><br>${escapeHtml(savedResponse.response)}</div>`
                              : answerState?.answer
                                ? `<div class="saved-response"><strong>Your answer:</strong><br>${escapeHtml(answerState.answer)}</div>`
                                : `<p class="panel-text">Completed.</p>`
                          }
                          ${
                            question.type === "mcq" && question.answer
                              ? `<div class="saved-response"><strong>Correct answer:</strong><br>${escapeHtml(question.answer)}</div>`
                              : ""
                          }
                        </div>
                      </article>
                    `;
                  })
                  .join("")}
              </div>`
            : `<div class="empty">You have not completed any practice questions yet.</div>`
        }
      </section>
    </div>
  `;

  buildAppLayout("", content, `${subject.name} Practice`, "Review completed questions and continue when ready.");

  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.hash = "#dashboard";
  });

  document.getElementById("backToPracticeBtn").addEventListener("click", () => {
    const refreshed = getPracticeState(subjectId);
    refreshed.summaryOpen = false;
    setPracticeState(subjectId, refreshed);
    renderQuiz(subjectId, false);
  });

  document.getElementById("restartPracticeBtn").addEventListener("click", () => {
    resetPracticeState(subjectId);
    renderQuiz(subjectId, false);
  });
}

/* -------------------------------- quiz -------------------------------- */

async function renderQuiz(subjectId, openSummary = false) {
  const subject = getSubjectById(subjectId);
  if (!subject) {
    window.location.hash = "#dashboard";
    return;
  }

  ensurePracticeTimerStarted();

  const practiceState = getPracticeState(subjectId);
  if (openSummary) {
    practiceState.summaryOpen = true;
    setPracticeState(subjectId, practiceState);
  }

  if (practiceState.summaryOpen) {
    return renderCompletedSummary(subjectId);
  }

  const questions = subject.quiz;
  let currentIndex = questions.findIndex(
    (question) => !practiceState.completedQuestionKeys.includes(question.question)
  );
  if (currentIndex < 0) currentIndex = 0;

  async function showQuestion() {
    resetPracticeInactivityTimer();

    const question = questions[currentIndex];
    const type = question.type || "mcq";
    const progressPercent = questions.length ? Math.round((currentIndex / questions.length) * 100) : 0;
    const flatComments = await fetchQuestionComments(subject.id, question.question);
    const savedResponse = await loadWrittenResponse(subject.id, question.question);
    const commentTree = buildCommentTree(flatComments);

    const answerUI =
      type === "mcq"
        ? `
          <div class="quiz-options">
            ${(question.options || [])
              .map(
                (option) => `
              <button class="quiz-option" data-answer="${escapeHtml(option)}" type="button">${escapeHtml(option)}</button>
            `
              )
              .join("")}
          </div>
        `
        : `
          <div class="quiz-answer-block">
            <textarea id="writtenAnswerInput" rows="${type === "short" ? 5 : 12}" placeholder="${
            type === "short" ? "Type your short answer..." : "Write your response here..."
          }">${savedResponse?.text ? escapeHtml(savedResponse.text) : savedResponse?.response ? escapeHtml(savedResponse.response) : ""}</textarea>
            <div class="quiz-answer-helper">
              ${
                type === "short"
                  ? "Short answers are checked against accepted responses and saved for review."
                  : "Written responses are saved for review and are not auto-marked."
              }
            </div>
          </div>
        `;

    const content = `
      <div class="page-wide">
        <div class="back-row practice-top-actions">
          <button class="btn-secondary" id="backBtn" type="button">← Back to Dashboard</button>
          <div class="practice-top-actions-right">
            <button class="btn-secondary" id="viewCompletedBtn" type="button">Completed Summary</button>
            <button class="btn-neutral" id="studyModeBtn" type="button">Enter Study Mode</button>
          </div>
        </div>

        <div class="quiz-meta">
          <span>${escapeHtml(subject.name)}</span>
          <span>${getPracticeState(subjectId).completedQuestionKeys.length} completed</span>
          <span>Question ${currentIndex + 1} of ${questions.length}</span>
        </div>

        <div class="quiz-layout quiz-layout-wide">
          <section class="quiz-card quiz-main-card">
            <div class="quiz-type-badge">${escapeHtml(getQuestionTypeLabel(type))}</div>
            <h2>${escapeHtml(question.question)}</h2>
            <p>Respond to this question, then move to the next one.</p>

            ${question.passage ? `<div class="quiz-passage">${escapeHtml(question.passage)}</div>` : ""}
            ${question.guidance ? `<p>${escapeHtml(question.guidance)}</p>` : ""}

            <div class="quiz-progress">
              <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" style="width:${progressPercent}%"></div>
              </div>
            </div>

            ${answerUI}
            <div id="feedback"></div>

            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:18px;">
              <button class="btn-primary" id="nextBtn" ${type === "mcq" ? "disabled" : ""} type="button">${
      currentIndex === questions.length - 1 ? "Finish Practice" : "Next Question"
    }</button>
            </div>
          </section>

          <aside class="quiz-comments-side quiz-comments-side-wide">
            <div class="quiz-comment-wrap quiz-comment-wrap-side">
              <h3>Question Comments</h3>
              <p>Discuss this exact question here.</p>

              <div class="quiz-comment-list">
                ${renderCommentTree(commentTree)}
              </div>

              <form class="quiz-comment-form quiz-comment-form-side" id="quizCommentForm">
                <input id="quizCommentInput" type="text" placeholder="Add a comment about this question." required />
                <button class="btn-secondary" type="submit">Post</button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    `;

    buildAppLayout("", content, `${subject.name} Practice`, "Mixed-format subject practice from your dashboard.");

    document.getElementById("backBtn").addEventListener("click", () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      closeInactivityModal();
      window.location.hash = "#dashboard";
    });

    document.getElementById("viewCompletedBtn").addEventListener("click", () => {
      const latest = getPracticeState(subjectId);
      latest.summaryOpen = true;
      setPracticeState(subjectId, latest);
      renderCompletedSummary(subjectId);
    });

    document.getElementById("studyModeBtn").addEventListener("click", () => {
      clearStudyModeInterval();
      window.location.hash = `#study-mode/${subject.id}`;
    });

    document.getElementById("quizCommentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("quizCommentInput");
      const text = input.value.trim();
      if (!text) return;
      await createQuestionComment(subject.id, question.question, text, null);
      showQuestion();
    });

    document.querySelectorAll(".quiz-reply-toggle").forEach((button) => {
      button.addEventListener("click", () => {
        const form = document.getElementById(`replyForm_${button.dataset.commentId}`);
        form.style.display = form.style.display === "none" ? "grid" : "none";
      });
    });

    document.querySelectorAll(".quiz-reply-form").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const commentId = Number(form.id.replace("replyForm_", ""));
        const input = document.getElementById(`replyInput_${commentId}`);
        const text = input.value.trim();
        if (!text) return;
        await createQuestionComment(subject.id, question.question, text, commentId);
        showQuestion();
      });
    });

    const nextBtn = document.getElementById("nextBtn");
    const feedback = document.getElementById("feedback");

    if (type === "mcq") {
      let selectedAnswer = null;
      let answerLocked = false;

      document.querySelectorAll(".quiz-option").forEach((button) => {
        button.addEventListener("click", () => {
          if (answerLocked) return;
          document.querySelectorAll(".quiz-option").forEach((btn) => btn.classList.remove("selected"));
          button.classList.add("selected");
          selectedAnswer = button.dataset.answer;
          nextBtn.disabled = false;
        });
      });

      nextBtn.addEventListener("click", () => {
        if (!selectedAnswer || answerLocked) return;
        answerLocked = true;

        const isCorrect = selectedAnswer === question.answer;
        const latestState = getPracticeState(subjectId);

        latestState.answers[question.question] = {
          answer: selectedAnswer,
          isCorrect
        };

        if (!latestState.completedQuestionKeys.includes(question.question)) {
          latestState.completedQuestionKeys.push(question.question);
          latestState.autoMarkedCount = (latestState.autoMarkedCount || 0) + 1;
          if (isCorrect) latestState.score = (latestState.score || 0) + 1;
        }

        setPracticeState(subjectId, latestState);

        feedback.innerHTML = isCorrect
          ? `<div class="quiz-feedback correct">Correct answer.</div>`
          : `<div class="quiz-feedback incorrect">Incorrect. Correct answer: ${escapeHtml(question.answer)}</div>`;

        if (currentIndex < questions.length - 1) {
          currentIndex += 1;
          setTimeout(showQuestion, 300);
        } else {
          setTimeout(() => renderCompletedSummary(subjectId), 300);
        }
      });
    } else {
      nextBtn.addEventListener("click", async () => {
        const input = document.getElementById("writtenAnswerInput");
        const typed = input.value.trim();

        if (!typed) {
          feedback.innerHTML = `<div class="quiz-feedback incorrect">Please enter a response before continuing.</div>`;
          return;
        }

        const latestState = getPracticeState(subjectId);
        await saveWrittenResponse(subject.id, question.question, typed);

        if (!latestState.completedQuestionKeys.includes(question.question)) {
          latestState.completedQuestionKeys.push(question.question);
        }

        if (type === "short") {
          const accepted = (question.acceptedAnswers || []).map(normalizeAnswer);
          const isCorrect = accepted.includes(normalizeAnswer(typed));

          if (!latestState.answers[question.question]) {
            latestState.autoMarkedCount = (latestState.autoMarkedCount || 0) + 1;
            if (isCorrect) latestState.score = (latestState.score || 0) + 1;
          }

          latestState.answers[question.question] = {
            answer: typed,
            isCorrect
          };

          feedback.innerHTML = isCorrect
            ? `<div class="quiz-feedback correct">Accepted short answer.</div>`
            : `<div class="quiz-feedback incorrect">Saved, but not matched to the accepted short answers.</div>`;
        } else {
          latestState.answers[question.question] = {
            answer: typed,
            isCorrect: null
          };
          feedback.innerHTML = `<div class="quiz-feedback saved">Written response saved for later review.</div>`;
        }

        setPracticeState(subjectId, latestState);

        if (currentIndex < questions.length - 1) {
          currentIndex += 1;
          showQuestion();
        } else {
          renderCompletedSummary(subjectId);
        }
      });
    }
  }

  showQuestion();
}

/* ------------------------------ study mode ------------------------------- */

function renderStudyMode(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) {
    window.location.hash = "#dashboard";
    return;
  }

  const questions = subject.quiz;
  let state = getStudyModeState(subjectId);

  if (state.index >= questions.length) {
    state.index = questions.length - 1;
    setStudyModeState(subjectId, state);
  }

  const question = questions[state.index];
  const questionType = question.type || "mcq";
  const savedAnswer = getStudyModeAnswer(subjectId, question);

  const studyModeAnswerUI =
    questionType === "mcq"
      ? `
        <div class="study-mode-answer-wrap">
          <div class="study-mode-answer-label">Your answer</div>
          <div class="study-mode-mcq-list">
            ${(question.options || [])
              .map(
                (option) => `
              <button
                class="study-mode-option ${savedAnswer === option ? "selected" : ""}"
                data-study-option="${escapeHtml(option)}"
                type="button"
              >
                ${escapeHtml(option)}
              </button>
            `
              )
              .join("")}
          </div>
        </div>
      `
      : `
        <div class="study-mode-answer-wrap">
          <div class="study-mode-answer-label">Your answer</div>
          <textarea
            id="studyModeAnswerInput"
            class="study-mode-answer-box"
            rows="${questionType === "short" ? 4 : 8}"
            placeholder="${
              questionType === "short" ? "Write your short answer..." : "Write your response here..."
            }"
          >${escapeHtml(savedAnswer)}</textarea>
        </div>
      `;

  app.innerHTML = `
    <div class="study-mode-shell">
      <div class="study-mode-topbar">
        <div class="study-mode-left">
          <button class="btn-secondary" id="exitStudyModeBtn" type="button">Exit Study Mode</button>
          <div class="study-mode-title">
            <strong>${escapeHtml(subject.name)}</strong>
            <span>Question ${state.index + 1} of ${questions.length}</span>
          </div>
        </div>

        <div class="study-mode-right">
          <select id="studyModeMinutes">
            ${[10, 15, 20, 25, 30, 45, 60, 90]
              .map(
                (min) =>
                  `<option value="${min}" ${state.durationMinutes === min ? "selected" : ""}>${min} min</option>`
              )
              .join("")}
          </select>

          <div class="study-mode-timer" id="studyModeTimer">${formatSeconds(state.remainingSeconds)}</div>

          <button class="btn-primary" id="studyModeToggleBtn" type="button">${
            state.running ? "Pause" : "Start"
          }</button>
          <button class="btn-neutral" id="studyModeResetBtn" type="button">Reset</button>
        </div>
      </div>

      <div class="study-mode-content">
        <div class="study-mode-type">${escapeHtml(getQuestionTypeLabel(questionType))}</div>
        <h1>${escapeHtml(question.question)}</h1>
        ${question.passage ? `<div class="study-mode-passage">${escapeHtml(question.passage)}</div>` : ""}
        ${question.guidance ? `<p class="study-mode-guidance">${escapeHtml(question.guidance)}</p>` : ""}
        ${studyModeAnswerUI}
      </div>

      <div class="study-mode-nav">
        <button class="btn-secondary" id="studyModePrevBtn" type="button" ${
          state.index === 0 ? "disabled" : ""
        }>← Previous</button>
        <button class="btn-secondary" id="studyModeNextBtn" type="button" ${
          state.index === questions.length - 1 ? "disabled" : ""
        }>Next →</button>
      </div>
    </div>
  `;

  document.getElementById("exitStudyModeBtn").addEventListener("click", () => {
    clearStudyModeInterval();
    window.location.hash = `#quiz/${subjectId}`;
  });

  document.getElementById("studyModePrevBtn").addEventListener("click", () => {
    if (state.index === 0) return;
    state.index -= 1;
    setStudyModeState(subjectId, state);
    clearStudyModeInterval();
    renderStudyMode(subjectId);
  });

  document.getElementById("studyModeNextBtn").addEventListener("click", () => {
    if (state.index === questions.length - 1) return;
    state.index += 1;
    setStudyModeState(subjectId, state);
    clearStudyModeInterval();
    renderStudyMode(subjectId);
  });

  document.getElementById("studyModeMinutes").addEventListener("change", (event) => {
    const minutes = Number(event.target.value);
    state.durationMinutes = minutes;
    state.remainingSeconds = minutes * 60;
    state.running = false;
    setStudyModeState(subjectId, state);
    clearStudyModeInterval();
    renderStudyMode(subjectId);
  });

  document.getElementById("studyModeToggleBtn").addEventListener("click", () => {
    state.running = !state.running;
    setStudyModeState(subjectId, state);
    clearStudyModeInterval();
    renderStudyMode(subjectId);
  });

  document.getElementById("studyModeResetBtn").addEventListener("click", () => {
    state.remainingSeconds = state.durationMinutes * 60;
    state.running = false;
    setStudyModeState(subjectId, state);
    clearStudyModeInterval();
    renderStudyMode(subjectId);
  });

  document.querySelectorAll("[data-study-option]").forEach((button) => {
    button.addEventListener("click", () => {
      saveStudyModeAnswer(subjectId, question, button.dataset.studyOption);
      renderStudyMode(subjectId);
    });
  });

  const studyModeAnswerInput = document.getElementById("studyModeAnswerInput");
  if (studyModeAnswerInput) {
    studyModeAnswerInput.addEventListener("input", () => {
      saveStudyModeAnswer(subjectId, question, studyModeAnswerInput.value);
    });
  }

  clearStudyModeInterval();

  if (state.running) {
    studyModeTicker = setInterval(() => {
      const latest = getStudyModeState(subjectId);

      if (!latest.running) {
        clearStudyModeInterval();
        return;
      }

      if (latest.remainingSeconds > 0) {
        latest.remainingSeconds -= 1;
        setStudyModeState(subjectId, latest);
        const timerNode = document.getElementById("studyModeTimer");
        if (timerNode) timerNode.textContent = formatSeconds(latest.remainingSeconds);
      } else {
        latest.running = false;
        setStudyModeState(subjectId, latest);
        clearStudyModeInterval();
        renderStudyMode(subjectId);
      }
    }, 1000);
  }
}

/* --------------------------------- chat --------------------------------- */

function renderChat(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) {
    window.location.hash = "#dashboard";
    return;
  }

  const chats = getChats();
  const messages = chats[subjectId] || [];
  const currentUserId = getUserId();

  const content = `
    <div class="chat-shell">
      <div class="back-row">
        <button class="btn-secondary" id="backBtn" type="button">← Back</button>
      </div>

      <section class="chat-panel">
        <div class="chat-header">
          <h2>${escapeHtml(subject.name)} Public Chat</h2>
          <p>This chat is only for ${escapeHtml(subject.name)}.</p>
        </div>

        <div class="chat-box" id="chatBox">
          ${
            messages.length
              ? messages
                  .map(
                    (message) => `
                <div class="chat-message ${message.userId === currentUserId ? "own" : ""}">
                  <div class="chat-meta">${escapeHtml(message.userEmail)} • ${escapeHtml(
                      formatDateTime(message.time)
                    )}</div>
                  <div class="chat-text">${escapeHtml(message.text)}</div>
                </div>
              `
                  )
                  .join("")
              : `<div class="subject-search-empty">No messages yet for this subject.</div>`
          }
        </div>

        <form class="chat-form" id="chatForm">
          <input id="chatInput" type="text" placeholder="Write a message..." required />
          <button class="btn-primary" type="submit">Send</button>
        </form>
      </section>
    </div>
  `;

  buildAppLayout("dashboard", content, `${subject.name} Chat`, "Public discussion for this subject only.");

  document.getElementById("backBtn").addEventListener("click", () => {
    window.location.hash = "#dashboard";
  });

  document.getElementById("chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    const updatedChats = getChats();
    if (!updatedChats[subjectId]) updatedChats[subjectId] = [];

    updatedChats[subjectId].push({
      id: Date.now(),
      userEmail: getUserEmail(),
      userId: getUserId(),
      text,
      time: new Date().toISOString()
    });

    setChats(updatedChats);
    renderChat(subjectId);
  });

  const chatBox = document.getElementById("chatBox");
  chatBox.scrollTop = chatBox.scrollHeight;
}

/* -------------------------------- router -------------------------------- */

async function render() {
  const hash = window.location.hash || "#login";

  if (getAuthToken() && !getCurrentUser()) {
    await hydrateSession();
  }

  if (!getLoggedIn() && hash !== "#login") {
    window.location.hash = "#login";
    return;
  }

  if (getLoggedIn() && hash === "#login") {
    window.location.hash = "#dashboard";
    return;
  }

  clearTimerInterval();
  clearStudyModeInterval();
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  closeInactivityModal();

  if (hash === "#login") return renderLogin();
  if (hash === "#dashboard") return renderDashboard();
  if (hash === "#track-study") return renderTrackStudy();

  if (hash.startsWith("#quiz/")) {
    const [pathPart, queryPart] = hash.split("?");
    const subjectId = decodeURIComponent(pathPart.replace("#quiz/", ""));
    const params = new URLSearchParams(queryPart || "");
    const openSummary = params.get("summary") === "1";
    return renderQuiz(subjectId, openSummary);
  }

  if (hash.startsWith("#study-mode/")) {
    return renderStudyMode(hash.split("/")[1]);
  }

  if (hash.startsWith("#chat/")) {
    return renderChat(hash.split("/")[1]);
  }

  window.location.hash = getLoggedIn() ? "#dashboard" : "#login";
}

/* ------------------------------- startup -------------------------------- */

window.addEventListener("hashchange", render);
window.addEventListener("load", async () => {
  await hydrateSession();
  render();
});