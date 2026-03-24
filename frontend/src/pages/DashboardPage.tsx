import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { STORAGE_KEYS, API_PATHS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  BookOpen,
  MessageSquare,
  FileText,
  Plus,
  Search,
  X,
  Shield,
  Loader2,
  GraduationCap,
  BarChart3,
} from "lucide-react";

import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getMySubjects(userId: string): Subject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mySubjectsPrefix + userId);
    if (!raw) return [];
    return JSON.parse(raw) as Subject[];
  } catch {
    return [];
  }
}

function saveMySubjects(userId: string, subjects: Subject[]) {
  localStorage.setItem(
    STORAGE_KEYS.mySubjectsPrefix + userId,
    JSON.stringify(subjects),
  );
}

function getCompletedQuizCount(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEYS.practiceStatePrefix)) {
      try {
        const state = JSON.parse(localStorage.getItem(key) ?? "{}");
        if (state.completed) count++;
      } catch {
        // ignore malformed entries
      }
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = String(user?.id ?? "anonymous");

  const [mySubjects, setMySubjects] = useState<Subject[]>(() =>
    getMySubjects(userId),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Admin unlock
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const isAdmin = !!localStorage.getItem(STORAGE_KEYS.adminKey);

  const quizCount = useMemo(() => getCompletedQuizCount(), []);

  /* ------ subject management ------ */

  const addSubject = useCallback(
    (subject: Subject) => {
      setMySubjects((prev) => {
        if (prev.some((s) => s.id === subject.id)) return prev;
        const next = [...prev, subject];
        saveMySubjects(userId, next);
        return next;
      });
      toast.success(`Added "${subject.name}" to your subjects`);
    },
    [userId],
  );

  const removeSubject = useCallback(
    (subjectId: string) => {
      setMySubjects((prev) => {
        const next = prev.filter((s) => s.id !== subjectId);
        saveMySubjects(userId, next);
        return next;
      });
    },
    [userId],
  );

  const availableSubjects = useMemo(() => {
    const myIds = new Set(mySubjects.map((s) => s.id));
    return baseSubjects.filter(
      (s) =>
        !myIds.has(s.id) &&
        s.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [mySubjects, searchQuery]);

  /* ------ admin unlock ------ */

  const handleAdminUnlock = async () => {
    if (!adminKey.trim()) {
      setAdminError("Please enter an admin key");
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    try {
      localStorage.setItem(STORAGE_KEYS.adminKey, adminKey.trim());
      await apiFetchAdmin<unknown>(API_PATHS.admin.questions);
      toast.success("Admin access granted");
      setAdminDialogOpen(false);
      setAdminKey("");
    } catch (err) {
      localStorage.removeItem(STORAGE_KEYS.adminKey);
      if (err instanceof ApiError) setAdminError(err.message);
      else setAdminError("Invalid admin key");
    } finally {
      setAdminLoading(false);
    }
  };

  /* ------ render ------ */

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Welcome back, ${user?.username ?? "Student"}`}
    >
      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="paper-texture">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10">
              <GraduationCap className="size-5 text-brand" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {mySubjects.length}
              </p>
              <p className="text-sm text-muted-foreground">
                Subjects selected
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-texture">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
              <BarChart3 className="size-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{quizCount}</p>
              <p className="text-sm text-muted-foreground">
                Quizzes completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-texture sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber/10">
              <BookOpen className="size-5 text-amber" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">VCE</p>
              <p className="text-sm text-muted-foreground">
                Curriculum aligned
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          My Subjects
        </h2>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger
            render={
              <Button variant="outline" className="gap-1.5">
                <Plus className="size-4" />
                Add Subject
              </Button>
            }
          />
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Browse Subjects</SheetTitle>
              <SheetDescription>
                Add subjects to your dashboard for quick access.
              </SheetDescription>
            </SheetHeader>

            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8"
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-4">
              {availableSubjects.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {baseSubjects.length === 0
                    ? "No subjects available yet."
                    : "All subjects have been added or none match your search."}
                </p>
              ) : (
                <div className="space-y-2 pb-4">
                  {availableSubjects.map((subject) => (
                    <button
                      key={subject.id}
                      onClick={() => addSubject(subject)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {subject.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {subject.description}
                        </p>
                      </div>
                      <Plus className="size-4 shrink-0 text-brand" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Subject grid */}
      {mySubjects.length === 0 ? (
        <Card className="paper-texture flex flex-col items-center justify-center py-16">
          <CardContent className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/10">
              <BookOpen className="size-7 text-brand" />
            </div>
            <h3 className="font-display text-lg font-semibold">
              No subjects yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Get started by adding subjects to your dashboard. Click the
              &ldquo;Add Subject&rdquo; button above to browse available VCE
              subjects.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          }}
        >
          {mySubjects.map((subject) => (
            <Card key={subject.id} className="paper-texture relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="font-display text-lg">
                      {subject.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[11px]">
                      VCE
                    </Badge>
                  </div>
                  <button
                    onClick={() => removeSubject(subject.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${subject.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <CardDescription className="mt-1">
                  {subject.description}
                </CardDescription>
              </CardHeader>

              <CardFooter className="gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                  onClick={() => navigate(`/quiz/${subject.id}`)}
                >
                  <BookOpen className="size-3.5" />
                  Practice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/quiz/${subject.id}/summary`)}
                >
                  <FileText className="size-3.5" />
                  Summary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/chat/${subject.id}`)}
                >
                  <MessageSquare className="size-3.5" />
                  Chat
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Admin unlock */}
      {!isAdmin && (
        <>
          <Separator className="my-10" />
          <div className="flex justify-center">
            <Button
              variant="outline"
              className="gap-2 text-muted-foreground"
              onClick={() => setAdminDialogOpen(true)}
            >
              <Shield className="size-4" />
              Unlock Admin Panel
            </Button>
          </div>

          <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Admin Access</DialogTitle>
                <DialogDescription>
                  Enter the admin key to unlock the question management panel.
                </DialogDescription>
              </DialogHeader>

              {adminError && (
                <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
                  {adminError}
                </div>
              )}

              <Input
                type="password"
                placeholder="Admin key"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdminUnlock();
                }}
                className="h-10"
              />

              <DialogFooter>
                <Button
                  onClick={handleAdminUnlock}
                  disabled={adminLoading}
                  className="bg-brand text-white hover:bg-brand-dark"
                >
                  {adminLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Unlock"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </AppShell>
  );
}
