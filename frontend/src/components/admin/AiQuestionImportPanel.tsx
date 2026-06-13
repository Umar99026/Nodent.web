import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetchAdmin } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { purgeCustomQuestionsForSubject } from "@/lib/questionBankCache";
import { topicLabelsForSubject } from "@/lib/pdfTopicInfer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SubjectOption = { id: string; name: string };

type ChatTurn = { role: "user" | "assistant"; content: string };

type DraftRow = {
  selected: boolean;
  subjectId: string;
  type: string;
  topic: string;
  question: string;
  marks: number;
  answer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  passage?: string;
  options?: string[];
  answerParts?: {
    key?: string;
    label: string;
    marks?: number;
    acceptedAnswer?: string;
  }[];
};

type Props = {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  onImported?: () => Promise<void> | void;
};

function mapType(type: string): string {
  const t = type.toLowerCase();
  if (t === "mcq") return "mcq";
  if (t === "long_answer" || t === "long") return "long_answer";
  return "short_answer";
}

function toDraftRow(
  q: Omit<DraftRow, "selected">,
  subjectId: string,
  topicFallback: string,
): DraftRow {
  return {
    selected: true,
    subjectId: q.subjectId || subjectId,
    type: mapType(q.type),
    topic: q.topic || topicFallback,
    question: q.question,
    marks: Number.isFinite(Number(q.marks)) ? Math.max(1, Math.round(Number(q.marks))) : 2,
    answer: q.answer,
    acceptedAnswers: q.acceptedAnswers,
    guidance: q.guidance,
    passage: q.passage,
    options: q.options,
    answerParts: q.answerParts,
  };
}

