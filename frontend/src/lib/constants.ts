export const STORAGE_KEYS = {
  currentUser: "nodent_current_user",
  authToken: "nodent_auth_token",
  profilePhotoPrefix: "nodent_profile_photo_",
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

export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  const email = String(user?.email ?? "").toLowerCase();
  return !!email && email === ADMIN_EMAIL.toLowerCase();
}

export const API_PATHS = {
  auth: {
    login: "/api/auth/login",
    signup: "/api/auth/signup",
    logout: "/api/auth/logout",
    account: "/api/auth/account",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
  },
  bootstrap: "/api/bootstrap",
  subjects: "/api/subjects",
  questions: (subjectId: number | string) =>
    `/api/subjects/${subjectId}/questions`,
  submitAnswer: "/api/quiz/submit",
  quizHistory: "/api/quiz/history",
  studyMode: (subjectId: number | string) =>
    `/api/study/${subjectId}`,
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
  friends: {
    list: "/api/friends",
    requests: "/api/friends/requests",
    unreadCount: "/api/friends/unread-count",
    readRequests: "/api/friends/requests/read",
    search: (q: string) => `/api/friends/search?search=${encodeURIComponent(q)}`,
    sendRequest: "/api/friends/requests",
    acceptRequest: (requestId: number | string) =>
      `/api/friends/requests/${requestId}/accept`,
    rejectRequest: (requestId: number | string) =>
      `/api/friends/requests/${requestId}/reject`,
    thread: (friendId: number | string) => `/api/friends/${friendId}/thread`,
    friendScorecard: (friendId: number | string) =>
      `/api/friends/${friendId}/scorecard`,
    assign: (friendId: number | string) => `/api/friends/${friendId}/assign`,
    answerAssignment: (assignmentId: number | string) =>
      `/api/friends/assignments/${assignmentId}/answer`,
  },
  admin: {
    subjects: "/api/admin/subjects",
    questions: "/api/admin/questions",
    questionsBulk: "/api/admin/questions/bulk",
    questionsBulkDelete: "/api/admin/questions/bulk-delete",
    questionsAttachImagesBulk: "/api/admin/questions/attach-images-bulk",
    questionsReassignSubject: "/api/admin/questions/reassign-subject",
    users: "/api/admin/users",
    stats: "/api/admin/stats",
    googleSheetStatus: "/api/admin/google-sheet/status",
    googleSheetDiagnose: "/api/admin/google-sheet/diagnose",
    syncQuestionsFromSheet: "/api/admin/questions/sync-from-sheet",
    methodsRetagTopics: "/api/admin/methods/retag-topics",
    pdfPreview: "/api/admin/pdf/preview",
    pdfGenerate: "/api/admin/pdf/generate",
    pdfPublish: "/api/admin/pdf/publish",
    englishPromptsBulk: "/api/admin/english/prompts/bulk",
    englishPromptsBulkDelete: "/api/admin/english/prompts/bulk-delete",
    englishPrompts: "/api/admin/english/prompts",
  },
  english: {
    books: "/api/english/books",
    prompts: "/api/english/prompts",
    responses: "/api/english/responses",
    rateResponse: (responseId: number | string) => `/api/english/responses/${responseId}/rate`,
  },
} as const;
