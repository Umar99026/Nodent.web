import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS, isAdminUser } from "@/lib/constants";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import {
  getRawCustomQuestionsForSubject,
  practiceQuestionsForSubject,
} from "@/lib/practiceQuestions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, BookOpen, ArrowRight } from "lucide-react";
import { generalMathsPracticeTopicOptions } from "@/lib/generalMathsAreaTopic";
import { methodsPracticeTopicOptions } from "@/lib/methodsAreaTopic";
import { specialistMathsPracticeTopicOptions } from "@/lib/specialistMathsAreaTopic";
import { CurriculumOverview } from "@/components/study/CurriculumOverview";
import { getTopicOverview } from "@/lib/topicOverviews";

type EnglishSection = "A" | "B" | "C";

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

  const initialTopic = String(searchParams.get("topic") ?? "all");
  const initialSection = (String(searchParams.get("section") ?? "A").toUpperCase() as EnglishSection) || "A";

  const [topic, setTopic] = useState<string>(initialTopic || "all");
  const [englishSection, setEnglishSection] = useState<EnglishSection>(
    initialSection === "B" || initialSection === "C" ? initialSection : "A",
  );

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        if (!user) {
          setQuestions(practiceQuestionsForSubject([], subjectId));
          return;
        }
        const data = await apiFetch<{ customQuestions?: Record<string, unknown[]> }>(API_PATHS.bootstrap);
        if (cancelled) return;
        if (data.customQuestions) {
          localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(data.customQuestions));
        }
        const raw = getRawCustomQuestionsForSubject(data.customQuestions, subjectId);
        setQuestions(practiceQuestionsForSubject(raw, subjectId));
      } catch {
        let fallback: Question[] = [];
        try {
          const parsed = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.customQuestions) || "{}",
          ) as Record<string, unknown[]>;
          fallback = practiceQuestionsForSubject(
            getRawCustomQuestionsForSubject(parsed, subjectId),
            subjectId,
          );
        } catch {
          fallback = practiceQuestionsForSubject([], subjectId);
        }
        setQuestions(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, user]);

  const isMethods = String(subjectId) === "methods";
  const isGeneralMaths = String(subjectId) === "general-maths";
  const isSpecialistMaths = String(subjectId) === "specialist-maths";

  const availableTopics = useMemo(() => {
    if (isEnglish) return [];
    if (isMethods) return methodsPracticeTopicOptions();
    if (isGeneralMaths) return generalMathsPracticeTopicOptions();
    if (isSpecialistMaths) return specialistMathsPracticeTopicOptions();
    const fromBank = uniqSorted(questions.map((q) => q.topic ?? "General"));
    return ["all", ...fromBank];
  }, [questions, isEnglish, isMethods, isGeneralMaths, isSpecialistMaths]);

  const overviewMarkdown = useMemo(() => {
    if (!subjectId) return null;
    if (isEnglish) {
      return getTopicOverview({
        subjectId,
        subject,
        topic,
        englishSection,
      });
    }
    if (!topic || topic === "all") return null;
    return getTopicOverview({
      subjectId,
      subject,
      topic,
      englishSection,
    });
  }, [subjectId, subject, topic, englishSection, isEnglish]);

  useEffect(() => {
    if (isEnglish) return;
    if (availableTopics.length && !availableTopics.includes(topic)) {
      setTopic("all");
    }
  }, [availableTopics, topic, isEnglish]);

  const handleStart = () => {
    if (!subjectId) return;
    if (isEnglish) {
      navigate(`/quiz/english?section=${encodeURIComponent(englishSection)}`);
      return;
    }
    const qp = topic && topic !== "all" ? `?topic=${encodeURIComponent(topic)}` : "";
    navigate(`/quiz/${subjectId}${qp}`);
  };

  return (
    <AppShell
      title={subject ? `${subject.name} Practice` : "Practice"}
      subtitle="Choose your focus, then start questions."
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
        {/* Horizontal setup tile */}
        <Card className="practice-card">
          <div className="practice-card-header">
            <p className="practice-card-header-title">Practice setup</p>
          </div>
          <CardContent className="flex flex-col gap-4 bg-[#f3f4f6]/30 px-4 py-5 sm:px-7 sm:py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-tight text-[#0b0f19] sm:text-xl">
                {subject?.name ?? "Subject"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Pick a topic / section, then start questions.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-end lg:gap-3">
              {loading ? (
                <div className="flex items-center gap-2 rounded-xl border border-black/8 bg-[#f3f4f6] px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : isEnglish ? (
                <div className="w-full min-w-0 space-y-2 sm:min-w-[260px]">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    English section
                  </p>
                  <Select
                    value={englishSection}
                    onValueChange={(v) => setEnglishSection((v as EnglishSection) ?? "A")}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-brand-light/50 bg-brand-light/50 text-[#0b0f19]">
                      <SelectValue placeholder="Choose section" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="A">Section A — Text response</SelectItem>
                      <SelectItem value="B">Section B — Creative</SelectItem>
                      <SelectItem value="C">Section C — Writing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="w-full min-w-0 space-y-2 sm:min-w-[260px]">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Topic
                  </p>
                  <Select value={topic} onValueChange={(v) => setTopic(v ?? "all")}>
                    <SelectTrigger className="h-11 rounded-xl border-brand-light/50 bg-brand-light/50 text-[#0b0f19]">
                      <SelectValue placeholder="Choose topic" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false} className="max-h-72">
                      {availableTopics.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t === "all" ? "All topics" : t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button
                variant="accent"
                onClick={handleStart}
                className="h-11 w-full gap-2 rounded-xl sm:w-auto"
              >
                <BookOpen className="size-4" />
                Questions
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Overview under setup */}
        <Card className="practice-card">
          <div className="practice-card-header">
            <p className="practice-card-header-title">Study overview</p>
          </div>
          <CardContent className="px-4 py-5 sm:px-7 sm:py-6">
            {overviewMarkdown ? (
              <CurriculumOverview markdown={overviewMarkdown} />
            ) : (
              <div className="rounded-2xl border border-dashed border-black/15 bg-[#0b0f19]/[0.03] p-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Choose a topic above to load overview notes.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

