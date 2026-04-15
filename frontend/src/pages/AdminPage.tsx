import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS, ADMIN_EMAIL } from "@/lib/constants";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { RichMathText } from "@/components/quiz/QuestionStimulus";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { baseSubjects } from "@/lib/subjects";
import { useAuth } from "@/context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuestionType = "mcq" | "short_answer" | "long_answer";

interface AdminQuestion {
  id: string;
  subjectId: string;
  subjectName?: string;
  type: QuestionType;
  question: string;
  imageUrls?: string[];
  options?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  passage?: string;
  marks: number;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

type BulkRow = {
  rowNumber: number;
  subjectId: string;
  type: QuestionType;
  topic: string;
  passage?: string;
  question: string;
  options_json?: string;
  answer?: string;
  accepted_answers_json?: string;
  marks?: number;
  guidance?: string;
  image_urls_json?: string;
  errors: string[];
};

type PdfPreviewQuestion = {
  localId: string;
  subjectId: string;
  type: QuestionType;
  topic: string;
  question: string;
  passage?: string;
  options?: string[];
  answer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  marks?: number;
  imageUrls?: string[];
  sourcePage?: number;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdminEmail = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isAdminEmail;

  useEffect(() => {
    if (!isAdmin) {
      // Keep page readable: show an access message instead of hard-redirect.
      // (Routing guards already protect admin in production.)
    }
  }, [isAdmin, navigate]);

  /* ------ form state ------ */
  const [subjectId, setSubjectId] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [passage, setPassage] = useState("");
  const [topic, setTopic] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");
  const imageFilesRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [marks, setMarks] = useState<number>(1);

  // MCQ
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Short answer
  const [acceptedAnswers, setAcceptedAnswers] = useState("");

  // Long answer
  const [guidance, setGuidance] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Default marks based on question type.
  useEffect(() => {
    setMarks(questionType === "mcq" ? 1 : 2);
  }, [questionType]);

  /* ------ existing questions state ------ */
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );
  const expandedSubjectsInitRef = useRef(false);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [marksEdits, setMarksEdits] = useState<Record<string, number>>({});
  const [marksSaving, setMarksSaving] = useState<string | null>(null);

