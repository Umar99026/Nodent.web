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
  studyModeAnswers: "nodent_study_mode_answers",
  adminKey: "nodent_admin_key"
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
  adminQuestions: "/api/admin/questions",
  adminDeleteQuestion: (id) => `/api/admin/questions/${id}`,
  leaderboard: (subjectId) => `/api/leaderboard/${encodeURIComponent(subjectId)}`,
  comments: (subjectId, questionKey) =>
    `/api/comments/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`,
  written: (subjectId, questionKey) =>
    `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}`,
  writtenAll: (subjectId, questionKey) =>
    `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}/all`
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
          "Read the passage below and explain how language choices shape the reader's response. Refer closely to tone, persuasive devices, and intended audience.",
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
  },
  {
    id: "chemistry",
    name: "Chemistry",
    category: "VCE",
    description: "Atomic theory, chemical bonding, reactions, energy, organic chemistry, and electrochemistry.",
    quiz: [
      { type: "mcq", question: "The atomic number of an element equals:", options: ["Number of neutrons", "Number of protons", "Mass number", "Number of electrons only"], answer: "Number of protons" },
      { type: "short", question: "What is the pH of a neutral solution at 25°C?", acceptedAnswers: ["7", "7.0"] },
      { type: "mcq", question: "Which bond involves the sharing of electrons?", options: ["Ionic", "Covalent", "Metallic", "Hydrogen"], answer: "Covalent" },
      { type: "short", question: "What gas is produced when an acid reacts with a carbonate?", acceptedAnswers: ["carbon dioxide", "co2"] },
      {
        type: "long",
        question: "Explain the difference between exothermic and endothermic reactions, with one example of each.",
        guidance: "Use correct chemical terminology and relate energy changes to bond breaking and forming."
      }
    ]
  },
  {
    id: "physics",
    name: "Physics",
    category: "VCE",
    description: "Motion, forces, energy, electricity, fields, thermodynamics, and quantum physics.",
    quiz: [
      { type: "mcq", question: "Newton's second law states that force equals:", options: ["mass × velocity", "mass × acceleration", "mass × distance", "velocity / time"], answer: "mass × acceleration" },
      { type: "short", question: "What is the SI unit of electric current?", acceptedAnswers: ["ampere", "amp", "a"] },
      { type: "mcq", question: "Which type of wave does not require a medium to travel?", options: ["Sound", "Water", "Electromagnetic", "Seismic"], answer: "Electromagnetic" },
      { type: "short", question: "State the law of conservation of energy in one sentence.", acceptedAnswers: ["energy cannot be created or destroyed", "energy is conserved", "total energy remains constant"] },
      {
        type: "long",
        question: "A car accelerates from rest to 20 m/s in 8 seconds. Calculate its acceleration and the net force if its mass is 1200 kg. Show all working.",
        guidance: "Use F = ma and a = Δv/Δt. Show units at every step."
      }
    ]
  },
  {
    id: "psychology",
    name: "Psychology",
    category: "VCE",
    description: "Biological, cognitive, and sociocultural approaches to behaviour, consciousness, learning, and mental health.",
    quiz: [
      { type: "mcq", question: "The part of the brain most associated with memory formation is the:", options: ["Cerebellum", "Hippocampus", "Amygdala", "Frontal lobe"], answer: "Hippocampus" },
      { type: "mcq", question: "Classical conditioning was first demonstrated by:", options: ["Skinner", "Freud", "Pavlov", "Bandura"], answer: "Pavlov" },
      { type: "short", question: "What does REM stand for in sleep research?", acceptedAnswers: ["rapid eye movement"] },
      {
        type: "long",
        question: "Explain how the fight-or-flight response is triggered and describe its physiological effects on the body.",
        guidance: "Refer to the role of the nervous system and hormones such as adrenaline."
      },
      { type: "mcq", question: "Which research method best establishes cause and effect?", options: ["Case study", "Survey", "Experiment", "Observation"], answer: "Experiment" }
    ]
  },
  {
    id: "history-revolutions",
    name: "History: Revolutions",
    category: "VCE",
    description: "Causes, course, and consequences of major revolutions including France, Russia, America, and China.",
    quiz: [
      { type: "mcq", question: "The storming of the Bastille occurred in:", options: ["1776", "1789", "1799", "1815"], answer: "1789" },
      { type: "short", question: "Who led the Bolshevik Revolution in Russia in 1917?", acceptedAnswers: ["vladimir lenin", "lenin"] },
      { type: "mcq", question: "The Declaration of Independence was signed in:", options: ["1773", "1775", "1776", "1781"], answer: "1776" },
      {
        type: "long",
        question: "To what extent were long-term causes more important than short-term causes in bringing about a revolution of your choice?",
        guidance: "Construct an argument with a clear contention, at least two long-term and one short-term cause, and a conclusion."
      }
    ]
  },
  {
    id: "legal-studies",
    name: "Legal Studies",
    category: "VCE",
    description: "The Australian legal system, rights, justice, parliament, courts, and dispute resolution.",
    quiz: [
      { type: "mcq", question: "Statute law is law made by:", options: ["Courts", "Parliament", "Police", "The Governor-General"], answer: "Parliament" },
      { type: "short", question: "What is the highest court in Australia?", acceptedAnswers: ["high court", "high court of australia"] },
      { type: "mcq", question: "The presumption of innocence means:", options: ["All accused are guilty", "The accused is assumed innocent until proven guilty", "Evidence is not required", "The judge decides without a jury"], answer: "The accused is assumed innocent until proven guilty" },
      {
        type: "long",
        question: "Evaluate the effectiveness of mediation as a method of dispute resolution compared to litigation.",
        guidance: "Discuss cost, time, outcomes, and suitability for different types of disputes."
      }
    ]
  },
  {
    id: "economics",
    name: "Economics",
    category: "VCE",
    description: "Microeconomics, macroeconomics, markets, government policy, globalisation, and the Australian economy.",
    quiz: [
      { type: "mcq", question: "When price rises and quantity demanded falls, this shows:", options: ["Elastic supply", "The law of demand", "A supply shift", "Market failure"], answer: "The law of demand" },
      { type: "short", question: "What does GDP stand for?", acceptedAnswers: ["gross domestic product"] },
      { type: "mcq", question: "Inflation is best described as:", options: ["A fall in unemployment", "A sustained rise in the general price level", "A decrease in exports", "A budget surplus"], answer: "A sustained rise in the general price level" },
      {
        type: "long",
        question: "Explain how the Reserve Bank of Australia uses interest rates to manage inflation. In your response, discuss both the transmission mechanism and limitations of monetary policy.",
        guidance: "Use economic concepts and relevant Australian examples where possible."
      }
    ]
  },
  {
    id: "accounting",
    name: "Accounting",
    category: "VCE",
    description: "Financial reporting, double-entry bookkeeping, cash flows, balance sheets, and business decision-making.",
    quiz: [
      { type: "mcq", question: "The accounting equation is:", options: ["Assets = Liabilities + Equity", "Revenue = Expenses + Profit", "Assets = Revenue - Expenses", "Liabilities = Assets + Equity"], answer: "Assets = Liabilities + Equity" },
      { type: "short", question: "What financial report shows revenue and expenses for a period?", acceptedAnswers: ["income statement", "profit and loss statement", "profit and loss"] },
      { type: "mcq", question: "A credit entry in the accounts increases:", options: ["Assets", "Expenses", "Liabilities", "Drawings"], answer: "Liabilities" },
      {
        type: "long",
        question: "Explain the difference between cash accounting and accrual accounting, and discuss when each would be most appropriate for a small business.",
        guidance: "Include examples of how each method records a sale on credit."
      }
    ]
  },
  {
    id: "business-management",
    name: "Business Management",
    category: "VCE",
    description: "Business planning, management styles, operations, human resources, finance, and change management.",
    quiz: [
      { type: "mcq", question: "A SWOT analysis examines:", options: ["Sales, Wages, Operations, Technology", "Strengths, Weaknesses, Opportunities, Threats", "Strategy, Work, Output, Targets", "Staff, Workflow, Outcomes, Training"], answer: "Strengths, Weaknesses, Opportunities, Threats" },
      { type: "short", question: "What management style involves employees in decision-making?", acceptedAnswers: ["participative", "democratic", "consultative"] },
      { type: "mcq", question: "Staff turnover refers to:", options: ["Training new employees", "The rate at which employees leave and are replaced", "Promoting staff internally", "Annual performance reviews"], answer: "The rate at which employees leave and are replaced" },
      {
        type: "long",
        question: "Evaluate the effectiveness of transformational leadership in managing change within a business. Use examples to support your response.",
        guidance: "Refer to key features of transformational leadership and contrast with at least one other style."
      }
    ]
  },
  {
    id: "geography",
    name: "Geography",
    category: "VCE",
    description: "Natural environments, human populations, tourism, globalisation, and geographical inquiry and skills.",
    quiz: [
      { type: "mcq", question: "Plate tectonics explains:", options: ["Weather patterns", "Ocean salinity", "Movement of Earth's lithospheric plates", "River formation"], answer: "Movement of Earth's lithospheric plates" },
      { type: "short", question: "What term describes the movement of people from rural areas to cities?", acceptedAnswers: ["urbanisation", "rural-urban migration"] },
      { type: "mcq", question: "A renewable resource is one that:", options: ["Cannot be reused", "Replenishes naturally over time", "Is found only underground", "Is man-made"], answer: "Replenishes naturally over time" },
      {
        type: "long",
        question: "To what extent does tourism development bring more benefits than costs to a destination of your choice? Refer to economic, social, and environmental impacts.",
        guidance: "Use specific place-based examples and a clear evaluative structure."
      }
    ]
  },
  {
    id: "further-maths",
    name: "Further Mathematics",
    category: "VCE",
    description: "Data analysis, recursion and financial modelling, matrices, networks, geometry, and statistics.",
    quiz: [
      { type: "mcq", question: "The median of 3, 7, 9, 12, 15 is:", options: ["7", "9", "10", "12"], answer: "9" },
      { type: "short", question: "What is the name of the graph that displays the five-number summary?", acceptedAnswers: ["box plot", "boxplot", "box-and-whisker plot", "box and whisker plot"] },
      { type: "mcq", question: "Simple interest is calculated using:", options: ["I = Prn", "I = P(1 + r)^n", "I = P/rn", "I = P + rn"], answer: "I = Prn" },
      { type: "short", question: "In a network graph, what is the term for the number of edges connected to a vertex?", acceptedAnswers: ["degree", "valency"] }
    ]
  },
  {
    id: "specialist-maths",
    name: "Specialist Mathematics",
    category: "VCE",
    description: "Complex numbers, vectors, mechanics, advanced calculus, probability distributions, and proof.",
    quiz: [
      { type: "mcq", question: "The modulus of the complex number 3 + 4i is:", options: ["3", "4", "5", "7"], answer: "5" },
      { type: "short", question: "What is the derivative of sin(x)?", acceptedAnswers: ["cos(x)", "cos x"] },
      { type: "mcq", question: "A vector quantity has:", options: ["Magnitude only", "Direction only", "Both magnitude and direction", "Neither magnitude nor direction"], answer: "Both magnitude and direction" },
      {
        type: "long",
        question: "Prove by mathematical induction that the sum of the first n positive integers is n(n+1)/2.",
        guidance: "Clearly show the base case, inductive hypothesis, and inductive step."
      }
    ]
  },
  {
    id: "pe",
    name: "Physical Education",
    category: "VCE",
    description: "Energy systems, training principles, biomechanics, skill acquisition, and sport science.",
    quiz: [
      { type: "mcq", question: "The ATP-PC energy system predominantly fuels activities lasting:", options: ["Under 10 seconds", "1–3 minutes", "More than 20 minutes", "Exactly 5 minutes"], answer: "Under 10 seconds" },
      { type: "short", question: "What term describes the body's ability to return to homeostasis after exercise?", acceptedAnswers: ["recovery", "post-exercise recovery"] },
      { type: "mcq", question: "Which training principle ensures the body is challenged beyond its current level?", options: ["Reversibility", "Specificity", "Overload", "Variety"], answer: "Overload" },
      {
        type: "long",
        question: "Analyse how the aerobic energy system contributes to performance in a sport of your choice. Refer to the role of oxygen and the production of ATP.",
        guidance: "Link physiological concepts clearly to the demands of the chosen sport."
      }
    ]
  },
  {
    id: "health-human-development",
    name: "Health and Human Development",
    category: "VCE",
    description: "Global health, Australia's health system, health promotion, dimensions of health, and the SDGs.",
    quiz: [
      { type: "mcq", question: "The five dimensions of health are physical, social, emotional, mental, and:", options: ["Cultural", "Spiritual", "Economic", "Environmental"], answer: "Spiritual" },
      { type: "short", question: "What does WHO stand for?", acceptedAnswers: ["world health organization", "world health organisation"] },
      { type: "mcq", question: "Primary prevention in health refers to:", options: ["Treating existing illness", "Early detection of disease", "Preventing disease before it occurs", "Rehabilitation after illness"], answer: "Preventing disease before it occurs" },
      {
        type: "long",
        question: "Explain how the Ottawa Charter's action areas can be applied to reduce rates of type 2 diabetes in Australia.",
        guidance: "Refer to at least three action areas with specific examples."
      }
    ]
  },
  {
    id: "music",
    name: "Music Performance",
    category: "VCE",
    description: "Musicianship, performance practice, music theory, aural skills, and music history.",
    quiz: [
      { type: "mcq", question: "A time signature of 3/4 means:", options: ["3 beats per bar, quarter note gets one beat", "4 beats per bar, dotted quarter gets one beat", "3 eighth notes per bar", "4 beats with triplet feel"], answer: "3 beats per bar, quarter note gets one beat" },
      { type: "short", question: "What Italian term indicates a gradual increase in speed?", acceptedAnswers: ["accelerando", "accel"] },
      { type: "mcq", question: "A semitone is:", options: ["Two whole steps", "The smallest interval in Western music", "A half note", "A type of scale"], answer: "The smallest interval in Western music" }
    ]
  },
  {
    id: "studio-arts",
    name: "Studio Arts",
    category: "VCE",
    description: "Art practice, the folio, studio processes, art theories, and critical analysis of artworks.",
    quiz: [
      { type: "mcq", question: "A studio folio in VCE Studio Arts documents:", options: ["Only final artworks", "The full creative process from exploration to resolution", "Research essays only", "Art history notes"], answer: "The full creative process from exploration to resolution" },
      { type: "short", question: "What term describes the arrangement of visual elements in an artwork?", acceptedAnswers: ["composition"] },
      {
        type: "long",
        question: "Analyse how an artist of your choice has used materials and techniques to convey meaning in one of their works.",
        guidance: "Use formal analysis language and reference specific visual elements and principles."
      }
    ]
  },
  {
    id: "environmental-science",
    name: "Environmental Science",
    category: "VCE",
    description: "Ecosystems, biodiversity, climate change, pollution, resource management, and sustainability.",
    quiz: [
      { type: "mcq", question: "The greenhouse effect is caused by:", options: ["Ozone depletion", "Greenhouse gases trapping heat in the atmosphere", "Ocean acidification only", "Solar flares"], answer: "Greenhouse gases trapping heat in the atmosphere" },
      { type: "short", question: "What term describes the variety of life in a given area?", acceptedAnswers: ["biodiversity"] },
      { type: "mcq", question: "A keystone species is one that:", options: ["Is the largest in an ecosystem", "Has a disproportionately large effect on its ecosystem", "Is endangered", "Migrates seasonally"], answer: "Has a disproportionately large effect on its ecosystem" },
      {
        type: "long",
        question: "Evaluate the effectiveness of two strategies used to manage a specific environmental issue such as land degradation or water pollution.",
        guidance: "Include both advantages and limitations of each strategy and use real-world examples."
      }
    ]
  },
  {
    id: "sociology",
    name: "Sociology",
    category: "VCE",
    description: "Social structures, culture, inequality, institutions, and sociological theory.",
    quiz: [
      { type: "mcq", question: "Socialisation refers to:", options: ["Making friends", "The process by which individuals learn social norms and values", "Government policy", "Economic mobility"], answer: "The process by which individuals learn social norms and values" },
      { type: "short", question: "What sociologist introduced the concept of the 'sociological imagination'?", acceptedAnswers: ["c wright mills", "mills"] },
      {
        type: "long",
        question: "Using sociological concepts, explain how social class influences educational outcomes. Refer to at least one theoretical perspective.",
        guidance: "Consider cultural capital, structural factors, and relevant evidence."
      }
    ]
  },
  {
    id: "it-applications",
    name: "Information Technology Applications",
    category: "VCE",
    description: "Databases, spreadsheets, user interface design, project management, and digital solutions.",
    quiz: [
      { type: "mcq", question: "A primary key in a database table:", options: ["Can contain duplicate values", "Uniquely identifies each record", "Is always a number", "Links to another table"], answer: "Uniquely identifies each record" },
      { type: "short", question: "What does SQL stand for?", acceptedAnswers: ["structured query language"] },
      { type: "mcq", question: "Which of the following is an example of validation in a database?", options: ["Encrypting data", "Checking that an entered date is in the correct format", "Backing up data", "Sorting records"], answer: "Checking that an entered date is in the correct format" },
      {
        type: "long",
        question: "Describe the phases of a systems development life cycle (SDLC) and explain why each phase is important in delivering a quality digital solution.",
        guidance: "Cover at least four phases with examples of activities within each."
      }
    ]
  },
  {
    id: "software-development",
    name: "Software Development",
    category: "VCE",
    description: "Programming, algorithms, data structures, software design, testing, and project management.",
    quiz: [
      { type: "mcq", question: "Which data structure operates on a Last-In, First-Out basis?", options: ["Queue", "Stack", "Array", "Linked list"], answer: "Stack" },
      { type: "short", question: "What is the term for finding and fixing errors in code?", acceptedAnswers: ["debugging"] },
      { type: "mcq", question: "An algorithm that sorts a list by repeatedly swapping adjacent elements is called:", options: ["Merge sort", "Selection sort", "Bubble sort", "Binary sort"], answer: "Bubble sort" },
      {
        type: "long",
        question: "Explain the difference between white-box and black-box testing. When would each be used in a software project?",
        guidance: "Include definitions, examples of test cases for each type, and a comparison."
      }
    ]
  },
  {
    id: "media",
    name: "Media",
    category: "VCE",
    description: "Media production, media texts, representation, audience, narrative, and media industries.",
    quiz: [
      { type: "mcq", question: "The term 'mise-en-scène' refers to:", options: ["Sound editing", "Everything visible within the frame of a shot", "The film's screenplay", "Post-production colour grading"], answer: "Everything visible within the frame of a shot" },
      { type: "short", question: "What is the name for a camera shot that shows a character from the waist up?", acceptedAnswers: ["medium shot", "mid shot"] },
      {
        type: "long",
        question: "Analyse how a media text of your choice constructs a representation of a particular social group. Refer to specific media codes and conventions.",
        guidance: "Use the language of media analysis and refer to at least three codes or conventions."
      }
    ]
  },
  {
    id: "politics",
    name: "Australian and Global Politics",
    category: "VCE",
    description: "Australian government, global actors, international relations, human rights, and power.",
    quiz: [
      { type: "mcq", question: "Australia's system of government is best described as a:", options: ["Presidential republic", "Constitutional monarchy and federal parliamentary democracy", "Unitary state", "Autocracy"], answer: "Constitutional monarchy and federal parliamentary democracy" },
      { type: "short", question: "What body is the primary organ of the United Nations responsible for international peace and security?", acceptedAnswers: ["security council", "un security council"] },
      { type: "mcq", question: "The concept of state sovereignty means:", options: ["Citizens have supreme power", "A state has supreme authority within its borders", "The military controls government", "International law overrides domestic law"], answer: "A state has supreme authority within its borders" },
      {
        type: "long",
        question: "To what extent do non-state actors challenge the power of nation-states in global politics? Use specific examples to support your argument.",
        guidance: "Consider at least two types of non-state actors and evaluate their influence."
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

function getUserUsername() {
  return getCurrentUser()?.username || getCurrentUser()?.email || "";
}

function getUserId() {
  return getCurrentUser()?.id || null;
}

function getStoredAdminKey() {
  return localStorage.getItem(STORAGE_KEYS.adminKey) || "";
}

function setStoredAdminKey(key) {
  localStorage.setItem(STORAGE_KEYS.adminKey, key);
}

function clearStoredAdminKey() {
  localStorage.removeItem(STORAGE_KEYS.adminKey);
}

function isAdminUnlocked() {
  return Boolean(getStoredAdminKey());
}

async function apiFetchAdmin(url, options = {}) {
  return apiFetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-admin-key": getStoredAdminKey()
    }
  });
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

async function signup(email, password, remember, username) {
  const data = await apiFetch(API.authSignup, {
    method: "POST",
    body: JSON.stringify({ email, password, remember, username })
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
      username: getUserUsername(),
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
        <div class="comment-meta"><strong>${escapeHtml(comment.username || comment.userEmail || "User")}</strong> • ${escapeHtml(formatDateTime(comment.time))}</div>
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
                <div class="reply-meta"><strong>${escapeHtml(reply.username || reply.userEmail || "User")}</strong> • ${escapeHtml(formatDateTime(reply.time))}</div>
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
  // Click-toggle flyout so panel stays open when moving mouse to select subjects
  const trigger = document.querySelector(".subject-flyout-trigger");
  const panel = document.querySelector(".subject-flyout-panel");
  if (trigger && panel) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains("flyout-open");
      panel.classList.toggle("flyout-open", !isOpen);
    });
    document.addEventListener("click", function closeFlyout(e) {
      if (!panel.contains(e.target) && e.target !== trigger) {
        panel.classList.remove("flyout-open");
        document.removeEventListener("click", closeFlyout);
      }
    });
  }

  document.querySelectorAll(".add-subject-btn").forEach((button) => {
    button.addEventListener("click", () => {
      addMySubjectLocal(button.dataset.subject);
      renderDashboard();
    });
  });
}

