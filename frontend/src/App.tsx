import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, type ReactNode } from "react";
import { StudyTimerProvider } from "@/context/StudyTimerContext";
import { ADMIN_EMAIL } from "@/lib/constants";

// Lazy-load page components — stubs will be replaced with real implementations
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const QuizPage = lazy(() => import("@/pages/QuizPage"));
const SummaryPage = lazy(() => import("@/pages/SummaryPage"));
const StudyModePage = lazy(() => import("@/pages/StudyModePage"));
const TrackStudyPage = lazy(() => import("@/pages/TrackStudyPageNew"));
const QuestionForumThreadPage = lazy(
  () => import("@/pages/QuestionForumThreadPage"),
);
const DojoPage = lazy(() => import("@/pages/DojoPage"));
const DojoBattlePage = lazy(() => import("@/pages/DojoBattlePage"));
const AdminPage = lazy(() => import("@/pages/AdminPage"));
const FriendsPage = lazy(() => import("@/pages/FriendsPage"));
const UploadWrittenImagesPage = lazy(() => import("@/pages/UploadWrittenImagesPage"));

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
 * Protects a route — redirects unauthenticated users to /login.
 */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) return <LoadingFallback />;

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

  if (isLoading) {
    return <LoadingFallback />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFallback />;
  }

  return isAuthenticated ? (
    <Navigate to="/dashboard" replace />
  ) : (
    <Navigate to="/login" replace />
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
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
          path="/quiz/:subjectId/summary"
          element={
            <ProtectedRoute>
              <SummaryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/study/:subjectId"
          element={
            <ProtectedRoute>
              <StudyModePage />
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
          path="/dojo"
          element={
            <ProtectedRoute>
              <DojoPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dojo/battle/:battleId"
          element={
            <ProtectedRoute>
              <DojoBattlePage />
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

        <Route
          path="/friends"
          element={
            <ProtectedRoute>
              <FriendsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/friends/:friendId"
          element={
            <ProtectedRoute>
              <FriendsPage />
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
      <TooltipProvider>
        <StudyTimerProvider>
          <AppRoutes />
        </StudyTimerProvider>
      </TooltipProvider>
    </AuthProvider>
  );
}
