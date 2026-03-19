const app = document.getElementById("app");

const STORAGE_KEYS = {
  currentUser: "nodent_current_user",
  authToken: "nodent_auth_token",
  rememberLogin: "nodent_remember_login",
  practiceStatePrefix: "nodent_practice_state_",
  mySubjectsPrefix: "nodent_my_subjects_",
  chats: "nodent_public_chats",
  studyPrefix: "nodent_study_",
  customQuestions: "nodent_custom_questions",
  quizComments: "nodent_quiz_comments",
  writtenResponses: "nodent_written_responses"
};

const LOGO_PATH = "logo.png";
let adminUnlocked = false;

const BASE_SUBJECTS = [
  {
    id: "english",
    name: "English",
    category: "VCE",
    description: "Text response, argument analysis, comparative writing, and language development.",
    quiz: [
      {
        type: "long",
        question: "Read the passage below and explain how language choices shape the reader’s response. Refer closely to tone, persuasive devices, and intended audience.",
        passage:
`'We cannot keep calling these changes temporary when they are already shaping the future of entire communities. Every season of delay comes with another cost, another loss, another opportunity abandoned. The question is no longer whether action is necessary, but whether we are prepared to act with courage rather than convenience.'`,
        guidance: "Write a sustained analytical response. Aim for a clear contention, close analysis of language, and logical paragraphing."
      },
      {
        type: "long",
        question: "Discuss how a strong introduction establishes the direction of an English essay.",
        guidance: "Write an essay-style response with a clear central argument and developed explanation."
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
      { type: "long", question: "Explain how structure supports function in one biological organelle of your choice.", guidance: "Use a developed scientific explanation with correct terminology." }
    ]
  },
  {
    id: "chemistry",
    name: "Chemistry",
    category: "VCE",
    description: "Reactions, bonding, acids and bases, organic chemistry, and chemical analysis.",
    quiz: [
      { type: "mcq", question: "The atomic number equals the number of:", options: ["Protons", "Neutrons", "Shells", "Bonds"], answer: "Protons" },
      { type: "short", question: "What is the chemical formula for water?", acceptedAnswers: ["h2o"] },
      { type: "mcq", question: "A pH below 7 is:", options: ["Acidic", "Basic", "Neutral", "Metallic"], answer: "Acidic" }
    ]
  },
  {
    id: "physics",
    name: "Physics",
    category: "VCE",
    description: "Motion, electricity, energy, waves, fields, and modern physics principles.",
    quiz: [
      { type: "mcq", question: "Force equals:", options: ["mass × acceleration", "mass ÷ acceleration", "velocity × mass", "time × energy"], answer: "mass × acceleration" },
      { type: "short", question: "What is the SI unit of energy?", acceptedAnswers: ["joule", "joules", "j"] },
      { type: "long", question: "Explain the difference between scalar and vector quantities with at least two examples.", guidance: "Write a structured explanation using correct physics terminology." }
    ]
  },
  {
    id: "psychology",
    name: "Psychology",
    category: "VCE",
    description: "Memory, learning, mental processes, behaviour, and the nervous system.",
    quiz: [
      { type: "mcq", question: "The brain and spinal cord form the:", options: ["Central nervous system", "Peripheral nervous system", "Digestive system", "Respiratory system"], answer: "Central nervous system" },
      { type: "short", question: "Classical conditioning is associated with which researcher?", acceptedAnswers: ["pavlov", "ivan pavlov"] },
      { type: "long", question: "Explain one theory of memory and discuss how it helps us understand learning.", guidance: "Use psychology terminology and build a logical written response." }
    ]
  },
  {
    id: "legal-studies",
    name: "Legal Studies",
    category: "VCE",
    description: "Justice, rights, courts, legal institutions, and law-making processes.",
    quiz: [
      { type: "mcq", question: "One purpose of the legal system is to:", options: ["Resolve disputes fairly", "Remove all laws", "Ignore rights", "Replace education"], answer: "Resolve disputes fairly" },
      { type: "short", question: "Parliament mainly creates what type of law?", acceptedAnswers: ["statute law"] },
      { type: "long", question: "Discuss how an effective legal system balances fairness, access, and timeliness.", guidance: "Develop your response using legal concepts and clear explanation." }
    ]
  },
  {
    id: "business-management",
    name: "Business Management",
    category: "VCE",
    description: "Management styles, operations, human resources, and business decision-making.",
    quiz: [
      { type: "mcq", question: "A business objective is:", options: ["A business goal", "A random slogan", "A legal penalty", "A timetable"], answer: "A business goal" },
      { type: "short", question: "Human resources mainly focuses on what?", acceptedAnswers: ["employees", "staff", "workers"] },
      { type: "long", question: "Explain how operations management can influence efficiency and competitiveness.", guidance: "Use a business example where possible." }
    ]
  },
  {
    id: "economics",
    name: "Economics",
    category: "VCE",
    description: "Markets, policy, living standards, macroeconomic goals, and resource allocation.",
    quiz: [
      { type: "mcq", question: "Inflation is:", options: ["A rise in the general price level", "Lower population growth", "Only bank profit", "A drop in all prices"], answer: "A rise in the general price level" },
      { type: "short", question: "Demand usually falls when price does what?", acceptedAnswers: ["rises", "increase", "increases"] },
      { type: "long", question: "Explain how inflation can affect households, businesses, and government policy.", guidance: "Build a structured economics response using clear links between cause and effect." }
    ]
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "VCE",
    description: "Recording, reporting, analysis, and use of financial information in business.",
    quiz: [
      { type: "mcq", question: "Accounting information should be:", options: ["Relevant and reliable", "Random and unclear", "Only decorative", "Delayed and incomplete"], answer: "Relevant and reliable" },
      { type: "short", question: "Revenue usually means what?", acceptedAnswers: ["income", "income earned by the business", "business income"] },
      { type: "long", question: "Explain why accurate financial reporting matters for decision-making in a business.", guidance: "Write a concise but developed accounting explanation." }
    ]
  },
  {
    id: "history-revolutions",
    name: "History: Revolutions",
    category: "VCE",
    description: "The causes, events, and consequences of major revolutions and social change.",
    quiz: [
      { type: "mcq", question: "A revolution usually involves:", options: ["Major political and social change", "A weather event", "Only small local changes", "No historical impact"], answer: "Major political and social change" },
      { type: "short", question: "Historical evidence is important because it does what?", acceptedAnswers: ["supports interpretations of the past", "supports historical interpretation", "supports interpretations"] },
      { type: "long", question: "Discuss one major cause and one major consequence of a revolution you have studied.", guidance: "Use specific historical evidence in a structured paragraph or essay response." }
    ]
  }
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDateTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function getAuthToken() {
  return localStorage.getItem(STORAGE_KEYS.authToken) || "";
}

function setAuthSession(token, user, rememberLogin = false) {
  localStorage.setItem(STORAGE_KEYS.authToken, token);
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.rememberLogin, rememberLogin ? "1" : "0");
}

function clearAuthSession() {
  localStorage.removeItem(STORAGE_KEYS.authToken);
  localStorage.removeItem(STORAGE_KEYS.currentUser);
  localStorage.removeItem(STORAGE_KEYS.rememberLogin);
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.currentUser) || "null");
  } catch (_error) {
    return null;
  }
}

