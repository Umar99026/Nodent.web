import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS, ADMIN_EMAIL } from "@/lib/constants";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
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
  _english?: boolean;
  _book?: string;
  _section?: "A" | "B" | "C";
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

type ImageMapRow = {
  rowNumber: number;
  subjectId: string;
  questionId?: number;
  question: string;
  image_urls_json?: string;
  errors: string[];
};

type EnglishAdminPrompt = {
  id: number;
  section: "A" | "B" | "C";
  book: string;
  prompt: string;
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
  const [acceptedAnswersEdits, setAcceptedAnswersEdits] = useState<Record<string, string>>({});
  const [acceptedAnswersSaving, setAcceptedAnswersSaving] = useState<string | null>(null);
  const [autoFillingExpected, setAutoFillingExpected] = useState(false);
  const autoRepairExpectedRunRef = useRef(false);

  /* ------ Bulk import (paste table) ------ */
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkError, setBulkError] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [imageMapText, setImageMapText] = useState("");
  const [imageMapRows, setImageMapRows] = useState<ImageMapRow[]>([]);
  const [imageMapError, setImageMapError] = useState("");
  const [imageMapImporting, setImageMapImporting] = useState(false);
  const [englishBulkText, setEnglishBulkText] = useState("");
  const [englishBusy, setEnglishBusy] = useState(false);
  const [englishMsg, setEnglishMsg] = useState("");
  const [englishPreviewRows, setEnglishPreviewRows] = useState<
    Array<{ section: "A" | "B"; book: string; prompt: string }>
  >([]);
  const [englishPrompts, setEnglishPrompts] = useState<EnglishAdminPrompt[]>([]);

  const bulkImagesRef = useRef<HTMLInputElement | null>(null);
  const [bulkImagesProcessing, setBulkImagesProcessing] = useState(false);
  const [bulkImagesJson, setBulkImagesJson] = useState("");

  function formatExpectedAnswer(value: unknown): string {
    if (typeof value === "string") {
      const t = value.trim();
      if (!t || /object\s*object/i.test(t)) return "";
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          return formatExpectedAnswer(JSON.parse(t));
        } catch {
          return t;
        }
      }
      return t;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      if (typeof row.answer === "string" && row.answer.trim()) return row.answer.trim();
      if (typeof row.value === "string" && row.value.trim()) return row.value.trim();
      if (typeof row.label === "string" && row.label.trim()) return row.label.trim();
      return "";
    }
    return String(value ?? "").trim();
  }

  function normalizeExpectedAnswerList(raw: unknown): string[] | undefined {
    if (Array.isArray(raw)) {
      const arr = raw.map((x) => formatExpectedAnswer(x)).filter(Boolean);
      return arr.length ? arr : undefined;
    }
    if (typeof raw === "string") {
      const arr = parseFlexibleList(raw)?.map((x) => formatExpectedAnswer(x)).filter(Boolean);
      return arr?.length ? arr : undefined;
    }
    return undefined;
  }

  function normalizeAdminQuestion(q: any, subjectIdFallback?: string): AdminQuestion {
    const normalizedCorrect = formatExpectedAnswer(q.correctAnswer ?? q.answer);
    return {
      id: String(q.id ?? ""),
      subjectId: String(q.subjectId ?? subjectIdFallback ?? ""),
      type: (q.type as QuestionType) ?? "long_answer",
      question: String(q.question ?? ""),
      options: Array.isArray(q.options) ? q.options.map(String) : undefined,
      correctAnswer: normalizedCorrect || undefined,
      acceptedAnswers:
        normalizeExpectedAnswerList(q.acceptedAnswers) ??
        normalizeExpectedAnswerList(q.accepted_answers) ??
        normalizeExpectedAnswerList(q.accepted_answers_json),
      guidance: q.guidance ? String(q.guidance) : undefined,
      passage: q.passage ? String(q.passage) : undefined,
      marks: Number(q.marks ?? 1) || 1,
      imageUrls: Array.isArray(q.imageUrls) ? q.imageUrls.map(String) : undefined,
    };
  }

  function roundTo(value: number, dp: number): number {
    const f = 10 ** dp;
    return Math.round(value * f) / f;
  }

  function formatNumeric(value: number, dp = 2): string {
    if (!Number.isFinite(value)) return "";
    return Number.isInteger(value) ? String(value) : roundTo(value, dp).toFixed(dp);
  }

  function computeExpectedAnswersFromQuestionText(questionRaw: string): string[] {
    const question = String(questionRaw ?? "").replace(/\s+/g, " ").trim();
    if (!question) return [];

    // Least-squares linear model: price = a + (b)*distance
    const leastSquares = question.match(
      /price\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\*?\s*distance[\s\S]*?(\d+(?:\.\d+)?)\s*km[\s\S]*?sold\s*for\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
    );
    if (leastSquares) {
      const a = Number(leastSquares[1]);
      const b = Number(leastSquares[2]);
      const d = Number(leastSquares[3]);
      const sold = Number(leastSquares[4]);
      const predicted = a + b * d;
      const residual = sold - predicted;
      const modelText = residual >= 0 ? "under-predicted" : "over-predicted";
      return [
        formatNumeric(predicted, 2),
        formatNumeric(residual, 2),
        modelText,
      ];
    }

    // Weekly recurrence loan: L0=..., L(n+1)=r*L(n)-p, find effective annual rate and L52
    const weeklyLoan = question.match(
      /L\s*0\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,?\s*L\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\*?\s*L\s*\(\s*n\s*\)\s*-\s*([+-]?\d+(?:\.\d+)?)/i,
    );
    if (weeklyLoan && /effective annual rate/i.test(question) && /L\s*52/i.test(question)) {
      const L0 = Number(weeklyLoan[1]);
      const r = Number(weeklyLoan[2]);
      const p = Number(weeklyLoan[3]);
      let L = L0;
      for (let i = 0; i < 52; i++) L = r * L - p;
      const earPct = (r ** 52 - 1) * 100;
      return [formatNumeric(earPct, 2), formatNumeric(L, 2)];
    }

    // Project network critical path + crashing one critical activity by 2 days
    const paths = question.match(
      /path lengths:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i,
    );
    if (paths && /critical path length/i.test(question) && /crashed by 2 days/i.test(question)) {
      const values = [Number(paths[1]), Number(paths[2]), Number(paths[3])];
      const critical = Math.max(...values);
      const idx = values.indexOf(critical);
      const afterCrash = [...values];
      afterCrash[idx] = afterCrash[idx] - 2;
      const newDuration = Math.max(...afterCrash);
      return [formatNumeric(critical, 0), formatNumeric(newDuration, 0)];
    }

    // Reducing-balance monthly loan month-1 interest and balance after payment 1
    const reducing = question.match(
      /starting balance\s*\$?\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?annual rate\s*([+-]?\d+(?:\.\d+)?)%\s*compounding monthly[\s\S]*?monthly repayment\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
    );
    if (reducing && /month-?1 interest/i.test(question) && /new balance/i.test(question)) {
      const balance = Number(reducing[1]);
      const annualPct = Number(reducing[2]);
      const repayment = Number(reducing[3]);
      const interest = balance * (annualPct / 100 / 12);
      const newBalance = balance + interest - repayment;
      return [formatNumeric(interest, 2), formatNumeric(newBalance, 2)];
    }

    // Constant acceleration particle
    const particle = question.match(
      /initial velocity\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?acceleration\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?after\s*([+-]?\d+(?:\.\d+)?)\s*s/i,
    );
    if (particle && /displacement/i.test(question) && /reversed direction/i.test(question)) {
      const u = Number(particle[1]);
      const a = Number(particle[2]);
      const t = Number(particle[3]);
      const v = u + a * t;
      const s = u * t + 0.5 * a * t * t;
      const reversed = u !== 0 && Math.sign(u) !== Math.sign(v) ? "Yes" : "No";
      return [formatNumeric(v, 2), formatNumeric(s, 2), reversed];
    }

    // Quadratic in vertex form: g(x)=a(x-h)^2+k, find g(n) and minimum value
    const quadratic = question.match(
      /g\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\(\s*x\s*-\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\^?\s*2\s*\+\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?g\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)[\s\S]*?minimum value/i,
    );
    if (quadratic) {
      const a = Number(quadratic[1]);
      const h = Number(quadratic[2]);
      const k = Number(quadratic[3]);
      const x = Number(quadratic[4]);
      const gx = a * (x - h) ** 2 + k;
      return [formatNumeric(gx, 2), formatNumeric(k, 2)];
    }

    const quadraticStd = question.match(
      /f\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*x\s*\^?\s*2\s*([+-])\s*(\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i,
    );
    if (quadraticStd && /axis of symmetry/i.test(question) && /minimum value/i.test(question)) {
      const a = Number(quadraticStd[1]);
      const b = Number(quadraticStd[3]) * (quadraticStd[2] === "-" ? -1 : 1);
      const c = Number(quadraticStd[5]) * (quadraticStd[4] === "-" ? -1 : 1);
      if (a !== 0) {
        const xVertex = -b / (2 * a);
        const yVertex = a * xVertex * xVertex + b * xVertex + c;
        return [formatNumeric(xVertex, 2), formatNumeric(yVertex, 2), formatNumeric(xVertex, 2)];
      }
    }

    const complexReciprocal = question.match(
      /express\s*1\s*\/\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*i\s*\)\s*in\s*the\s*form\s*p\s*\+\s*q\s*i/i,
    );
    if (complexReciprocal) {
      const a = Number(complexReciprocal[1]);
      const sign = complexReciprocal[2] === "-" ? -1 : 1;
      const b = Number(complexReciprocal[3]) * sign;
      const den = a * a + b * b;
      if (den !== 0) {
        const p = a / den;
        const q = -b / den;
        const qSign = q >= 0 ? "+" : "-";
        const qAbs = Math.abs(q);
        const decimal = `${formatNumeric(p, 4)}${qSign}${formatNumeric(qAbs, 4)}i`;
        const ai = Number.isInteger(a);
        const bi = Number.isInteger(Math.abs(b));
        const di = Number.isInteger(den);
        if (ai && bi && di) {
          const exact = `${a}/${den}${b >= 0 ? "-" : "+"}${Math.abs(b)}/${den}i`;
          return [exact, decimal];
        }
        return [decimal];
      }
    }

    return [];
  }

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
        setQuestions((data ?? []).map((q) => normalizeAdminQuestion(q)));
      } else if (data && typeof data === "object" && (data as any).customQuestions) {
        const grouped = (data as any).customQuestions as Record<string, any[]>;
        const flat: AdminQuestion[] = [];
        for (const [sid, arr] of Object.entries(grouped)) {
          for (const q of arr ?? []) {
            flat.push(normalizeAdminQuestion(q, sid));
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

  const fetchEnglishPrompts = useCallback(async () => {
    try {
      const booksResp = await apiFetch<{ books: Array<{ id: number; title: string }> }>(
        `${API_PATHS.english.books}?section=A`,
      );
      const books = Array.isArray(booksResp?.books) ? booksResp.books : [];
      const aPrompts: EnglishAdminPrompt[] = [];
      for (const b of books) {
        const promptsResp = await apiFetch<{ prompts: Array<{ id: number; prompt: string }> }>(
          `${API_PATHS.english.prompts}?section=A&bookId=${encodeURIComponent(b.id)}`,
        );
        const rows = Array.isArray(promptsResp?.prompts) ? promptsResp.prompts : [];
        rows.forEach((p) =>
          aPrompts.push({
            id: Number(p.id),
            section: "A",
            book: String(b.title || ""),
            prompt: String(p.prompt || ""),
          }),
        );
      }

      const bResp = await apiFetch<{ prompts: Array<{ id: number; bookTitle: string; prompt: string }> }>(
        `${API_PATHS.english.prompts}?section=B`,
      );
      const cResp = await apiFetch<{ prompts: Array<{ id: number; bookTitle: string; prompt: string }> }>(
        `${API_PATHS.english.prompts}?section=C`,
      );
      const bPrompts: EnglishAdminPrompt[] = (bResp?.prompts ?? []).map((p) => ({
        id: Number(p.id),
        section: "B",
        book: String(p.bookTitle || ""),
        prompt: String(p.prompt || ""),
      }));
      const cPrompts: EnglishAdminPrompt[] = (cResp?.prompts ?? []).map((p) => ({
        id: Number(p.id),
        section: "C",
        book: String(p.bookTitle || ""),
        prompt: String(p.prompt || ""),
      }));

      setEnglishPrompts([...aPrompts, ...bPrompts, ...cPrompts]);
    } catch {
      setEnglishPrompts([]);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchQuestions();
      fetchEnglishPrompts();
    }
  }, [isAdmin, fetchQuestions, fetchEnglishPrompts]);

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

  const handleUpdateAcceptedAnswers = async (questionId: string, rawText: string) => {
    const acceptedAnswers = rawText
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);
    if (!acceptedAnswers.length) {
      toast.error("Add at least one allowable answer.");
      return;
    }
    try {
      setAcceptedAnswersSaving(questionId);
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "PUT",
        body: JSON.stringify({ acceptedAnswers }),
      });
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, acceptedAnswers } : q)),
      );
      toast.success("Allowable answers updated.");
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update allowable answers.");
    } finally {
      setAcceptedAnswersSaving(null);
    }
  };

  const handleAppendAllowableAnswer = (questionId: string, fallback: string) => {
    const current = acceptedAnswersEdits[questionId] ?? fallback;
    const next = current.trim() ? `${current}\n` : "";
    setAcceptedAnswersEdits((prev) => ({ ...prev, [questionId]: `${next}new answer` }));
  };

  const handleAutoFillMissingExpectedAnswers = async () => {
    setAutoFillingExpected(true);
    try {
      const result = await apiFetchAdmin<{ ok: boolean; updated?: number; unresolved?: number }>(
        `${API_PATHS.admin.questions}/autofill-answers`,
        { method: "POST" },
      );
      const updated = Number(result?.updated ?? 0);
      const unresolved = Number(result?.unresolved ?? 0);
      if (updated > 0) {
        toast.success(`Saved expected answers for ${updated} question${updated === 1 ? "" : "s"}.`);
      } else {
        toast("No questions needed updates.");
      }
      if (unresolved > 0) {
        toast.error(`${unresolved} question${unresolved === 1 ? "" : "s"} still need manual answers.`);
      }
      await fetchQuestions();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to auto-fill expected answers.");
    } finally {
      setAutoFillingExpected(false);
    }
  };

  useEffect(() => {
    if (questionsLoading || autoFillingExpected || autoRepairExpectedRunRef.current) return;
    if (!questions.length) return;
    autoRepairExpectedRunRef.current = true;
    void handleAutoFillMissingExpectedAnswers();
  }, [questionsLoading, autoFillingExpected, questions]);

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

    const stripped = t.replace(/^["'`]+|["'`]+$/g, "").trim();
    const bracketStripped =
      stripped.startsWith("[") && stripped.endsWith("]") ? stripped.slice(1, -1).trim() : stripped;
    const candidate = bracketStripped || stripped;

    if (/^data:[^,]+,[\s\S]+$/i.test(candidate)) return [candidate];

    let parts: string[] = [];
    if (candidate.includes("\n")) parts = candidate.split("\n");
    else if (candidate.includes("|")) parts = candidate.split("|");
    else if (candidate.includes(";")) parts = candidate.split(";");
    else if (candidate.includes(",")) {
      if (/^data:[^,]+,[\s\S]+$/i.test(candidate)) {
        parts = [candidate];
      } else if (/(https?:\/\/|data:image\/)/i.test(candidate)) {
        parts = candidate.split(/,(?=\s*(?:https?:\/\/|data:image\/))/i);
        if (parts.length <= 1) parts = [candidate];
      } else {
        parts = candidate.split(",");
      }
    } else {
      parts = [candidate];
    }

    const normalized = parts
      .map((s) => s.trim().replace(/^["'`]+|["'`]+$/g, ""))
      .filter(Boolean);
    return normalized.length ? normalized : null;
  }

  function getExpectedAnswersForQuestion(q: AdminQuestion): string[] {
    if (q.type === "mcq") {
      const raw = String(q.correctAnswer ?? "").trim();
      if (!raw) return [];
      if (/^[A-Za-z]$/.test(raw) && Array.isArray(q.options) && q.options.length > 0) {
        const idx = raw.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
        if (idx >= 0 && idx < q.options.length) {
          const opt = String(q.options[idx] ?? "").trim();
          return [opt ? `${raw.toUpperCase()}: ${opt}` : raw.toUpperCase()];
        }
      }
      return [raw];
    }
    const base = Array.isArray(q.acceptedAnswers)
      ? q.acceptedAnswers.map((x) => formatExpectedAnswer(x)).filter(Boolean)
      : [];
    if (base.length) return base;
    const answerFallback = formatExpectedAnswer(q.correctAnswer ?? "");
    if (answerFallback) return [answerFallback];
    const fallback = parseFlexibleList(String((q as any).acceptedAnswers ?? "")) ?? [];
    const parsedFallback = fallback.map((x) => formatExpectedAnswer(x)).filter(Boolean);
    if (parsedFallback.length) return parsedFallback;
    return computeExpectedAnswersFromQuestionText(q.question);
  }

  function getExpectedAnswersEditText(q: AdminQuestion): string {
    return getExpectedAnswersForQuestion(q).join("\n");
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
          const guidance =
            String(
              q.guidance ??
                (q as any).workedSolution ??
                (q as any).roughWorking ??
                (q as any).solutionWorking ??
                "",
            ).trim() || undefined;
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

    const sep: "\t" | "," | "|" | "2space" =
      lines[0]!.includes("\t")
        ? "\t"
        : lines[0]!.includes("|")
          ? "|"
          : lines[0]!.includes(",")
            ? ","
            : /\s{2,}/.test(lines[0]!)
              ? "2space"
              : ",";
    const splitCols = (line: string) => {
      if (sep === "2space") return line.split(/\s{2,}/).map((x) => x.trim());
      if (sep === "|") return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
      return line.split(sep).map((x) => x.trim());
    };
    const rawHeader = splitCols(lines[0]!);
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
      workedsolution: "guidance",
      roughworking: "guidance",
      solutionworking: "guidance",
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
      const cols = splitCols(lines[i]!);
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
      // Keep payloads small to avoid proxy/worker timeouts on large imports.
      const CHUNK_SIZE = 10;
      let importedTotal = 0;
      const allErrors: { index: number; message: string }[] = [];

      for (let start = 0; start < bulkRows.length; start += CHUNK_SIZE) {
        const chunk = bulkRows.slice(start, start + CHUNK_SIZE);
        const payload = {
          questions: chunk.map((r) => ({
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

        try {
          const res = await apiFetchAdmin<{
            ok: boolean;
            imported: number;
            errors?: { index: number; message: string }[];
          }>(API_PATHS.admin.questionsBulk, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          importedTotal += Number(res?.imported ?? 0);
          if (Array.isArray(res?.errors) && res.errors.length) {
            // Re-map per-chunk index to original row index for clearer error messages.
            allErrors.push(
              ...res.errors.map((e) => ({
                index: start + e.index,
                message: e.message,
              })),
            );
          }
        } catch {
          // Local Node API doesn't expose /questions/bulk.
          // Fallback to one-by-one inserts via /questions so imports still work locally.
          for (let i = 0; i < chunk.length; i++) {
            const row = chunk[i]!;
            try {
              const options = parseFlexibleList(row.options_json ?? "");
              const acceptedAnswers = parseFlexibleList(row.accepted_answers_json ?? "");
              const imageUrls = parseFlexibleList(row.image_urls_json ?? "");

              await apiFetchAdmin(API_PATHS.admin.questions, {
                method: "POST",
                body: JSON.stringify({
                  subjectId: row.subjectId,
                  type: row.type,
                  topic: row.topic,
                  passage: row.passage,
                  question: row.question,
                  options: options ?? undefined,
                  answer: row.answer,
                  acceptedAnswers: acceptedAnswers ?? undefined,
                  marks: row.marks,
                  guidance: row.guidance,
                  imageUrls: imageUrls ?? undefined,
                }),
              });
              importedTotal++;
            } catch (e) {
              const msg = e instanceof ApiError ? e.message : "Row import failed.";
              allErrors.push({ index: start + i, message: msg });
            }
          }
        }
      }

      if (allErrors.length) {
        setBulkError(
          `Imported ${importedTotal}. Some rows failed: ` +
            allErrors
              .slice(0, 8)
              .map((e) => `#${e.index + 1} ${e.message}`)
              .join("; "),
        );
        toast.error("Imported with errors. See details below.");
      } else {
        toast.success(`Imported ${importedTotal} questions.`);
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

  const buildImageMapPreview = () => {
    setImageMapError("");
    // Be forgiving with AI output:
    // - convert literal "\t" sequences into real tabs
    // - keep CSV fallback (commas) if user didn't get true TSV
    const text = imageMapText.replace(/\r\n/g, "\n").replace(/\\t/g, "\t").trim();
    if (!text) {
      setImageMapRows([]);
      return;
    }

    const rawLines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => !/^```/.test(l)); // ignore markdown code fences
    // ignore markdown table separator rows like: |---|---|---|
    const lines = rawLines.filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(l));
    if (lines.length < 2) {
      setImageMapError("Paste a header + at least one data row.");
      setImageMapRows([]);
      return;
    }

    const detectSep = (line: string) =>
      line.includes("\t")
        ? "\t"
        : line.includes("|")
          ? "|"
          : line.includes(";")
            ? ";"
            : ",";
    let sep: "\t" | "|" | ";" | "," = detectSep(lines[0]!) as "\t" | "|" | ";" | ",";
    const parseLine = (line: string): string[] => {
      // TSV path: tabs are safest and avoid image data URL comma issues.
      if (sep === "\t") return line.split("\t");
      if (sep === "|") {
        const t = line.trim().replace(/^\|/, "").replace(/\|$/, "");
        return t.split("|").map((c) => c.trim());
      }

      // CSV fallback with quote handling; keeps commas inside quoted values.
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
          continue;
        }
        if (!inQuotes && ch === sep) {
          out.push(cur);
          cur = "";
          continue;
        }
        cur += ch;
      }
      out.push(cur);
      return out;
    };

    const norm = (h: string) =>
      h
        .trim()
        .replace(/^\uFEFF/, "") // BOM
        .replace(/^["'`]+|["'`]+$/g, "") // wrapping quotes/backticks
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/-/g, "_");
    const HEADER_ALIASES: Record<string, string> = {
      subject: "subject_id",
      subjectid: "subject_id",
      subject_id: "subject_id",
      question: "question",
      q: "question",
      stem: "question",
      prompt: "question",
      imageurls: "image_urls_json",
      image_urls: "image_urls_json",
      imageurlsjson: "image_urls_json",
      image_urls_json: "image_urls_json",
      images: "image_urls_json",
      image: "image_urls_json",
    };
    const canonicalize = (h: string) => {
      const n = norm(h);
      return HEADER_ALIASES[n] ?? n;
    };
    const hasRequiredHeader = (cells: string[]) => {
      const mapped = new Set(cells.map(canonicalize));
      return mapped.has("subject_id") && mapped.has("question") && mapped.has("image_urls_json");
    };
    // Find header row in first few lines (GPT often prepends prose).
    let headerLineIndex = 0;
    let rawHeader: string[] = [];
    for (let i = 0; i < Math.min(lines.length, 16); i++) {
      const trySep = detectSep(lines[i]!) as "\t" | "|" | ";" | ",";
      const prevSep = sep;
      sep = trySep;
      const cells = parseLine(lines[i]!).map((h) => h.trim());
      if (hasRequiredHeader(cells)) {
        headerLineIndex = i;
        rawHeader = cells;
        break;
      }
      sep = prevSep;
    }
    if (!rawHeader.length) {
      rawHeader = parseLine(lines[0]!).map((h) => h.trim());
      headerLineIndex = 0;
    }
    const header = rawHeader.map(norm);
    const idx = (canonicalOrAlias: string) => {
      const key = norm(canonicalOrAlias);
      const canonical = HEADER_ALIASES[key] ?? key;
      for (let i = 0; i < header.length; i++) {
        const mapped = HEADER_ALIASES[header[i]!] ?? header[i]!;
        if (mapped === canonical) return i;
      }
      return -1;
    };

    let subjectIdx = Math.max(idx("subject_id"), idx("subjectId"), idx("subject"));
    const questionIdIdx = Math.max(
      idx("question_id"),
      idx("questionId"),
      idx("id"),
      idx("database_id"),
    );
    let questionIdx = Math.max(idx("question"), idx("prompt"), idx("stem"));
    let imageIdx = Math.max(idx("image_urls_json"), idx("image_urls"), idx("imageUrls"));

    const missing: string[] = [];
    if (subjectIdx < 0 && questionIdIdx < 0) missing.push("subject_id or question_id");
    if (questionIdx < 0 && questionIdIdx < 0) missing.push("question or question_id");
    if (imageIdx < 0) missing.push("image_urls_json");
    if (missing.length) {
      // Last-resort compatibility mode:
      // many AI outputs include noisy/annotated headers, but data rows are still 3-column
      // in order: subject_id, question, image_urls_json.
      let fallbackOk = false;
      for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const cols = parseLine(lines[i]!);
        if (cols.length >= 3) {
          fallbackOk = true;
          break;
        }
      }
      if (!fallbackOk) {
        setImageMapError(
          `Missing required columns: ${missing.join(", ")}. Header must include subject_id, question, image_urls_json.`,
        );
        setImageMapRows([]);
        return;
      }
      subjectIdx = 0;
      questionIdx = 1;
      imageIdx = 2;
      setImageMapError(
        "Header row was non-standard, so parser used compatibility mode: column 1=subject_id, 2=question, 3=image_urls_json.",
      );
    }

    const out: ImageMapRow[] = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
      let cols = parseLine(lines[i]!);
      // CSV fallback rescue: if image column is last and unquoted JSON contains commas,
      // join extra tokens back into the final image_urls_json field.
      if ((sep === "," || sep === ";") && imageIdx >= 0 && cols.length > rawHeader.length) {
        cols = [...cols.slice(0, imageIdx), cols.slice(imageIdx).join(sep)];
      }
      const subjectId = String(cols[subjectIdx] ?? "").trim();
      const rawQid = String(cols[questionIdIdx] ?? "").trim();
      const questionId = Number(rawQid);
      const question = String(cols[questionIdx] ?? "").trim();
      const image_urls_json = String(cols[imageIdx] ?? "").trim();
      const errors: string[] = [];

      if (!Number.isFinite(questionId) || questionId <= 0) {
        if (!subjectId) errors.push("subject_id is required (or provide question_id).");
        if (!question) errors.push("question is required (or provide question_id).");
      }
      const imgs = parseFlexibleList(image_urls_json);
      if (!imgs || imgs.length === 0) {
        errors.push("image_urls_json must be a JSON array or list with 1+ image values.");
      }

      out.push({
        rowNumber: i + 1,
        subjectId,
        questionId: Number.isFinite(questionId) && questionId > 0 ? questionId : undefined,
        question,
        image_urls_json,
        errors,
      });
    }
    setImageMapRows(out);
    // Parsed successfully; do not surface compatibility mode as an error.
  };

  const importImageMapRows = async () => {
    setImageMapError("");
    if (!imageMapRows.length) {
      toast.error("Nothing to import.");
      return;
    }
    const bad = imageMapRows.filter((r) => r.errors.length > 0);
    if (bad.length) {
      toast.error(`Fix ${bad.length} row(s) with errors before attaching images.`);
      return;
    }

    setImageMapImporting(true);
    try {
      const CHUNK_SIZE = 10;
      let updatedTotal = 0;
      const allErrors: { index: number; message: string }[] = [];

      for (let start = 0; start < imageMapRows.length; start += CHUNK_SIZE) {
        const chunk = imageMapRows.slice(start, start + CHUNK_SIZE);
        const payload = {
          mappings: chunk.map((r) => ({
            subjectId: r.subjectId,
            questionId: r.questionId,
            question: r.question,
            image_urls_json: r.image_urls_json,
          })),
        };

        const res = await apiFetchAdmin<{
          ok: boolean;
          updated: number;
          errors?: { index: number; message: string }[];
        }>(API_PATHS.admin.questionsAttachImagesBulk, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        updatedTotal += Number(res?.updated ?? 0);
        if (Array.isArray(res?.errors) && res.errors.length) {
          allErrors.push(
            ...res.errors.map((e) => ({
              index: start + e.index,
              message: e.message,
            })),
          );
        }
      }

      if (allErrors.length) {
        setImageMapError(
          `Attached ${updatedTotal}. Some rows failed: ` +
            allErrors
              .slice(0, 8)
              .map((e) => `#${e.index + 1} ${e.message}`)
              .join("; "),
        );
        toast.error("Image mapping imported with errors.");
      } else {
        toast.success(`Attached images to ${updatedTotal} question(s).`);
      }

      setImageMapText("");
      setImageMapRows([]);
      await fetchQuestions();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Image mapping import failed.";
      setImageMapError(msg);
      toast.error(msg);
    } finally {
      setImageMapImporting(false);
    }
  };

  const parseEnglishRows = () => {
    const normalizedInput = englishBulkText
      .replace(/\r\n/g, "\n")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");

    const lines = normalizedInput
      .split("\n")
      .map((l) => l.replace(/\uFEFF/g, "").trim())
      .filter(Boolean);
    if (lines.length < 2) {
      return {
        rows: [] as Array<{ section: "A" | "B"; book: string; prompt: string }>,
        message: "Paste a header + at least one prompt row.",
      };
    }

    const isHeader = /^section\s*(?:\t|[ ,|]+)\s*book\s*(?:\t|[ ,|]+)\s*prompt$/i.test(lines[0]!);
    const dataLines = lines.slice(isHeader ? 1 : 0);
    const rows: Array<{ section: "A" | "B"; book: string; prompt: string }> = [];
    const badRows: number[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const raw = dataLines[i]!;

      // Exact requested behavior:
      // A <book name> ## <prompt>
      // B <prompt>
      const aMatch = raw.match(/^\s*A\s+(.+?)\s*##\s*(.+)\s*$/i);
      if (aMatch) {
        const book = (aMatch[1] ?? "").trim();
        const prompt = (aMatch[2] ?? "").trim();
        if (!book || !prompt) {
          badRows.push((isHeader ? 2 : 1) + i);
          continue;
        }
        rows.push({ section: "A", book, prompt });
        continue;
      }

      const bMatch = raw.match(/^\s*B\s+(.+)\s*$/i);
      if (bMatch) {
        const prompt = (bMatch[1] ?? "").trim();
        if (!prompt) {
          badRows.push((isHeader ? 2 : 1) + i);
          continue;
        }
        rows.push({ section: "B", book: "", prompt });
        continue;
      }

      // Also allow strict TSV row if user provides it.
      const parts = raw.split("\t");
      if (parts.length === 3) {
        const section = (parts[0] ?? "").trim().toUpperCase();
        const book = (parts[1] ?? "").replace(/\s*##\s*$/g, "").trim();
        const prompt = (parts[2] ?? "").trim();
        if (section === "A" && book && prompt) {
          rows.push({ section: "A", book, prompt });
          continue;
        }
        if (section === "B" && prompt) {
          rows.push({ section: "B", book: "", prompt });
          continue;
        }
      }

      badRows.push((isHeader ? 2 : 1) + i);
    }

    if (badRows.length) {
      return {
        rows,
        message: `Preview: ${rows.length} valid row(s), ${badRows.length} invalid row(s). Invalid line(s): ${badRows
          .slice(0, 8)
          .join(", ")}`,
      };
    }
    return { rows, message: `Preview: ${rows.length} valid row(s).` };
  };

  const previewEnglishPrompts = () => {
    const parsed = parseEnglishRows();
    setEnglishPreviewRows(parsed.rows);
    setEnglishMsg(parsed.message);
  };

  const importEnglishPrompts = async () => {
    setEnglishMsg("");
    if (!englishPreviewRows.length) {
      setEnglishMsg("Preview first, then click Confirm import.");
      return;
    }

    setEnglishBusy(true);
    try {
      const res = await apiFetchAdmin<{ importedBooks: number; importedPrompts: number; errors?: any[] }>(
        API_PATHS.admin.englishPromptsBulk,
        {
          method: "POST",
          body: JSON.stringify({ rows: englishPreviewRows }),
        },
      );
      const e = Array.isArray(res.errors) ? res.errors.length : 0;
      const sampleErrors =
        Array.isArray(res.errors) && res.errors.length
          ? res.errors
              .slice(0, 3)
              .map((x) => String(x?.message ?? "Unknown row error"))
              .join(" | ")
          : "";
      setEnglishMsg(
        `Imported prompts: ${res.importedPrompts ?? 0} (books in bank: ${res.importedBooks ?? 0})${
          e ? ` • ${e} row(s) skipped` : ""
        }${sampleErrors ? ` • sample: ${sampleErrors}` : ""}`,
      );
      if (!e) {
        setEnglishBulkText("");
        setEnglishPreviewRows([]);
      }
      await fetchEnglishPrompts();
      toast.success("English prompts updated.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to import English prompts.";
      setEnglishMsg(msg);
      toast.error(msg);
    } finally {
      setEnglishBusy(false);
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
      <AppShell
        title="Admin Panel"
        subtitle="Manage custom questions"
        edgeToEdgeHeader
      >
        <div className="max-w-none space-y-6">
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
    <AppShell
      title="Admin Panel"
      subtitle="Manage custom questions"
      edgeToEdgeHeader
    >
      <div className="max-w-none space-y-8">
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">English books & prompts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create English prompt banks by book. Students pick a book in Practice, then write
              responses and peer-rate out of 10 in the shared viewing space.
            </p>
            <Textarea
              value={englishBulkText}
              onChange={(e) => {
                setEnglishBulkText(e.target.value);
                setEnglishMsg("");
                setEnglishPreviewRows([]);
              }}
              rows={8}
              className="bg-white/60"
              placeholder={`section\tbook\tprompt
A\tThe Women of Troy\tHow does Euripides show power and helplessness in The Women of Troy?
A\tRansom\tHow does Malouf explore grief and healing in Ransom?
B\t\tWrite a creative piece that reimagines a moment of moral conflict from a modern perspective.`}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="secondary" onClick={previewEnglishPrompts} className="gap-2" disabled={englishBusy}>
                Preview import
              </Button>
              <Button type="button" onClick={() => void importEnglishPrompts()} className="gap-2" disabled={englishBusy || englishPreviewRows.length === 0}>
                {englishBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                Confirm import
              </Button>
              {englishMsg ? <p className="text-sm text-muted-foreground">{englishMsg}</p> : null}
            </div>

            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Current English prompt bank</p>
              {!englishPrompts.length ? (
                <p className="text-sm text-muted-foreground">No English prompts yet.</p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-lg border border-border/50 bg-white/60">
                  {englishPrompts.map((r) => (
                    <div
                      key={`english-bank-${r.id}`}
                      className="border-b border-border/30 px-3 py-2 last:border-b-0"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase">
                          Section {r.section}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px]">
                          {r.book || "English Prompt Bank"}
                        </Badge>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground">{r.prompt}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                          <RichQuestionContent text={r.question} className="prose prose-sm max-w-none prose-p:my-0" />
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
            <CardTitle className="font-display text-lg">Bulk image mapping (attach to existing questions)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use this after text import. Paste TSV with{" "}
              <code className="rounded bg-black/10 px-1">subject_id</code>,{" "}
              <code className="rounded bg-black/10 px-1">question</code>,{" "}
              <code className="rounded bg-black/10 px-1">image_urls_json</code>. We match by exact
              subject + question text and attach images in bulk.
            </p>

            <Textarea
              value={imageMapText}
              onChange={(e) => setImageMapText(e.target.value)}
              rows={6}
              className="bg-white/60"
              placeholder={`subject_id\tquestion\timage_urls_json
methods\tThe median bag size bought by customers on the day was\t["data:image/jpeg;base64,..."]
methods\tThe total number of avocados sold in bags was\t["data:image/jpeg;base64,..."]`}
            />

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="button" variant="secondary" onClick={buildImageMapPreview} className="gap-2">
                Preview mappings
              </Button>
              <Button
                type="button"
                onClick={() => void importImageMapRows()}
                disabled={imageMapImporting || imageMapRows.length === 0}
                className="gap-2"
              >
                {imageMapImporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Attaching…
                  </>
                ) : (
                  "Attach images to matched questions"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                {imageMapRows.length ? `${imageMapRows.length} row(s) parsed` : "No preview yet"}
              </p>
            </div>

            {imageMapError ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-2 text-sm text-foreground">
                {imageMapError}
              </div>
            ) : null}

            {imageMapRows.length ? (
              <div className="overflow-auto rounded-xl border border-black/10 bg-white/70">
                <table className="w-full min-w-[860px] text-left text-xs">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-black/10">
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2">Question</th>
                      <th className="px-3 py-2">Images</th>
                      <th className="px-3 py-2">Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageMapRows.slice(0, 200).map((r) => (
                      <tr key={r.rowNumber} className="border-b border-black/5 align-top">
                        <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-3 py-2">{r.subjectId}</td>
                        <td className="px-3 py-2 max-w-[380px] whitespace-pre-wrap">{r.question}</td>
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
              <div className="flex items-center justify-between gap-2">
                <Label>Filter by Subject</Label>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="gap-2"
                  disabled={autoFillingExpected}
                  onClick={() => void handleAutoFillMissingExpectedAnswers()}
                >
                  {autoFillingExpected ? <Loader2 className="size-4 animate-spin" /> : null}
                  Auto-fill missing expected answers
                </Button>
              </div>
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
                  [
                    ...Object.entries(groupedQuestions),
                    ...(englishPrompts.length
                      ? [
                          [
                            "English",
                            englishPrompts.map((p) => ({
                              id: `english-${p.id}`,
                              type: "long_answer",
                              question: p.prompt,
                              marks: 0,
                              _english: true,
                              _book: p.book,
                              _section: p.section,
                            })),
                          ] as [string, any[]],
                        ]
                      : []),
                  ].map(
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
                                        {q._english ? `Section ${q._section}` : q.type.replace("_", " ")}
                                      </Badge>
                                      {q._english ? (
                                        <Badge variant="secondary" className="text-[11px]">
                                          {q._book || "Section B Creative"}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <p className={q._english ? "text-base font-semibold leading-relaxed text-foreground whitespace-pre-wrap" : "text-sm text-foreground"}>
                                      {q.question}
                                    </p>
                                    {!q._english && q.type !== "mcq" ? (
                                      <div className="mt-2 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label className="text-xs text-muted-foreground">Expected answers</Label>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-2 text-xs"
                                            onClick={() =>
                                              handleAppendAllowableAnswer(
                                                q.id,
                                                getExpectedAnswersEditText(q),
                                              )
                                            }
                                          >
                                            + Add answer
                                          </Button>
                                        </div>
                                        <Textarea
                                          rows={3}
                                          className="bg-white/70 text-xs"
                                          value={
                                            acceptedAnswersEdits[q.id] ??
                                            getExpectedAnswersEditText(q)
                                          }
                                          onChange={(e) =>
                                            setAcceptedAnswersEdits((prev) => ({
                                              ...prev,
                                              [q.id]: e.target.value,
                                            }))
                                          }
                                        />
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8"
                                          disabled={acceptedAnswersSaving === q.id}
                                          onClick={() =>
                                            handleUpdateAcceptedAnswers(
                                              q.id,
                                              acceptedAnswersEdits[q.id] ??
                                                getExpectedAnswersEditText(q),
                                            )
                                          }
                                        >
                                          {acceptedAnswersSaving === q.id ? (
                                            <Loader2 className="size-4 animate-spin" />
                                          ) : (
                                            "Save expected answers"
                                          )}
                                        </Button>
                                      </div>
                                    ) : null}
                                    {!q._english && q.type === "mcq" ? (
                                      <div className="mt-2 rounded-lg border border-black/10 bg-white/60 px-2.5 py-2">
                                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          Expected answer
                                        </p>
                                        {getExpectedAnswersForQuestion(q).length ? (
                                          <div className="space-y-0.5">
                                            {getExpectedAnswersForQuestion(q).map((ans, i) => (
                                              <p key={`${q.id}-exp-${i}`} className="text-xs text-foreground">
                                                {ans}
                                              </p>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-xs font-medium text-danger">Missing expected answer</p>
                                        )}
                                      </div>
                                    ) : null}
                                  </div>

                                  {!q._english && q.type !== "mcq" && (
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

                                  {!q._english ? (
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
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )
                ) : subjectFilter === "english" ? (
                  <div className="rounded-lg border border-border/50">
                    {!englishPrompts.length ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No English prompts yet.
                      </div>
                    ) : (
                      englishPrompts.map((r) => (
                        <div
                          key={`english-${r.id}`}
                          className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-2 flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase">
                                Section {r.section}
                              </Badge>
                              <Badge variant="secondary" className="text-[11px]">
                                {r.book || "Section B Creative"}
                              </Badge>
                            </div>
                            <p className="text-base font-semibold leading-relaxed text-foreground whitespace-pre-wrap">
                              {r.prompt}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
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
                            {q.type !== "mcq" ? (
                              <div className="mt-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">Expected answers</Label>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={() =>
                                      handleAppendAllowableAnswer(
                                        q.id,
                                        getExpectedAnswersEditText(q),
                                      )
                                    }
                                  >
                                    + Add answer
                                  </Button>
                                </div>
                                <Textarea
                                  rows={3}
                                  className="bg-white/70 text-xs"
                                  value={
                                    acceptedAnswersEdits[q.id] ??
                                    getExpectedAnswersEditText(q)
                                  }
                                  onChange={(e) =>
                                    setAcceptedAnswersEdits((prev) => ({
                                      ...prev,
                                      [q.id]: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={acceptedAnswersSaving === q.id}
                                  onClick={() =>
                                    handleUpdateAcceptedAnswers(
                                      q.id,
                                      acceptedAnswersEdits[q.id] ??
                                        getExpectedAnswersEditText(q),
                                    )
                                  }
                                >
                                  {acceptedAnswersSaving === q.id ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    "Save expected answers"
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="mt-2 rounded-lg border border-black/10 bg-white/60 px-2.5 py-2">
                                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Expected answer
                                </p>
                                {getExpectedAnswersForQuestion(q).length ? (
                                  <div className="space-y-0.5">
                                    {getExpectedAnswersForQuestion(q).map((ans, i) => (
                                      <p key={`${q.id}-exp-flat-${i}`} className="text-xs text-foreground">
                                        {ans}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs font-medium text-danger">Missing expected answer</p>
                                )}
                              </div>
                            )}
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
