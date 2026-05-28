import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { API_PATHS } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, X } from "lucide-react";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { toast } from "sonner";
import { CommentThread } from "@/components/quiz/CommentThread";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import {
  cleanSectionAPromptText,
  cleanSectionBPromptText,
  formatSectionBPromptDisplay,
  sectionBFramework,
  sectionBPromptInstruction,
  sectionBTitle,
  shouldShowSectionBPrompt,
} from "@/lib/sectionBPrompts";

type Book = { id: number; title: string; promptCount: number };
type Section = "A" | "B" | "C";
type Prompt = { id: number; bookId: number; bookTitle: string; prompt: string; section: Section };
type ResponseRow = {
  id: number;
  promptId: number;
  prompt: string;
  userId: number;
  username: string;
  responseType: "essay" | "paragraph";
  responseText: string;
  imageUrls: string[];
  updatedAt: string;
  averageScore: number | null;
  ratingCount: number;
  myScore: number | null;
  section: Section;
};

function promptForumKey(promptId: number) {
  return `english-prompt-${promptId}`;
}

function dedupePrompts(list: Prompt[]): Prompt[] {
  const seen = new Set<string>();
  const out: Prompt[] = [];
  for (const p of list) {
    const key = String(p.prompt ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function EnglishPracticePanel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [books, setBooks] = useState<Book[]>([]);
  const [section, setSection] = useState<Section>("A");
  const [selectedBookId, setSelectedBookId] = useState<string>("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingPromptId, setSubmittingPromptId] = useState<number | null>(null);

  const [textByPrompt, setTextByPrompt] = useState<Record<number, string>>({});
  const [imagesByPrompt, setImagesByPrompt] = useState<Record<number, string[]>>({});
  const [activePromptIndex, setActivePromptIndex] = useState(0);
  const [submittedPromptIds, setSubmittedPromptIds] = useState<Record<number, true>>({});

  const numericBookId = Number(selectedBookId);
  const effectiveBookId =
    Number.isFinite(numericBookId) && numericBookId > 0
      ? numericBookId
      : books[0]?.id ?? Number.NaN;

  // Allow deep-linking from PracticeSetup: /quiz/english?section=B
  useEffect(() => {
    const s = String(searchParams.get("section") ?? "")
      .trim()
      .toUpperCase();
    if (!s) return;
    const next: Section = s === "B" ? "B" : s === "C" ? "C" : "A";
    setSection(next);
  }, [searchParams]);

  async function loadBooks(currentSection: Section) {
    const data = await apiFetch<{ books: Book[] }>(
      `${API_PATHS.english.books}?section=${encodeURIComponent(currentSection)}`,
    );
    const nextBooks = data.books || [];
    setBooks(nextBooks);
    if (currentSection === "A") {
      setSelectedBookId((prev) => {
        if (!nextBooks.length) return "";
        if (!prev) return String(nextBooks[0].id);
        return nextBooks.some((b) => String(b.id) === prev) ? prev : String(nextBooks[0].id);
      });
    } else {
      setSelectedBookId("");
    }
  }

  async function loadBookData(id: number, currentSection: Section) {
    const resolvedBookId =
      currentSection === "A" && (!Number.isFinite(id) || id <= 0)
        ? (books[0]?.id ?? Number.NaN)
        : id;
    const suffix =
      currentSection === "A"
        ? Number.isFinite(resolvedBookId) && resolvedBookId > 0
          ? `?section=A&bookId=${encodeURIComponent(resolvedBookId)}`
          : `?section=A`
        : `?section=${encodeURIComponent(currentSection)}`;
    const p = await apiFetch<{ prompts: Prompt[] }>(`${API_PATHS.english.prompts}${suffix}`);
    setPrompts(p.prompts || []);
  }

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadBooks(section);
      } catch {
        toast.error("Could not load English setup.");
      } finally {
        setLoading(false);
      }
    })();
  }, [section]);

  useEffect(() => {
    if (section === "A" && (!Number.isFinite(effectiveBookId) || effectiveBookId <= 0)) return;
    (async () => {
      try {
        await loadBookData(effectiveBookId, section);
        setActivePromptIndex(0);
      } catch {
        toast.error("Could not load prompts/responses.");
      }
    })();
  }, [effectiveBookId, section, books]);

  const visiblePrompts = useMemo(() => {
    const cleaned = prompts.map((p) => {
      const nextPrompt =
        section === "A"
          ? cleanSectionAPromptText(p.prompt)
          : formatSectionBPromptDisplay(p.prompt);
      return { ...p, prompt: nextPrompt };
    });
    if (section === "B") {
      return dedupePrompts(cleaned.filter((p) => shouldShowSectionBPrompt(p.prompt)));
    }
    return dedupePrompts(cleaned);
  }, [prompts, section]);
  const selectedBook = useMemo(
    () => books.find((b) => String(b.id) === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  useEffect(() => {
    if (activePromptIndex < visiblePrompts.length) return;
    setActivePromptIndex(0);
  }, [activePromptIndex, visiblePrompts.length]);

  const activePrompt = visiblePrompts[activePromptIndex] ?? null;

  const handleFiles = async (promptId: number, files: FileList | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, 6);
    if (!list.length) return;
    const urls = await Promise.all(
      list.map((f) =>
        compressImageFileToDataUrl(f, {
          maxWidth: 1800,
          maxHeight: 1800,
          quality: 0.72,
          outputType: "image/jpeg",
        }),
      ),
    );
    setImagesByPrompt((prev) => ({ ...prev, [promptId]: [...(prev[promptId] ?? []), ...urls] }));
  };

  const submitResponse = async (prompt: Prompt) => {
    const responseText = (textByPrompt[prompt.id] ?? "").trim();
    const imageUrls = imagesByPrompt[prompt.id] ?? [];
    if (!responseText && imageUrls.length === 0) {
      toast.error("Write something or upload at least one image.");
      return;
    }
    setSubmittingPromptId(prompt.id);
    try {
      await apiFetch(API_PATHS.english.responses, {
        method: "POST",
        body: JSON.stringify({
          promptId: prompt.id,
          responseType: "essay",
          responseText,
          imageUrls,
        }),
      });
      toast.success("Response uploaded to shared space.");
      setSubmittedPromptIds((prev) => ({ ...prev, [prompt.id]: true }));
      setTextByPrompt((prev) => ({ ...prev, [prompt.id]: "" }));
      setImagesByPrompt((prev) => ({ ...prev, [prompt.id]: [] }));
      navigate(
        `/quiz/english/prompt/${prompt.id}/responses?section=${section}${
          section === "A" && Number.isFinite(numericBookId) && numericBookId > 0
            ? `&bookId=${numericBookId}`
            : ""
        }`,
      );
    } catch (e) {
      const message =
        e instanceof Error && e.message ? e.message : "Could not submit response.";
      toast.error(message);
    } finally {
      setSubmittingPromptId(null);
    }
  };

  const sectionDisplayLabel =
    section === "A" ? "Section A" : section === "B" ? "Section B" : "Section C";

  return (
      <div className="space-y-6">
        <Card className="overflow-hidden border-white/30 bg-gradient-to-br from-[#1d4e89] via-[#2563a6] to-[#2b7bc3] text-white shadow-[0_20px_50px_rgba(10,18,35,0.25)]">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-xl sm:text-2xl">English Practice</CardTitle>
            <CardDescription className="text-white/80">
              Choose your section, open prompts, draft responses, and join prompt discussions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full max-w-xs">
              <Select value={section} onValueChange={(v) => setSection((v as Section) ?? "A")}>
                <SelectTrigger className="h-11 border-white/20 bg-white/95 font-medium text-black">
                  <SelectValue placeholder="Choose your section">{sectionDisplayLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Section A - Book prompts</SelectItem>
                  <SelectItem value="B">Section B - Creative stimulus</SelectItem>
                  <SelectItem value="C">Section C - Writing prompts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {section === "A" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full max-w-md">
                  <Select
                    value={selectedBookId}
                    onValueChange={(v) => setSelectedBookId(v ?? "")}
                  >
                    <SelectTrigger className="h-11 border-white/20 bg-white/95 text-black">
                      <SelectValue placeholder={loading ? "Loading..." : "Choose your text"}>
                        {selectedBook?.title ?? (loading ? "Loading..." : "Choose your text")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {books.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <Badge variant="secondary" className="bg-white/90 text-[#0b0f19]">
                {section === "B" ? "Creative writing practice" : "Section C writing practice"}
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-white/30 bg-white/95 shadow-[0_18px_40px_rgba(10,18,35,0.2)]">
          <CardContent className="space-y-5">
            {!visiblePrompts.length ? (
              <p className="rounded-lg border border-dashed border-black/15 bg-black/[0.02] p-5 text-sm text-muted-foreground">
                {section === "A" ? "No prompts for this book yet." : "No prompts in this section yet."}
              </p>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-gradient-to-b from-white to-slate-50 p-5 space-y-5">
                <div className="flex items-center justify-between">
                  {section !== "C" ? (
                    <Badge variant="secondary" className="bg-black/[0.04] text-[#0b0f19]">
                      Prompt {activePromptIndex + 1} of {visiblePrompts.length}
                    </Badge>
                  ) : (
                    <span />
                  )}
                  {section !== "C" ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-black/15 bg-white hover:bg-black/[0.03]"
                        onClick={() => setActivePromptIndex((i) => Math.max(0, i - 1))}
                        disabled={activePromptIndex <= 0}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-black/15 bg-white hover:bg-black/[0.03]"
                        onClick={() => setActivePromptIndex((i) => Math.min(visiblePrompts.length - 1, i + 1))}
                        disabled={activePromptIndex >= visiblePrompts.length - 1}
                      >
                        Next
                      </Button>
                    </div>
                  ) : (
                    <span />
                  )}
                </div>

                {activePrompt ? (
                  <>
                    {section !== "B" ? (
                      <p className="rounded-xl border border-black/10 bg-white p-4 text-lg font-semibold leading-relaxed whitespace-pre-wrap shadow-sm">
                        {activePrompt.prompt}
                      </p>
                    ) : null}
                    {section === "B" ? (
                      <div className="rounded-xl border border-black/10 bg-gradient-to-b from-[#f8f5ff] to-white p-4 space-y-3 shadow-sm">
                        <p className="text-sm font-medium text-[#243042]">
                          Respond with a creative piece on the following prompt.
                        </p>
                        {sectionBFramework(activePrompt.prompt) ? (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {sectionBFramework(activePrompt.prompt)!.framework}
                          </p>
                        ) : null}
                        <p className="text-base font-semibold text-[#101828]">
                          title: {sectionBFramework(activePrompt.prompt)?.title ?? sectionBTitle(activePrompt.prompt)}.
                        </p>
                        {sectionBPromptInstruction(activePrompt.prompt) ? (
                          <p className="text-base font-medium leading-relaxed whitespace-pre-wrap text-[#243042]">
                            {sectionBPromptInstruction(activePrompt.prompt)}
                          </p>
                        ) : null}
                        {sectionBFramework(activePrompt.prompt) ? (
                          <>
                            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                              {sectionBFramework(activePrompt.prompt)!.instructions.map((ins) => (
                                <li key={ins}>{ins}</li>
                              ))}
                            </ul>
                            <div className="rounded-lg border border-black/10 bg-white p-4 text-sm leading-relaxed shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Stimulus
                              </p>
                              <p className="mt-2 text-[#243042]">
                                {sectionBFramework(activePrompt.prompt)!.stimulus}
                              </p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <Textarea
                      rows={8}
                      value={textByPrompt[activePrompt.id] ?? ""}
                      onChange={(e) => setTextByPrompt((m) => ({ ...m, [activePrompt.id]: e.target.value }))}
                      placeholder={
                        section === "C"
                          ? "Write your argument analysis response..."
                          : "Write your response for this prompt..."
                      }
                      className="min-h-[220px] border-black/15 bg-white text-[15px] leading-7 shadow-sm"
                    />
                    {section === "C" ? (
                      <div className="rounded-xl border border-black/10 bg-gradient-to-b from-[#eefdf9] to-white p-4 shadow-sm">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Section C Writing
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          Respond directly to the prompt. Build a clear contention, develop your ideas, and use strong language choices.
                        </p>
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-[#172033]">Upload handwritten photo(s)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => void handleFiles(activePrompt.id, e.target.files)}
                        className="border-black/15 bg-white"
                      />
                      {(imagesByPrompt[activePrompt.id] ?? []).length ? (
                        <p className="text-xs text-muted-foreground">
                          {imagesByPrompt[activePrompt.id]!.length} image(s) attached.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void submitResponse(activePrompt)}
                        disabled={submittingPromptId === activePrompt.id}
                        className="gap-2 bg-[#0f172a] text-white shadow-md hover:bg-[#111827]"
                      >
                        {submittingPromptId === activePrompt.id ? <Loader2 className="size-4 animate-spin" /> : null}
                        {submittedPromptIds[activePrompt.id] ? (
                          <>
                            <Check className="size-4" />
                            Submitted
                          </>
                        ) : (
                          "Submit response"
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-black/15 bg-white hover:bg-black/[0.03]"
                        onClick={() =>
                          navigate(
                            `/quiz/english/prompt/${activePrompt.id}/responses?section=${section}${
                              section === "A" && Number.isFinite(numericBookId) && numericBookId > 0
                                ? `&bookId=${numericBookId}`
                                : ""
                            }`,
                          )
                        }
                      >
                        View all responses
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {activePrompt ? (
          <Card className="overflow-hidden border-white/30 bg-white/95 shadow-[0_14px_36px_rgba(10,18,35,0.18)]">
            <CardHeader>
              <CardTitle className="font-display text-xl">Prompt Discussion</CardTitle>
              <CardDescription>Chat with others about this exact prompt.</CardDescription>
            </CardHeader>
            <CardContent>
              <CommentThread subjectId="english" questionKey={promptForumKey(activePrompt.id)} />
            </CardContent>
          </Card>
        ) : null}
      </div>
  );
}

export function EnglishPromptResponsesPage() {
  const { user } = useAuth();
  const { promptId } = useParams<{ promptId: string }>();
  const [searchParams] = useSearchParams();
  const section = ((searchParams.get("section") ?? "A").toUpperCase() as Section);
  const bookId = Number(searchParams.get("bookId"));
  const numericPromptId = Number(promptId);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [catalogPromptRaw, setCatalogPromptRaw] = useState("");
  const [ratingByResponseId, setRatingByResponseId] = useState<Record<number, string>>({});
  const [savingRatingId, setSavingRatingId] = useState<number | null>(null);
  const [openResponseId, setOpenResponseId] = useState<number | null>(null);

  const promptsQuerySuffix =
    section === "A"
      ? `?section=A&bookId=${encodeURIComponent(bookId)}`
      : `?section=${encodeURIComponent(section)}`;

  useEffect(() => {
    if (!Number.isFinite(numericPromptId) || numericPromptId <= 0) return;
    let cancelled = false;
    (async () => {
      try {
        const p = await apiFetch<{ prompts: { id: number; prompt: string }[] }>(
          `${API_PATHS.english.prompts}${promptsQuerySuffix}`,
        );
        if (cancelled) return;
        const hit = (p.prompts ?? []).find((x) => Number(x.id) === numericPromptId);
        setCatalogPromptRaw(String(hit?.prompt ?? ""));
      } catch {
        if (!cancelled) setCatalogPromptRaw("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [numericPromptId, promptsQuerySuffix]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const suffix =
          section === "A"
            ? `?section=A&bookId=${encodeURIComponent(bookId)}`
            : `?section=${encodeURIComponent(section)}`;
        const r = await apiFetch<{ responses: ResponseRow[] }>(`${API_PATHS.english.responses}${suffix}`);
        const rows = (r.responses ?? [])
          .map((x) => ({ ...x, prompt: cleanSectionBPromptText(x.prompt) }))
          .filter((x) => x.promptId === numericPromptId);
        setResponses(rows);
        setRatingByResponseId(() =>
          rows.reduce<Record<number, string>>((acc, row) => {
            if (row.myScore != null) acc[row.id] = String(row.myScore);
            return acc;
          }, {}),
        );
      } catch {
        toast.error("Could not load responses for this prompt.");
      } finally {
        setLoading(false);
      }
    })();
  }, [section, bookId, numericPromptId]);

  const resolvedPromptFormatted = useMemo(() => {
    const fromRows = responses.map((row) => row.prompt).find((t) => String(t ?? "").trim()) ?? "";
    const raw = String(catalogPromptRaw ?? "").trim() || fromRows;
    const base = cleanSectionBPromptText(raw);
    if (!base.trim()) return "";
    return section === "A"
      ? cleanSectionAPromptText(base)
      : formatSectionBPromptDisplay(base);
  }, [catalogPromptRaw, responses, section]);

  const promptTitleShort = useMemo(() => {
    const t = resolvedPromptFormatted.trim();
    if (!t) return "Prompt responses";
    const oneLine = t.replace(/\s+/g, " ").trim();
    return oneLine.length > 140 ? `${oneLine.slice(0, 137)}…` : oneLine;
  }, [resolvedPromptFormatted]);

  const openResponse = responses.find((r) => r.id === openResponseId) ?? null;
  const rateResponse = async (responseId: number, scoreRaw: string) => {
    const score = Number(scoreRaw);
    if (!Number.isFinite(score) || score < 1 || score > 10) return;
    setSavingRatingId(responseId);
    try {
      await apiFetch(API_PATHS.english.rateResponse(responseId), {
        method: "POST",
        body: JSON.stringify({ score }),
      });
      setResponses((prev) =>
        prev.map((row) =>
          row.id === responseId
            ? { ...row, myScore: score }
            : row,
        ),
      );
      setRatingByResponseId((prev) => ({ ...prev, [responseId]: String(score) }));
      const suffix =
        section === "A"
          ? `?section=A&bookId=${encodeURIComponent(bookId)}`
          : `?section=${encodeURIComponent(section)}`;
      const refreshed = await apiFetch<{ responses: ResponseRow[] }>(`${API_PATHS.english.responses}${suffix}`);
      const nextRows =
        (refreshed.responses ?? [])
          .map((x) => ({ ...x, prompt: cleanSectionBPromptText(x.prompt) }))
          .filter((x) => x.promptId === numericPromptId);
      setResponses(nextRows);
      setRatingByResponseId(() =>
        nextRows.reduce<Record<number, string>>((acc, row) => {
          if (row.myScore != null) acc[row.id] = String(row.myScore);
          return acc;
        }, {}),
      );
      toast.success("Rating saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save rating.");
    } finally {
      setSavingRatingId(null);
    }
  };

  return (
    <AppShell
      title="Prompt Responses"
      subtitle="All responses for this exact prompt."
      edgeToEdgeHeader
      edgeToEdgeMain
      edgeToEdgeHeaderClassName="px-0 sm:px-1 lg:px-2"
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">{promptTitleShort}</CardTitle>
            <CardDescription>
              {loading ? "Loading..." : `${responses.length} response(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!responses.length ? (
              <p className="text-sm text-muted-foreground">No responses yet for this prompt.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                {responses.map((r) => {
                  const isMine = user?.id != null && Number(user.id) === Number(r.userId);
                  return (
                    <div
                      key={r.id}
                      className="group relative aspect-square overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        className="absolute inset-x-0 top-0 bottom-12 z-[1]"
                        onClick={() => setOpenResponseId(r.id)}
                        aria-label={`Open response by ${r.username}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
                      <div className="absolute inset-0 flex items-center justify-center p-1.5">
                        <div className="w-full rounded-sm border border-black/10 bg-white/60 p-1.5 backdrop-blur-sm">
                          <p className="line-clamp-3 whitespace-pre-wrap text-center text-[10px] leading-tight text-[#111827]/85 blur-[1.6px] select-none">
                            {(r.responseText || "Handwritten response").trim()}
                          </p>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 border-b border-black/10 bg-white/88 px-1.5 py-1 backdrop-blur">
                        <span className="truncate text-[10px] font-semibold text-[#0f172a]">@{r.username}</span>
                        <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[9px]">
                          Avg: {r.averageScore != null ? `${r.averageScore}/10` : "—"}
                        </Badge>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-[2] border-t border-black/10 bg-white/92 px-1.5 py-1.5 backdrop-blur">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {isMine ? "Your response" : "Tap to view & rate"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Prompt discussion</CardTitle>
            <CardDescription>Forum for this exact prompt.</CardDescription>
          </CardHeader>
          <CardContent>
            <CommentThread subjectId="english" questionKey={promptForumKey(numericPromptId)} />
          </CardContent>
        </Card>
      </div>
      {openResponse ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpenResponseId(null)}
        >
          <div
            className="relative w-full max-w-3xl rounded-xl border border-black/10 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Always-visible close button on the tile (not hover-only). */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-3 top-3 z-50 border-black/25 bg-white text-[#0b0f19] opacity-100 shadow-sm ring-1 ring-black/5 hover:bg-white"
              onClick={() => setOpenResponseId(null)}
              aria-label="Close response"
            >
              <X className="size-4.5" />
            </Button>
            <div className="sticky top-0 z-20 -m-4 mb-3 border-b border-black/10 bg-white/95 p-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3 pr-12">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0f172a]">@{openResponse.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg: {openResponse.averageScore != null ? `${openResponse.averageScore}/10` : "No ratings yet"}
                  </p>
                </div>
                {user?.id != null && Number(user.id) === Number(openResponse.userId) ? (
                  <p className="text-xs font-medium text-muted-foreground">You can’t rate your own response.</p>
                ) : (
                  <div className="flex items-center">
                    {(() => {
                      const selectedRaw =
                        ratingByResponseId[openResponse.id] ??
                        (openResponse.myScore != null ? String(openResponse.myScore) : "");
                      // Base-UI Select treats "" as "no value"; keep it undefined so the placeholder shows.
                      const selected = selectedRaw ? selectedRaw : undefined;
                      const triggerLabel = selected ? `${selected}/10` : "RATE";
                      return (
                        <Select
                          value={selected}
                          onValueChange={(v) => {
                            if (!v) return;
                            setRatingByResponseId((prev) => ({ ...prev, [openResponse.id]: v }));
                            void rateResponse(openResponse.id, v);
                          }}
                          disabled={savingRatingId === openResponse.id}
                        >
                          <SelectTrigger className="h-8 w-[132px] bg-white px-2 text-xs">
                            <SelectValue placeholder={triggerLabel} />
                          </SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                              <SelectItem key={s} value={String(s)}>
                                {s}/10
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-black/10 bg-slate-50 p-4">
              <div className="mb-4 rounded-lg border border-black/10 bg-white p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Prompt
                </p>
                <RichQuestionContent
                  text={
                    resolvedPromptFormatted.trim() ||
                    "Prompt text is unavailable. Try refreshing the page."
                  }
                  preferMarkdown
                  className="prose max-w-none"
                />
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#111827]">
                {openResponse.responseText || "No typed response text."}
              </p>
              {openResponse.imageUrls?.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {openResponse.imageUrls.map((u, i) => (
                    <img key={`${openResponse.id}-${i}`} src={u} alt={`response-${openResponse.id}-${i + 1}`} className="w-full rounded border border-black/10" />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

export default function EnglishPracticePage() {
  return (
    <AppShell
      title="English Practice"
      subtitle="Book prompts, writing uploads, and peer ratings out of 10."
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <EnglishPracticePanel />
    </AppShell>
  );
}

