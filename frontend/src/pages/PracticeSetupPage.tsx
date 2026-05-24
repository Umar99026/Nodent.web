import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import { baseSubjects } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import {
  getRawCustomQuestionsForSubject,
  practiceQuestionsForSubject,
} from "@/lib/practiceQuestions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { generalMathsPracticeTopicOptions } from "@/lib/generalMathsAreaTopic";
import { methodsPracticeTopicOptions } from "@/lib/methodsAreaTopic";
import { specialistMathsPracticeTopicOptions } from "@/lib/specialistMathsAreaTopic";
import { CurriculumOverview } from "@/components/study/CurriculumOverview";
import { topicExistsInQuestionBank } from "@/lib/methodsCurriculumOverviews";
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
  const [searchParams] = useSearchParams();

  const subject: Subject | undefined = useMemo(
    () => baseSubjects.find((s) => String(s.id) === String(subjectId)),
    [subjectId],
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
    if (
      (isMethods || isGeneralMaths || isSpecialistMaths) &&
      topic &&
      topic !== "all" &&
      !topicExistsInQuestionBank(topic, questions)
    ) {
      navigate(`/quiz/${subjectId}`);
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
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Horizontal setup tile */}
        <Card className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-brand via-brand-light to-amber" />
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-xl font-semibold text-[#0b0f19]">
                  Practice setup
                </p>
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="size-3.5" />
                  Focus mode
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Pick a topic / section, then start questions.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2 lg:gap-3 lg:justify-end">
              {loading ? (
                <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : isEnglish ? (
                <div className="min-w-[260px] space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    English section
                  </p>
                  <Select
                    value={englishSection}
                    onValueChange={(v) => setEnglishSection((v as EnglishSection) ?? "A")}
                  >
                    <SelectTrigger className="h-11 border-black/10 bg-white text-[#0b0f19]">
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
                <div className="min-w-[260px] space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Topic
                  </p>
                  <Select value={topic} onValueChange={(v) => setTopic(v ?? "all")}>
                    <SelectTrigger className="h-11 border-black/10 bg-white text-[#0b0f19]">
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
                onClick={handleStart}
                className="h-11 gap-2 bg-brand text-white hover:bg-brand-dark"
              >
                <BookOpen className="size-4" />
                Questions
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Overview under setup */}
        <Card className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-brand via-brand-light to-amber" aria-hidden />
          <CardHeader className="space-y-3 px-6 pb-2 pt-6 sm:px-8">
            <CardTitle className="font-display text-2xl font-bold tracking-tight text-[#0b0f19] sm:text-3xl">
              Study overview
            </CardTitle>
            <p className="text-base font-medium text-muted-foreground sm:text-lg">
              {isEnglish
                ? "Section summary for English practice."
                : "Large-type reference for the topic you select."}
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-8 pt-2 sm:px-6 sm:pb-10">
            {overviewMarkdown ? (
              <CurriculumOverview markdown={overviewMarkdown} />
            ) : (
              <div className="rounded-xl border border-dashed border-black/15 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Select topic
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