function getUserId() {
  const user = getCurrentUser();
  return user ? user.id : null;
}

function getUsername() {
  const user = getCurrentUser();
  return user ? (user.username || user.email || "Student") : "Student";
}

function getEmail() {
  const user = getCurrentUser();
  return user ? (user.email || "") : "";
}

function getLoggedIn() {
  return Boolean(getCurrentUser() && getAuthToken());
}

async function apiRequest(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "string"
      ? payload
      : payload?.error || "Request failed.";
    throw new Error(message);
  }

  return payload;
}

async function loginRequest(login, password) {
  return apiRequest("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: login, username: login, password })
  });
}

async function signupRequest(username, email, password) {
  return apiRequest("/api/signup", {
    method: "POST",
    body: JSON.stringify({ username, email, password })
  });
}

async function logoutRequest() {
  return apiRequest("/api/logout", { method: "POST" });
}

async function fetchProfile() {
  return apiRequest("/api/me");
}

async function fetchComments(subjectId, questionKey) {
  return apiRequest(`/api/comments/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`);
}

async function postComment(subjectId, questionKey, text, parentCommentId = null) {
  return apiRequest(`/api/comments/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`, {
    method: "POST",
    body: JSON.stringify({ text, parentCommentId })
  });
}

async function fetchWrittenResponseApi(subjectId, questionKey) {
  return apiRequest(`/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`);
}

async function saveWrittenResponseApi(subjectId, questionKey, responseText) {
  return apiRequest(`/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`, {
    method: "PUT",
    body: JSON.stringify({ responseText })
  });
}

async function fetchOtherWrittenResponses(subjectId, questionKey) {
  return apiRequest(`/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}/all`);
}

function getCustomQuestionsMap() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.customQuestions) || "{}");
  } catch (_error) {
    return {};
  }
}

function setCustomQuestionsMap(value) {
  localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(value));
}

function getCustomQuestionsForSubject(subjectId) {
  const map = getCustomQuestionsMap();
  return Array.isArray(map[subjectId]) ? map[subjectId] : [];
}

function addCustomQuestion(subjectId, question) {
  const map = getCustomQuestionsMap();
  if (!Array.isArray(map[subjectId])) map[subjectId] = [];
  map[subjectId].push(question);
  setCustomQuestionsMap(map);
}

function mergeSubjectsWithCustomQuestions(subjects) {
  return subjects.map(subject => ({
    ...subject,
    quiz: [...subject.quiz, ...getCustomQuestionsForSubject(subject.id)]
  }));
}

function getSubjectLibrary() {
  return mergeSubjectsWithCustomQuestions(BASE_SUBJECTS);
}

function getMySubjects() {
  const userId = getUserId() || "guest";
  try {
    const stored = JSON.parse(localStorage.getItem(`${STORAGE_KEYS.mySubjectsPrefix}${userId}`) || "null");
    if (Array.isArray(stored) && stored.length) {
      return mergeSubjectsWithCustomQuestions(stored);
    }
  } catch (_error) {
    // ignore
  }
  const defaultSubjects = getSubjectLibrary();
  localStorage.setItem(`${STORAGE_KEYS.mySubjectsPrefix}${userId}`, JSON.stringify(defaultSubjects));
  return defaultSubjects;
}

function setMySubjects(subjects) {
  const userId = getUserId() || "guest";
  localStorage.setItem(`${STORAGE_KEYS.mySubjectsPrefix}${userId}`, JSON.stringify(subjects));
}

function getSubjectById(subjectId) {
  return getMySubjects().find(subject => subject.id === subjectId);
}

function addSubjectToLibrary(subject) {
  const existing = getMySubjects();
  if (existing.some(item => item.id === subject.id)) return;
  setMySubjects([...existing, subject]);
}

function removeSubjectFromLibrary(subjectId) {
  setMySubjects(getMySubjects().filter(subject => subject.id !== subjectId));
}

