import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, type ReactNode } from "react";
import { StudyTimerProvider } from "@/context/StudyTimerContext";
import { HandwritingModeProvider } from "@/context/HandwritingModeContext";
import { isAdminUser, canAccessTeacherNav, canAccessTrackNav, needsStudentOnboarding, STORAGE_KEYS } from "@/lib/constants";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import LandingPage from "@/pages/LandingPage";
import FeedbackPage from "@/pages/FeedbackPage";
import VceResourcesPage from "@/pages/VceResourcesPage";
import FreeVcePracticeExamsPage from "@/pages/FreeVcePracticeExamsPage";

// Lazy-load page components — stubs will be replaced with real implementations
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const PremiumPage = lazy(() => import("@/pages/PremiumPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const SummaryPage = lazy(() => import("@/pages/SummaryPage"));
const ReportPage = lazy(() => import("@/pages/ReportPage"));
const TrackStudyPage = lazy(() => import("@/pages/TrackStudyPageNew"));
const QuestionForumThreadPage = lazy(
  () => import("@/pages/QuestionForumThreadPage"),
);
const EnglishPromptResponsesPage = lazy(
  () => import("@/pages/EnglishPromptResponsesPage"),
);
const EnglishSharedEssaysPage = lazy(
  () => import("@/pages/EnglishSharedEssaysPage"),
);
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const CreatePage = lazy(() => import("@/pages/CreatePage"));
const TeacherPage = lazy(() => import("@/pages/TeacherPage"));
const JoinClassPage = lazy(() => import("@/pages/JoinClassPage"));
const UploadWrittenImagesPage = lazy(() => import("@/pages/UploadWrittenImagesPage"));
const PracticeSetupPage = lazy(() => import("@/pages/PracticeSetupPage"));
const PracticeExamsPage = lazy(() => import("@/pages/PracticeExamsPage"));
const PracticeExamPapersPage = lazy(() => import("@/pages/PracticeExamPapersPage"));
const PracticeExamDetailPage = lazy(() => import("@/pages/PracticeExamDetailPage"));

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f5f0]">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#56abe6] border-t-transparent" />
        <p className="mt-4 font-['Source_Sans_3'] text-gray-600">
          Loading...
        </p>
      </div>
    </div>
  );
}

/**
 * Protects a route — redirects unauthenticated users to the landing page.
 */
function hasStoredAuthToken() {
  return (
    typeof window !== "undefined" &&
    !!localStorage.getItem(STORAGE_KEYS.authToken)
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) return <LoadingFallback />;

  const isAdmin = isAdminUser(user);
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function TeacherOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) return <LoadingFallback />;

  if (!canAccessTeacherNav(user)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function StudentOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) return <LoadingFallback />;

  if (!canAccessTrackNav(user)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function StudentOnboardingGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) return <LoadingFallback />;

  if (needsStudentOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function OnboardingOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) return <LoadingFallback />;

  if (!needsStudentOnboarding(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function authHomePath(user: Parameters<typeof needsStudentOnboarding>[0]) {
  return needsStudentOnboarding(user) ? "/onboarding" : "/dashboard";
}

/**
 * Redirects authenticated users away from guest-only pages (e.g. /login).
 */
function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading && hasStoredAuthToken()) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to={authHomePath(user)} replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [searchParams] = useSearchParams();

  if (searchParams.get("welcome") === "1") {
    return <Navigate to="/feedback" replace />;
  }

  if (isLoading && hasStoredAuthToken()) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to={authHomePath(user)} replace />;
  }

  return <LandingPage />;
}

function AppRoutes() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />

        <Route path="/vce-resources" element={<VceResourcesPage />} />
        <Route path="/free-vce-practice-exams" element={<FreeVcePracticeExamsPage />} />

        <Route path="/feedback" element={<FeedbackPage />} />

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <GuestRoute>
              <ForgotPasswordPage />
            </GuestRoute>
          }
        />

        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />

        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingOnlyRoute>
                <OnboardingPage />
              </OnboardingOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <StudentOnboardingGate>
                <DashboardPage />
              </StudentOnboardingGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/report"
          element={
            <ProtectedRoute>
              <StudentOnboardingGate>
                <ReportPage />
              </StudentOnboardingGate>
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId"
          element={
            <ProtectedRoute>
              <PracticeSetupPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/premium"
          element={
            <ProtectedRoute>
              <PremiumPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId/exams"
          element={
            <ProtectedRoute>
              <PracticeExamsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId/exams/:year"
          element={
            <ProtectedRoute>
              <PracticeExamPapersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId/exams/:year/:examNumber"
          element={
            <ProtectedRoute>
              <PracticeExamDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/:subjectId"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/:subjectId/wrong"
          element={
            <ProtectedRoute>
              <QuizPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/:subjectId/question-forum"
          element={
            <ProtectedRoute>
              <QuestionForumThreadPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/english/prompt/:promptId/responses"
          element={
            <ProtectedRoute>
              <EnglishPromptResponsesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/english/shared"
          element={
            <ProtectedRoute>
              <EnglishSharedEssaysPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz/:subjectId/summary"
          element={
            <ProtectedRoute>
              <SummaryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/track"
          element={
            <ProtectedRoute>
              <StudentOnlyRoute>
                <TrackStudyPage />
              </StudentOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <TeacherOnlyRoute>
                <TeacherPage />
              </TeacherOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/create"
          element={
            <ProtectedRoute>
              <TeacherOnlyRoute>
                <CreatePage />
              </TeacherOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route path="/create" element={<Navigate to="/teacher/create" replace />} />

        <Route
          path="/join-class"
          element={
            <ProtectedRoute>
              <JoinClassPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <AdminPage />
              </AdminOnlyRoute>
            </ProtectedRoute>
          }
        />

        {/* Public upload page used by QR codes */}
        <Route path="/upload/:token" element={<UploadWrittenImagesPage />} />

          {/* Catch-all: redirect to root */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HandwritingModeProvider>
        <TooltipProvider>
          <StudyTimerProvider>
            <AppRoutes />
          </StudyTimerProvider>
        </TooltipProvider>
      </HandwritingModeProvider>
    </AuthProvider>
  );
}
