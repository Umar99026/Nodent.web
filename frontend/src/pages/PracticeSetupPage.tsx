import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import {
  API_PATHS,
  STORAGE_KEYS,
  isAdminUser,
} from "@/lib/constants";
import { canAccessPracticeExams, PREMIUM_PATH } from "@/lib/premium";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import { loadPracticeBank } from "@/lib/questionBankCache";
import {
  getRawCustomQuestionsForSubject,
  practiceQuestionsForSubject,
} from "@/lib/practiceQuestions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TopicPerformanceSelect } from "@/components/practice/TopicPerformanceSelect";
import { CurriculumOverview } from "@/components/study/CurriculumOverview";
import { ArrowRight, BookOpen, FileText, Loader2, Lock } from "lucide-react";
import { generalMathsPracticeTopicOptions } from "@/lib/generalMathsAreaTopic";
import { methodsPracticeTopicOptions } from "@/lib/methodsAreaTopic";
import { specialistMathsPracticeTopicOptions } from "@/lib/specialistMathsAreaTopic";
import { getTopicOverview } from "@/lib/topicOverviews";

function uniqSorted(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export default function PracticeSetupPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const examsUnlocked = canAccessPracticeExams(user);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (String(subjectId) === "demo" && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [subjectId, isAdmin, navigate]);

  const visibleSubjects = useMemo(
    () => (isAdmin ? subjectsForUser({ isAdmin }) : baseSubjects),
    [isAdmin],
  );

  const subject: Subject | undefined = useMemo(
    () => visibleSubjects.find((s) => String(s.id) === String(subjectId)),
    [visibleSubjects, subjectId],
  );

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);

  const isEnglish = String(subjectId) === "english";

  useEffect(() => {
    if (isEnglish) {
      navigate("/quiz/english", { replace: true });
    }
  }, [isEnglish, navigate]);

  const initialTopic = String(searchParams.get("topic") ?? "all");
  const [topic, setTopic] = useState<string>(initialTopic || "all");

  useEffect(() => {
    const fromUrl = String(searchParams.get("topic") ?? "all") || "all";
    setTopic((current) => (current === fromUrl ? current : fromUrl));
  }, [searchParams]);

  const handleTopicChange = (next: string) => {
    setTopic(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (!next || next === "all") params.delete("topic");
        else params.set("topic", next);
        return params;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;

    const cached = loadPracticeBank(subjectId);
    if (cached.length > 0) {
      setQuestions(cached);
      setLoading(false);
    } else if (!user) {
      setQuestions(practiceQuestionsForSubject([], subjectId));
      setLoading(false);
      return;
    } else {
      setLoading(true);
    }

    if (!user) return;

    (async () => {
      try {
        const data = await apiFetch<{ customQuestions?: Record<string, unknown[]> }>(
          API_PATHS.bootstrap,
          { timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS },
        );
        if (cancelled) return;
        if (data.customQuestions) {
          localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(data.customQuestions));
        }
        const raw = getRawCustomQuestionsForSubject(data.customQuestions, subjectId);
        setQuestions(practiceQuestionsForSubject(raw, subjectId));
      } catch {
        if (cancelled) return;
        setQuestions(loadPracticeBank(subjectId));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, user]);

  const isMethods = String(subjectId) === "methods";
  const isGeneralMaths = String(subjectId) === "general-maths" || String(subjectId) === "demo";
  const isSpecialistMaths = String(subjectId) === "specialist-maths";

  const availableTopics = useMemo(() => {
    if (isEnglish) return [];
    if (isMethods) return methodsPracticeTopicOptions();
    if (isGeneralMaths) return generalMathsPracticeTopicOptions();
    if (isSpecialistMaths) return specialistMathsPracticeTopicOptions();
    const fromBank = uniqSorted(questions.map((q) => q.topic ?? "General"));
    return ["all", ...fromBank];
  }, [questions, isEnglish, isMethods, isGeneralMaths, isSpecialistMaths]);

  const topicOptions = useMemo(
    () => availableTopics.filter((t) => t !== "all"),
    [availableTopics],
  );

  const overviewMarkdown = useMemo(() => {
    if (!subjectId || isEnglish) return null;
    if (!topic || topic === "all") return null;
    return getTopicOverview({
      subjectId,
      subject,
      topic,
    });
  }, [subjectId, subject, topic, isEnglish]);

  useEffect(() => {
    if (isEnglish) return;
    if (availableTopics.length && !availableTopics.includes(topic)) {
      setTopic("all");
    }
  }, [availableTopics, topic, isEnglish]);

  const handleStart = () => {
    if (!subjectId) return;
    if (isEnglish) {
      navigate("/quiz/english");
      return;
    }
    const qp = topic && topic !== "all" ? `?topic=${encodeURIComponent(topic)}` : "";
    navigate(`/quiz/${subjectId}${qp}`);
  };

  return (
    <AppShell
      title="Practice"
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
        <Card className="practice-card">
          <CardContent className="bg-[#f3f4f6]/30 px-4 py-8 sm:px-7 sm:py-10">
            <div className="mx-auto flex min-h-[min(32rem,70vh)] w-full max-w-4xl flex-col">
              <div className="text-center">
                <p className="font-display text-2xl font-semibold tracking-tight text-[#0b0f19] sm:text-3xl">
                  {subject?.name ?? "Practice"}
                </p>
              </div>

              <div className="mt-7 flex flex-1 flex-col sm:mt-9">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-black/8 bg-white px-5 py-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : isEnglish ? (
                  <p className="text-center text-sm text-muted-foreground">Redirecting…</p>
                ) : (
                  <>
                    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
                      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-center">
                        <div className="w-full sm:w-[18rem]">
                          <p className="mb-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Topic
                          </p>
                          <TopicPerformanceSelect
                            subjectId={subjectId}
                            value={topic}
                            onValueChange={handleTopicChange}
                            topics={topicOptions}
                            includeAllOption
                            placeholder="Choose topic"
                            className="w-full sm:w-[18rem]"
                          />
                        </div>

                        <div className="w-full sm:w-[18rem]">
                          <p
                            className="mb-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-transparent"
                            aria-hidden
                          >
                            Topic
                          </p>
                          <Button
                            variant="accent"
                            onClick={handleStart}
                            className="h-12 w-full gap-2 rounded-2xl text-base sm:w-[18rem]"
                          >
                            <BookOpen className="size-4" />
                            Questions
                            <ArrowRight className="size-4" />
                          </Button>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (!examsUnlocked) {
                            navigate(PREMIUM_PATH);
                            return;
                          }
                          navigate(`/practice/${subjectId}/exams`);
                        }}
                        className="h-12 w-full max-w-xs gap-2 rounded-2xl text-base"
                        aria-label={examsUnlocked ? "Open past exams" : "Past exams — Premium required"}
                      >
                        {examsUnlocked ? (
                          <FileText className="size-4" />
                        ) : (
                          <Lock className="size-4 text-muted-foreground" />
                        )}
                        Exams
                        {examsUnlocked ? <ArrowRight className="size-4" /> : null}
                      </Button>
                    </div>

                    <div className="mt-10 flex flex-1 flex-col justify-center">
                      {overviewMarkdown ? (
                        <CurriculumOverview markdown={overviewMarkdown} />
                      ) : (
                        <p className="text-center text-sm text-muted-foreground sm:text-base">
                          Choose what to revise
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