function getPracticeState(subjectId) {
  const userId = getUserId() || "guest";
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEYS.practiceStatePrefix}${userId}_${subjectId}`) || "null") || {
      completedQuestionKeys: [],
      summaryOpen: false
    };
  } catch (_error) {
    return { completedQuestionKeys: [], summaryOpen: false };
  }
}

function setPracticeState(subjectId, value) {
  const userId = getUserId() || "guest";
  localStorage.setItem(`${STORAGE_KEYS.practiceStatePrefix}${userId}_${subjectId}`, JSON.stringify(value));
}

function markQuestionCompleted(subjectId, questionKey) {
  const state = getPracticeState(subjectId);
  if (!state.completedQuestionKeys.includes(questionKey)) {
    state.completedQuestionKeys.push(questionKey);
    setPracticeState(subjectId, state);
  }
}

function getWrittenResponses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.writtenResponses) || "{}");
  } catch (_error) {
    return {};
  }
}

function saveWrittenResponse(subjectId, questionKey, response) {
  const userId = getUserId() || "guest";
  const allResponses = getWrittenResponses();
  const compositeKey = `${userId}__${subjectId}__${questionKey}`;
  allResponses[compositeKey] = {
    response,
    time: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEYS.writtenResponses, JSON.stringify(allResponses));
}

function getWrittenResponse(subjectId, questionKey) {
  const userId = getUserId() || "guest";
  const allResponses = getWrittenResponses();
  return allResponses[`${userId}__${subjectId}__${questionKey}`] || null;
}

function getQuizComments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.quizComments) || "{}");
  } catch (_error) {
    return {};
  }
}

function addQuizComment(subjectId, questionKey, text, parentCommentId = null) {
  const comments = getQuizComments();
  const compound = `${subjectId}__${questionKey}`;
  if (!Array.isArray(comments[compound])) comments[compound] = [];

  comments[compound].push({
    id: Date.now() + Math.random(),
    parentCommentId,
    userId: getUserId(),
    username: getUsername(),
    text,
    time: new Date().toISOString()
  });

  localStorage.setItem(STORAGE_KEYS.quizComments, JSON.stringify(comments));
}

function buildCommentTree(flatComments) {
  const nodes = flatComments.map(comment => ({
    ...comment,
    children: []
  }));
  const lookup = new Map(nodes.map(item => [item.id, item]));
  const roots = [];

  nodes.forEach(node => {
    if (node.parentCommentId && lookup.has(node.parentCommentId)) {
      lookup.get(node.parentCommentId).children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function renderCommentItems(comments) {
  if (!comments.length) {
    return `<div class="empty">No comments yet. Start the discussion.</div>`;
  }

  return comments.map(comment => `
    <article class="quiz-comment-item">
      <div class="quiz-comment-meta">${escapeHtml(comment.username)} • ${escapeHtml(formatDateTime(comment.time))}</div>
      <div class="quiz-comment-text">${escapeHtml(comment.text)}</div>
      <div class="quiz-comment-actions">
        <button class="btn-secondary quiz-reply-toggle" data-comment-id="${comment.id}" type="button">Reply</button>
      </div>
      <form class="quiz-reply-form" id="replyForm_${comment.id}" style="display:none;">
        <input id="replyInput_${comment.id}" type="text" placeholder="Write a reply..." required />
        <button class="btn-secondary" type="submit">Post</button>
      </form>
      ${
        comment.children?.length
          ? `<div class="quiz-reply-list">${comment.children.map(child => `
              <div class="quiz-reply-item">
                <div class="quiz-comment-meta">${escapeHtml(child.username)} • ${escapeHtml(formatDateTime(child.time))}</div>
                <div class="quiz-comment-text">${escapeHtml(child.text)}</div>
              </div>
            `).join("")}</div>`
          : ""
      }
    </article>
  `).join("");
}

function getChats() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.chats) || "[]");
  } catch (_error) {
    return [];
  }
}

function setChats(chats) {
  localStorage.setItem(STORAGE_KEYS.chats, JSON.stringify(chats));
}

function addChatMessage(text) {
  const chats = getChats();
  chats.push({
    id: Date.now(),
    userId: getUserId(),
    username: getUsername(),
    text,
    createdAt: new Date().toISOString()
  });
  setChats(chats);
}

function getStudyState() {
  const userId = getUserId() || "guest";
  try {
    return JSON.parse(localStorage.getItem(`${STORAGE_KEYS.studyPrefix}${userId}`) || "null") || {
      sessionSeconds: 1500,
      elapsedSeconds: 0,
      running: false,
      totalTodaySeconds: 0,
      totalAllSeconds: 0,
      sessionsCompleted: 0,
      updatedAt: new Date().toISOString(),
      pausedForInactivity: false,
      inactivityPromptOpen: false
    };
  } catch (_error) {
    return {
      sessionSeconds: 1500,
      elapsedSeconds: 0,
      running: false,
      totalTodaySeconds: 0,
      totalAllSeconds: 0,
      sessionsCompleted: 0,
      updatedAt: new Date().toISOString(),
      pausedForInactivity: false,
      inactivityPromptOpen: false
    };
  }
}

function setStudyState(value) {
  const userId = getUserId() || "guest";
  localStorage.setItem(`${STORAGE_KEYS.studyPrefix}${userId}`, JSON.stringify(value));
}

let studyTimerInterval = null;
let inactivityTimeout = null;
let inactivityModalOpen = false;

function clearStudyInterval() {
  if (studyTimerInterval) {
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
  }
}

function startStudyTimerLoop() {
  clearStudyInterval();
  studyTimerInterval = setInterval(() => {
    const state = getStudyState();
    if (!state.running) return;

    state.elapsedSeconds += 1;
    state.totalTodaySeconds += 1;
    state.totalAllSeconds += 1;

    if (state.elapsedSeconds >= state.sessionSeconds) {
      state.running = false;
      state.elapsedSeconds = state.sessionSeconds;
      state.sessionsCompleted += 1;
    }

    state.updatedAt = new Date().toISOString();
    setStudyState(state);

    if (window.location.hash === "#study") {
      renderStudy();
    }
  }, 1000);
}

function stopStudyTimer() {
  const state = getStudyState();
  state.running = false;
  state.pausedForInactivity = false;
  state.inactivityPromptOpen = false;
  state.updatedAt = new Date().toISOString();
  setStudyState(state);
  clearStudyInterval();
}

function beginStudyTimer() {
  const state = getStudyState();
  state.running = true;
  state.pausedForInactivity = false;
  state.inactivityPromptOpen = false;
  state.updatedAt = new Date().toISOString();
  setStudyState(state);
  startStudyTimerLoop();
}

function resetStudyTimer() {
  const state = getStudyState();
  state.elapsedSeconds = 0;
  state.running = false;
  state.pausedForInactivity = false;
  state.inactivityPromptOpen = false;
  state.updatedAt = new Date().toISOString();
  setStudyState(state);
  clearStudyInterval();
}

function setStudySessionMinutes(minutes) {
  const state = getStudyState();
  state.sessionSeconds = Math.max(300, Number(minutes) * 60);
  state.elapsedSeconds = Math.min(state.elapsedSeconds, state.sessionSeconds);
  state.updatedAt = new Date().toISOString();
  setStudyState(state);
}

function isPracticePageHash(hash) {
  return /^#practice\//.test(hash || "");
}

function closeInactivityModal() {
  const modal = document.getElementById("inactivityModal");
  if (modal) modal.remove();
  inactivityModalOpen = false;
}

function showInactivityPrompt() {
  if (inactivityModalOpen) return;
  inactivityModalOpen = true;
  const state = getStudyState();
  state.running = false;
  state.pausedForInactivity = true;
  state.inactivityPromptOpen = true;
  state.updatedAt = new Date().toISOString();
  setStudyState(state);

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "inactivityModal";
  overlay.innerHTML = `
    <div class="modal-card inactivity-card">
      <h3>Are you still there?</h3>
      <p class="panel-text">Your study timer has paused after 10 minutes of inactivity.</p>
      <div class="modal-actions" style="justify-content:center;">
        <button class="btn-primary" id="resumeStudyTimerBtn">Yes</button>
        <button class="btn-secondary" id="pauseStudyTimerBtn">No</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("resumeStudyTimerBtn").addEventListener("click", () => {
    closeInactivityModal();
    beginStudyTimer();
    resetInactivityWatch();
  });

  document.getElementById("pauseStudyTimerBtn").addEventListener("click", () => {
    closeInactivityModal();
    stopStudyTimer();
  });
}

function resetInactivityWatch() {
  if (inactivityTimeout) {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = null;
  }

  if (!isPracticePageHash(window.location.hash)) return;

  const studyState = getStudyState();
  if (!studyState.running) return;

  inactivityTimeout = setTimeout(() => {
    showInactivityPrompt();
  }, 10 * 60 * 1000);
}

["mousemove", "keydown", "click", "scroll", "touchstart"].forEach(eventName => {
  window.addEventListener(eventName, () => {
    if (isPracticePageHash(window.location.hash)) {
      resetInactivityWatch();
    }
  }, { passive: true });
});

function ensurePracticeTimerStarted() {
  const state = getStudyState();
  if (!state.running && !state.pausedForInactivity) {
    beginStudyTimer();
  } else if (state.running) {
    startStudyTimerLoop();
  }
  resetInactivityWatch();
}

