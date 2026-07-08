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
  createDraft: "nodent_create_draft",
  /** Auto-saved PDF import rows on the Admin page (survives refresh). */
  pdfImportDraft: "nodent_pdf_import_draft",
} as const;

// Hardcoded admin credentials (requested).
export const ADMIN_EMAIL = "nodent.app@gmail.com";

export type AccountRole = "student" | "teacher";

export function isAdminUser(user: { email?: string | null } | null | undefined): boolean {
  const email = String(user?.email ?? "").toLowerCase();
  return !!email && email === ADMIN_EMAIL.toLowerCase();
}

/** Resolved role for nav and route guards. Admin bypasses role; legacy users default to student. */
export function resolvedAccountRole(
  user: { email?: string | null; accountRole?: AccountRole | null } | null | undefined,
): AccountRole | null {
  if (isAdminUser(user)) return null;
  if (user?.accountRole === "teacher" || user?.accountRole === "student") {
    return user.accountRole;
  }
  return "student";
}

export function canAccessTeacherNav(
  user: { email?: string | null; accountRole?: AccountRole | null } | null | undefined,
): boolean {
  return isAdminUser(user) || resolvedAccountRole(user) === "teacher";
}

export function canAccessTrackNav(
  user: { email?: string | null; accountRole?: AccountRole | null } | null | undefined,
): boolean {
  return isAdminUser(user) || resolvedAccountRole(user) === "student";
}

/** New students must complete VCE + subjects + confidence setup before the dashboard. */
export function needsStudentOnboarding(
  user:
    | {
        email?: string | null;
        accountRole?: AccountRole | null;
        onboardingCompletedAt?: string | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return false;
  if (resolvedAccountRole(user) === "teacher") return false;
  return !user.onboardingCompletedAt;
}

/** @deprecated Use `canAccessPracticeExams` from `@/lib/premium`. */
export function canAccessPracticeExams(
  user: { email?: string | null; plan?: string | null; premiumUntil?: string | null; isPremium?: boolean | null } | null | undefined,
): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  if (user.isPremium === true) return true;
  const plan = String(user.plan ?? "free").trim().toLowerCase();
  if (plan === "premium" || plan === "paid") {
    const until = String(user.premiumUntil ?? "").trim();
    if (!until) return true;
    const t = Date.parse(until);
    if (!Number.isFinite(t)) return true;
    return t > Date.now();
  }
  return false;
}

/** Class / admin-only exam tooling until public launch. */
export function canAccessExamsAndClassFeatures(
  user: { email?: string | null } | null | undefined,
): boolean {
  return isAdminUser(user);
}

export const API_PATHS = {
  auth: {
    login: "/api/auth/login",
    signup: "/api/auth/signup",
    logout: "/api/auth/logout",
    session: "/api/auth/session",
    account: "/api/auth/account",
    forgotPassword: "/api/auth/forgot-password",
    resetPassword: "/api/auth/reset-password",
  },
  bootstrap: "/api/bootstrap",
  onboarding: {
    complete: "/api/onboarding/complete",
  },
  premium: {
    usage: "/api/premium/usage",
  },
  subjects: {
    my: "/api/subjects/my",
  },
  questions: (subjectId: number | string) =>
    `/api/subjects/${subjectId}/questions`,
  submitAnswer: "/api/quiz/submit",
  quizHistory: "/api/quiz/history",
  studyMode: (subjectId: number | string) =>
    `/api/study/${subjectId}`,
  track: "/api/track",
  feedback: "/api/feedback",
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
  teacher: {
    class: "/api/teacher/class",
    classMembers: "/api/teacher/class/members",
    classStats: "/api/teacher/class/stats",
    join: "/api/class/join",
    membership: "/api/class/membership",
    preview: (code: string) =>
      `/api/class/preview?code=${encodeURIComponent(code)}`,
  },
  admin: {
    subjects: "/api/admin/subjects",
    questions: "/api/admin/questions",
    questionsBulk: "/api/admin/questions/bulk",
    questionsBulkDelete: "/api/admin/questions/bulk-delete",
    questionsDeleteBySubject: "/api/admin/questions/delete-by-subject",
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
    aiStatus: "/api/admin/ai/status",
    aiParseQuestions: "/api/admin/ai/parse-questions",
    aiFillAnswers: "/api/admin/ai/fill-answers",
    aiQuestionChat: "/api/admin/ai/question-chat",
    feedback: "/api/admin/feedback",
  },
  written: {
    mark: (subjectId: string, questionKey: string) =>
      `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}/mark`,
    help: (subjectId: string, questionKey: string) =>
      `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}/help`,
  },
  english: {
    books: "/api/english/books",
    prompts: "/api/english/prompts",
    responses: "/api/english/responses",
    shared: "/api/english/shared",
    response: (responseId: number | string) =>
      `/api/english/responses/${encodeURIComponent(String(responseId))}`,
    aiScoreResponse: (responseId: number | string) =>
      `/api/english/responses/${responseId}/ai-score`,
  },
} as const;
