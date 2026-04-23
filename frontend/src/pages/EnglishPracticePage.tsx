import { useEffect, useMemo, useState } from "react";
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
import { Loader2 } from "lucide-react";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { toast } from "sonner";

type Book = { id: number; title: string; promptCount: number };
type Section = "A" | "B";
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

export function EnglishPracticePanel() {
  const [books, setBooks] = useState<Book[]>([]);
  const [section, setSection] = useState<Section>("A");
  const [selectedBookTitle, setSelectedBookTitle] = useState<string>("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingPromptId, setSubmittingPromptId] = useState<number | null>(null);

  const [textByPrompt, setTextByPrompt] = useState<Record<number, string>>({});
  const [imagesByPrompt, setImagesByPrompt] = useState<Record<number, string[]>>({});
  const [openPromptResponses, setOpenPromptResponses] = useState<Record<number, boolean>>({});
  const [activePromptIndex, setActivePromptIndex] = useState(0);

  const selectedBook = books.find((b) => b.title === selectedBookTitle) ?? null;
  const numericBookId = selectedBook?.id ?? Number.NaN;

  async function loadBooks(currentSection: Section) {
    const data = await apiFetch<{ books: Book[] }>(
      `${API_PATHS.english.books}?section=${encodeURIComponent(currentSection)}`,
    );
    setBooks(data.books || []);
    if (currentSection === "A") {
      if (!selectedBookTitle && data.books?.length) setSelectedBookTitle(data.books[0].title);
      if (selectedBookTitle && !data.books.some((b) => b.title === selectedBookTitle)) {
        setSelectedBookTitle(data.books.length ? data.books[0].title : "");
      }
    } else {
      setSelectedBookTitle("");
    }
  }

  async function loadBookData(id: number, currentSection: Section) {
    const suffix =
      currentSection === "A"
        ? `?section=A&bookId=${encodeURIComponent(id)}`
        : `?section=${encodeURIComponent(currentSection)}`;
    const [p, r] = await Promise.all([
      apiFetch<{ prompts: Prompt[] }>(`${API_PATHS.english.prompts}${suffix}`),
      apiFetch<{ responses: ResponseRow[] }>(`${API_PATHS.english.responses}${suffix}`),
    ]);
    setPrompts(p.prompts || []);
    setResponses(r.responses || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        await loadBooks(section);
      } catch (e) {
        toast.error("Could not load English books.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (section === "A" && (!Number.isFinite(numericBookId) || numericBookId <= 0)) return;
    (async () => {
      try {
        await loadBookData(numericBookId, section);
        setActivePromptIndex(0);
      } catch {
        toast.error("Could not load prompts/responses.");
      }
    })();
  }, [numericBookId, section]);

  const promptCountLabel = useMemo(() => {
    const b = books.find((x) => x.title === selectedBookTitle);
    return b ? `${b.promptCount} prompts` : "";
  }, [books, selectedBookTitle]);

  const activePrompt = prompts[activePromptIndex] ?? null;

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
      await loadBookData(numericBookId, section);
    } catch (e) {
      toast.error("Could not submit response.");
    } finally {
      setSubmittingPromptId(null);
    }
  };

  return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Choose section</CardTitle>
            <CardDescription>A = Book prompts, B = Creative stimulus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full max-w-xs">
              <Select value={section} onValueChange={(v) => setSection((v as Section) ?? "A")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Section A - Book prompts</SelectItem>
                  <SelectItem value="B">Section B - Creative stimulus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {section === "A" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="w-full max-w-md">
                  <Select value={selectedBookTitle} onValueChange={(v) => setSelectedBookTitle(v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? "Loading..." : "Select a book"} />
                    </SelectTrigger>
                    <SelectContent>
                      {books.map((b) => (
                        <SelectItem key={b.id} value={b.title}>
                          {b.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {promptCountLabel ? <Badge variant="secondary">{promptCountLabel}</Badge> : null}
              </div>
            ) : (
              <Badge variant="secondary">
                Creative writing practice
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Prompt Practice</CardTitle>
            <CardDescription>Navigate prompts with previous/next, then write and submit for the current one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!prompts.length ? (
              <p className="text-sm text-muted-foreground">
                {section === "A" ? "No prompts for this book yet." : "No prompts in this section yet."}
              </p>
            ) : (
              <div className="rounded-xl border border-black/10 bg-white/70 p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">
                    Prompt {activePromptIndex + 1} of {prompts.length}
                  </Badge>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActivePromptIndex((i) => Math.max(0, i - 1))}
                      disabled={activePromptIndex <= 0}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setActivePromptIndex((i) => Math.min(prompts.length - 1, i + 1))}
                      disabled={activePromptIndex >= prompts.length - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>

                {activePrompt ? (
                  <>
                    <p className="text-lg font-semibold leading-relaxed whitespace-pre-wrap">{activePrompt.prompt}</p>
                    <Textarea
                      rows={8}
                      value={textByPrompt[activePrompt.id] ?? ""}
                      onChange={(e) => setTextByPrompt((m) => ({ ...m, [activePrompt.id]: e.target.value }))}
                      placeholder="Write your response for this prompt..."
                    />
                    <div className="space-y-2">
                      <Label>Upload handwritten photo(s)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => void handleFiles(activePrompt.id, e.target.files)}
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
                        className="gap-2"
                      >
                        {submittingPromptId === activePrompt.id ? <Loader2 className="size-4 animate-spin" /> : null}
                        Submit response
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setOpenPromptResponses((prev) => ({
                            ...prev,
                            [activePrompt.id]: !prev[activePrompt.id],
                          }))
                        }
                      >
                        {openPromptResponses[activePrompt.id]
                          ? "Hide others for this prompt"
                          : "View others for this prompt"}
                      </Button>
                    </div>
                    {openPromptResponses[activePrompt.id] ? (
                      <div className="space-y-2 rounded-lg border border-black/10 bg-white p-3">
                        {responses
                          .filter((r) => r.promptId === activePrompt.id)
                          .map((r) => (
                            <div
                              key={`prompt-${activePrompt.id}-resp-${r.id}`}
                              className="rounded border border-black/10 p-3 space-y-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">@{r.username}</span>
                                <Badge variant="secondary">
                                  Avg: {r.averageScore != null ? `${r.averageScore}/10` : "No ratings"}
                                </Badge>
                              </div>
                              {r.responseText ? <p className="text-sm whitespace-pre-wrap">{r.responseText}</p> : null}
                              {r.imageUrls?.length ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {r.imageUrls.map((u, i) => (
                                    <img
                                      key={`${r.id}-${i}`}
                                      src={u}
                                      alt={`prompt-${activePrompt.id}-resp-${i + 1}`}
                                      className="w-full rounded border border-black/10"
                                    />
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        {!responses.some((r) => r.promptId === activePrompt.id) ? (
                          <p className="text-xs text-muted-foreground">No responses for this prompt yet.</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}

export default function EnglishPracticePage() {
  return (
    <AppShell title="English Practice" subtitle="Book prompts, writing uploads, and peer ratings out of 10.">
      <EnglishPracticePanel />
    </AppShell>
  );
}