function buildAppLayout(activeKey, mainContent, title, subtitle) {
  const username = getUsername();
  const email = getEmail();

  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <img class="sidebar-logo sidebar-logo-blue" src="${LOGO_PATH}" alt="Nodent logo" />
            <div>
              <h2>Nodent</h2>
              <p>${escapeHtml(username)}</p>
            </div>
          </div>

          <nav class="nav">
            <button class="nav-btn ${activeKey === "dashboard" ? "active" : ""}" data-nav="dashboard">Home</button>
            <button class="nav-btn ${activeKey === "study" ? "active" : ""}" data-nav="study">Track My Study</button>
            <button class="nav-btn ${activeKey === "chat" ? "active" : ""}" data-nav="chat">Public Chat</button>
          </nav>
        </div>

        <div class="user-card">
          <div class="small">Signed in as</div>
          <div class="email">${escapeHtml(username)}</div>
          <div class="user-card-sub">${escapeHtml(email)}</div>
          <button class="btn-secondary w-full" id="logoutBtn">Logout</button>
        </div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="topbar-left">
            <div class="subject-flyout">
              <button class="subject-flyout-trigger" type="button">☰</button>
              <div class="subject-flyout-panel">
                ${renderSubjectSearch(true)}
              </div>
            </div>
            <div>
              <h1>${escapeHtml(title)}</h1>
              <p>${escapeHtml(subtitle)}</p>
            </div>
          </div>

          <div class="top-pill">${escapeHtml(username)}</div>
        </div>

        ${mainContent}
      </main>
    </div>
  `;

  document.querySelectorAll("[data-nav]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.nav;
      if (target === "dashboard") window.location.hash = "#dashboard";
      if (target === "study") window.location.hash = "#study";
      if (target === "chat") window.location.hash = "#chat";
    });
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    try {
      await logoutRequest();
    } catch (_error) {}
    clearAuthSession();
    render();
  });

  bindSubjectSearch();
}

function renderSubjectSearch(isCompact = false) {
  const subjects = getMySubjects();
  return `
    <div class="subject-search-all">
      <div class="subject-search-all-header">${isCompact ? "Browse subjects" : "Search all current subjects"}</div>
      <div class="subject-search-list">
        ${subjects.map(subject => `
          <div class="subject-search-item">
            <div>
              <h4>${escapeHtml(subject.name)}</h4>
              <p>${escapeHtml(subject.description)}</p>
            </div>
            <button class="btn-secondary subject-search-open" data-subject="${subject.id}">Open</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function bindSubjectSearch() {
  document.querySelectorAll(".subject-search-open").forEach(button => {
    button.addEventListener("click", () => {
      window.location.hash = `#practice/${button.dataset.subject}`;
    });
  });
}

function renderAuthPage(mode = "login") {
  const isLogin = mode === "login";
  app.innerHTML = `
    <div class="auth-page">
      <section class="auth-left">
        <div class="brand-row">
          <img class="brand-logo-large brand-logo-white" src="${LOGO_PATH}" alt="Nodent logo" />
          <div>
            <div class="brand-title">Nodent</div>
            <div class="brand-sub">Structured practice, study tracking, and student discussion.</div>
          </div>
        </div>

        <h1 class="hero-title">Build your study momentum with focused practice.</h1>
        <p class="hero-text">
          Practice subject questions, discuss tricky prompts, and track your study sessions in one clean workspace.
        </p>
      </section>

      <section class="auth-right">
        <div class="login-panel">
          <h2>${isLogin ? "Welcome back" : "Create your account"}</h2>
          <p class="subtext">
            ${isLogin
              ? "Log in to continue your practice, written responses, comments, and study tracking."
              : "Sign up with your own username so your comments and responses appear under your chosen name."}
          </p>

          <form id="authForm">
            ${
              isLogin
                ? ""
                : `
                  <div class="form-group">
                    <label class="label" for="authUsername">Username</label>
                    <input id="authUsername" type="text" placeholder="Choose a username" required />
                  </div>
                `
            }

            <div class="form-group">
              <label class="label" for="authEmail">${isLogin ? "Email or Username" : "Email"}</label>
              <input id="authEmail" type="${isLogin ? "text" : "email"}" placeholder="${isLogin ? "Enter your email or username" : "Enter your email"}" required />
            </div>

            <div class="form-group">
              <label class="label" for="authPassword">Password</label>
              <div class="password-input-wrap">
                <input id="authPassword" type="password" placeholder="Enter your password" required />
                <button class="password-toggle" id="togglePasswordBtn" type="button">Show</button>
              </div>
            </div>

            <label class="checkbox-line">
              <input id="rememberMe" type="checkbox" />
              <span>Keep me signed in on this device</span>
            </label>

            <button class="btn-primary w-full" type="submit">${isLogin ? "Log In" : "Create Account"}</button>
            <div id="authError" class="error-message"></div>
          </form>

          <div style="margin-top:18px; color:var(--muted);">
            ${
              isLogin
                ? `Need an account? <button id="switchAuthMode" class="btn-secondary" style="padding:8px 12px;">Sign Up</button>`
                : `Already have an account? <button id="switchAuthMode" class="btn-secondary" style="padding:8px 12px;">Log In</button>`
            }
          </div>
        </div>
      </section>
    </div>
  `;

  document.getElementById("switchAuthMode").addEventListener("click", () => {
    renderAuthPage(isLogin ? "signup" : "login");
  });

  document.getElementById("togglePasswordBtn").addEventListener("click", () => {
    const passwordInput = document.getElementById("authPassword");
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    document.getElementById("togglePasswordBtn").textContent = isPassword ? "Hide" : "Show";
  });

  document.getElementById("authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errorBox = document.getElementById("authError");
    errorBox.textContent = "";

    const login = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value.trim();
    const remember = document.getElementById("rememberMe").checked;

    try {
      let response;
      if (isLogin) {
        response = await loginRequest(login, password);
      } else {
        const username = document.getElementById("authUsername").value.trim();
        response = await signupRequest(username, login, password);
      }

      setAuthSession(response.token, response.user, remember);
      render();
    } catch (error) {
      errorBox.textContent = error.message || (isLogin ? "Could not log in." : "Could not create account.");
    }
  });
}

