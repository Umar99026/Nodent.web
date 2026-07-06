import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import {
  API_PATHS,
  STORAGE_KEYS,
  canAccessPracticeExams,
  isAdminUser,
} from "@/lib/constants";
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
import { Loader2, ArrowRight } from "lucide-react";
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
  const showExamsEntry = canAccessPracticeExams(user);
  const [searchParams] = useSearchParams();

  // Demo subject is admin-only (guard direct URL access).
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
      title={subject ? `${subject.name} Practice` : "Practice"}
      hideTitle
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto flex w-full min-h-[calc(100dvh-7rem)] max-w-7xl flex-col gap-6 px-1 py-4 sm:gap-8 sm:px-2 sm:py-6 lg:px-4">
        <div className="text-center">
          <h1 className="font-display text-[clamp(1.75rem,5vw,2.75rem)] font-bold tracking-tight text-[#0b0f19]">
            {subject?.name ?? "Subject"}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">
            Pick a topic, then start questions — or browse past exams.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5">
          {showExamsEntry && !isEnglish ? (
            <Card className="practice-card overflow-hidden">
              <button
                type="button"
                onClick={() => navigate(`/practice/${subjectId}/exams`)}
                className="group w-full text-left"
              >
                <div className="practice-card-header !min-h-0 !justify-between !py-3.5 sm:!py-4">
                  <p className="practice-card-header-title">Exams</p>
                  <p className="practice-card-header-meta">Past papers by year</p>
                </div>
                <div className="flex items-center justify-between gap-4 bg-[#f3f4f6]/25 px-5 py-5 transition-colors group-hover:bg-[#f3f4f6]/45 sm:px-8 sm:py-6">
                  <p className="text-sm text-muted-foreground sm:text-base">
                    Open exam papers for this subject
                  </p>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#0b0f19]" />
                </div>
              </button>
            </Card>
          ) : null}

          <Card className="practice-card overflow-hidden">
            <div className="practice-card-header !min-h-0 !justify-between !py-3.5 sm:!py-4">
              <p className="practice-card-header-title">
                {isEnglish ? "Essay upload" : "Questions"}
              </p>
              <p className="practice-card-header-meta">
                {isEnglish ? "Smart feedback" : "Instant marking"}
              </p>
            </div>
            <CardContent className="flex flex-col gap-5 bg-[#f3f4f6]/25 px-5 py-6 sm:gap-6 sm:px-8 sm:py-7 lg:flex-row lg:items-center lg:justify-between">
              <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
                {isEnglish
                  ? "Upload and get feedback on your writing."
                  : "Choose a topic, then work through questions at your own pace."}
              </p>

              <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end lg:w-auto lg:shrink-0">
                {loading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading…
                  </div>
                ) : isEnglish ? (
                  <p className="text-sm text-muted-foreground">Redirecting…</p>
                ) : (
                  <TopicPerformanceSelect
                    subjectId={subjectId}
                    value={topic}
                    onValueChange={setTopic}
                    topics={topicOptions}
                    includeAllOption
                    placeholder="Choose topic"
                    className="w-full sm:w-[min(100%,18rem)]"
                  />
                )}
                <Button
                  variant="accent"
                  onClick={handleStart}
                  className="h-12 w-full gap-2 rounded-xl px-6 text-base sm:w-auto sm:min-w-[10.5rem]"
                >
                  {isEnglish ? "Upload essay" : "Start"}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {!isEnglish ? (
          <Card className="practice-card flex min-h-[min(24rem,42vh)] flex-1 flex-col">
            <div className="practice-card-header">
              <p className="practice-card-header-title">Study overview</p>
            </div>
            <CardContent className="flex flex-1 flex-col px-5 py-6 sm:px-8 sm:py-7">
              {overviewMarkdown ? (
                <CurriculumOverview markdown={overviewMarkdown} />
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-black/15 bg-[#0b0f19]/[0.03] p-10 text-center">
                  <p className="max-w-md text-sm font-medium text-muted-foreground sm:text-base">
                    Choose a topic above to load overview notes for that area.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