export function AiQuestionImportPanel({
  subjects,
  defaultSubjectId,
  onImported,
}: Props) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "methods");
  const [resources, setResources] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [sending, setSending] = useState(false);
  const [importing, setImporting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const topicOptions = useMemo(() => topicLabelsForSubject(subjectId), [subjectId]);
  const topicFallback = topicOptions[0] ?? "General";

  useEffect(() => {
    void (async () => {
      try {
        const data = await apiFetchAdmin<{ configured: boolean }>(API_PATHS.admin.aiStatus);
        setConfigured(Boolean(data.configured));
      } catch {
        setConfigured(false);
      }
    })();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  const sendMessage = async () => {
    const text = chatInput.trim();
    if (!text || sending) return;

    const userTurn: ChatTurn = { role: "user", content: text };
    const nextChat = [...chat, userTurn];
    setChat(nextChat);
    setChatInput("");
    setSending(true);

    try {
      const data = await apiFetchAdmin<{
        message: string;
        questions: Omit<DraftRow, "selected">[];
      }>(API_PATHS.admin.aiQuestionChat, {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          topicOptions: [...topicOptions],
          resources: resources.trim() || undefined,
          messages: nextChat,
          currentDraft: draft.map(({ selected: _s, ...rest }) => rest),
        }),
      });

      setChat((prev) => [...prev, { role: "assistant", content: data.message || "Done." }]);

      const incoming = (data.questions ?? []).map((q) => toDraftRow(q, subjectId, topicFallback));
      if (incoming.length) {
        setDraft((prev) => [...prev, ...incoming]);
        toast.success(`Added ${incoming.length} question(s) to draft.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat request failed.");
      setChat((prev) => prev.slice(0, -1));
      setChatInput(text);
    } finally {
      setSending(false);
    }
  };

  const importSelected = async () => {
    const selected = draft.filter((r) => r.selected);
    if (!selected.length) {
      toast.error("Select at least one question in the draft.");
      return;
    }
    setImporting(true);
    try {
      const payload = {
        questions: selected.map((r) => ({
          subjectId: r.subjectId,
          type: r.type,
          topic: r.topic,
          question: r.question,
          marks: r.marks,
          answer: r.answer,
          acceptedAnswers: r.acceptedAnswers,
          guidance: r.guidance,
          passage: r.passage,
          options: r.options,
          answerParts: r.answerParts?.map((p) => ({
            key: p.key,
            label: p.label,
            marks: p.marks,
            acceptedAnswer: p.acceptedAnswer,
          })),
        })),
      };
      const result = await apiFetchAdmin<{ imported: number; errors: { index: number; message: string }[] }>(
        API_PATHS.admin.questionsBulk,
        { method: "POST", body: JSON.stringify(payload) },
      );
      const subjectsTouched = new Set(selected.map((r) => r.subjectId));
      for (const sid of subjectsTouched) purgeCustomQuestionsForSubject(sid);
      await onImported?.();
      const errCount = result.errors?.length ?? 0;
      toast.success(`Imported ${result.imported ?? 0} question(s).${errCount ? ` ${errCount} failed.` : ""}`);
      if (errCount === 0) {
        setDraft((prev) => prev.filter((r) => !r.selected));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="size-5" />
          AI question generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {configured === false && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            OpenAI is not configured. Add <code className="text-xs">OPENAI_API_KEY</code> to{" "}
            <code className="text-xs">.dev.vars</code> (local) or Cloudflare Pages secrets (production).
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Topics available</Label>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {topicOptions.join(" · ")}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Reference material (optional)</Label>
          <Textarea
            value={resources}
            onChange={(e) => setResources(e.target.value)}
            rows={5}
            placeholder="Paste study design notes, topic summaries, example questions, or textbook excerpts to inspire generation…"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This stays attached as context while you chat. Ask for specific topics, counts, difficulty, or types.
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-slate-50/80">
          <div className="flex items-center gap-2 border-b border-black/10 px-3 py-2">
            <MessageSquare className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Chat</span>
          </div>
          <div className="max-h-[320px] min-h-[160px] space-y-3 overflow-y-auto p-3">
            {!chat.length ? (
              <p className="text-sm text-muted-foreground">
                Try: &quot;Generate 5 hard short-answer questions on differential calculus&quot; or
                &quot;Make 3 MCQs using the reference material on matrices&quot;.
              </p>
            ) : (
              chat.map((turn, idx) => (
                <div
                  key={`${turn.role}-${idx}`}
                  className={
                    turn.role === "user"
                      ? "ml-8 rounded-lg bg-[#0f172a] px-3 py-2 text-sm text-white"
                      : "mr-8 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#0f172a]"
                  }
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {turn.role === "user" ? "You" : "Assistant"}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                </div>
              ))
            )}
            {sending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Generating…
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>
          <div className="flex gap-2 border-t border-black/10 p-3">
            <Textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              rows={2}
              placeholder="Ask for questions, revisions, or a different topic…"
              className="min-h-0 flex-1 resize-none bg-white text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              variant="accent"
              onClick={() => void sendMessage()}
              disabled={sending || configured === false || !chatInput.trim()}
              className="shrink-0 self-end"
            >
              Send
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-base">Draft ({draft.length})</Label>
            <div className="flex flex-wrap gap-2">
              {draft.length > 0 && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={() => setDraft([])}>
                    <Trash2 className="mr-1 size-3.5" />
                    Clear draft
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    size="sm"
                    onClick={() => void importSelected()}
                    disabled={importing}
                  >
                    {importing ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                    Import selected ({draft.filter((r) => r.selected).length})
                  </Button>
                </>
              )}
            </div>
          </div>

          {!draft.length ? (
            <p className="rounded-lg border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-muted-foreground">
              Generated questions appear here. Review them, uncheck any you don&apos;t want, then import into the
              question bank.
            </p>
          ) : (
            <div className="max-h-[360px] space-y-2 overflow-y-auto">
              {draft.map((row, idx) => (
                <div key={`draft-${idx}-${row.question.slice(0, 24)}`} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) =>
                        setDraft((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, selected: e.target.checked } : r)),
                        )
                      }
                    />
                    <Badge variant="outline">{row.type}</Badge>
                    <Badge variant="secondary">{row.topic}</Badge>
                    <span className="text-xs text-muted-foreground">{row.marks} marks</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ml-auto size-7"
                      onClick={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove question"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{row.question}</p>
                  {row.answer ? (
                    <p className="text-xs text-muted-foreground">
                      Answer: <span className="text-foreground">{row.answer}</span>
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
