const app = document.getElementById("app");

const STORAGE_KEYS = {
  currentUser: "nodent_current_user",
  authToken: "nodent_auth_token",
  rememberLogin: "nodent_remember_login",
  mySubjectsPrefix: "nodent_my_subjects_",
  chats: "nodent_public_chats",
  studyPrefix: "nodent_study_",
  customQuestions: "nodent_custom_questions",
  quizComments: "nodent_quiz_comments",
  writtenResponses: "nodent_written_responses"
};

const LOGO_PATH = "logo.png";

const baseSubjects = [
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

const defaultSubjects = ["english", "methods", "general-maths", "biology"];
let timerInterval = null;
let adminUnlocked = false;

function getSubjects() {
  const customQuestions = getJson(STORAGE_KEYS.customQuestions, {});
  return baseSubjects.map(subject => ({
    ...subject,
    quiz: [...subject.quiz, ...(customQuestions[subject.id] || [])]
  }));
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeAnswer(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,!?;:()'"`]/g, "");
}

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
  return Boolean(getAuthToken());
}

function getRememberLogin() {
  return localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true";
}

function setRememberLogin(value) {
  localStorage.setItem(STORAGE_KEYS.rememberLogin, String(value));
}

function getUserEmail() {
  const user = getCurrentUser();
  return user ? user.email : "";
}

function getUserId() {
  const user = getCurrentUser();
  return user ? user.id : null;
}

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function signupUser(email, password) {
  return apiFetch("/api/signup", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

async function loginUser(email, password) {
  return apiFetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
}

async function fetchMe() {
  return apiFetch("/api/me");
}

async function logoutApi() {
  return apiFetch("/api/logout", {
    method: "POST"
  });
}

async function submitQuizScore(subjectId, score, totalQuestions) {
  return apiFetch("/api/quiz/submit", {
    method: "POST",
    body: JSON.stringify({ subjectId, score, totalQuestions })
  });
}

async function fetchLeaderboard(subjectId) {
  return apiFetch(`/api/leaderboard/${subjectId}`);
}

async function hydrateSession() {
  if (!getAuthToken()) return false;

  try {
    const data = await fetchMe();
    setCurrentUser(data.user);
    return true;
  } catch {
    clearAuthToken();
    clearCurrentUser();
    return false;
  }
}

function getMySubjects() {
  const userId = getUserId();
  if (!userId) return defaultSubjects;
  return getJson(`${STORAGE_KEYS.mySubjectsPrefix}${userId}`, defaultSubjects);
}

function setMySubjects(list) {
  const userId = getUserId();
  if (!userId) return;
  setJson(`${STORAGE_KEYS.mySubjectsPrefix}${userId}`, list);
}

function getChats() {
  return getJson(STORAGE_KEYS.chats, {});
}

function setChats(chats) {
  setJson(STORAGE_KEYS.chats, chats);
}

function getQuizComments() {
  return getJson(STORAGE_KEYS.quizComments, {});
}

function setQuizComments(comments) {
  setJson(STORAGE_KEYS.quizComments, comments);
}

function addQuizComment(subjectId, questionText, text, parentCommentId = null) {
  const comments = getQuizComments();
  const key = `${subjectId}__${questionText}`;
  if (!comments[key]) comments[key] = [];
  comments[key].push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    parentCommentId,
    userEmail: getUserEmail(),
    userId: getUserId(),
    text,
    time: new Date().toISOString()
  });
  setQuizComments(comments);
}

function buildCommentTree(commentList) {
  const map = new Map();
  const roots = [];

  commentList.forEach(comment => {
    map.set(comment.id, { ...comment, replies: [] });
  });

  commentList.forEach(comment => {
    const item = map.get(comment.id);
    if (comment.parentCommentId) {
      const parent = map.get(comment.parentCommentId);
      if (parent) {
        parent.replies.push(item);
      } else {
        roots.push(item);
      }
    } else {
      roots.push(item);
    }
  });

  return roots;
}

function renderCommentItems(commentTree) {
  if (!commentTree.length) {
    return `<div class="empty" style="color:#566474; background:#f6f6f6; border-color:rgba(0,0,0,0.08);">No comments on this question yet.</div>`;
  }

  return commentTree.map(comment => `
    <div class="quiz-comment-item">
      <div class="quiz-comment-meta">${escapeHtml(comment.userEmail)} • ${escapeHtml(formatDateTime(comment.time))}</div>
      <div class="quiz-comment-text">${escapeHtml(comment.text)}</div>

      <div class="quiz-comment-actions">
        <button class="btn-secondary quiz-reply-toggle" data-comment-id="${comment.id}" type="button">Reply</button>
      </div>

      <form class="quiz-reply-form" id="replyForm_${comment.id}" style="display:none;">
        <input id="replyInput_${comment.id}" type="text" placeholder="Write a reply..." required />
        <button class="btn-secondary" type="submit">Post Reply</button>
      </form>

      ${comment.replies.length ? `
        <div class="quiz-reply-list">
          ${comment.replies.map(reply => `
            <div class="quiz-reply-item">
              <div class="quiz-comment-meta">${escapeHtml(reply.userEmail)} • ${escapeHtml(formatDateTime(reply.time))}</div>
              <div class="quiz-comment-text">${escapeHtml(reply.text)}</div>
            </div>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `).join("");
}

function getCustomQuestions() {
  return getJson(STORAGE_KEYS.customQuestions, {});
}

function addCustomQuestion(subjectId, question) {
  const customQuestions = getCustomQuestions();
  if (!customQuestions[subjectId]) customQuestions[subjectId] = [];
  customQuestions[subjectId].push({
    id: Date.now(),
    ...question
  });
  setJson(STORAGE_KEYS.customQuestions, customQuestions);
}

function getWrittenResponses() {
  return getJson(STORAGE_KEYS.writtenResponses, {});
}

function setWrittenResponses(data) {
  setJson(STORAGE_KEYS.writtenResponses, data);
}

function saveWrittenResponse(subjectId, questionText, responseText) {
  const userId = getUserId();
  const responses = getWrittenResponses();
  const key = `${userId}__${subjectId}__${questionText}`;
  responses[key] = {
    response: responseText,
    time: new Date().toISOString()
  };
  setWrittenResponses(responses);
}

function getWrittenResponse(subjectId, questionText) {
  const userId = getUserId();
  const responses = getWrittenResponses();
  return responses[`${userId}__${subjectId}__${questionText}`] || null;
}

function getTodayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getStudyData() {
  const userId = getUserId();
  const key = `${STORAGE_KEYS.studyPrefix}${userId || "guest"}`;
  const saved = getJson(key, null);

  const defaultData = {
    date: getTodayKey(),
    dailySeconds: 0,
    goalMinutes: 120,
    sessionMinutes: 25,
    remainingSeconds: 25 * 60,
    isRunning: false,
    sessionsCompleted: 0
  };

  if (!saved) return defaultData;

  if (saved.date !== getTodayKey()) {
    return {
      ...defaultData,
      goalMinutes: saved.goalMinutes || 120,
      sessionMinutes: saved.sessionMinutes || 25,
      remainingSeconds: (saved.sessionMinutes || 25) * 60
    };
  }

  return { ...defaultData, ...saved };
}

function setStudyData(data) {
  const userId = getUserId();
  const key = `${STORAGE_KEYS.studyPrefix}${userId || "guest"}`;
  setJson(key, data);
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString();
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatMinutesFromSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  return `${hours}h ${remainingMinutes}m`;
}

function getSubjectById(id) {
  return getSubjects().find(subject => subject.id === id);
}

function clearTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

async function logout() {
  try {
    if (getAuthToken()) {
      await logoutApi();
    }
  } catch {
    // ignore logout API error
  }

  if (!getRememberLogin()) {
    clearCurrentUser();
  }

  clearAuthToken();
  clearTimerInterval();
  window.location.hash = "#login";
}

function buildSubjectFlyout(subjects, mySubjects) {
  return `
    <div class="subject-flyout">
      <button class="subject-flyout-trigger" aria-label="Search subjects">⌕</button>
      <div class="subject-flyout-panel">
        <input id="allSubjectsSearch" type="text" placeholder="Search subjects..." />
        <div class="subject-search-all">
          <div class="subject-search-all-header">Add subjects</div>
          <div class="subject-search-list" id="allSubjectsList">
            ${subjects.map(subject => `
              <div class="subject-search-item" data-all-name="${subject.name.toLowerCase()}">
                <div>
                  <h4>${subject.name}</h4>
                  <p>${subject.description}</p>
                </div>
                <div>
                  ${
                    mySubjects.includes(subject.id)
                      ? `<button class="btn-secondary" disabled>Added</button>`
                      : `<button class="btn-primary" data-add-subject="${subject.id}">Add</button>`
                  }
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

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

  if (hash === "#login") return renderLogin();
  if (hash === "#dashboard") return renderDashboard();
  if (hash === "#track-study") return renderTrackStudy();
  if (hash.startsWith("#quiz/")) return renderQuiz(hash.split("/")[1]);

  window.location.hash = getLoggedIn() ? "#dashboard" : "#login";
}

function renderLogin() {
  const rememberedUser = getRememberLogin() ? getCurrentUser() : null;
  const rememberedEmail = rememberedUser ? rememberedUser.email : "";

  app.innerHTML = `
    <section class="auth-page">
      <div class="auth-left">
        <div class="brand-row">
          <img src="${LOGO_PATH}" alt="Nodent logo" class="brand-logo-large" />
          <div>
            <div class="brand-title">Nodent</div>
            <div class="brand-sub">Student learning platform</div>
          </div>
        </div>

        <h1 class="hero-title">Study feels cleaner when the workspace looks right.</h1>
        <p class="hero-text">
          Organise your VCE subjects, run mixed-format quizzes, write essay responses,
          and keep study progress in one focused space.
        </p>
      </div>

      <div class="auth-right">
        <div class="login-panel">
          <div style="display:flex; gap:10px; margin-bottom:18px;">
            <button class="btn-primary" id="showLoginBtn" style="flex:1;">Log In</button>
            <button class="btn-secondary" id="showSignupBtn" style="flex:1;">Sign Up</button>
          </div>

          <div id="authContent"></div>
        </div>
      </div>
    </section>
  `;

  const authContent = document.getElementById("authContent");
  const showLoginBtn = document.getElementById("showLoginBtn");
  const showSignupBtn = document.getElementById("showSignupBtn");

  function setMode(mode) {
    const loginActive = mode === "login";
    showLoginBtn.className = loginActive ? "btn-primary" : "btn-secondary";
    showSignupBtn.className = loginActive ? "btn-secondary" : "btn-primary";

    authContent.innerHTML = `
      <h2>${loginActive ? "Log in" : "Create account"}</h2>
      <p class="subtext">
        ${loginActive ? "Use your account to enter Nodent." : "Create a real account stored in the app database."}
      </p>

      <form id="authForm">
        <div class="form-group">
          <label class="label" for="email">Email address</label>
          <input type="email" id="email" placeholder="student@example.com" value="${escapeHtml(rememberedEmail)}" required />
        </div>

        <div class="form-group">
          <label class="label" for="password">Password</label>
          <input type="password" id="password" placeholder="Enter your password" required />
        </div>

        <label class="checkbox-line">
          <input type="checkbox" id="rememberMe" ${getRememberLogin() ? "checked" : ""} />
          <span>Remember login on this device</span>
        </label>

        <button class="btn-primary w-full" type="submit">${loginActive ? "Continue" : "Create account"}</button>
        <div id="authError" class="error-message"></div>
      </form>
    `;

    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = document.getElementById("email").value.trim().toLowerCase();
      const password = document.getElementById("password").value.trim();
      const remember = document.getElementById("rememberMe").checked;
      const errorBox = document.getElementById("authError");

      errorBox.textContent = "";

      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      if (!validEmail) {
        errorBox.textContent = "Please enter a valid email address.";
        return;
      }

      if (password.length < 4) {
        errorBox.textContent = "Password must be at least 4 characters.";
        return;
      }

      try {
        const result = loginActive
          ? await loginUser(email, password)
          : await signupUser(email, password);

        setAuthToken(result.token);
        setCurrentUser(result.user);
        setRememberLogin(remember);

        const existingSubjects = getJson(`${STORAGE_KEYS.mySubjectsPrefix}${result.user.id}`, null);
        if (!existingSubjects) {
          setJson(`${STORAGE_KEYS.mySubjectsPrefix}${result.user.id}`, defaultSubjects);
        }

        window.location.hash = "#dashboard";
      } catch (error) {
        errorBox.textContent = error.message;
      }
    });
  }

  showLoginBtn.addEventListener("click", () => setMode("login"));
  showSignupBtn.addEventListener("click", () => setMode("signup"));
  setMode("login");
}

function buildAppLayout(activePage, content, heading, subheading, extraTopLeft = "") {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-top">
          <div class="sidebar-brand">
            <img src="${LOGO_PATH}" alt="Nodent logo" class="sidebar-logo" />
            <div>
              <h2>Nodent</h2>
              <p>Focused student workspace</p>
            </div>
          </div>

          <nav class="nav">
            <button class="nav-btn ${activePage === "dashboard" ? "active" : ""}" id="navDashboard">
              <span>▣</span>
              <span>Dashboard</span>
            </button>

            <button class="nav-btn ${activePage === "track-study" ? "active" : ""}" id="navTrack">
              <span>◔</span>
              <span>Track My Study</span>
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
              <h1>${heading}</h1>
              <p>${subheading}</p>
            </div>
          </div>
          <div class="top-pill">Accounts and scores saved in SQLite</div>
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

  document.getElementById("logoutBtn").addEventListener("click", logout);
}

function attachSubjectSearchLogic(mySubjects) {
  const searchInput = document.getElementById("allSubjectsSearch");
  if (!searchInput) return;

  document.querySelectorAll("[data-add-subject]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-add-subject");
      const updated = [...new Set([...mySubjects, id])];
      setMySubjects(updated);
      renderDashboard();
    });
  });

  searchInput.addEventListener("input", (event) => {
    const value = event.target.value.trim().toLowerCase();
    let visibleCount = 0;

    document.querySelectorAll("#allSubjectsList .subject-search-item").forEach(item => {
      const name = item.getAttribute("data-all-name");
      const isVisible = name.includes(value);
      item.style.display = isVisible ? "flex" : "none";
      if (isVisible) visibleCount++;
    });

    const list = document.getElementById("allSubjectsList");
    const existingEmpty = document.getElementById("searchEmptyState");
    if (existingEmpty) existingEmpty.remove();

    if (visibleCount === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.id = "searchEmptyState";
      emptyDiv.className = "subject-search-empty";
      emptyDiv.textContent = "No subjects match your search.";
      list.appendChild(emptyDiv);
    }
  });
}