  /* ------ Bulk import (paste table) ------ */
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  const bulkImagesRef = useRef<HTMLInputElement | null>(null);
  const [bulkImagesProcessing, setBulkImagesProcessing] = useState(false);
  const [bulkImagesJson, setBulkImagesJson] = useState("");

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfSubjectId, setPdfSubjectId] = useState("");
  const [pdfTopic, setPdfTopic] = useState("General");
  const [pdfMaxPages, setPdfMaxPages] = useState<number>(50);
  const [pdfPreviewRows, setPdfPreviewRows] = useState<PdfPreviewQuestion[]>([]);
  const [pdfExtractedCount, setPdfExtractedCount] = useState(0);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfBusy, setPdfBusy] = useState(false);

  const [reassignFrom, setReassignFrom] = useState("");
  const [reassignTo, setReassignTo] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignMsg, setReassignMsg] = useState("");

  /* ------ fetch existing questions ------ */

  const fetchQuestions = useCallback(async () => {
    try {
      setQuestionsLoading(true);
      const data = await apiFetchAdmin<
        | AdminQuestion[]
        | {
            customQuestions: Record<string, any[]>;
          }
      >(API_PATHS.admin.questions);

      if (Array.isArray(data)) {
        setQuestions(data ?? []);
      } else if (data && typeof data === "object" && (data as any).customQuestions) {
        const grouped = (data as any).customQuestions as Record<string, any[]>;
        const flat: AdminQuestion[] = [];
        for (const [sid, arr] of Object.entries(grouped)) {
          for (const q of arr ?? []) {
            flat.push({
              id: String(q.id ?? ""),
              subjectId: String(sid),
              type: q.type as QuestionType,
              question: String(q.question ?? ""),
              options: Array.isArray(q.options) ? q.options.map(String) : undefined,
              correctAnswer: q.answer ? String(q.answer) : undefined,
              acceptedAnswers: Array.isArray(q.acceptedAnswers)
                ? q.acceptedAnswers.map(String)
                : undefined,
              guidance: q.guidance ? String(q.guidance) : undefined,
              passage: q.passage ? String(q.passage) : undefined,
              marks: Number(q.marks ?? 1) || 1,
              imageUrls: Array.isArray(q.imageUrls) ? q.imageUrls.map(String) : undefined,
            });
          }
        }
        setQuestions(flat);
      } else {
        setQuestions([]);
      }
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchQuestions();
  }, [isAdmin, fetchQuestions]);

  // “All subjects” uses collapsible groups that started fully collapsed, so new
  // questions looked like they never appeared. Expand every group once data
  // first loads; after that, only expand the subject you just edited.
  useEffect(() => {
    if (questionsLoading || questions.length === 0) return;
    if (expandedSubjectsInitRef.current) return;
    expandedSubjectsInitRef.current = true;
    setExpandedSubjects(
      new Set(
        questions.map(
          (q) => q.subjectName || q.subjectId || "Unknown",
        ),
      ),
    );
  }, [questionsLoading, questions]);

  /* ------ submit question ------ */

  const resetForm = () => {
    setQuestionText("");
    setPassage("");
    setTopic("");
    setImageUrlsText("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setAcceptedAnswers("");
    setGuidance("");
    setFormError("");
  };

  const appendImageDataUrls = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    setIsProcessingImages(true);
    try {
      const urls = await Promise.all(
        list.slice(0, 6).map(async (file) => {
          // Compress to keep payload size manageable.
          return await compressImageFileToDataUrl(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.65,
            outputType: "image/jpeg",
          });
        }),
      );

      const existing = imageUrlsText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const next = [...existing, ...urls].slice(0, 12);
      setImageUrlsText(next.join("\n"));
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleSubmit = async () => {
    setFormError("");

    if (!subjectId) {
      setFormError("Please select a subject");
      return;
    }
    if (!questionText.trim()) {
      setFormError("Question text is required");
      return;
    }

    if (questionType === "mcq") {
      if (options.some((o) => !o.trim())) {
        setFormError("All four options are required");
        return;
      }
      if (!correctAnswer) {
        setFormError("Please select the correct answer");
        return;
      }
    }

    if (questionType === "short_answer") {
      const answers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        setFormError("At least one accepted answer is required");
        return;
      }
    }

    if (questionType === "long_answer") {
      const answers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        setFormError("At least one accepted answer is required");
        return;
      }
    }

    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      subjectId,
      type: questionType,
      question: questionText.trim(),
    };

    if (passage.trim()) body.passage = passage.trim();
    body.topic = topic.trim() || "General";
    const imageUrls = imageUrlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (imageUrls.length) body.imageUrls = imageUrls;

    if (questionType === "mcq") {
      body.options = options.map((o) => o.trim());
      body.correctAnswer = correctAnswer;
    } else if (questionType === "short_answer") {
      body.acceptedAnswers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
    } else if (questionType === "long_answer") {
      if (guidance.trim()) body.guidance = guidance.trim();
      body.acceptedAnswers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // Admin-configurable marks (non-MCQ defaults to >1).
    body.marks = marks;

    try {
      await apiFetchAdmin(API_PATHS.admin.questions, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Question added successfully");
      setExpandedSubjects((prev: Set<string>) => {
        const next = new Set(prev);
        next.add(subjectId);
        return next;
      });
      resetForm();
      fetchQuestions();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to add question (network or server error).";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------ delete question ------ */

  const handleDelete = async (questionId: string) => {
    try {
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "DELETE",
      });
      toast.success("Question deleted");
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to delete question");
    }
  };

  const handleUpdateMarks = async (questionId: string, nextMarks: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(nextMarks)));
    try {
      setMarksSaving(questionId);
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "PUT",
        body: JSON.stringify({ marks: clamped }),
      });

      toast.success("Marks updated");
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, marks: clamped } : q)),
      );
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update marks");
    } finally {
      setMarksSaving(null);
    }
  };

  function parseJsonArrayString(raw: string): string[] | null {
    const t = String(raw ?? "").trim();
    if (!t) return null;
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
      return null;
    } catch {
      return null;
    }
  }

  function parseFlexibleList(raw: string): string[] | null {
    const t = String(raw ?? "").trim();
    if (!t) return null;

    // First preference: JSON array
    const asJson = parseJsonArrayString(t);
    if (asJson) return asJson.map((s) => s.trim()).filter(Boolean);

    // Common paste formats: one-per-line OR pipe-separated
    const sep = t.includes("|") ? "|" : "\n";
    const parts = t
      .split(sep)
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.length ? parts : null;
  }

  function normalizeType(raw: string): QuestionType | null {
    const t = String(raw ?? "").trim().toLowerCase();
    if (t === "mcq") return "mcq";
    if (t === "multiple_choice" || t === "multiple choice" || t === "multichoice") return "mcq";
    if (t === "short" || t === "short_answer") return "short_answer";
    if (t === "short answer") return "short_answer";
    if (t === "long" || t === "long_answer" || t === "written") return "long_answer";
    if (t === "long answer" || t === "extended response") return "long_answer";
    return null;
  }

  const buildBulkPreview = () => {
    setBulkError("");
    let text = bulkText.replace(/\r\n/g, "\n").trim();
    if (!text) {
      setBulkRows([]);
      return;
    }

    const subjectHintMatch = text.match(/\bfor\s+([a-z0-9_-]+)\b/i);
    const hintedSubjectId = subjectHintMatch?.[1]?.trim() || "";
    const normalizeSubjectId = (raw: unknown): string => {
      const v = String(raw ?? "").trim();
      if (!v || v === "<PUT_SUBJECT_ID_HERE>") {
        return hintedSubjectId || subjectId || baseSubjects[0]?.id || "methods";
      }
      return v;
    };

    // JSON import path (GPT-friendly): accepts either
    // - [{...}, {...}]
    // - { "questions": [{...}, {...}] }
    try {
        const cleaned = text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();

        let parsed: unknown;
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          // Tolerate trailing hints like ", for methods" by extracting the main JSON block.
          const firstBrace = cleaned.search(/[\[{]/);
          const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
          if (firstBrace >= 0 && lastBrace > firstBrace) {
            parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
          } else {
            throw new Error("invalid json");
          }
        }

        const items = Array.isArray(parsed)
          ? parsed
          : parsed && typeof parsed === "object" && Array.isArray((parsed as any).questions)
            ? ((parsed as any).questions as unknown[])
            : null;
        if (!items) {
          setBulkError("JSON must be an array or an object with a `questions` array.");
          setBulkRows([]);
          return;
        }

        const out: BulkRow[] = [];
        for (let i = 0; i < items.length; i++) {
          const rowNumber = i + 1;
          const q = (items[i] ?? {}) as Record<string, unknown>;
          const errors: string[] = [];

          const subjectId = normalizeSubjectId(
            q.subjectId ?? q.subject_id ?? q.subject ?? "",
          );
          const type =
            normalizeType(String(q.type ?? "")) ??
            normalizeType(String(q.questionType ?? "")) ??
            "long_answer";
          const topic = String(q.topic ?? "General").trim() || "General";
          const passage = String(q.passage ?? "").trim();
          const question = String(q.question ?? q.stem ?? q.prompt ?? "").trim();

          const optionsArr = Array.isArray(q.options)
            ? (q.options as unknown[]).map((x) => String(x).trim()).filter(Boolean)
            : parseFlexibleList((q as any).options_json ?? q.options) ?? null;
          const acceptedArr = Array.isArray(q.acceptedAnswers)
            ? (q.acceptedAnswers as unknown[]).map((x) => String(x).trim()).filter(Boolean)
            : Array.isArray((q as any).accepted_answers)
              ? ((q as any).accepted_answers as unknown[]).map((x) => String(x).trim()).filter(Boolean)
              : parseFlexibleList((q as any).accepted_answers_json ?? q.acceptedAnswers ?? (q as any).accepted_answers) ?? null;
          const imageArr = Array.isArray(q.imageUrls)
            ? (q.imageUrls as unknown[]).map((x) => String(x).trim()).filter(Boolean)
            : Array.isArray((q as any).image_urls)
              ? ((q as any).image_urls as unknown[]).map((x) => String(x).trim()).filter(Boolean)
              : parseFlexibleList((q as any).image_urls_json ?? q.imageUrls ?? (q as any).image_urls) ?? null;

          const options_json = optionsArr?.length ? JSON.stringify(optionsArr) : undefined;
          const accepted_answers_json = acceptedArr?.length
            ? JSON.stringify(acceptedArr)
            : undefined;
          const image_urls_json = imageArr?.length ? JSON.stringify(imageArr) : undefined;

          const answer = String(q.answer ?? q.correctAnswer ?? "").trim() || undefined;
          const guidance = String(q.guidance ?? "").trim() || undefined;
          const marksRaw = Number(q.marks ?? NaN);
          const marks = Number.isFinite(marksRaw)
            ? Math.max(1, Math.round(marksRaw))
            : undefined;

          if (!subjectId) errors.push("Could not resolve subjectId.");
          if (!question) errors.push("question is required.");
          // JSON paste mode is intentionally permissive: backend does final validation/coercion.

          out.push({
            rowNumber,
            subjectId,
            type: (type ?? "mcq") as QuestionType,
            topic,
            passage: passage || undefined,
            question,
            options_json,
            answer,
            accepted_answers_json,
            marks,
            guidance,
            image_urls_json,
            errors,
          });
        }

        setBulkRows(out);
        return;
    } catch {
      // fall through to TSV parser if not valid JSON
    }

    // GPT sometimes outputs “TSV” with spaces instead of real tabs.
    // If we detect the known header tokens but no tabs, try converting 2+ spaces to tabs.
    const firstLine = text.split("\n")[0] ?? "";
    if (!firstLine.includes("\t") && firstLine.toLowerCase().includes("subject_id")) {
      // Only replace runs of 2+ spaces to avoid destroying normal sentence spacing.
      text = text.replace(/ {2,}/g, "\t");
    }

    const lines = text.split("\n").filter((l) => l.trim().length > 0);
    if (!lines.length) {
      setBulkRows([]);
      return;
    }

    const sep = lines[0]!.includes("\t") ? "\t" : ",";
    const rawHeader = lines[0]!.split(sep).map((h) => h.trim());
    const norm = (h: string) =>
      h
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "_");

    const header = rawHeader.map(norm);

    const HEADER_ALIASES: Record<string, string> = {
      subject: "subject_id",
      subjectid: "subject_id",
      subject_id: "subject_id",
      subjectslug: "subject_id",
      type: "type",
      question: "question",
      q: "question",
      stem: "question",
      prompt: "question",
      passage: "passage",
      stimulus: "passage",
      topic: "topic",
      options: "options_json",
      optionsjson: "options_json",
      options_json: "options_json",
      acceptedanswers: "accepted_answers_json",
      accepted_answers: "accepted_answers_json",
      acceptedanswersjson: "accepted_answers_json",
      accepted_answers_json: "accepted_answers_json",
      answer: "answer",
      marks: "marks",
      guidance: "guidance",
      imageurls: "image_urls_json",
      image_urls: "image_urls_json",
      imageurlsjson: "image_urls_json",
      image_urls_json: "image_urls_json",
    };

    const idx = (canonicalOrAlias: string) => {
      const key = norm(canonicalOrAlias);
      const canonical = HEADER_ALIASES[key] ?? key;
      // find first header cell that maps to canonical
      for (let i = 0; i < header.length; i++) {
        const mapped = HEADER_ALIASES[header[i]!] ?? header[i]!;
        if (mapped === canonical) return i;
      }
      return -1;
    };

    const requiredHeaders = ["subject_id", "type", "question"];
    const missing = requiredHeaders.filter((h) => idx(h) < 0);
    if (missing.length) {
      setBulkError(
        `Missing required columns: ${missing.join(", ")}. Detected headers: ${rawHeader.join(", ")}. ` +
          `If you generated this with GPT, make sure it outputs REAL tabs (TSV). ` +
          `Tip: ask it to wrap the TSV in a code block and then copy/paste.`,
      );
      setBulkRows([]);
      return;
    }

    const out: BulkRow[] = [];
    let prev: Partial<BulkRow> | null = null;

    for (let i = 1; i < lines.length; i++) {
      const rowNumber = i + 1;
      const cols = lines[i]!.split(sep);
      const get = (h: string) => {
        const j = idx(h);
        return j >= 0 ? String(cols[j] ?? "").trim() : "";
      };

      const errors: string[] = [];

      const rawSubject = get("subject_id");
      const rawType = get("type");
      const rawQuestion = get("question");

      const subjectId = rawSubject || (prev?.subjectId ? prev.subjectId : "");
      const type = normalizeType(rawType) || (prev?.type ? prev.type : null);
      const topic = get("topic") || (prev?.topic ? prev.topic : "General");
      const passage = get("passage") || (prev?.passage ? prev.passage : "");
      const question = rawQuestion;

      if (!subjectId) errors.push("subject_id is required (or inherit from previous row).");
      if (!type) errors.push("type is required (mcq/short_answer/long_answer) (or inherit).");
      if (!question) errors.push("question is required.");

      const options_json = get("options_json") || get("options");
      const accepted_answers_json = get("accepted_answers_json") || get("accepted_answers");
      const image_urls_json = get("image_urls_json") || get("image_urls");
      const guidance = get("guidance");
      const answer = get("answer");
      const marksRaw = get("marks");
      const marks = marksRaw ? Math.max(1, Math.round(Number(marksRaw) || 0)) : undefined;

      if (type === "mcq") {
        const opts = parseFlexibleList(options_json || "");
        if (!opts || opts.length < 2) {
          errors.push(
            'MCQ requires options_json (2+). Use JSON like ["A","B","C","D"] or paste options as `A | B | C | D` or one-per-line.',
          );
        }
      }
      if (type === "short_answer") {
        const acc = parseFlexibleList(accepted_answers_json || "");
        if (!acc || acc.length === 0) {
          errors.push(
            'Short answer requires accepted_answers_json (1+). Use JSON like ["2","x=2"] or one-per-line.',
          );
        }
      }
      if (image_urls_json) {
        const imgs = parseFlexibleList(image_urls_json);
        if (!imgs) errors.push("image_urls_json must be a JSON array of URLs.");
      }

      const row: BulkRow = {
        rowNumber,
        subjectId,
        type: (type ?? "mcq") as QuestionType,
        topic: topic || "General",
        passage: passage || undefined,
        question,
        // keep original text; backend will accept flexible formats too
        options_json: options_json || undefined,
        answer: answer || undefined,
        accepted_answers_json: accepted_answers_json || undefined,
        marks,
        guidance: guidance || undefined,
        image_urls_json: image_urls_json || undefined,
        errors,
      };

      out.push(row);
      prev = {
        subjectId: row.subjectId,
        type: row.type,
        topic: row.topic,
        passage: row.passage,
      };
    }

    setBulkRows(out);
  };

  const importBulkRows = async () => {
    setBulkError("");
    if (!bulkRows.length) {
      toast.error("Nothing to import.");
      return;
    }
    const bad = bulkRows.filter((r) => r.errors.length > 0);
    if (bad.length) {
      toast.error(`Fix ${bad.length} row(s) with errors before importing.`);
      return;
    }
    setBulkImporting(true);
    try {
      const payload = {
        questions: bulkRows.map((r) => ({
          subjectId: r.subjectId,
          type: r.type,
          topic: r.topic,
          passage: r.passage,
          question: r.question,
          options_json: r.options_json,
          answer: r.answer,
          accepted_answers_json: r.accepted_answers_json,
          marks: r.marks,
          guidance: r.guidance,
          image_urls_json: r.image_urls_json,
        })),
      };
      const res = await apiFetchAdmin<{
        ok: boolean;
        imported: number;
        errors?: { index: number; message: string }[];
      }>(API_PATHS.admin.questionsBulk, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res?.errors?.length) {
        setBulkError(
          `Imported ${res.imported}. Some rows failed: ` +
            res.errors
              .slice(0, 5)
              .map((e) => `#${e.index + 1} ${e.message}`)
              .join("; "),
        );
        toast.error("Imported with errors. See details below.");
      } else {
        toast.success(`Imported ${res?.imported ?? 0} questions.`);
      }

      setBulkText("");
      setBulkRows([]);
      await fetchQuestions();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Bulk import failed.";
      setBulkError(msg);
      toast.error(msg);
    } finally {
      setBulkImporting(false);
    }
  };

  const previewPdfImport = async () => {
    if (!pdfFile) {
      toast.error("Pick a PDF first.");
      return;
    }
    if (!pdfSubjectId) {
      toast.error("Pick a subject first.");
      return;
    }

    setPdfBusy(true);
    try {
      const form = new FormData();
      form.set("file", pdfFile);
      form.set("subjectId", pdfSubjectId);
      form.set("topic", (pdfTopic || "General").trim());
      form.set("maxPages", String(Math.max(1, Math.min(200, Math.round(pdfMaxPages || 50)))));

      const res = await apiFetchAdmin<{
        ok: boolean;
        pageCount: number;
        extractedCount: number;
        questions: PdfPreviewQuestion[];
      }>(API_PATHS.admin.pdfPreview, {
        method: "POST",
        body: form,
      });

      setPdfPreviewRows(Array.isArray(res.questions) ? res.questions : []);
      setPdfExtractedCount(Number(res.extractedCount ?? 0));
      setPdfPageCount(Number(res.pageCount ?? 0));
      toast.success(`Preview ready: ${res.extractedCount ?? 0} question(s).`);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "PDF preview failed.";
      toast.error(msg);
    } finally {
      setPdfBusy(false);
    }
  };

  const publishPdfImport = async () => {
    if (!pdfSubjectId) {
      toast.error("Pick a subject first.");
      return;
    }
    if (pdfPreviewRows.length === 0) {
      toast.error("Generate a preview first.");
      return;
    }

    setPdfBusy(true);
    try {
      const payload = {
        subjectId: pdfSubjectId,
        questions: pdfPreviewRows,
      };
      const res = await apiFetchAdmin<{ ok: boolean; imported: number }>(
        API_PATHS.admin.pdfPublish,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      toast.success(`Imported ${res.imported ?? 0} question(s) from PDF.`);
      setPdfPreviewRows([]);
      setPdfExtractedCount(0);
      setPdfPageCount(0);
      setPdfFile(null);
      await fetchQuestions();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "PDF publish failed.";
      toast.error(msg);
    } finally {
      setPdfBusy(false);
    }
  };

  const generateQuestionsFromPdf = async () => {
    if (!pdfFile) {
      toast.error("Pick a PDF first.");
      return;
    }
    if (!pdfSubjectId) {
      toast.error("Pick a subject first.");
      return;
    }

    setPdfBusy(true);
    try {
      const form = new FormData();
      form.set("file", pdfFile);
      form.set("subjectId", pdfSubjectId);
      form.set("topic", (pdfTopic || "General").trim());
      form.set("maxPages", String(Math.max(1, Math.min(200, Math.round(pdfMaxPages || 50)))));

      const generated = await apiFetchAdmin<{
        ok: boolean;
        pageCount: number;
        extractedCount: number;
        imported: number;
      }>(API_PATHS.admin.pdfGenerate, {
        method: "POST",
        body: form,
      });

      if ((generated.extractedCount ?? 0) === 0) {
        toast.error("No questions could be extracted from this PDF. Try a clearer/digital PDF.");
        setPdfPreviewRows([]);
        setPdfExtractedCount(0);
        setPdfPageCount(Number(generated.pageCount ?? 0));
        return;
      }

      setPdfPreviewRows([]);
      setPdfExtractedCount(Number(generated.extractedCount ?? 0));
      setPdfPageCount(Number(generated.pageCount ?? 0));

      toast.success(
        `Generated and imported ${generated.imported ?? 0} question(s) from PDF.`,
      );
      setPdfFile(null);
      setPdfPreviewRows([]);
      // Import already succeeded; don't surface refresh issues as import failure.
      try {
        await fetchQuestions();
      } catch {
        // ignore
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "PDF generation failed.";
      toast.error(msg);
    } finally {
      setPdfBusy(false);
    }
  };

  const reassignSubject = async () => {
    setReassignMsg("");
    if (!reassignFrom || !reassignTo) {
      setReassignMsg("Pick both a FROM subject and a TO subject.");
      return;
    }
    if (reassignFrom === reassignTo) {
      setReassignMsg("FROM and TO must be different.");
      return;
    }
    setReassigning(true);
    try {
      const r = await apiFetchAdmin<{ ok: boolean; moved: number }>(
        API_PATHS.admin.questionsReassignSubject,
        {
          method: "POST",
          body: JSON.stringify({ fromSubjectId: reassignFrom, toSubjectId: reassignTo }),
        },
      );
      toast.success(`Moved ${r.moved} question(s).`);
      setReassignMsg(`Moved ${r.moved} question(s) from ${reassignFrom} → ${reassignTo}.`);
      await fetchQuestions();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to reassign subject.";
      setReassignMsg(msg);
      toast.error(msg);
    } finally {
      setReassigning(false);
    }
  };

  /* ------ grouped questions ------ */

  const groupedQuestions = questions.reduce<Record<string, AdminQuestion[]>>(
    (acc, q) => {
      const key = q.subjectName || q.subjectId || "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    },
    {},
  );

  const filteredQuestions = subjectFilter === "all"
    ? questions
    : questions.filter((q) => String(q.subjectId) === subjectFilter);

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  /* ------ render ------ */

  if (!isAdmin) {
    return (
      <AppShell title="Admin Panel" subtitle="Manage custom questions">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="paper-texture">
            <CardHeader>
              <CardTitle className="font-display text-lg">Admin access required</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Sign in with <span className="font-medium text-foreground">{ADMIN_EMAIL}</span> to
              manage questions.
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Panel" subtitle="Manage custom questions">
      <div className="mx-auto max-w-4xl space-y-8">
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">Import from PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload an exam PDF and auto-extract questions + embedded images. Review preview, then
              publish into the question bank.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select
                  value={pdfSubjectId}
                  onValueChange={(val: string | null) => val && setPdfSubjectId(val)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Topic (optional)</Label>
                <Input
                  value={pdfTopic}
                  onChange={(e) => setPdfTopic(e.target.value)}
                  placeholder="General"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <div className="space-y-1.5">
                <Label>PDF file</Label>
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max pages</Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={pdfMaxPages}
                  onChange={(e) => setPdfMaxPages(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => void generateQuestionsFromPdf()}
                disabled={pdfBusy || !pdfFile || !pdfSubjectId}
                className="gap-2 bg-brand text-white hover:bg-brand-dark"
              >
                {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                Generate questions from PDF
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void previewPdfImport()}
                disabled={pdfBusy || !pdfFile || !pdfSubjectId}
                className="gap-2"
              >
                {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                Preview PDF
              </Button>
              <Button
                type="button"
                onClick={() => void publishPdfImport()}
                disabled={pdfBusy || pdfPreviewRows.length === 0 || !pdfSubjectId}
                className="gap-2"
              >
                {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                Publish extracted questions
              </Button>
              <p className="text-xs text-muted-foreground">
                {pdfPreviewRows.length
                  ? `${pdfExtractedCount} extracted from ${pdfPageCount} page(s)`
                  : "No PDF preview yet"}
              </p>
            </div>

            {pdfPreviewRows.length > 0 ? (
              <div className="overflow-auto rounded-xl border border-black/10 bg-white/70">
                <table className="w-full min-w-[740px] text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-black/10">
                      <th className="px-3 py-2">Page</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Question</th>
                      <th className="px-3 py-2">Images</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfPreviewRows.slice(0, 80).map((r, idx) => (
                      <tr key={`${r.localId}-${idx}`} className="border-b border-black/5 align-top">
                        <td className="px-3 py-2">{r.sourcePage ?? "-"}</td>
                        <td className="px-3 py-2">{r.type}</td>
                        <td className="max-w-[460px] whitespace-pre-wrap px-3 py-2">
                          {r.question}
                        </td>
                        <td className="px-3 py-2">{r.imageUrls?.length ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">Bulk import (paste table)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Paste TSV copied from Sheets/Excel.{" "}
              <span className="font-medium text-foreground">Detail rows</span> can leave{" "}
              <code className="rounded bg-black/10 px-1">subject_id</code>,{" "}
              <code className="rounded bg-black/10 px-1">type</code>,{" "}
              <code className="rounded bg-black/10 px-1">topic</code>,{" "}
              <code className="rounded bg-black/10 px-1">passage</code> blank to inherit from the
              previous row. Questions sharing the same non-empty{" "}
              <code className="rounded bg-black/10 px-1">passage</code> render on the same page in
              Quiz/Study.
            </p>

            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={8}
              className="bg-white/60"
              placeholder={`subject_id\ttype\ttopic\tpassage\tquestion\toptions_json\tanswer\taccepted_answers_json\tmarks\tguidance\timage_urls_json
methods\tmcq\tAlgebra\t\t1. Simplify...\t["A","B","C","D"]\tA\t\t1\t\t["https://.../fig1.png"]
\tshort_answer\t\tSame passage for next part\t1(b) Hence...\t\t\t["2","x=2"]\t2\t\t`}
            />

            <div className="rounded-xl border border-black/10 bg-white/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Images helper (no URLs needed)</p>
                  <p className="text-xs text-muted-foreground">
                    Upload images and we’ll generate <code className="rounded bg-black/10 px-1">image_urls_json</code>{" "}
                    as <code className="rounded bg-black/10 px-1">data:</code> URLs you can paste into your TSV.
                  </p>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={bulkImagesRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files ?? []).filter((f) =>
                        f.type.startsWith("image/"),
                      );
                      if (!files.length) return;
                      setBulkImagesProcessing(true);
                      try {
                        const urls = await Promise.all(
                          files.slice(0, 10).map(async (file) => {
                            return await compressImageFileToDataUrl(file, {
                              maxWidth: 1400,
                              maxHeight: 1400,
                              quality: 0.7,
                              outputType: "image/jpeg",
                            });
                          }),
                        );
                        const json = JSON.stringify(urls);
                        setBulkImagesJson(json);
                        try {
                          await navigator.clipboard.writeText(json);
                          toast.success("Copied image_urls_json to clipboard.");
                        } catch {
                          toast.message("Generated image_urls_json below (copy manually).");
                        }
                      } finally {
                        setBulkImagesProcessing(false);
                        if (bulkImagesRef.current) bulkImagesRef.current.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => bulkImagesRef.current?.click()}
                    disabled={bulkImagesProcessing}
                    className="gap-2"
                  >
                    {bulkImagesProcessing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      "Upload images"
                    )}
                  </Button>
                </div>
              </div>

              {bulkImagesJson ? (
                <div className="mt-3 space-y-2">
                  <Label>image_urls_json</Label>
                  <Textarea value={bulkImagesJson} readOnly rows={3} className="bg-white/70 font-mono text-xs" />
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="secondary" onClick={buildBulkPreview} className="gap-2">
                Preview rows
              </Button>
              <Button
                type="button"
                onClick={() => void importBulkRows()}
                disabled={bulkImporting || bulkRows.length === 0}
                className="gap-2"
              >
                {bulkImporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  "Import into question bank"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {bulkRows.length ? `${bulkRows.length} row(s) parsed` : "No preview yet"}
              </p>
            </div>

            {bulkError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-foreground">
                {bulkError}
              </div>
            ) : null}

            {bulkRows.length ? (
              <div className="overflow-auto rounded-xl border border-black/10 bg-white/70">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-black/10">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Topic</th>
                      <th className="px-3 py-2">Passage</th>
                      <th className="px-3 py-2">Question</th>
                      <th className="px-3 py-2">Images</th>
                      <th className="px-3 py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 200).map((r) => (
                      <tr key={r.rowNumber} className="border-b border-black/5 align-top">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.subjectId}</td>
                        <td className="px-3 py-2">{r.type}</td>
                        <td className="px-3 py-2">{r.topic}</td>
                        <td className="px-3 py-2 max-w-[260px] whitespace-pre-wrap">{r.passage ?? ""}</td>
                        <td className="px-3 py-2 max-w-[320px] whitespace-pre-wrap">
                          <RichMathText text={r.question} className="prose prose-sm max-w-none prose-p:my-0" />
                        </td>
                        <td className="px-3 py-2 max-w-[220px] whitespace-pre-wrap text-muted-foreground">
                          {r.image_urls_json ?? ""}
                        </td>
                        <td className="px-3 py-2">
                          {r.errors.length ? (
                            <div className="space-y-1">
                              {r.errors.map((e, i) => (
                                <div key={i} className="text-red-700">
                                  {e}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-700">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">Reassign subject (fix wrong imports)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              If you imported questions under the wrong <code className="rounded bg-black/10 px-1">subject_id</code>,
              use this to move them so they show up in the right Practice subject.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From subject</Label>
                <Input
                  value={reassignFrom}
                  onChange={(e) => setReassignFrom(e.target.value)}
                  placeholder='e.g. "vce_specialist_maths exam"'
                />
                <p className="text-xs text-muted-foreground">
                  This must match the imported <code className="rounded bg-black/10 px-1">subject_id</code> exactly
                  (we’ll normalize casing/spacing).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>To subject</Label>
                <Select value={reassignTo} onValueChange={(v) => setReassignTo(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Pick subject_id to move TO" />
                  </SelectTrigger>
                  <SelectContent>
                    {baseSubjects.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                onClick={() => void reassignSubject()}
                disabled={reassigning || !reassignFrom || !reassignTo}
                className="gap-2"
              >
                {reassigning ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Moving…
                  </>
                ) : (
                  "Move questions"
                )}
              </Button>
              {reassignMsg ? (
                <p className="text-sm text-muted-foreground">{reassignMsg}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Add Question Form */}
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <Plus className="size-5 text-brand" />
              Add Question
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Admin access is determined by authenticated email only. */}

            {formError && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {formError}
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={(val: string | null) => val && setSubjectId(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {baseSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {baseSubjects.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No subjects available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Question Type */}
            <div className="space-y-1.5">
              <Label>Question Type</Label>
              <Select
                value={questionType}
                onValueChange={(v) => setQuestionType(v as QuestionType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {questionType !== "mcq" && (
              <div className="space-y-1.5">
                <Label>Marks</Label>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            )}

            {/* Question Text */}
            <div className="space-y-1.5">
              <Label>Question Text</Label>
              <Textarea
                placeholder="Enter the question..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
              />
            </div>

            {/* Images (optional) */}
            <div className="space-y-1.5">
              <Label>
                Question Images{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Paste one image URL per line or drag/drop image files. Students will see it under the question.
              </p>

              {/* Drag + Drop uploader */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => imageFilesRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") imageFilesRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void appendImageDataUrls(e.dataTransfer.files);
                  }
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-white/50 px-4 py-4 text-center transition-colors hover:bg-white/70"
              >
                <span className="text-sm font-semibold text-[#0b0f19]/80">
                  {isProcessingImages ? "Processing images..." : "Drag & drop images here"}
                </span>
                <span className="text-xs text-muted-foreground">
                  or click to browse (up to 6 at a time)
                </span>
              </div>

              <input
                ref={imageFilesRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void appendImageDataUrls(e.target.files);
                    e.currentTarget.value = "";
                  }
                }}
              />

              <Textarea
                placeholder={"https://example.com/image1.png\nhttps://example.com/image2.jpg"}
                value={imageUrlsText}
                onChange={(e) => setImageUrlsText(e.target.value)}
                rows={3}
              />
              {imageUrlsText.trim() && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {imageUrlsText
                    .split("\n")
                    .map((u) => u.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((u) => (
                      <div
                        key={u}
                        className="overflow-hidden rounded-xl border border-black/10 bg-white"
                      >
                        <img
                          src={u}
                          alt="Question media"
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Passage (optional) */}
            <div className="space-y-1.5">
              <Label>
                Passage{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                placeholder="Optional reading passage for the question..."
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input
                placeholder="e.g. Calculus, Argument Analysis..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Conditional fields */}
            {questionType === "mcq" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>Options</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = e.target.value;
                          setOptions(next);
                        }}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Correct Answer</Label>
                  <Select
                    value={correctAnswer}
                    onValueChange={(val: string | null) => val && setCorrectAnswer(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt, i) => (
                        <SelectItem
                          key={i}
                          value={String.fromCharCode(65 + i)}
                          disabled={!opt.trim()}
                        >
                          {String.fromCharCode(65 + i)}
                          {opt.trim() ? `: ${opt.trim()}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {questionType === "short_answer" && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label>Accepted Answers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter one accepted answer per line
                  </p>
                  <Textarea
                    placeholder={"Answer 1\nAnswer 2\nAnswer 3"}
                    value={acceptedAnswers}
                    onChange={(e) => setAcceptedAnswers(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {questionType === "long_answer" && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label>
                    Marking Guidance{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    placeholder="Guidance for evaluating the response..."
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Accepted Answers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter one accepted answer/keyword per line
                  </p>
                  <Textarea
                    placeholder={"Answer 1\nAnswer 2\nAnswer 3"}
                    value={acceptedAnswers}
                    onChange={(e) => setAcceptedAnswers(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="gap-1.5 bg-brand text-white hover:bg-brand-dark"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add Question
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing Questions */}
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Existing Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-1.5">
              <Label>Filter by Subject</Label>
              <Select value={subjectFilter} onValueChange={(val: string | null) => val && setSubjectFilter(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {baseSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {questionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : questions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No custom questions yet. Add your first question above.
              </p>
            ) : (
              <div className="space-y-2">
                {subjectFilter === "all" ? (
                  Object.entries(groupedQuestions).map(
                    ([subjectName, subjectQuestions]) => {
                      const isExpanded = expandedSubjects.has(subjectName);

                      return (
                        <div
                          key={subjectName}
                          className="rounded-lg border border-border/50"
                        >
                          <button
                            onClick={() => toggleSubjectExpand(subjectName)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )}
                              <span className="font-display font-medium">
                                {subjectName}
                              </span>
                              <Badge variant="secondary" className="text-[11px]">
                                {subjectQuestions.length}
                              </Badge>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border/50">
                              {subjectQuestions.map((q) => (
                                <div
                                  key={q.id}
                                  className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] uppercase"
                                      >
                                        {q.type.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-foreground">
                                      {q.question}
                                    </p>
                                  </div>

                                  {q.type !== "mcq" && (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={20}
                                        className="h-9 w-24"
                                        value={marksEdits[q.id] ?? q.marks}
                                        onChange={(e) =>
                                          setMarksEdits((prev) => ({
                                            ...prev,
                                            [q.id]: Number(e.target.value),
                                          }))
                                        }
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        disabled={marksSaving === q.id}
                                        onClick={() =>
                                          handleUpdateMarks(
                                            q.id,
                                            marksEdits[q.id] ?? q.marks,
                                          )
                                        }
                                      >
                                        {marksSaving === q.id ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          "Save"
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  <AlertDialog>
                                    <AlertDialogTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className="shrink-0 text-muted-foreground hover:text-danger"
                                        />
                                      }
                                    >
                                      <Trash2 className="size-4" />
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete Question
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this
                                          question? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(q.id)}
                                          className="bg-danger text-white hover:bg-danger/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )
                ) : (
                  <div className="rounded-lg border border-border/50">
                    {filteredQuestions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No questions for this subject yet.
                      </div>
                    ) : (
                      filteredQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase"
                              >
                                {q.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground">
                              {q.question}
                            </p>
                          </div>

                          {q.type !== "mcq" && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={20}
                                className="h-9 w-24"
                                value={marksEdits[q.id] ?? q.marks}
                                onChange={(e) =>
                                  setMarksEdits((prev) => ({
                                    ...prev,
                                    [q.id]: Number(e.target.value),
                                  }))
                                }
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9"
                                disabled={marksSaving === q.id}
                                onClick={() =>
                                  handleUpdateMarks(
                                    q.id,
                                    marksEdits[q.id] ?? q.marks,
                                  )
                                }
                              >
                                {marksSaving === q.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                            </div>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-danger"
                                />
                              }
                            >
                              <Trash2 className="size-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Question
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this question?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(q.id)}
                                  className="bg-danger text-white hover:bg-danger/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
