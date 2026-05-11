import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import { baseSubjects } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import {
  getRawCustomQuestionsForSubject,
  normalizeCustomQuestionsList,
} from "@/lib/practiceQuestions";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles, BookOpen, ArrowRight } from "lucide-react";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
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
          setQuestions(subject?.quiz ?? []);
          return;
        }
        const data = await apiFetch<{ customQuestions?: Record<string, unknown[]> }>(API_PATHS.bootstrap);
        if (cancelled) return;
        if (data.customQuestions) {
          localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(data.customQuestions));
        }
        const raw = getRawCustomQuestionsForSubject(data.customQuestions, subjectId);
        const custom = normalizeCustomQuestionsList(raw);
        setQuestions(custom.length ? custom : (subject?.quiz ?? []));
      } catch {
        setQuestions(subject?.quiz ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subjectId, subject?.quiz, user]);

  const availableTopics = useMemo(() => {
    if (isEnglish) return [];
    const topics = uniqSorted(questions.map((q) => q.topic ?? "General"));
    return ["all", ...topics];
  }, [questions, isEnglish]);

  useEffect(() => {
    if (isEnglish) return;
    if (availableTopics.length && !availableTopics.includes(topic)) {
      setTopic("all");
    }
  }, [availableTopics, topic, isEnglish]);

  const overview = useMemo(() => {
    return getTopicOverview({
      subjectId: String(subjectId ?? ""),
      subject,
      topic,
      englishSection,
    });
  }, [englishSection, subject, subjectId, topic]);

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
      subtitle="Choose your focus, skim the overview, then start questions."
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[420px_1fr]">
        <Card className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-brand via-brand-light to-amber" />
          <CardHeader className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="font-display text-xl text-[#0b0f19]">
                Practice setup
              </CardTitle>
              <Badge variant="secondary" className="gap-1">
                <Sparkles className="size-3.5" />
                Focus mode
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Choose what you want to study, then jump into questions.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-slate-50 p-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading topics…
              </div>
            ) : isEnglish ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  English section
                </p>
                <Select value={englishSection} onValueChange={(v) => setEnglishSection((v as EnglishSection) ?? "A")}>
                  <SelectTrigger className="h-11 border-black/10 bg-white text-[#0b0f19]">
                    <SelectValue placeholder="Choose section" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Section A — Text response</SelectItem>
                    <SelectItem value="B">Section B — Creative</SelectItem>
                    <SelectItem value="C">Section C — Writing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Topic
                </p>
                <Select value={topic} onValueChange={(v) => setTopic(v ?? "all")}>
                  <SelectTrigger className="h-11 border-black/10 bg-white text-[#0b0f19]">
                    <SelectValue placeholder="Choose topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTopics.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t === "all" ? "All topics" : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <Button onClick={handleStart} className="h-11 gap-2 bg-brand text-white hover:bg-brand-dark">
                <BookOpen className="size-4" />
                Questions
                <ArrowRight className="size-4" />
              </Button>
              <Button variant="outline" className="h-11" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-black/10 bg-white/80 shadow-sm backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle className="font-display text-xl text-[#0b0f19]">
              Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              A quick refresher before you start.
            </p>
          </CardHeader>
          <CardContent>
            <div className="prose prose-slate max-w-none">
              <RichQuestionContent text={overview} className="prose max-w-none" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

