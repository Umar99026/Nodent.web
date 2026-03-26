export const STORAGE_KEYS = {
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
  adminKey: "nodent_admin_key",
} as const;

// Hardcoded admin credentials (requested).
export const ADMIN_EMAIL = "nodent.app@gmail.com";

export const API_PATHS = {
  auth: {
    login: "/api/auth/login",
    signup: "/api/auth/signup",
    logout: "/api/auth/logout",
  },
  bootstrap: "/api/bootstrap",
  subjects: "/api/subjects",
  questions: (subjectId: number | string) =>
    `/api/subjects/${subjectId}/questions`,
  submitAnswer: "/api/quiz/submit",
  quizHistory: "/api/quiz/history",
  studyMode: (subjectId: number | string) =>
    `/api/study/${subjectId}`,
  chat: (subjectId: number | string) =>
    `/api/chat/${subjectId}`,
  forum: {
    posts: (subjectId: number | string) => `/api/forum/${subjectId}/posts`,
    post: (subjectId: number | string, postId: number | string) =>
      `/api/forum/${subjectId}/posts/${postId}`,
    replies: (subjectId: number | string, postId: number | string) =>
      `/api/forum/${subjectId}/posts/${postId}/replies`,
  },
  track: "/api/track",
  dojo: {
    unreadCount: "/api/dojo/unread-count",
    challenges: "/api/dojo/challenges",
    readChallenges: "/api/dojo/challenges/read",
    users: (search: string) => `/api/dojo/users?search=${encodeURIComponent(search)}`,
    createChallenge: "/api/dojo/challenges",
    acceptChallenge: (challengeId: number | string) =>
      `/api/dojo/challenges/${challengeId}/accept`,
    battle: (battleId: number | string) => `/api/dojo/battles/${battleId}`,
    answer: (battleId: number | string) =>
      `/api/dojo/battles/${battleId}/answer`,
  },
  admin: {
    subjects: "/api/admin/subjects",
    questions: "/api/admin/questions",
    users: "/api/admin/users",
    stats: "/api/admin/stats",
  },
} as const;
