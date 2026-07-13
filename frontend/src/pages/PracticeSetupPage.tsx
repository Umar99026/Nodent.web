import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import {
  API_PATHS,
  STORAGE_KEYS,
  isAdminUser,
} from "@/lib/constants";
import { canAccessPracticeExams, isPremiumUser, PREMIUM_PATH } from "@/lib/premium";
import { formatCompactFreePlanDescription } from "@/lib/premiumUsage";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import { loadPracticeBank } from "@/lib/questionBankCache";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const isPremium = isPremiumUser(user);
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

  type PracticeKind = "mixed" | "mcq" | "sa" | "la" | "exams";
  const initialKind = (String(searchParams.get("kind") ?? "mixed").trim() ||
    "mixed") as PracticeKind;
  const [kind, setKind] = useState<PracticeKind>(() => {
    const k = ["mixed", "mcq", "sa", "la", "exams"].includes(initialKind)
      ? initialKind
      : "mixed";
    if ((k === "la" && !isPremium) || (k === "exams" && !examsUnlocked)) return "mixed";
    return k;
  });

  useEffect(() => {
    const fromUrl = String(searchParams.get("topic") ?? "all") || "all";
    setTopic((current) => (current === fromUrl ? current : fromUrl));
  }, [searchParams]);

  useEffect(() => {
    const fromUrl = String(searchParams.get("kind") ?? "mixed")
      .trim()
      .toLowerCase();
    if (!fromUrl) return;
    if (fromUrl === kind) return;
    if (fromUrl === "mixed" || fromUrl === "mcq" || fromUrl === "sa" || fromUrl === "la" || fromUrl === "exams") {
      if (fromUrl === "la" && !isPremium) {
        setKind("mixed");
        return;
      }
      setKind(fromUrl as PracticeKind);
    }
  }, [searchParams, kind, isPremium]);

  useEffect(() => {
    if (isPremium) return;
    if (kind !== "la") return;
    setKind("mixed");
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        params.delete("kind");
        return params;
      },
      { replace: true },
    );
  }, [isPremium, kind, setSearchParams]);

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

  const handleKindChange = (next: PracticeKind) => {
    if (next === "la" && !isPremium) {
      navigate(PREMIUM_PATH);
      return;
    }
    if (next === "exams" && !examsUnlocked) {
      navigate(PREMIUM_PATH);
      return;
    }
    setKind(next);
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (!next || next === "mixed") params.delete("kind");
        else params.set("kind", next);
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
      setQuestions(loadPracticeBank(subjectId));
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
        setQuestions(loadPracticeBank(subjectId));
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
    if (kind === "la" && !isPremium) {
      navigate(PREMIUM_PATH);
      return;
    }
    if (kind === "exams") {
      if (!examsUnlocked) {
        navigate(PREMIUM_PATH);
        return;
      }
      navigate(`/practice/${subjectId}/exams`);
      return;
    }

    const params = new URLSearchParams();
    if (topic && topic !== "all") params.set("topic", topic);
    if (kind && kind !== "mixed") params.set("kind", kind);
    const qp = params.toString() ? `?${params.toString()}` : "";
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
                      <div className="w-full">
                        <p className="mb-2 text-center text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Practice mode
                        </p>
                        <Tabs value={kind} onValueChange={(v) => handleKindChange(v as PracticeKind)}>
                          <TabsList className="mx-auto w-full max-w-3xl justify-between">
                            <TabsTrigger value="mixed">Mixed</TabsTrigger>
                            <TabsTrigger value="mcq">MCQ</TabsTrigger>
                            <TabsTrigger value="sa">SA</TabsTrigger>
                            <TabsTrigger value="la" aria-disabled={!isPremium}>
                              {isPremium ? "LA" : "LA (Premium)"}
                            </TabsTrigger>
                            <TabsTrigger value="exams" aria-disabled={!examsUnlocked}>
                              {examsUnlocked ? "Exams" : "Exams (Premium)"}
                            </TabsTrigger>
                          </TabsList>
                          <TabsContent value={kind} className="mt-3">
                            <div className="rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground">
                              {kind === "exams" ? (
                                <div className="flex items-start gap-2">
                                  <span className="mt-0.5">
                                    {examsUnlocked ? (
                                      <FileText className="size-4 text-foreground" />
                                    ) : (
                                      <Lock className="size-4" />
                                    )}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-medium text-foreground">Past practice exams</p>
                                    <p className="mt-0.5">
                                      {examsUnlocked
                                        ? "Browse past papers by topic and attempt them like the real exam."
                                        : "Premium only. Free accounts can practice MCQ and short answers."}
                                    </p>
                                  </div>
                                </div>
                              ) : kind === "mcq" ? (
                                <p>Multiple choice only. Fast reps + quick confidence building.</p>
                              ) : kind === "sa" ? (
                                <p>
                                  Typed or drawn answers share 3 detailed AI responses each day.
                                  After that, typed answers continue with unlimited instant matching.
                                </p>
                              ) : kind === "la" ? (
                                <div className="flex items-start gap-2">
                                  <Lock className="mt-0.5 size-4 shrink-0" />
                                  <div>
                                    <p className="font-medium text-foreground">Long-answer practice</p>
                                    <p className="mt-0.5">
                                      {isPremium
                                        ? "Full working, mark breakdown, and harder reasoning."
                                        : "Premium only. Free accounts use MCQ and short-answer practice."}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <p>
                                  {isPremium
                                    ? "Mixed practice. We’ll rotate question styles while staying on your chosen topic."
                                    : "Mixed MCQ and short answers (no long answers on Free)."}
                                </p>
                              )}
                            </div>
                          </TabsContent>
                        </Tabs>

                        <div className="mt-3 rounded-2xl border border-black/8 bg-white px-4 py-3 text-left text-sm">
                          <p className="font-semibold text-[#0b0f19]">Your plan limits</p>
                          {isPremium ? (
                            <p className="mt-1 text-muted-foreground">
                              Premium: Unlimited topic practice, unlimited AI marking, Ask AI, and full practice exams.
                            </p>
                          ) : (
                            <p className="mt-1 text-muted-foreground">
                              Free: {formatCompactFreePlanDescription()} · exams not included.
                              <button
                                type="button"
                                className="ml-1 font-semibold text-brand-dark hover:underline"
                                onClick={() => navigate(PREMIUM_PATH)}
                              >
                                View Premium
                              </button>
                            </p>
                          )}
                        </div>
                      </div>

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
                            {kind === "exams" ? (
                              examsUnlocked ? (
                                <FileText className="size-4" />
                              ) : (
                                <Lock className="size-4" />
                              )
                            ) : (
                              <BookOpen className="size-4" />
                            )}
                            {kind === "exams" ? (examsUnlocked ? "Open exams" : "Premium exams") : "Start practice"}
                            <ArrowRight className="size-4" />
                          </Button>
                        </div>
                      </div>
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
