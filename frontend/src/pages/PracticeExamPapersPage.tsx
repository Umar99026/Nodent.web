import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { isAdminUser } from "@/lib/constants";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import {
  isPracticeExamYear,
  PRACTICE_EXAM_NUMBERS,
  practiceExamLabel,
  practiceExamPaperLabel,
} from "@/lib/practiceExams";
import { fetchPracticeExamList } from "@/lib/practiceExamApi";
import type { PracticeExamListItem } from "@/lib/practiceExamTypes";
import { ArrowRight, FileText, Loader2 } from "lucide-react";

export default function PracticeExamPapersPage() {
  const { subjectId, year } = useParams<{ subjectId: string; year: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [examMeta, setExamMeta] = useState<PracticeExamListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const examYear = year && isPracticeExamYear(year) ? (Number(year) as any) : null;

  useEffect(() => {
    if (String(subjectId) === "demo" && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [subjectId, isAdmin, navigate]);

  useEffect(() => {
    if (!year || !isPracticeExamYear(year)) {
      navigate(`/practice/${subjectId}/exams`, { replace: true });
    }
  }, [year, subjectId, navigate]);

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

  const metaByExamNumber = useMemo(() => {
    const map = new Map<number, PracticeExamListItem>();
    if (!examYear) return map;
    for (const item of examMeta) {
      if (item.year === examYear) map.set(item.examNumber, item);
    }
    return map;
  }, [examMeta, examYear]);

  if (!examYear) return null;

  return (
    <AppShell
      title={subject ? `${subject.name} — ${examYear}` : `${examYear} Exams`}
      subtitle="Choose Exam 1 or Exam 2."
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 sm:space-y-6">
        <Card className="practice-card">
          <div className="practice-card-header">
            <p className="practice-card-header-title">{practiceExamLabel(examYear)}</p>
          </div>
          <CardContent className="divide-y divide-black/8 px-0 py-0 sm:px-0">
            {loading ? (
              <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-7">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : (
              PRACTICE_EXAM_NUMBERS.map((examNumber) => {
                const meta = metaByExamNumber.get(examNumber);
                const available = meta?.published && meta.hasPages;
                return (
                  <div
                    key={examNumber}
                    className="flex items-center justify-between gap-4 px-4 py-4 sm:px-7"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0b0f19]/[0.04] text-muted-foreground">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base font-semibold text-[#0b0f19]">
                          {practiceExamPaperLabel(examNumber)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {available
                            ? "Available"
                            : isAdmin && meta?.hasPages
                              ? `Draft — publish from Admin (${practiceExamPaperLabel(examNumber)})`
                              : "Coming soon"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 rounded-xl"
                      aria-label={`Open ${examYear} exam ${examNumber}`}
                      disabled={!available && !(isAdmin && meta?.hasPages)}
                      onClick={() =>
                        navigate(`/practice/${subjectId}/exams/${examYear}/${examNumber}`)
                      }
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