function renderDashboard() {
  const subjects = getSubjects();
  const mySubjects = getMySubjects();
  const currentSubjects = subjects.filter(subject => mySubjects.includes(subject.id));

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
              ? currentSubjects.map(subject => `
                <article class="subject-card">
                  <div class="subject-head">
                    <h4>${subject.name}</h4>
                    <div class="subject-head-actions">
                      <span class="tag">${subject.category}</span>
                      <button class="subject-remove-btn" data-remove="${subject.id}" aria-label="Remove ${subject.name}" title="Remove ${subject.name}">×</button>
                    </div>
                  </div>
                  <div class="subject-desc">${subject.description}</div>
                  <div class="subject-actions">
                    <button class="btn-primary" data-quiz="${subject.id}">Quiz</button>
                                      </div>
                </article>
              `).join("")
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
    "Manage your study subjects and launch quizzes.",
    buildSubjectFlyout(subjects, mySubjects)
  );

  attachSubjectSearchLogic(mySubjects);

  document.querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-remove");
      setMySubjects(mySubjects.filter(subjectId => subjectId !== id));
      renderDashboard();
    });
  });

  document.querySelectorAll("[data-quiz]").forEach(button => {
    button.addEventListener("click", () => {
      window.location.hash = `#quiz/${button.getAttribute("data-quiz")}`;
    });
  });

  if (adminUnlocked) {
    openAdminPanel();
  }
}