function renderDashboard() {
  const subjects = getMySubjects();

  const content = `
    <div class="dashboard-grid">
      <section class="panel">
        <h3>Your current subjects</h3>
        <p class="panel-text">Open any subject to continue practice, see completed questions, or add your own new questions.</p>

        <div class="subject-grid">
          ${subjects.map(subject => `
            <article class="subject-card">
              <div class="subject-head">
                <div>
                  <h4>${escapeHtml(subject.name)}</h4>
                  <div class="tag">${escapeHtml(subject.category || subject.area || "")}</div>
                </div>
                <div class="subject-head-actions">
                  <button class="subject-remove-btn" data-remove-subject="${subject.id}" type="button" title="Remove subject">−</button>
                </div>
              </div>

              <div class="subject-desc">${escapeHtml(subject.description)}</div>

              <div class="subject-actions">
                <button class="btn-primary open-practice-btn" data-subject="${subject.id}">Open Practice</button>
                <button class="btn-secondary summary-practice-btn" data-subject="${subject.id}">Completed Summary</button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    </div>
  `;

  buildAppLayout("dashboard", content, "Dashboard", "Choose a subject, continue your practice, or review completed questions.");

  document.querySelectorAll(".open-practice-btn").forEach(button => {
    button.addEventListener("click", () => {
      window.location.hash = `#practice/${button.dataset.subject}`;
    });
  });

  document.querySelectorAll(".summary-practice-btn").forEach(button => {
    button.addEventListener("click", () => {
      window.location.hash = `#practice/${button.dataset.subject}?summary=1`;
    });
  });

  document.querySelectorAll("[data-remove-subject]").forEach(button => {
    button.addEventListener("click", () => {
      removeSubjectFromLibrary(button.dataset.removeSubject);
      renderDashboard();
    });
  });
}

function renderStudy() {
  const state = getStudyState();
  const remaining = Math.max(0, state.sessionSeconds - state.elapsedSeconds);
  const progress = Math.min(100, Math.round((state.elapsedSeconds / state.sessionSeconds) * 100));
  const todayHours = (state.totalTodaySeconds / 3600).toFixed(2);
  const allHours = (state.totalAllSeconds / 3600).toFixed(2);

  const content = `
    <div class="study-grid">
      <section class="timer-card">
        <h3>Study Timer</h3>
        <p class="panel-text">Track focused study time, auto-start practice sessions, and pause when inactive.</p>

        <div class="timer-status">${state.running ? "Running" : state.pausedForInactivity ? "Paused for inactivity" : "Not running"}</div>
        <div class="timer-display">${formatTime(remaining)}</div>

        <div class="timer-controls">
          <button class="btn-primary" id="startTimerBtn">${state.running ? "Restart Loop" : "Start"}</button>
          <button class="btn-secondary" id="pauseTimerBtn">Pause</button>
          <button class="btn-secondary" id="resetTimerBtn">Reset</button>
        </div>

        <div class="timer-settings">
          <div>
            <label class="label" for="sessionMinutesInput">Session length (minutes)</label>
            <input id="sessionMinutesInput" type="number" min="5" step="5" value="${Math.round(state.sessionSeconds / 60)}" />
          </div>
          <div style="display:flex; align-items:flex-end;">
            <button class="btn-secondary w-full" id="saveSessionMinutesBtn">Save Session Length</button>
          </div>
        </div>
      </section>

      <section class="progress-card">
        <h3>Track My Study</h3>
        <p class="panel-text">Your running timer also tracks cumulative study progress.</p>

        <div class="progress-ring-panel">
          <div class="progress-circle" style="--progress:${progress};">
            <div class="progress-circle-inner">
              <strong>${progress}%</strong>
              <span>current session</span>
            </div>
          </div>
        </div>

        <div class="daily-progress-bar">
          <div class="daily-progress-fill" style="width:${Math.min(100, Math.round((state.totalTodaySeconds / (4 * 3600)) * 100))}%"></div>
        </div>

        <div class="stat-list">
          <div class="stat-row"><span>Today's study time</span><strong>${todayHours} hrs</strong></div>
          <div class="stat-row"><span>Total study time</span><strong>${allHours} hrs</strong></div>
          <div class="stat-row"><span>Completed sessions</span><strong>${state.sessionsCompleted}</strong></div>
        </div>
      </section>
    </div>
  `;

  buildAppLayout("study", content, "Track My Study", "Your timer, session progress, and cumulative study stats.");

  document.getElementById("startTimerBtn").addEventListener("click", () => {
    beginStudyTimer();
    resetInactivityWatch();
    renderStudy();
  });

  document.getElementById("pauseTimerBtn").addEventListener("click", () => {
    stopStudyTimer();
    renderStudy();
  });

  document.getElementById("resetTimerBtn").addEventListener("click", () => {
    resetStudyTimer();
    renderStudy();
  });

  document.getElementById("saveSessionMinutesBtn").addEventListener("click", () => {
    const value = Number(document.getElementById("sessionMinutesInput").value || 25);
    setStudySessionMinutes(value);
    renderStudy();
  });
}

function renderChat() {
  const chats = getChats();

  const content = `
    <div class="chat-shell">
      <section class="chat-panel">
        <div class="chat-header">
          <h2>Public Chat</h2>
          <p>Talk with other signed-in users in a shared discussion space.</p>
        </div>

        <div class="chat-box">
          ${
            chats.length
              ? chats.map(message => `
                  <div class="chat-message ${message.userId === getUserId() ? "own" : ""}">
                    <div class="chat-meta">${escapeHtml(message.username)} • ${escapeHtml(formatDateTime(message.createdAt))}</div>
                    <div class="chat-text">${escapeHtml(message.text)}</div>
                  </div>
                `).join("")
              : `<div class="empty">No messages yet. Say hello.</div>`
          }
        </div>

        <form class="chat-form" id="chatForm">
          <input id="chatInput" type="text" placeholder="Write a public message..." required />
          <button class="btn-primary" type="submit">Send</button>
        </form>
      </section>
    </div>
  `;

  buildAppLayout("chat", content, "Public Chat", "Shared chat for everyone signed in.");

  document.getElementById("chatForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;
    addChatMessage(text);
    renderChat();
  });
}

function getQuestionTypeLabel(type) {
  if (type === "mcq") return "Multiple Choice";
  if (type === "short") return "Short Answer";
  return "Written Response";
}

