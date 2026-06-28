import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAdminUser } from "@/lib/constants";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import { PRACTICE_EXAM_YEARS, practiceExamLabel } from "@/lib/practiceExams";
import { fetchPracticeExamList } from "@/lib/practiceExamApi";
import type { PracticeExamListItem } from "@/lib/practiceExamTypes";
import { ArrowRight, FileText, Loader2 } from "lucide-react";

export default function PracticeExamsPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [examMeta, setExamMeta] = useState<PracticeExamListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (String(subjectId) === "demo" && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [subjectId, isAdmin, navigate]);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    setLoading(true);
    void fetchPracticeExamList(subjectId)
      .then((exams) => {
        if (!cancelled) setExamMeta(exams);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  const visibleSubjects = useMemo(
    () => (isAdmin ? subjectsForUser({ isAdmin }) : baseSubjects),
    [isAdmin],
  );

  const subject = useMemo(
    () => visibleSubjects.find((s) => String(s.id) === String(subjectId)),
    [visibleSubjects, subjectId],
  );

  const metaByYear = useMemo(() => {
    const map = new Map<number, PracticeExamListItem[]>();
    for (const item of examMeta) {
      const list = map.get(item.year) ?? [];
      list.push(item);
      map.set(item.year, list);
    }
    return map;
  }, [examMeta]);

  return (
    <AppShell
      title={subject ? `${subject.name} Exams` : "Exams"}
      subtitle="Past exams by year."
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        <Card className="practice-card">
          <div className="practice-card-header">
            <p className="practice-card-header-title">Past exams</p>
          </div>
          <CardContent className="divide-y divide-black/8 px-0 py-0 sm:px-0">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-7">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              PRACTICE_EXAM_YEARS.map((year) => {
                const papers = metaByYear.get(year) ?? [];
                const available = papers.some((p) => p.published && p.hasPages);
                const adminDraft = papers.some((p) => p.hasPages);
                const publishedCount = papers.filter((p) => p.published && p.hasPages).length;
                return (
                  <div
                    key={year}
                    className="flex items-center justify-between gap-4 px-4 py-4 sm:px-7"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0b0f19]/[0.04] text-muted-foreground">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold text-[#0b0f19]">
                          {practiceExamLabel(year)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {available
                            ? publishedCount === 2
                              ? "Exam 1 & 2 available"
                              : "Exam 1 or 2 available"
                            : isAdmin && adminDraft
                              ? "Draft — publish from Admin"
                              : "Coming soon"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-xl"
                      aria-label={`Open ${year} exams`}
                      onClick={() => navigate(`/practice/${subjectId}/exams/${year}`)}
                    >
                      <ArrowRight className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