function openAdminPanel() {
  if (document.getElementById("adminOverlay")) return;

  const subjects = getSubjects();
  const customQuestions = getCustomQuestions();

  const overlay = document.createElement("div");
  overlay.className = "admin-overlay";
  overlay.id = "adminOverlay";
  overlay.innerHTML = `
    <div class="admin-modal">
      <h2>Hidden Question Manager</h2>
      <p>Add VCE-style mixed-format questions privately. These input tools do not appear in the normal student interface.</p>

      <form id="adminQuestionForm">
        <div class="admin-grid">
          <div>
            <label class="label" for="adminSubject">Subject</label>
            <select id="adminSubject">
              ${subjects.map(subject => `<option value="${subject.id}">${subject.name}</option>`).join("")}
            </select>
          </div>

          <div>
            <label class="label" for="adminQuestionType">Question type</label>
            <select id="adminQuestionType">
              <option value="mcq">Multiple choice</option>
              <option value="short">Short answer</option>
              <option value="long">Written / essay</option>
            </select>
          </div>

          <div class="admin-grid-full">
            <label class="label" for="adminQuestion">Question</label>
            <textarea id="adminQuestion" rows="3" placeholder="Paste your VCE question here..." required></textarea>
          </div>

          <div class="admin-grid-full">
            <label class="label" for="adminPassage">Passage / extract (optional)</label>
            <textarea id="adminPassage" rows="5" placeholder="Paste any stimulus passage, quote, or extract here if needed..."></textarea>
          </div>

          <div class="admin-grid-full">
            <label class="label" for="adminGuidance">Writing guidance (optional)</label>
            <input id="adminGuidance" type="text" placeholder="e.g. Write a structured essay with textual evidence" />
          </div>

          <div id="mcqFields">
            <label class="label" for="adminOption1">Option 1</label>
            <input id="adminOption1" type="text" />
          </div>

          <div id="mcqFields2">
            <label class="label" for="adminOption2">Option 2</label>
            <input id="adminOption2" type="text" />
          </div>

          <div id="mcqFields3">
            <label class="label" for="adminOption3">Option 3</label>
            <input id="adminOption3" type="text" />
          </div>

          <div id="mcqFields4">
            <label class="label" for="adminOption4">Option 4</label>
            <input id="adminOption4" type="text" />
          </div>

          <div id="mcqCorrectWrap">
            <label class="label" for="adminCorrect">Correct option number</label>
            <select id="adminCorrect">
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
              <option value="3">Option 3</option>
              <option value="4">Option 4</option>
            </select>
          </div>

          <div class="admin-grid-full" id="shortAnswerWrap" style="display:none;">
            <label class="label" for="adminAcceptedAnswers">Accepted short answers</label>
            <textarea id="adminAcceptedAnswers" rows="3" placeholder="Enter accepted answers separated by commas"></textarea>
          </div>
        </div>

        <div class="admin-actions">
          <button class="btn-primary" type="submit">Save Question</button>
          <button class="btn-secondary" type="button" id="closeAdminPanelBtn">Close</button>
        </div>

        <div class="admin-note">Saved questions are still local to this device unless you build more backend endpoints for them too.</div>
      </form>

      <div class="admin-saved-list">
        ${Object.entries(customQuestions).flatMap(([subjectId, questionList]) =>
          questionList.map(question => {
            const subject = subjects.find(s => s.id === subjectId);
            return `
              <div class="admin-saved-item">
                <strong>${escapeHtml(subject ? subject.name : subjectId)} • ${escapeHtml(question.type || "mcq")}</strong>
                <div>${escapeHtml(question.question)}</div>
              </div>
            `;
          })
        ).join("") || `<div class="empty">No custom questions added yet.</div>`}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const typeSelect = document.getElementById("adminQuestionType");

  function updateAdminFields() {
    const type = typeSelect.value;
    const mcqIds = ["mcqFields", "mcqFields2", "mcqFields3", "mcqFields4", "mcqCorrectWrap"];
    mcqIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = type === "mcq" ? "" : "none";
    });
    document.getElementById("shortAnswerWrap").style.display = type === "short" ? "" : "none";
  }

  typeSelect.addEventListener("change", updateAdminFields);
  updateAdminFields();

  document.getElementById("closeAdminPanelBtn").addEventListener("click", () => {
    adminUnlocked = false;
    overlay.remove();
  });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      adminUnlocked = false;
      overlay.remove();
    }
  });

  document.getElementById("adminQuestionForm").addEventListener("submit", (event) => {
    event.preventDefault();

    const subjectId = document.getElementById("adminSubject").value;
    const type = document.getElementById("adminQuestionType").value;
    const questionText = document.getElementById("adminQuestion").value.trim();
    const passage = document.getElementById("adminPassage").value.trim();
    const guidance = document.getElementById("adminGuidance").value.trim();

    if (!questionText) return;

    if (type === "mcq") {
      const option1 = document.getElementById("adminOption1").value.trim();
      const option2 = document.getElementById("adminOption2").value.trim();
      const option3 = document.getElementById("adminOption3").value.trim();
      const option4 = document.getElementById("adminOption4").value.trim();
      const correctIndex = Number(document.getElementById("adminCorrect").value) - 1;
      const options = [option1, option2, option3, option4];

      if (options.some(option => !option)) return;

      addCustomQuestion(subjectId, {
        type: "mcq",
        question: questionText,
        passage,
        guidance,
        options,
        answer: options[correctIndex]
      });
    }

    if (type === "short") {
      const acceptedAnswers = document.getElementById("adminAcceptedAnswers").value
        .split(",")
        .map(answer => answer.trim())
        .filter(Boolean);

      if (!acceptedAnswers.length) return;

      addCustomQuestion(subjectId, {
        type: "short",
        question: questionText,
        passage,
        guidance,
        acceptedAnswers
      });
    }

    if (type === "long") {
      addCustomQuestion(subjectId, {
        type: "long",
        question: questionText,
        passage,
        guidance
      });
    }

    overlay.remove();
    openAdminPanel();
  });
}

function renderTrackStudy() {
  const studyData = getStudyData();
  const progressPercent = Math.min(100, Math.round((studyData.dailySeconds / (studyData.goalMinutes * 60)) * 100));

  const content = `
    <div class="study-grid">
      <section class="timer-card">
        <h3>Study Timer</h3>
        <div class="panel-text">
          Run a focused study session, track today’s total study time, and keep your daily progress saved automatically.
        </div>

        <div class="timer-status">
          <span>●</span>
          <span>${studyData.isRunning ? "Session running" : "Timer paused"}</span>
        </div>

        <div class="timer-display" id="timerDisplay">${formatSeconds(studyData.remainingSeconds)}</div>

        <div class="timer-settings">
          <div>
            <label class="label" for="sessionMinutes">Focus session length</label>
            <select id="sessionMinutes">
              ${[15, 25, 30, 45, 60, 90].map(min => `
                <option value="${min}" ${studyData.sessionMinutes === min ? "selected" : ""}>${min} minutes</option>
              `).join("")}
            </select>
          </div>

          <div>
            <label class="label" for="goalMinutes">Daily study goal</label>
            <select id="goalMinutes">
              ${[30, 60, 90, 120, 180, 240].map(min => `
                <option value="${min}" ${studyData.goalMinutes === min ? "selected" : ""}>${min} minutes</option>
              `).join("")}
            </select>
          </div>
        </div>

        <div class="timer-controls">
          <button class="btn-primary" id="startPauseBtn">${studyData.isRunning ? "Pause" : "Start"}</button>
          <button class="btn-neutral" id="resetSessionBtn">Reset Session</button>
          <button class="btn-amber" id="completeSessionBtn">Complete Session</button>
        </div>
      </section>

      <aside class="progress-card">
        <h3>Daily Progress</h3>
        <div class="panel-text">Your study time today resets automatically each new day.</div>

        <div class="progress-ring-panel">
          <div class="progress-circle" style="--progress:${progressPercent}">
            <div class="progress-circle-inner">
              <strong>${progressPercent}%</strong>
              <span>goal reached</span>
            </div>
          </div>
        </div>

        <div class="daily-progress-bar">
          <div class="daily-progress-fill" style="width:${progressPercent}%"></div>
        </div>

        <div class="stat-list">
          <div class="stat-row">
            <span>Today studied</span>
            <strong id="todayStudiedValue">${formatMinutesFromSeconds(studyData.dailySeconds)}</strong>
          </div>
          <div class="stat-row">
            <span>Daily goal</span>
            <strong>${studyData.goalMinutes} min</strong>
          </div>
          <div class="stat-row">
            <span>Sessions completed</span>
            <strong id="sessionsCompletedValue">${studyData.sessionsCompleted}</strong>
          </div>
          <div class="stat-row">
            <span>Current session left</span>
            <strong id="remainingValue">${formatSeconds(studyData.remainingSeconds)}</strong>
          </div>
        </div>
      </aside>
    </div>
  `;

  buildAppLayout("track-study", content, "Track My Study", "Run a focus timer and track your daily study progress.");

  const sessionSelect = document.getElementById("sessionMinutes");
  const goalSelect = document.getElementById("goalMinutes");
  const startPauseBtn = document.getElementById("startPauseBtn");
  const resetSessionBtn = document.getElementById("resetSessionBtn");
  const completeSessionBtn = document.getElementById("completeSessionBtn");

  sessionSelect.addEventListener("change", () => {
    const data = getStudyData();
    data.sessionMinutes = Number(sessionSelect.value);
    if (!data.isRunning) data.remainingSeconds = data.sessionMinutes * 60;
    setStudyData(data);
    renderTrackStudy();
  });

  goalSelect.addEventListener("change", () => {
    const data = getStudyData();
    data.goalMinutes = Number(goalSelect.value);
    setStudyData(data);
    renderTrackStudy();
  });

  startPauseBtn.addEventListener("click", () => {
    const data = getStudyData();
    data.isRunning = !data.isRunning;
    setStudyData(data);
    renderTrackStudy();
  });

  resetSessionBtn.addEventListener("click", () => {
    const data = getStudyData();
    data.isRunning = false;
    data.remainingSeconds = data.sessionMinutes * 60;
    setStudyData(data);
    renderTrackStudy();
  });

  completeSessionBtn.addEventListener("click", () => {
    const data = getStudyData();
    const completedSeconds = data.sessionMinutes * 60 - data.remainingSeconds;
    data.dailySeconds += completedSeconds > 0 ? completedSeconds : data.sessionMinutes * 60;
    data.sessionsCompleted += 1;
    data.isRunning = false;
    data.remainingSeconds = data.sessionMinutes * 60;
    setStudyData(data);
    renderTrackStudy();
  });

  startTimerTick();
}

function startTimerTick() {
  clearTimerInterval();

  const data = getStudyData();
  if (!data.isRunning) return;

  timerInterval = setInterval(() => {
    const latest = getStudyData();

    if (!latest.isRunning) {
      clearTimerInterval();
      return;
    }

    if (latest.remainingSeconds > 0) {
      latest.remainingSeconds -= 1;
      latest.dailySeconds += 1;
      setStudyData(latest);

      const timerDisplay = document.getElementById("timerDisplay");
      const todayStudiedValue = document.getElementById("todayStudiedValue");
      const remainingValue = document.getElementById("remainingValue");

      if (timerDisplay) timerDisplay.textContent = formatSeconds(latest.remainingSeconds);
      if (todayStudiedValue) todayStudiedValue.textContent = formatMinutesFromSeconds(latest.dailySeconds);
      if (remainingValue) remainingValue.textContent = formatSeconds(latest.remainingSeconds);

      const goalSeconds = latest.goalMinutes * 60;
      const progressPercent = Math.min(100, Math.round((latest.dailySeconds / goalSeconds) * 100));

      const circle = document.querySelector(".progress-circle");
      const fill = document.querySelector(".daily-progress-fill");
      const circleText = document.querySelector(".progress-circle-inner strong");

      if (circle) circle.style.setProperty("--progress", progressPercent);
      if (fill) fill.style.width = `${progressPercent}%`;
      if (circleText) circleText.textContent = `${progressPercent}%`;
    } else {
      latest.isRunning = false;
      latest.sessionsCompleted += 1;
      latest.remainingSeconds = latest.sessionMinutes * 60;
      setStudyData(latest);
      renderTrackStudy();
    }
  }, 1000);
}

function getQuestionTypeLabel(type) {
  if (type === "mcq") return "Multiple Choice";
  if (type === "short") return "Short Answer";
  if (type === "long") return "Written Response";
  return "Question";
}

function renderQuiz(subjectId) {
  const subject = getSubjectById(subjectId);
  if (!subject) {
    window.location.hash = "#dashboard";
    return;
  }

  const questions = subject.quiz;
  let currentIndex = 0;
  let score = 0;
  let autoMarkedCount = 0;
  let answerLocked = false;

  function showQuestion() {
    const question = questions[currentIndex];
    const type = question.type || "mcq";
    const progressPercent = Math.round((currentIndex / questions.length) * 100);
    const flatComments = getQuizComments()[`${subject.id}__${question.question}`] || [];
    const commentTree = buildCommentTree(flatComments);
    const savedResponse = getWrittenResponse(subject.id, question.question);

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
          <textarea id="writtenAnswerInput" rows="${type === "short" ? 3 : 10}" placeholder="${type === "short" ? "Type your short answer..." : "Write your response here..."}">${savedResponse ? escapeHtml(savedResponse.response) : ""}</textarea>
          <div class="quiz-answer-helper">
            ${
              type === "short"
                ? "Short answers are auto-checked against accepted answers."
                : "Written responses are saved for review and are not auto-marked."
            }
          </div>
        </div>
      `;

    const content = `
      <div class="page-narrow page-wide">
        <div class="back-row">
          <button class="btn-secondary" id="backBtn">← Back to Dashboard</button>
        </div>

        <div class="quiz-meta">
          <span>${subject.name}</span>
          <span>Question ${currentIndex + 1} of ${questions.length}</span>
        </div>

        <div class="quiz-layout">
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
                ? `<div class="saved-response"><strong>Saved response:</strong>

${escapeHtml(savedResponse.response)}</div>`
                : ""
            }

            <div style="display:flex; gap:12px; flex-wrap:wrap; margin-top:18px;">
              <button class="btn-primary" id="nextBtn" ${type === "mcq" ? "disabled" : ""}>${currentIndex === questions.length - 1 ? "Finish Quiz" : "Next Question"}</button>
            </div>
          </section>

          <aside class="quiz-comments-side">
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

    buildAppLayout("", content, `${subject.name} Quiz`, "Mixed-format subject practice from your dashboard.");

    document.getElementById("backBtn").addEventListener("click", () => {
      window.location.hash = "#dashboard";
    });

    document.getElementById("quizCommentForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("quizCommentInput");
      const text = input.value.trim();
      if (!text) return;
      addQuizComment(subject.id, question.question, text, null);
      showQuestion();
    });

    document.querySelectorAll(".quiz-reply-toggle").forEach(button => {
      button.addEventListener("click", () => {
        const form = document.getElementById(`replyForm_${button.dataset.commentId}`);
        form.style.display = form.style.display === "none" ? "grid" : "none";
      });
    });

    document.querySelectorAll(".quiz-reply-form").forEach(form => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const commentId = Number(form.id.replace("replyForm_", ""));
        const input = document.getElementById(`replyInput_${commentId}`);
        const text = input.value.trim();
        if (!text) return;
        addQuizComment(subject.id, question.question, text, commentId);
        showQuestion();
      });
    });

    const nextBtn = document.getElementById("nextBtn");
    const feedback = document.getElementById("feedback");

    if (type === "mcq") {
      document.querySelectorAll(".quiz-option").forEach(button => {
        button.addEventListener("click", () => {
          if (answerLocked) return;
          answerLocked = true;

          const selectedAnswer = button.textContent;
          const isCorrect = selectedAnswer === question.answer;
          autoMarkedCount += 1;

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

          if (isCorrect) {
            score++;
            feedback.innerHTML = `<div class="quiz-feedback correct">Correct answer.</div>`;
          } else {
            feedback.innerHTML = `<div class="quiz-feedback incorrect">Incorrect. Correct answer: ${escapeHtml(question.answer)}</div>`;
          }

          nextBtn.disabled = false;
        });
      });
    } else {
      nextBtn.addEventListener("click", () => {
        if (answerLocked) return;

        const input = document.getElementById("writtenAnswerInput");
        const typed = input.value.trim();

        if (!typed) {
          feedback.innerHTML = `<div class="quiz-feedback incorrect">Please enter a response before continuing.</div>`;
          return;
        }

        answerLocked = true;
        input.disabled = true;

        if (type === "short") {
          const normalizedTyped = normalizeAnswer(typed);
          const accepted = (question.acceptedAnswers || []).map(normalizeAnswer);
          autoMarkedCount += 1;
          saveWrittenResponse(subject.id, question.question, typed);

          if (accepted.includes(normalizedTyped)) {
            score++;
            feedback.innerHTML = `<div class="quiz-feedback correct">Accepted short answer.</div>`;
          } else {
            feedback.innerHTML = `<div class="quiz-feedback incorrect">Saved, but not matched to the accepted short answers.</div>`;
          }
        }

        if (type === "long") {
          saveWrittenResponse(subject.id, question.question, typed);
          feedback.innerHTML = `<div class="quiz-feedback saved">Written response saved for later review.</div>`;
        }

        if (currentIndex < questions.length - 1) {
          currentIndex++;
          answerLocked = false;
          showQuestion();
        } else {
          showResult();
        }
      });

      return;
    }

    nextBtn.addEventListener("click", () => {
      currentIndex++;
      answerLocked = false;

      if (currentIndex < questions.length) {
        showQuestion();
      } else {
        showResult();
      }
    });
  }

  async function showResult() {
    const percent = autoMarkedCount > 0 ? Math.round((score / autoMarkedCount) * 100) : 0;
    const longCount = questions.filter(q => (q.type || "mcq") === "long").length;
    let leaderboardHtml = `<div class="leaderboard-meta">Leaderboard unavailable.</div>`;

    try {
      if (autoMarkedCount > 0) {
        await submitQuizScore(subject.id, score, autoMarkedCount);
      }

      const leaderboardData = await fetchLeaderboard(subject.id);
      const board = leaderboardData.leaderboard || [];

      leaderboardHtml = board.length
        ? `
          <div class="leaderboard-list">
            ${board.map((entry, index) => `
              <div class="leaderboard-row">
                <div>
                  <div><span class="leaderboard-rank">#${index + 1}</span> ${escapeHtml(entry.email)}</div>
                  <div class="leaderboard-meta">${entry.attempts} attempt${Number(entry.attempts) === 1 ? "" : "s"}</div>
                </div>
                <strong>${entry.best_percent}% (${entry.best_score}/${entry.best_total})</strong>
              </div>
            `).join("")}
          </div>
        `
        : `<div class="leaderboard-meta">No scores yet for this subject.</div>`;
    } catch (error) {
      leaderboardHtml = `<div class="leaderboard-meta">${escapeHtml(error.message)}</div>`;
    }

    const content = `
      <div class="page-narrow">
        <div class="back-row">
          <button class="btn-secondary" id="backBtn">← Back to Dashboard</button>
        </div>

        <section class="quiz-card">
          <h2>${subject.name} Quiz Complete</h2>
          <div class="result-score">${score} / ${autoMarkedCount}</div>
          <div class="result-sub">
            Auto-marked score: ${percent}%.
            ${longCount > 0 ? ` This quiz also included ${longCount} written response ${longCount === 1 ? "question" : "questions"} saved separately.` : ""}
          </div>

          <div style="display:flex; gap:12px; flex-wrap:wrap;">
            <button class="btn-primary" id="retryBtn">Retry Quiz</button>
          </div>

          <div class="leaderboard-block">
            <h3>Leaderboard</h3>
            <p>Top scores for ${subject.name}.</p>
            ${leaderboardHtml}
          </div>
        </section>
      </div>
    `;

    buildAppLayout("", content, `${subject.name} Quiz`, "Review your result and continue revising.");

    document.getElementById("backBtn").addEventListener("click", () => {
      window.location.hash = "#dashboard";
    });

    document.getElementById("retryBtn").addEventListener("click", () => {
      currentIndex = 0;
      score = 0;
      autoMarkedCount = 0;
      answerLocked = false;
      showQuestion();
    });
  }

  showQuestion();
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

window.addEventListener("load", render);
window.addEventListener("hashchange", render);