function openAdminPanel() {
  if (document.getElementById("adminOverlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "admin-overlay";
  overlay.id = "adminOverlay";

  overlay.innerHTML = `
    <div class="admin-modal">
      <h2>Admin Subject Builder</h2>
      <p>Create a new subject and add it directly to your dashboard.</p>

      <div class="admin-grid">
        <div>
          <label class="label" for="adminSubjectName">Subject name</label>
          <input id="adminSubjectName" type="text" placeholder="e.g. Sociology" />
        </div>
        <div>
          <label class="label" for="adminSubjectArea">Category</label>
          <input id="adminSubjectArea" type="text" placeholder="e.g. VCE" />
        </div>
        <div class="admin-grid-full">
          <label class="label" for="adminSubjectDescription">Description</label>
          <textarea id="adminSubjectDescription" rows="4" placeholder="Describe this subject."></textarea>
        </div>
      </div>

      <div class="admin-note">
        Add questions one at a time after creating the subject by opening its practice page and using “Add Question”.
      </div>

      <div class="admin-actions">
        <button class="btn-secondary" id="closeAdminBtn">Close</button>
        <button class="btn-primary" id="saveAdminSubjectBtn">Save Subject</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeAdminBtn").addEventListener("click", () => {
    overlay.remove();
  });

  document.getElementById("saveAdminSubjectBtn").addEventListener("click", () => {
    const name = document.getElementById("adminSubjectName").value.trim();
    const category = document.getElementById("adminSubjectArea").value.trim() || "VCE";
    const description = document.getElementById("adminSubjectDescription").value.trim();

    if (!name || !description) return;

    const subject = {
      id: slugify(name),
      name,
      category,
      description,
      quiz: []
    };

    addSubjectToLibrary(subject);
    overlay.remove();
    renderDashboard();
  });
}

function render() {
  const hash = window.location.hash || "#dashboard";

  if (!getLoggedIn()) {
    clearStudyInterval();
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    closeInactivityModal();
    renderAuthPage("login");
    return;
  }

  if (hash === "#dashboard" || hash === "#") {
    clearStudyInterval();
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    closeInactivityModal();
    renderDashboard();
    return;
  }

  if (hash === "#study") {
    renderStudy();
    if (getStudyState().running) {
      startStudyTimerLoop();
    }
    return;
  }

  if (hash === "#chat") {
    clearStudyInterval();
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    closeInactivityModal();
    renderChat();
    return;
  }

  if (hash.startsWith("#practice/")) {
    const [pathPart, queryPart] = hash.split("?");
    const subjectId = decodeURIComponent(pathPart.replace("#practice/", ""));
    const params = new URLSearchParams(queryPart || "");
    const summary = params.get("summary") === "1";
    renderPractice(subjectId, summary);
    return;
  }

  window.location.hash = "#dashboard";
}

async function renderPractice(subjectId, openSummary = false) {
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

  let currentIndex = 0;
  let answerLocked = false;
  const questions = subject.quiz;
  const nextIncompleteIndex = questions.findIndex(question => !practiceState.completedQuestionKeys.includes(question.question));
  currentIndex = nextIncompleteIndex >= 0 ? nextIncompleteIndex : 0;

  function renderCompletedSummary() {
    const refreshedSubject = getSubjectById(subjectId);
    const refreshedQuestions = refreshedSubject.quiz;
    const state = getPracticeState(subjectId);
    const completedQuestions = refreshedQuestions.filter(question => state.completedQuestionKeys.includes(question.question));

    const content = `
      <div class="page-wide">
        <div class="back-row practice-top-actions">
          <button class="btn-secondary" id="backBtn">← Back to Dashboard</button>
          <div class="practice-top-actions-right">
            <button class="btn-primary" id="backToPracticeBtn">Continue Practice</button>
            <button class="btn-secondary" id="restartPracticeBtn">Restart Completed List</button>
          </div>
        </div>

        <section class="panel">
          <div class="practice-summary-head">
            <div>
              <h3>${subject.name} Practice Summary</h3>
              <p class="panel-text">Review your completed questions and continue the ongoing practice whenever you are ready.</p>
            </div>
          </div>

          ${
            completedQuestions.length
              ? `<div class="practice-summary-list">
                  ${completedQuestions.map((question, index) => {
                    const savedResponse = getWrittenResponse(subjectId, question.question);
                    return `
                      <article class="practice-summary-item">
                        <div class="practice-summary-number">${index + 1}</div>
                        <div>
                          <div class="quiz-type-badge">${getQuestionTypeLabel(question.type || "mcq")}</div>
                          <h4>${escapeHtml(question.question)}</h4>
                          ${
                            savedResponse
                              ? `<div class="saved-response"><strong>Your response:</strong><br>${escapeHtml(savedResponse.response)}</div>`
                              : question.type === "mcq"
                                ? `<p class="panel-text">Marked as completed in practice.</p>`
                                : `<p class="panel-text">Completed.</p>`
                          }
                        </div>
                      </article>
                    `;
                  }).join("")}
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
      const nextIncompleteIndex = questions.findIndex(question => !refreshed.completedQuestionKeys.includes(question.question));
      currentIndex = nextIncompleteIndex >= 0 ? nextIncompleteIndex : 0;
      showQuestion();
    });

    document.getElementById("restartPracticeBtn").addEventListener("click", () => {
      setPracticeState(subjectId, { completedQuestionKeys: [], summaryOpen: false });
      currentIndex = 0;
      answerLocked = false;
      showQuestion();
    });
  }

  function openAddQuestionModal() {
    if (document.getElementById("practiceQuestionModal")) return;

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "practiceQuestionModal";
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Add a practice question</h3>
        <form id="practiceQuestionForm" class="modal-form">
          <label class="label" for="practiceQuestionType">Question type</label>
          <select id="practiceQuestionType">
            <option value="mcq">Multiple Choice</option>
            <option value="short">Short Answer</option>
            <option value="long">Written Response</option>
          </select>

          <label class="label" for="practiceQuestionText">Question</label>
          <textarea id="practiceQuestionText" rows="4" placeholder="Enter the question" required></textarea>

          <div id="practiceQuestionExtra"></div>

          <div class="modal-actions">
            <button class="btn-secondary" type="button" id="closePracticeQuestionModal">Cancel</button>
            <button class="btn-primary" type="submit">Add Question</button>
          </div>
          <div id="practiceQuestionError" class="error-message"></div>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const extra = document.getElementById("practiceQuestionExtra");
    const typeSelect = document.getElementById("practiceQuestionType");

    function renderExtraFields() {
      const value = typeSelect.value;
      if (value === "mcq") {
        extra.innerHTML = `
          <label class="label" for="practiceQuestionOptions">Options (one per line)</label>
          <textarea id="practiceQuestionOptions" rows="5" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4"></textarea>
          <label class="label" for="practiceQuestionAnswer">Correct answer</label>
          <input id="practiceQuestionAnswer" type="text" placeholder="Exact correct answer" />
        `;
        return;
      }

      if (value === "short") {
        extra.innerHTML = `
          <label class="label" for="practiceQuestionAnswers">Accepted answers (one per line)</label>
          <textarea id="practiceQuestionAnswers" rows="4" placeholder="Accepted answer 1&#10;Accepted answer 2"></textarea>
        `;
        return;
      }

      extra.innerHTML = `
        <label class="label" for="practiceQuestionGuidance">Guidance</label>
        <textarea id="practiceQuestionGuidance" rows="4" placeholder="Optional writing guidance"></textarea>
      `;
    }

    renderExtraFields();
    typeSelect.addEventListener("change", renderExtraFields);

    document.getElementById("closePracticeQuestionModal").addEventListener("click", () => overlay.remove());

    document.getElementById("practiceQuestionForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const type = typeSelect.value;
      const questionText = document.getElementById("practiceQuestionText").value.trim();
      const errorBox = document.getElementById("practiceQuestionError");

      errorBox.textContent = "";

      if (!questionText) {
        errorBox.textContent = "Please enter a question.";
        return;
      }

      if (type === "mcq") {
        const options = document.getElementById("practiceQuestionOptions").value.split("\n").map(item => item.trim()).filter(Boolean);
        const answer = document.getElementById("practiceQuestionAnswer").value.trim();
        if (options.length < 2 || !answer) {
          errorBox.textContent = "Please add at least two options and a correct answer.";
          return;
        }
        addCustomQuestion(subjectId, { type, question: questionText, options, answer });
      } else if (type === "short") {
        const acceptedAnswers = document.getElementById("practiceQuestionAnswers").value.split("\n").map(item => item.trim()).filter(Boolean);
        if (!acceptedAnswers.length) {
          errorBox.textContent = "Please add at least one accepted answer.";
          return;
        }
        addCustomQuestion(subjectId, { type, question: questionText, acceptedAnswers });
      } else {
        const guidance = document.getElementById("practiceQuestionGuidance").value.trim();
        addCustomQuestion(subjectId, { type, question: questionText, guidance });
      }

      overlay.remove();
      const refreshedQuestions = getSubjectById(subjectId).quiz;
      currentIndex = refreshedQuestions.findIndex(question => question.question === questionText);
      showQuestion();
    });
  }

  async function showOtherResponses(question) {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "otherResponsesModal";
    overlay.innerHTML = `
      <div class="modal-card modal-card-wide">
        <div class="practice-summary-head">
          <div>
            <h3>Other responses</h3>
            <p class="panel-text">See how other students approached this written response.</p>
          </div>
          <button class="btn-secondary" id="closeOtherResponsesBtn">Close</button>
        </div>
        <div id="otherResponsesBody"><div class="empty">Loading responses...</div></div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("closeOtherResponsesBtn").addEventListener("click", () => overlay.remove());

    try {
      const data = await fetchOtherWrittenResponses(subject.id, question.question);
      const body = document.getElementById("otherResponsesBody");
      const responses = (data.responses || []).filter(item => item.userId !== getUserId());

      body.innerHTML = responses.length
        ? `<div class="other-response-list">
            ${responses.map(item => `
              <article class="other-response-item">
                <div class="quiz-comment-meta">${escapeHtml(item.username)} • ${escapeHtml(formatDateTime(item.updatedAt))}</div>
                <div class="other-response-text">${escapeHtml(item.text)}</div>
              </article>
            `).join("")}
          </div>`
        : `<div class="empty">No other responses have been shared for this question yet.</div>`;
    } catch (error) {
      document.getElementById("otherResponsesBody").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    }
  }

  async function showQuestion() {
    const refreshedSubject = getSubjectById(subjectId);
    const liveQuestions = refreshedSubject.quiz;
    if (!liveQuestions.length) {
      renderCompletedSummary();
      return;
    }
    if (currentIndex >= liveQuestions.length) currentIndex = liveQuestions.length - 1;

    const question = liveQuestions[currentIndex];
    const type = question.type || "mcq";
    const progressPercent = liveQuestions.length ? Math.round((currentIndex / liveQuestions.length) * 100) : 0;
    let commentTree = [];
    let savedResponse = getWrittenResponse(subject.id, question.question);

    try {
      const [commentsData, writtenData] = await Promise.all([
        fetchComments(subject.id, question.question),
        type === "mcq" ? Promise.resolve({ response: null }) : fetchWrittenResponseApi(subject.id, question.question)
      ]);
      commentTree = buildCommentTree(commentsData.comments || []);
      if (writtenData && writtenData.response) {
        savedResponse = {
          response: writtenData.response.text,
          time: writtenData.response.updatedAt
        };
        saveWrittenResponse(subject.id, question.question, writtenData.response.text);
      }
    } catch (_error) {
      const flatComments = getQuizComments()[`${subject.id}__${question.question}`] || [];
      commentTree = buildCommentTree(flatComments);
    }

    const answerUI = type === "mcq"
      ? `
        <div class="quiz-options">
          ${question.options.map(option => `
            <button class="quiz-option">${escapeHtml(option)}</button>
          `).join("")}
        </div>
      `
      : `
        <div class="quiz-answer-block">
          <textarea id="writtenAnswerInput" rows="${type === "short" ? 5 : 12}" placeholder="${type === "short" ? "Type your short answer..." : "Write your response here..."}">${savedResponse ? escapeHtml(savedResponse.response) : ""}</textarea>
          <div class="quiz-answer-helper">
            <span>
              ${type === "short"
                ? "Short answers are checked against accepted responses and saved for review."
                : "Written responses are saved for review and are not auto-marked."}
            </span>
            <div class="inline-action-row">
              <button class="btn-secondary" id="saveWrittenBtn" type="button">Save Response</button>
              <button class="btn-secondary" id="viewOtherResponsesBtn" type="button">View Other Responses</button>
            </div>
          </div>
        </div>
      `;

    const content = `
      <div class="page-wide">
        <div class="back-row practice-top-actions">
          <button class="btn-secondary" id="backBtn">← Back to Dashboard</button>
          <div class="practice-top-actions-right">
            <button class="btn-secondary" id="viewCompletedBtn">Completed Summary</button>
            <button class="btn-primary" id="addQuestionBtn">Add Question</button>
          </div>
        </div>

        <div class="quiz-meta">
          <span>${subject.name}</span>
          <span>${getPracticeState(subjectId).completedQuestionKeys.length} completed</span>
          <span>Question ${currentIndex + 1} of ${liveQuestions.length}</span>
        </div>

        <div class="quiz-layout quiz-layout-wide">
          <section class="quiz-card quiz-main-card">
            <div class="quiz-type-badge">${getQuestionTypeLabel(type)}</div>
            <h2>${escapeHtml(question.question)}</h2>
            <p>Respond to this question, then move to the next one.</p>

            ${question.passage ? `<div class="quiz-passage">${escapeHtml(question.passage)}</div>` : ""}
            ${question.guidance ? `<p><strong>Guidance:</strong> ${escapeHtml(question.guidance)}</p>` : ""}

            <div class="quiz-progress">
              <div class="quiz-progress-bar">
                <div class="quiz-progress-fill" style="width:${progressPercent}%"></div>
              </div>
            </div>

            ${answerUI}

            <div id="feedback"></div>

            ${
              savedResponse && type !== "mcq"
                ? `<div class="saved-response"><strong>Saved response:</strong><br>${escapeHtml(savedResponse.response)}</div>`
                : ""
            }

            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:18px;">
              <button class="btn-primary" id="nextBtn" ${type === "mcq" ? "disabled" : ""}>${currentIndex === liveQuestions.length - 1 ? "Finish Practice" : "Next Question"}</button>
            </div>
          </section>

          <aside class="quiz-comments-side quiz-comments-side-wide">
            <div class="quiz-comment-wrap quiz-comment-wrap-side">
              <h3>Question Comments</h3>
              <p>Discuss this exact question here.</p>

              <div class="quiz-comment-list">
                ${renderCommentItems(commentTree)}
              </div>

              <form class="quiz-comment-form quiz-comment-form-side" id="quizCommentForm">
                <input id="quizCommentInput" type="text" placeholder="Add a comment about this question..." required />
                <button class="btn-secondary" type="submit">Post</button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    `;

    buildAppLayout("", content, `${subject.name} Practice`, "Mixed-format subject practice from your dashboard.");

    document.getElementById("backBtn").addEventListener("click", () => {
      window.location.hash = "#dashboard";
    });

    document.getElementById("viewCompletedBtn").addEventListener("click", renderCompletedSummary);
    document.getElementById("addQuestionBtn").addEventListener("click", openAddQuestionModal);

    document.getElementById("quizCommentForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const input = document.getElementById("quizCommentInput");
      const text = input.value.trim();
      if (!text) return;

      try {
        await postComment(subject.id, question.question, text, null);
      } catch (_error) {
        addQuizComment(subject.id, question.question, text, null);
      }

      showQuestion();
    });

    document.querySelectorAll(".quiz-reply-toggle").forEach(button => {
      button.addEventListener("click", () => {
        const form = document.getElementById(`replyForm_${button.dataset.commentId}`);
        form.style.display = form.style.display === "none" ? "grid" : "none";
      });
    });

    document.querySelectorAll(".quiz-reply-form").forEach(form => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const commentId = Number(form.id.replace("replyForm_", ""));
        const input = document.getElementById(`replyInput_${commentId}`);
        const text = input.value.trim();
        if (!text) return;

        try {
          await postComment(subject.id, question.question, text, commentId);
        } catch (_error) {
          addQuizComment(subject.id, question.question, text, commentId);
        }

        showQuestion();
      });
    });

    const nextBtn = document.getElementById("nextBtn");
    const feedback = document.getElementById("feedback");

    if (type !== "mcq") {
      const saveButton = document.getElementById("saveWrittenBtn");
      const viewResponsesButton = document.getElementById("viewOtherResponsesBtn");

      saveButton.addEventListener("click", async () => {
        const input = document.getElementById("writtenAnswerInput");
        const typed = input.value.trim();
        if (!typed) {
          feedback.innerHTML = `<div class="quiz-feedback incorrect">Please enter a response before saving.</div>`;
          return;
        }

        try {
          await saveWrittenResponseApi(subject.id, question.question, typed);
        } catch (_error) {
          saveWrittenResponse(subject.id, question.question, typed);
        }
        saveWrittenResponse(subject.id, question.question, typed);
        feedback.innerHTML = `<div class="quiz-feedback saved">Written response saved.</div>`;
      });

      viewResponsesButton.addEventListener("click", () => {
        showOtherResponses(question);
      });
    }

    if (type === "mcq") {
      document.querySelectorAll(".quiz-option").forEach(button => {
        button.addEventListener("click", () => {
          if (answerLocked) return;
          answerLocked = true;

          const selectedAnswer = button.textContent;
          const isCorrect = selectedAnswer === question.answer;

          document.querySelectorAll(".quiz-option").forEach(btn => {
            btn.disabled = true;

            if (btn.textContent === question.answer) {
              btn.style.borderColor = "rgba(35,163,109,0.45)";
              btn.style.background = "rgba(35,163,109,0.15)";
            }

            if (btn.textContent === selectedAnswer && selectedAnswer !== question.answer) {
              btn.style.borderColor = "rgba(216,95,95,0.45)";
              btn.style.background = "rgba(216,95,95,0.15)";
            }
          });

          feedback.innerHTML = isCorrect
            ? `<div class="quiz-feedback correct">Correct answer.</div>`
            : `<div class="quiz-feedback incorrect">Incorrect. Correct answer: ${escapeHtml(question.answer)}</div>`;

          nextBtn.disabled = false;
        });
      });
    } else {
      nextBtn.addEventListener("click", async () => {
        if (answerLocked) return;

        const input = document.getElementById("writtenAnswerInput");
        const typed = input.value.trim();

        if (!typed) {
          feedback.innerHTML = `<div class="quiz-feedback incorrect">Please enter a response before continuing.</div>`;
          return;
        }

        answerLocked = true;
        input.disabled = true;

        try {
          await saveWrittenResponseApi(subject.id, question.question, typed);
        } catch (_error) {}

        if (type === "short") {
          const normalizedTyped = normalizeAnswer(typed);
          const accepted = (question.acceptedAnswers || []).map(normalizeAnswer);
          saveWrittenResponse(subject.id, question.question, typed);

          feedback.innerHTML = accepted.includes(normalizedTyped)
            ? `<div class="quiz-feedback correct">Accepted short answer.</div>`
            : `<div class="quiz-feedback incorrect">Saved, but not matched to the accepted short answers.</div>`;
        }

        if (type === "long") {
          saveWrittenResponse(subject.id, question.question, typed);
          feedback.innerHTML = `<div class="quiz-feedback saved">Written response saved for later review.</div>`;
        }

        markQuestionCompleted(subject.id, question.question);

        const latestQuestions = getSubjectById(subjectId).quiz;
        const nextIncompleteIndex = latestQuestions.findIndex(item => !getPracticeState(subjectId).completedQuestionKeys.includes(item.question));

        if (nextIncompleteIndex >= 0) {
          currentIndex = nextIncompleteIndex;
          answerLocked = false;
          showQuestion();
        } else {
          renderCompletedSummary();
        }
      });

      return;
    }

    nextBtn.addEventListener("click", () => {
      markQuestionCompleted(subject.id, question.question);
      const latestQuestions = getSubjectById(subjectId).quiz;
      const nextIncompleteIndex = latestQuestions.findIndex(item => !getPracticeState(subjectId).completedQuestionKeys.includes(item.question));
      answerLocked = false;

      if (nextIncompleteIndex >= 0) {
        currentIndex = nextIncompleteIndex;
        showQuestion();
      } else {
        renderCompletedSummary();
      }
    });
  }

  if (getPracticeState(subjectId).summaryOpen) {
    renderCompletedSummary();
  } else {
    showQuestion();
  }
}

window.addEventListener("keydown", (event) => {
  if (
    getLoggedIn() &&
    window.location.hash === "#dashboard" &&
    event.ctrlKey &&
    event.shiftKey &&
    event.key.toLowerCase() === "a"
  ) {
    event.preventDefault();
    adminUnlocked = true;
    openAdminPanel();
  }
});

window.addEventListener("load", async () => {
  if (getLoggedIn()) {
    try {
      const profile = await fetchProfile();
      setAuthSession(getAuthToken(), profile.user, localStorage.getItem(STORAGE_KEYS.rememberLogin) === "1");
    } catch (_error) {
      clearAuthSession();
    }
  }
  render();
});

window.addEventListener("hashchange", render);