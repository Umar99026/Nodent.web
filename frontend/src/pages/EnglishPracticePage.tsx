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

const SECTION_B_FRAMEWORKS: Record<
  string,
  {
    framework: string;
    instructions: string[];
    title: string;
    promptLine: string;
    stimuli: string[];
  }
> = {
  Origins: {
    framework: "Writing about country",
    title: "Origins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about country and belonging.",
    instructions: [
      "Write a text that explores ideas about country.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "My body might go, but my heart can never leave.",
      "... there is no separation between people, animals, plants, land, sea and sky. It is all Country. It is all family. And everyone is part of the story.",
    ],
  },
  "Small Acts, Big Wins": {
    framework: "Writing about protest",
    title: "Small Acts, Big Wins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about protest and collective action.",
    instructions: [
      "Write a text that explores ideas about protest.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"I want to change the world,\" said Tiny Dragon. \"Start with the next person who needs your help,\" replied Big Panda.",
      "And now my voice is louder than ever. Louder because people have joined me and together we make a chorus, standing up for what we believe.",
    ],
  },
  "Changing Direction": {
    framework: "Writing about personal journeys",
    title: "Changing Direction",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.",
    instructions: [
      "Write a text that explores ideas about personal journeys.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "You were looking for the key for years, but the door was always open!",
      "In the midst of my journey through life I found myself in a dark forest, where the clear way forward was lost.",
    ],
  },
};

function promptForumKey(promptId: number) {
  return `english-prompt-${promptId}`;
}

function cleanSectionBPromptText(promptText: string) {
  return String(promptText ?? "")
    .replace(/â€™|’/g, "'")
    .replace(/â€œ|â€|“|”/g, '"')
    .replace(/â€“|–/g, "-")
    .replace(/â€”|—/g, "-")
    .replace(/(\w)\?(\w)/g, "$1'$2")
    .replace(/\?([^?\n]*[.!][^?\n]*)\?/g, '"$1"')
    .replace(/\s+/g, " ")
    .replace(/\.\s*begin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .replace(/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .trim();
}

function cleanSectionAPromptText(promptText: string) {
  return cleanSectionBPromptText(promptText)
    .replace(/^\s*\(?[ivxlcdm]+\)?[.)\-:\s]+/i, "")
    .trim();
}

function isMalformedSectionBPrompt(promptText: string) {
  const t = String(promptText ?? "").trim();
  if (!t) return true;
  if (/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*creative writing\b/i.test(t)) return true;
  if (/^\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*[^.\n]{0,2}\s*$/i.test(t)) return true;
  if (t.length < 48) return true;
  return false;
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

function extractSectionBTitle(promptText: string) {
  const cleaned = cleanSectionBPromptText(promptText);
  const explicit = cleaned.match(/Title:\s*['"]?([^'"\n]+?)['"]?(?:\s*$)/i)?.[1];
  const titled = cleaned.match(/titled\s+([A-Za-z][A-Za-z ,'-]{1,80})/i)?.[1];
  return (explicit ?? titled ?? "").trim().replace(/[.,"']+$/g, "");
}

function sectionBFramework(promptText: string) {
  const title = extractSectionBTitle(promptText);
  if (!title) return null;
  return SECTION_B_FRAMEWORKS[title] ?? null;
}

function sectionBTitle(promptText: string) {
  const title = extractSectionBTitle(promptText);
  return title || "Creative writing";
}

function sectionBPromptInstruction(promptText: string) {
  const framework = sectionBFramework(promptText);
  if (framework) return framework.promptLine;
  return "";
}

export function EnglishPracticePanel() {
  const navigate = useNavigate();
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
          : cleanSectionBPromptText(p.prompt);
      return { ...p, prompt: nextPrompt };
    });
    if (section === "B") {
      return dedupePrompts(
        cleaned.filter((p) => !isMalformedSectionBPrompt(p.prompt)),
      );
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
                  {section !== "B" && section !== "C" ? (
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
                            <div className="grid gap-3 sm:grid-cols-2">
                              {sectionBFramework(activePrompt.prompt)!.stimuli.map((s) => (
                                <div key={s} className="rounded-lg border border-black/10 bg-white p-3 text-sm shadow-sm">
                                  {s}
                                </div>
                              ))}
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
  const navigate = useNavigate();
  const { promptId } = useParams<{ promptId: string }>();
  const [searchParams] = useSearchParams();
  const section = ((searchParams.get("section") ?? "A").toUpperCase() as Section);
  const bookId = Number(searchParams.get("bookId"));
  const numericPromptId = Number(promptId);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [ratingByResponseId, setRatingByResponseId] = useState<Record<number, string>>({});
  const [savingRatingId, setSavingRatingId] = useState<number | null>(null);
  const [openResponseId, setOpenResponseId] = useState<number | null>(null);

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

  const promptTitle = responses[0]?.prompt ?? "Prompt responses";
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
      const suffix =
        section === "A"
          ? `?section=A&bookId=${encodeURIComponent(bookId)}`
          : `?section=${encodeURIComponent(section)}`;
      const refreshed = await apiFetch<{ responses: ResponseRow[] }>(`${API_PATHS.english.responses}${suffix}`);
      setResponses(
        (refreshed.responses ?? [])
          .map((x) => ({ ...x, prompt: cleanSectionBPromptText(x.prompt) }))
          .filter((x) => x.promptId === numericPromptId),
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
            <CardTitle className="font-display text-lg">{promptTitle}</CardTitle>
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-3 top-3 z-10 border-black/20 bg-white/95 hover:bg-white"
              onClick={() => setOpenResponseId(null)}
              aria-label="Close response"
            >
              <X className="size-4" />
            </Button>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0f172a]">@{openResponse.username}</p>
                <p className="text-xs text-muted-foreground">
                  Avg: {openResponse.averageScore != null ? `${openResponse.averageScore}/10` : "No ratings yet"}
                </p>
              </div>
              {user?.id != null && Number(user.id) === Number(openResponse.userId) ? (
                <p className="text-xs font-medium text-muted-foreground">You can’t rate your own response.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Rate
                  </p>
                  <Select
                    value={
                      ratingByResponseId[openResponse.id] ??
                      (openResponse.myScore != null ? String(openResponse.myScore) : "")
                    }
                    onValueChange={(v) => {
                      if (!v) return;
                      setRatingByResponseId((prev) => ({ ...prev, [openResponse.id]: v }));
                      void rateResponse(openResponse.id, v);
                    }}
                    disabled={savingRatingId === openResponse.id}
                  >
                    <SelectTrigger className="h-8 w-[108px] bg-white px-2 text-xs">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="button" variant="outline" size="icon" onClick={() => setOpenResponseId(null)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mb-3 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  navigate(
                    `/quiz/english?section=${section}${
                      section === "A" && Number.isFinite(bookId) && bookId > 0
                        ? `&bookId=${bookId}`
                        : ""
                    }`,
                  )
                }
              >
                Exit page
              </Button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-black/10 bg-slate-50 p-4">
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