/* ----------------------------- layout builder ----------------------------- */

function buildAppLayout(activePage, content, heading, subheading, extraTopLeft = "") {
  const username = getUserUsername();
  const email = getUserEmail();

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

            ${isAdminUnlocked() ? `
            <button class="nav-btn ${activePage === "admin" ? "active" : ""}" id="navAdmin">
              <span>⚙</span>
              <span class="nav-label">Admin: Add Questions</span>
            </button>
            ` : ""}
          </nav>
        </div>

        <div class="user-card">
          <div class="small">Signed in as</div>
          <div class="username-display">${escapeHtml(username)}</div>
          <div class="email">${escapeHtml(email)}</div>
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
          <div class="topbar-right-group">
            <div class="topbar-username-pill">👤 ${escapeHtml(username)}</div>
            <div class="top-pill">Accounts and scores saved locally</div>
          </div>
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

  if (isAdminUnlocked()) {
    const navAdmin = document.getElementById("navAdmin");
    if (navAdmin) navAdmin.addEventListener("click", () => {
      window.location.hash = "#admin";
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

/* -------------------------------- login -------------------------------- */

function renderLogin() {
  const rememberedEmail = getRememberLogin() ? getCurrentUser()?.email || "" : "";

  // Start with login mode
  let isSignupMode = false;

  function renderForm() {
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
            <h2>${isSignupMode ? "Create account" : "Welcome back"}</h2>
            <p class="subtext">${isSignupMode ? "Fill in your details to get started." : "Log in or create an account to continue where you left off."}</p>

            <form id="authForm">
              ${isSignupMode ? `
              <div class="form-group">
                <label class="label" for="username">Username</label>
                <input id="username" type="text" placeholder="Choose a username" minlength="2" required />
              </div>
              ` : ""}

              <div class="form-group">
                <label class="label" for="email">Email</label>
                <input id="email" type="email" placeholder="your@email.com" value="${escapeHtml(rememberedEmail)}" required />
              </div>

              <div class="form-group">
                <label class="label" for="password">Password</label>
                <div class="password-wrap">
                  <input id="password" type="password" placeholder="••••••••" required />
                  <button class="password-toggle" type="button" id="togglePassword" aria-label="Show password">
                    <svg id="eyeIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  </button>
                </div>
              </div>

              <label class="checkbox-line">
                <input id="rememberLogin" type="checkbox" ${getRememberLogin() ? "checked" : ""} />
                Keep me signed in
              </label>

              <div style="display:flex; gap:12px; flex-wrap:wrap;">
                <button class="btn-primary" type="submit">${isSignupMode ? "Create Account" : "Log In"}</button>
                <button class="btn-secondary" type="button" id="toggleModeBtn">${isSignupMode ? "Back to Log In" : "Create Account"}</button>
              </div>

              <div class="error-message" id="authError"></div>
            </form>
          </div>
        </div>
      </section>
    `;

    // Password toggle
    document.getElementById("togglePassword").addEventListener("click", () => {
      const passwordInput = document.getElementById("password");
      const eyeIcon = document.getElementById("eyeIcon");
      if (passwordInput.type === "password") {
        passwordInput.type = "text";
        eyeIcon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        `;
      } else {
        passwordInput.type = "password";
        eyeIcon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
      }
    });

    // Switch between login / signup
    document.getElementById("toggleModeBtn").addEventListener("click", () => {
      isSignupMode = !isSignupMode;
      renderForm();
    });

    document.getElementById("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const authError = document.getElementById("authError");
      authError.textContent = "";

      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const remember = document.getElementById("rememberLogin").checked;

      try {
        if (isSignupMode) {
          const username = document.getElementById("username").value.trim();
          await signup(email, password, remember, username);
        } else {
          await login(email, password, remember);
        }
        window.location.hash = "#dashboard";
        render();
      } catch (error) {
        authError.textContent = error.message;
      }
    });
  }

  renderForm();
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
                      <button class="subject-remove-btn" data-remove="${subject.id}" type="button" aria-label="Remove ${escapeHtml(subject.name)}" title="Remove ${escapeHtml(subject.name)}">×</button>
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

  // Admin unlock — small unobtrusive button at bottom of dashboard
  const adminUnlockHtml = `
    <div class="admin-unlock-row">
      ${isAdminUnlocked()
        ? `<button class="btn-secondary admin-lock-btn" id="adminLockBtn" type="button">🔓 Admin unlocked — Lock</button>`
        : `<button class="btn-secondary admin-lock-btn" id="adminUnlockBtn" type="button">🔒 Admin</button>`
      }
    </div>
  `;
  const dashGrid = document.querySelector(".dashboard-grid");
  if (dashGrid) dashGrid.insertAdjacentHTML("beforeend", adminUnlockHtml);

  if (isAdminUnlocked()) {
    document.getElementById("adminLockBtn")?.addEventListener("click", () => {
      clearStoredAdminKey();
      renderDashboard();
    });
  } else {
    document.getElementById("adminUnlockBtn")?.addEventListener("click", () => {
      const key = prompt("Enter admin key:");
      if (!key) return;
      setStoredAdminKey(key.trim());
      // verify it works
      apiFetchAdmin(API.adminQuestions)
        .then(() => renderDashboard())
        .catch(() => {
          clearStoredAdminKey();
          alert("Incorrect admin key.");
        });
    });
  }

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
        <h2>Today's Progress</h2>

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

  const totalQuestions = questions.length;
  const completedCount = completedQuestions.length;
  const correctCount = completedQuestions.filter(
    (q) => state.answers?.[q.question]?.isCorrect === true
  ).length;
  const incorrectCount = completedQuestions.filter(
    (q) => state.answers?.[q.question]?.isCorrect === false
  ).length;
  const savedCount = completedQuestions.filter(
    (q) => state.answers?.[q.question]?.isCorrect === null
  ).length;

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
            <h3>${escapeHtml(subject.name)} — Practice Summary</h3>
            <p class="panel-text">Review your completed questions and continue the ongoing practice whenever you are ready.</p>
          </div>
        </div>

        <div class="summary-stats-row">
          <div class="summary-stat">
            <span class="summary-stat-number">${completedCount} / ${totalQuestions}</span>
            <span class="summary-stat-label">Questions completed</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-number correct-text">${correctCount}</span>
            <span class="summary-stat-label">Correct</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-number incorrect-text">${incorrectCount}</span>
            <span class="summary-stat-label">Incorrect</span>
          </div>
          <div class="summary-stat">
            <span class="summary-stat-number saved-text">${savedCount}</span>
            <span class="summary-stat-label">Written (saved)</span>
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
            <div class="written-action-row">
              <button class="btn-secondary" id="saveAnswerBtn" type="button">💾 Save Answer</button>
              ${type === "long" ? `<button class="btn-secondary" id="viewResponsesBtn" type="button">👁 View Other Responses</button>` : ""}
            </div>
            <div id="saveAnswerFeedback"></div>
            ${type === "long" ? `
            <div class="other-responses-panel" id="otherResponsesPanel" style="display:none;">
              <div class="other-responses-header">
                <strong>Anonymous responses from other students</strong>
                <button class="btn-secondary other-responses-close" id="closeResponsesBtn" type="button">✕ Close</button>
              </div>
              <div class="other-responses-list" id="otherResponsesList">
                <p class="panel-text">Loading...</p>
              </div>
            </div>
            ` : ""}
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

    document.querySelectorAll("[id^='replyForm_']").forEach((form) => {
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

    // Save Answer button — saves without advancing
    const saveAnswerBtn = document.getElementById("saveAnswerBtn");
    if (saveAnswerBtn) {
      saveAnswerBtn.addEventListener("click", async () => {
        const input = document.getElementById("writtenAnswerInput");
        const typed = input?.value.trim();
        const saveFeedback = document.getElementById("saveAnswerFeedback");
        if (!typed) {
          if (saveFeedback) saveFeedback.innerHTML = `<div class="quiz-feedback incorrect">Nothing to save yet.</div>`;
          return;
        }
        await saveWrittenResponse(subject.id, question.question, typed);
        if (saveFeedback) {
          saveFeedback.innerHTML = `<div class="quiz-feedback saved">Answer saved.</div>`;
          setTimeout(() => { if (saveFeedback) saveFeedback.innerHTML = ""; }, 2000);
        }
      });
    }

    // View Other Responses button — fetches anonymised responses
    const viewResponsesBtn = document.getElementById("viewResponsesBtn");
    if (viewResponsesBtn) {
      viewResponsesBtn.addEventListener("click", async () => {
        const panel = document.getElementById("otherResponsesPanel");
        const list = document.getElementById("otherResponsesList");
        if (!panel || !list) return;

        panel.style.display = "";
        list.innerHTML = `<p class="panel-text">Loading...</p>`;

        try {
          const data = await apiFetch(API.writtenAll(subject.id, question.question));
          const responses = (data.responses || []).filter(r => r.userId !== getUserId());
          if (!responses.length) {
            list.innerHTML = `<p class="panel-text">No other responses submitted yet.</p>`;
          } else {
            list.innerHTML = responses.map((r, i) => `
              <div class="other-response-item">
                <div class="other-response-label">Student ${i + 1}</div>
                <div class="other-response-text">${escapeHtml(r.text)}</div>
              </div>
            `).join("");
          }
        } catch {
          list.innerHTML = `<p class="panel-text">Could not load responses.</p>`;
        }
      });
    }

    const closeResponsesBtn = document.getElementById("closeResponsesBtn");
    if (closeResponsesBtn) {
      closeResponsesBtn.addEventListener("click", () => {
        const panel = document.getElementById("otherResponsesPanel");
        if (panel) panel.style.display = "none";
      });
    }

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
          <h2>${escapeHtml(subject.name)} — Public Chat</h2>
          <p>This chat is only for ${escapeHtml(subject.name)} discussion.</p>
        </div>

        <div class="chat-box" id="chatBox">
          ${
            messages.length
              ? messages
                  .map(
                    (message) => `
                <div class="chat-message ${message.userId === currentUserId ? "own" : ""}">
                  <div class="chat-meta"><strong>${escapeHtml(message.username || message.userEmail || "User")}</strong> • ${escapeHtml(formatDateTime(message.time))}</div>
                  <div class="chat-text">${escapeHtml(message.text)}</div>
                </div>
              `
                  )
                  .join("")
              : `<div class="subject-search-empty">No messages yet for ${escapeHtml(subject.name)}.</div>`
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
      username: getUserUsername(),
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

/* -------------------------------- admin -------------------------------- */

async function renderAdmin() {
  if (!isAdminUnlocked()) {
    window.location.hash = "#dashboard";
    return;
  }

  const subjects = getSubjects();

  // Load existing custom questions from server
  let serverCustom = {};
  try {
    const data = await apiFetchAdmin(API.adminQuestions);
    serverCustom = data.customQuestions || {};
  } catch {
    serverCustom = {};
  }

  function buildQuestionList(subjectId) {
    const list = serverCustom[subjectId] || [];
    if (!list.length) return `<p class="panel-text" style="padding:10px 0;">No custom questions yet.</p>`;
    return list.map(q => `
      <div class="admin-q-item">
        <div class="admin-q-meta">
          <span class="quiz-type-badge">${escapeHtml(getQuestionTypeLabel(q.type))}</span>
        </div>
        <div class="admin-q-text">${escapeHtml(q.question)}</div>
        <button class="btn-danger admin-q-delete" data-id="${q.id}" type="button">Delete</button>
      </div>
    `).join("");
  }

  const content = `
    <div class="page-wide">
      <section class="panel">
        <h3>Add a Question</h3>
        <p class="panel-text">Only you can see this panel. Questions you add here appear for all users in the relevant subject quiz.</p>

        <form id="adminAddForm" class="admin-add-form">
          <div class="form-group">
            <label class="label">Subject</label>
            <select id="adminSubject">
              ${subjects.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join("")}
            </select>
          </div>

          <div class="form-group">
            <label class="label">Question Type</label>
            <select id="adminType">
              <option value="mcq">Multiple Choice (MCQ)</option>
              <option value="short">Short Answer</option>
              <option value="long">Extended Response</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label">Question Text</label>
            <textarea id="adminQuestion" rows="3" placeholder="Enter the question..." required></textarea>
          </div>

          <div class="form-group">
            <label class="label">Passage (optional — for English-style questions)</label>
            <textarea id="adminPassage" rows="3" placeholder="Optional reading passage..."></textarea>
          </div>

          <div class="form-group">
            <label class="label">Guidance (optional — shown to students below the question)</label>
            <input id="adminGuidance" type="text" placeholder="e.g. Write at least 3 paragraphs..." />
          </div>

          <div id="adminMcqFields">
            <div class="form-group">
              <label class="label">Options (one per line, exactly 4)</label>
              <textarea id="adminOptions" rows="4" placeholder="Option A&#10;Option B&#10;Option C&#10;Option D"></textarea>
            </div>
            <div class="form-group">
              <label class="label">Correct Answer (must exactly match one option)</label>
              <input id="adminAnswer" type="text" placeholder="Option A" />
            </div>
          </div>

          <div id="adminShortFields" style="display:none;">
            <div class="form-group">
              <label class="label">Accepted Answers (one per line — all will be accepted)</label>
              <textarea id="adminAccepted" rows="3" placeholder="answer one&#10;answer two"></textarea>
            </div>
          </div>

          <div class="error-message" id="adminError"></div>
          <div class="quiz-feedback correct" id="adminSuccess" style="display:none; margin-top:12px;">Question added successfully.</div>

          <button class="btn-primary" type="submit" style="margin-top:8px;">Add Question</button>
        </form>
      </section>

      <section class="panel" style="margin-top:20px;">
        <h3>Existing Custom Questions</h3>
        <div id="adminQuestionList">
          ${subjects.map(s => `
            <div class="admin-subject-block">
              <h4>${escapeHtml(s.name)}</h4>
              <div class="admin-q-list" id="adminList_${s.id}">
                ${buildQuestionList(s.id)}
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `;

  buildAppLayout("admin", content, "Admin — Add Questions", "Questions added here appear for all students in the subject quiz.");

  // Show/hide fields based on type
  const typeSelect = document.getElementById("adminType");
  const mcqFields = document.getElementById("adminMcqFields");
  const shortFields = document.getElementById("adminShortFields");

  typeSelect.addEventListener("change", () => {
    const t = typeSelect.value;
    mcqFields.style.display = t === "mcq" ? "" : "none";
    shortFields.style.display = t === "short" ? "" : "none";
  });

  // Submit handler
  document.getElementById("adminAddForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const errEl = document.getElementById("adminError");
    const successEl = document.getElementById("adminSuccess");
    errEl.textContent = "";
    successEl.style.display = "none";

    const subjectId = document.getElementById("adminSubject").value;
    const type = typeSelect.value;
    const question = document.getElementById("adminQuestion").value.trim();
    const passage = document.getElementById("adminPassage").value.trim();
    const guidance = document.getElementById("adminGuidance").value.trim();

    if (!question) { errEl.textContent = "Question text is required."; return; }

    let payload = { subjectId, type, question };
    if (passage) payload.passage = passage;
    if (guidance) payload.guidance = guidance;

    if (type === "mcq") {
      const optionsRaw = document.getElementById("adminOptions").value.trim();
      const answer = document.getElementById("adminAnswer").value.trim();
      const options = optionsRaw.split("\n").map(o => o.trim()).filter(Boolean);
      if (options.length < 2) { errEl.textContent = "Please enter at least 2 options."; return; }
      if (!answer) { errEl.textContent = "Please enter the correct answer."; return; }
      payload.options = options;
      payload.answer = answer;
    } else if (type === "short") {
      const acceptedRaw = document.getElementById("adminAccepted").value.trim();
      const acceptedAnswers = acceptedRaw.split("\n").map(a => a.trim()).filter(Boolean);
      if (!acceptedAnswers.length) { errEl.textContent = "Please enter at least one accepted answer."; return; }
      payload.acceptedAnswers = acceptedAnswers;
    }

    try {
      await apiFetchAdmin(API.adminQuestions, { method: "POST", body: JSON.stringify(payload) });
      successEl.style.display = "";
      document.getElementById("adminAddForm").reset();
      mcqFields.style.display = "";
      shortFields.style.display = "none";
      // Refresh custom questions in localStorage then re-render admin
      const refreshed = await apiFetchAdmin(API.adminQuestions);
      serverCustom = refreshed.customQuestions || {};
      setJson(STORAGE_KEYS.customQuestions, serverCustom);
      // Refresh list
      subjects.forEach(s => {
        const listEl = document.getElementById(`adminList_${s.id}`);
        if (listEl) listEl.innerHTML = buildQuestionList(s.id);
      });
      // Re-bind delete buttons
      bindDeleteButtons();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  function bindDeleteButtons() {
    document.querySelectorAll(".admin-q-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this question?")) return;
        try {
          await apiFetchAdmin(API.adminDeleteQuestion(btn.dataset.id), { method: "DELETE" });
          const refreshed = await apiFetchAdmin(API.adminQuestions);
          serverCustom = refreshed.customQuestions || {};
          setJson(STORAGE_KEYS.customQuestions, serverCustom);
          subjects.forEach(s => {
            const listEl = document.getElementById(`adminList_${s.id}`);
            if (listEl) listEl.innerHTML = buildQuestionList(s.id);
          });
          bindDeleteButtons();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  }

  bindDeleteButtons();
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
  if (hash === "#admin") return renderAdmin();

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
    return renderChat(decodeURIComponent(hash.replace("#chat/", "")));
  }

  window.location.hash = getLoggedIn() ? "#dashboard" : "#login";
}

/* ------------------------------- startup -------------------------------- */

window.addEventListener("hashchange", render);
window.addEventListener("load", async () => {
  await hydrateSession();
  render();
});