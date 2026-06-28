import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { lazy, Suspense, type ReactNode } from "react";
import { StudyTimerProvider } from "@/context/StudyTimerContext";
import { HandwritingModeProvider } from "@/context/HandwritingModeContext";
import { ADMIN_EMAIL, STORAGE_KEYS } from "@/lib/constants";
import LandingPage from "@/pages/LandingPage";
import FeedbackPage from "@/pages/FeedbackPage";

// Lazy-load page components — stubs will be replaced with real implementations
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const SummaryPage = lazy(() => import("@/pages/SummaryPage"));
const TrackStudyPage = lazy(() => import("@/pages/TrackStudyPageNew"));
const QuestionForumThreadPage = lazy(
  () => import("@/pages/QuestionForumThreadPage"),
);
const EnglishPromptResponsesPage = lazy(
  () => import("@/pages/EnglishPromptResponsesPage"),
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

  const isAdminEmail = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isAdminEmail;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

/**
 * Redirects authenticated users away from guest-only pages (e.g. /login).
 */
function GuestRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading && hasStoredAuthToken()) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();

  if (searchParams.get("welcome") === "1") {
    return <Navigate to="/feedback" replace />;
  }

  if (isLoading && hasStoredAuthToken()) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

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
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
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
          path="/practice/:subjectId/exams"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <PracticeExamsPage />
              </AdminOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId/exams/:year"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <PracticeExamPapersPage />
              </AdminOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/practice/:subjectId/exams/:year/:examNumber"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <PracticeExamDetailPage />
              </AdminOnlyRoute>
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
              <TrackStudyPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <TeacherPage />
              </AdminOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/create"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <CreatePage />
              </AdminOnlyRoute>
            </ProtectedRoute>
          }
        />

        <Route path="/create" element={<Navigate to="/teacher/create" replace />} />

        <Route
          path="/join-class"
          element={
            <ProtectedRoute>
              <AdminOnlyRoute>
                <JoinClassPage />
              </AdminOnlyRoute>
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
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HandwritingModeProvider>
        <TooltipProvider>
          <StudyTimerProvider>
            <AppRoutes />
            <Toaster richColors closeButton position="top-center" />
          </StudyTimerProvider>
        </TooltipProvider>
      </HandwritingModeProvider>
    </AuthProvider>
  );
}
