import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch, apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS, ADMIN_EMAIL } from "@/lib/constants";
import { saveAdminQuestion, refreshQuestionBankAfterSave, patchCachedQuestionAfterAdminSave, type AdminQuestionSaveDraft } from "@/lib/adminQuestionSave";
import { refreshCustomQuestionsCache } from "@/lib/questionBankCache";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import {
  bankCorrectionNeedsApply,
  matchAdminBankCorrection,
} from "@/lib/adminBankCorrections";
import { repairAdminQuestionStem } from "@/lib/adminStemRepairs";
import { inferUseAiMarkingForImport } from "@/lib/questionAiMarking";
import {
  getAllBuiltinSeedRows,
  questionStemKey,
} from "@/lib/builtinQuestionsSeed";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { AppShell } from "@/components/layout/AppShell";
import { Button, buttonVariants } from "@/components/ui/button";
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
  ArrowRightLeft,
  RefreshCw,
  UserPlus,
} from "lucide-react";

import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import { GOOGLE_SHEETS_TOPIC_LABELS, topicTaxonomySubjectId } from "@/lib/mathSubjectTopics";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { PdfQuestionImportPanel } from "@/components/admin/PdfQuestionImportPanel";
import { AdminPracticeExamPanel } from "@/components/admin/AdminPracticeExamPanel";
import { AdminPromptingPanel } from "@/components/admin/AdminPromptingPanel";
import { AdminFeedbackPanel } from "@/components/admin/AdminFeedbackPanel";
import { AdminQuestionImageEditor } from "@/components/admin/AdminQuestionImageEditor";
import {
  MultipartAnswerPartsEditor,
  buildAnswerPartsPayload,
  emptyMultipartParts,
  mergePartsWithAcceptedAnswers,
  type MultipartPartDraft,
} from "@/components/admin/MultipartAnswerPartsEditor";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuestionType = "mcq" | "short_answer" | "long_answer";

type AdminAnswerPart = {
  key: string;
  label: string;
  placeholder?: string;
  marks?: number;
  imageUrl?: string;
};

interface AdminQuestion {
  id: string;
  subjectId: string;
  subjectName?: string;
  type: QuestionType;
  topic?: string;
  question: string;
  imageUrls?: string[];
  options?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
  answerParts?: AdminAnswerPart[];
  guidance?: string;
  passage?: string;
  marks: number;
  _english?: boolean;
  _book?: string;
  _section?: "A" | "B" | "C";
}

function adminSubjectDisplayName(
  subjectId: string,
  subjects: { id: string; name: string }[],
): string {
  const sid = canonicalSubjectId(subjectId);
  return subjects.find((s) => s.id === sid)?.name ?? sid;
}

function adminTopicOptionsForSubject(subjectId: string): string[] {
  const key = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  return [...(GOOGLE_SHEETS_TOPIC_LABELS[key] ?? [])];
}

function parseAdminAnswerParts(val: unknown): AdminAnswerPart[] | undefined {
  if (!Array.isArray(val)) return undefined;
  const parts = val
    .map((it, idx) => {
      if (!it || typeof it !== "object") return null;
      const row = it as Record<string, unknown>;
      const label = String(row.label ?? "").trim();
      if (!label) return null;
      const marksRaw = Number(row.marks);
      return {
        key: String(row.key ?? `part${idx + 1}`).trim() || `part${idx + 1}`,
        label,
        placeholder: String(row.placeholder ?? "").trim() || undefined,
        marks:
          Number.isFinite(marksRaw) && marksRaw > 0 ? Math.round(marksRaw) : undefined,
        imageUrl: String(row.imageUrl ?? row.image_url ?? "").trim() || undefined,
      };
    })
    .filter((p) => p != null) as AdminAnswerPart[];
  return parts.length ? parts : undefined;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

type EnglishAdminPrompt = {
  id: number;
  section: "A" | "B" | "C";
  book: string;
  prompt: string;
};

type AdminRecentUser = {
  id: number;
  username: string;
  email: string;
  createdAt: string;
};

function formatSignupWhen(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return createdAt || "â€”";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdminEmail = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const isAdmin = isAdminEmail;
  const visibleSubjects = useMemo(() => subjectsForUser({ isAdmin }), [isAdmin]);

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
  const [marks, setMarks] = useState<number>(1);

  // MCQ
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Short answer
  const [acceptedAnswers, setAcceptedAnswers] = useState("");

  // Long answer
  const [guidance, setGuidance] = useState("");
  const [multipartEnabled, setMultipartEnabled] = useState(false);
  const [answerParts, setAnswerParts] = useState<MultipartPartDraft[]>(() =>
    emptyMultipartParts(2),
  );
  const [uploadingPartIndex, setUploadingPartIndex] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Default marks based on question type.
  useEffect(() => {
    setMarks(questionType === "mcq" ? 1 : 2);
  }, [questionType]);

  useEffect(() => {
    if (subjectId) return;
    if (import.meta.env.DEV && visibleSubjects.some((s) => s.id === "demo")) {
      setSubjectId("demo");
    }
  }, [subjectId, visibleSubjects]);

  /* ------ existing questions state ------ */
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [marksEdits, setMarksEdits] = useState<Record<string, number>>({});
  const [marksSaving, setMarksSaving] = useState<string | null>(null);
  const [acceptedAnswersEdits, setAcceptedAnswersEdits] = useState<Record<string, string>>({});
  const [acceptedAnswersSaving, setAcceptedAnswersSaving] = useState<string | null>(null);
  const [autoFillingExpected, setAutoFillingExpected] = useState(false);
  const [retaggingMethodsTopics, setRetaggingMethodsTopics] = useState(false);
  const autoRepairExpectedRunRef = useRef(false);

  const [englishBulkText, setEnglishBulkText] = useState("");
  const [englishBusy, setEnglishBusy] = useState(false);
  const [englishMsg, setEnglishMsg] = useState("");
  const [englishPreviewRows, setEnglishPreviewRows] = useState<
    Array<{ section: "A" | "B" | "C"; book: string; prompt: string }>
  >([]);
  const [englishPrompts, setEnglishPrompts] = useState<EnglishAdminPrompt[]>([]);

  const [recentUsers, setRecentUsers] = useState<AdminRecentUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [recentUsersLoading, setRecentUsersLoading] = useState(true);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedEnglishPromptIds, setSelectedEnglishPromptIds] = useState<
    Set<number>
  >(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkMoveSubjectId, setBulkMoveSubjectId] = useState("");
  const [bulkMoving, setBulkMoving] = useState(false);
  const [builtinSyncing, setBuiltinSyncing] = useState(false);
  const builtinSyncStartedRef = useRef(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<AdminQuestion>>({});
  const [editSaving, setEditSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const handledEditLinkRef = useRef<string | null>(null);

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
      subjectId: canonicalSubjectId(String(q.subjectId ?? subjectIdFallback ?? "")),
      subjectName: adminSubjectDisplayName(
        String(q.subjectId ?? subjectIdFallback ?? ""),
        visibleSubjects,
      ),
      type: (q.type as QuestionType) ?? "long_answer",
      topic: String(q.topic ?? "General"),
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
      answerParts:
        parseAdminAnswerParts(q.answerParts) ??
        parseAdminAnswerParts(q.answer_parts) ??
        parseAdminAnswerParts(q.answer_parts_json),
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

  const fetchQuestions = useCallback(async (): Promise<AdminQuestion[] | null> => {
    try {
      setQuestionsLoading(true);
      const data = await apiFetchAdmin<
        | AdminQuestion[]
        | {
            customQuestions: Record<string, any[]>;
          }
      >(API_PATHS.admin.questions);

      let flat: AdminQuestion[] = [];
      if (Array.isArray(data)) {
        flat = (data ?? []).map((q) => normalizeAdminQuestion(q));
      } else if (data && typeof data === "object" && (data as any).customQuestions) {
        const grouped = (data as any).customQuestions as Record<string, any[]>;
        for (const [sid, arr] of Object.entries(grouped)) {
          for (const q of arr ?? []) {
            flat.push(normalizeAdminQuestion(q, sid));
          }
        }
      }
      setQuestions(flat);
      return flat;
    } catch {
      setQuestions([]);
      return null;
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  /** After admin writes, sync global bank to DB-backed cache used by Practice / Quiz. */
  const publishQuestionBank = useCallback(async () => {
    await fetchQuestions();
    try {
      await refreshCustomQuestionsCache();
    } catch {
      /* admin session edge case â€” list still refreshed */
    }
  }, [fetchQuestions]);

  /** Normalize mangled question stems in the DB (labels, OCR, broken LaTeX). */
  const applyStemRepairs = useCallback(async (current: AdminQuestion[]) => {
    let changed = 0;
    for (const q of current) {
      const repaired = repairAdminQuestionStem(q.question);
      if (!repaired || repaired === String(q.question ?? "").trim()) continue;
      const id = Number(q.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const body: Record<string, unknown> = {
        subjectId: canonicalSubjectId(q.subjectId),
        type: q.type,
        topic: q.topic,
        question: repaired,
        passage: q.passage || null,
        marks: q.marks,
        guidance: q.guidance || null,
        imageUrls: q.imageUrls,
      };
      if (q.type === "mcq") {
        body.options = q.options;
        body.correctAnswer = q.correctAnswer;
      } else {
        body.acceptedAnswers = q.acceptedAnswers;
      }
      try {
        await apiFetchAdmin(`${API_PATHS.admin.questions}/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        changed++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) continue;
      }
    }
    if (changed > 0) {
      toast.success(`Repaired ${changed} question stem(s) in the bank.`);
    }
  }, []);

  /** Reconcile known mis-assignments in the DB (admin-maintained correction list). */
  const applyBankCorrections = useCallback(async (current: AdminQuestion[]) => {
    let changed = 0;
    for (const q of current) {
      const fix = matchAdminBankCorrection(q.question);
      if (!fix || !bankCorrectionNeedsApply(q, fix)) continue;
      const id = Number(q.id);
      if (!Number.isFinite(id) || id <= 0) continue;

      const body: Record<string, unknown> = {
        subjectId: canonicalSubjectId(fix.subjectId),
        type: q.type,
        topic: fix.topic ?? q.topic,
        question: q.question,
        passage: q.passage || null,
        marks: q.marks,
        guidance: q.guidance || null,
        imageUrls: q.imageUrls,
      };
      if (q.type === "mcq") {
        body.options = q.options;
        body.correctAnswer = q.correctAnswer;
      } else {
        body.acceptedAnswers = q.acceptedAnswers;
      }
      try {
        await apiFetchAdmin(`${API_PATHS.admin.questions}/${id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        changed++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) continue;
      }
    }
    if (changed > 0) {
      toast.success(`Reconciled ${changed} question assignment(s) in the bank.`);
    }
  }, []);

  /** One-time sync: legacy built-in TS banks â†’ `custom_questions` so admin is the only source. */
  const syncBuiltinsToDatabase = useCallback(async () => {
    if (builtinSyncStartedRef.current) return;
    builtinSyncStartedRef.current = true;
    setBuiltinSyncing(true);
    try {
      const seedRows = getAllBuiltinSeedRows();
      const data = await apiFetchAdmin<AdminQuestion[] | { customQuestions?: Record<string, unknown[]> }>(
        API_PATHS.admin.questions,
      );
      let current: AdminQuestion[] = [];
      if (Array.isArray(data)) {
        current = data.map((q) => normalizeAdminQuestion(q));
      } else if (data && typeof data === "object" && (data as { customQuestions?: Record<string, unknown[]> }).customQuestions) {
        const grouped = (data as { customQuestions: Record<string, unknown[]> }).customQuestions;
        for (const [sid, arr] of Object.entries(grouped)) {
          for (const q of arr ?? []) {
            current.push(normalizeAdminQuestion(q, sid));
          }
        }
      }
      const stemSet = new Set(
        current
          .map((q) => {
            const sid = canonicalSubjectId(q.subjectId);
            const stem = questionStemKey(q.question);
            return stem ? `${sid}::${stem}` : "";
          })
          .filter(Boolean),
      );
      const missing = seedRows.filter((r) => {
        const sid = canonicalSubjectId(String(r.subjectId ?? ""));
        const stem = questionStemKey(String(r.question ?? ""));
        const key = stem ? `${sid}::${stem}` : "";
        return key && !stemSet.has(key);
      });
      if (!missing.length) return;

      const CHUNK = 25;
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < missing.length; i += CHUNK) {
        const chunk = missing.slice(i, i + CHUNK);
        const res = await apiFetchAdmin<{ imported?: number; skipped?: number }>(
          API_PATHS.admin.questionsBulk,
          {
            method: "POST",
            body: JSON.stringify({ questions: chunk }),
          },
        );
        imported += Number(res?.imported ?? 0);
        skipped += Number(res?.skipped ?? 0);
      }
      if (imported > 0) {
        toast.success(`Synced ${imported} built-in question(s) into the bank.`);
      } else if (skipped > 0) {
        toast.message(`${skipped} built-in question(s) already in the bank (skipped).`);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Built-in sync failed.";
      toast.error(msg);
    } finally {
      setBuiltinSyncing(false);
    }
  }, []);

  const fetchRecentUsers = useCallback(async () => {
    try {
      setRecentUsersLoading(true);
      const data = await apiFetchAdmin<{ users?: AdminRecentUser[]; total?: number }>(
        `${API_PATHS.admin.users}?limit=10`,
      );
      setRecentUsers(Array.isArray(data?.users) ? data.users : []);
      setTotalUsers(Number(data?.total ?? 0));
    } catch {
      setRecentUsers([]);
      setTotalUsers(0);
    } finally {
      setRecentUsersLoading(false);
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
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const [current] = await Promise.all([
          fetchQuestions(),
          fetchEnglishPrompts(),
          fetchRecentUsers(),
        ]);
        if (cancelled || current === null) return;
        await applyStemRepairs(current);
        if (cancelled) return;
        await applyBankCorrections(current);
        if (cancelled) return;
        await syncBuiltinsToDatabase();
        if (cancelled) return;
        await publishQuestionBank();
      } catch (e) {
        console.error("[admin-init]", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isAdmin,
    fetchQuestions,
    fetchEnglishPrompts,
    fetchRecentUsers,
    applyStemRepairs,
    applyBankCorrections,
    syncBuiltinsToDatabase,
    publishQuestionBank,
  ]);

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
    setMultipartEnabled(false);
    setAnswerParts(emptyMultipartParts(2));
    setFormError("");
  };

  const uploadPartImage = async (file: File, partIndex: number) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingPartIndex(partIndex);
    try {
      const url = await compressImageFileToDataUrl(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.65,
        outputType: "image/jpeg",
      });
      setAnswerParts((prev) =>
        prev.map((p, i) => (i === partIndex ? { ...p, imageUrl: url } : p)),
      );
    } finally {
      setUploadingPartIndex(null);
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
      if (multipartEnabled) {
        const validParts = answerParts.filter((p) => p.label.trim());
        if (validParts.length < 2) {
          setFormError("Multipart questions need at least two parts with labels");
          return;
        }
        if (validParts.some((p) => !(p.acceptedAnswer ?? "").trim())) {
          setFormError("Each part needs an accepted answer for auto-marking");
          return;
        }
      } else {
        const answers = acceptedAnswers
          .split("\n")
          .map((a) => a.trim())
          .filter(Boolean);
        if (answers.length === 0) {
          setFormError("At least one accepted answer is required");
          return;
        }
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
      if (multipartEnabled) {
        const payloadParts = buildAnswerPartsPayload(answerParts);
        body.answerParts = payloadParts;
        body.acceptedAnswers = answerParts
          .map((p) => (p.acceptedAnswer ?? "").trim())
          .filter(Boolean);
        body.marks = payloadParts.reduce((sum, p) => sum + (p.marks ?? 0), 0) || marks;
      } else {
        body.acceptedAnswers = acceptedAnswers
          .split("\n")
          .map((a) => a.trim())
          .filter(Boolean);
        body.marks = marks;
      }
    }

    if (questionType !== "long_answer" || !multipartEnabled) {
      body.marks = marks;
    }

    if (questionType !== "mcq") {
      const accForAi =
        questionType === "long_answer" && multipartEnabled
          ? answerParts.map((p) => (p.acceptedAnswer ?? "").trim()).filter(Boolean)
          : acceptedAnswers
              .split("\n")
              .map((a) => a.trim())
              .filter(Boolean);
      body.useAiMarking = inferUseAiMarkingForImport({
        type: questionType,
        questionText: [questionText, passage].filter(Boolean).join("\n"),
        partLabels: multipartEnabled ? answerParts.map((p) => p.label) : [],
        acceptedAnswers: accForAi,
        subjectId,
      });
    }

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
      await publishQuestionBank();
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

  const startEditingQuestion = (q: AdminQuestion) => {
    const parts = q.answerParts ?? [];
    setEditingQuestionId(String(q.id));
    setEditDraft({
      subjectId: q.subjectId,
      type: q.type,
      topic: q.topic ?? "",
      question: q.question,
      passage: q.passage ?? "",
      marks: q.marks,
      correctAnswer: q.correctAnswer,
      options: q.options,
      acceptedAnswers: q.acceptedAnswers,
      guidance: q.guidance,
      imageUrls: q.imageUrls,
      answerParts:
        parts.length > 0
          ? mergePartsWithAcceptedAnswers(parts, q.acceptedAnswers)
          : undefined,
    });
  };

  useEffect(() => {
    if (!isAdmin || questionsLoading) return;
    const editId = searchParams.get("edit")?.trim();
    if (!editId || handledEditLinkRef.current === editId) return;

    const subjectParam = searchParams.get("subject")?.trim();
    if (subjectParam) {
      setSubjectFilter(canonicalSubjectId(subjectParam));
    }

    const target = questions.find((q) => String(q.id) === editId && !q._english);
    if (!target) return;

    handledEditLinkRef.current = editId;
    setSubjectFilter(canonicalSubjectId(String(target.subjectId)));
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      next.add(target.subjectName ?? String(target.subjectId));
      return next;
    });
    startEditingQuestion(target);

    window.setTimeout(() => {
      document
        .getElementById(`admin-question-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("edit");
        next.delete("subject");
        return next;
      },
      { replace: true },
    );
  }, [isAdmin, questionsLoading, questions, searchParams, setSearchParams]);

  const cancelEditingQuestion = () => {
    setEditingQuestionId(null);
    setEditDraft({});
  };

  const handleSaveQuestionEdit = async (questionId: string) => {
    setEditSaving(true);
    try {
      const editParts = (editDraft.answerParts ?? []) as MultipartPartDraft[];
      const draft: AdminQuestionSaveDraft = {
        subjectId: String(editDraft.subjectId ?? ""),
        type: (editDraft.type as AdminQuestionSaveDraft["type"]) ?? "long_answer",
        topic: String(editDraft.topic ?? "General"),
        question: String(editDraft.question ?? ""),
        passage: editDraft.passage ?? null,
        marks: Number(editDraft.marks ?? 1),
        guidance: editDraft.guidance ?? null,
        imageUrls: editDraft.imageUrls,
        options: editDraft.options,
        correctAnswer: editDraft.correctAnswer,
        acceptedAnswers: editDraft.acceptedAnswers,
        answerParts: editParts.length >= 2 ? editParts : undefined,
      };
      const saved = await saveAdminQuestion(questionId, draft);
      patchCachedQuestionAfterAdminSave(
        questionId,
        saved,
        String(editDraft.subjectId ?? ""),
      );
      toast.success("Question updated.");
      cancelEditingQuestion();
      await refreshQuestionBankAfterSave();
      await fetchQuestions();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update question.");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    try {
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "DELETE",
      });
      toast.success("Question deleted");
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      try {
        await refreshCustomQuestionsCache();
      } catch {
        /* ignore */
      }
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

  const bulkMoveSelectedToSubject = async () => {
    const ids = Array.from(selectedQuestionIds)
      .map((id) => Number(id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) {
      toast.error("Select at least one maths question to move.");
      return;
    }
    const target = canonicalSubjectId(bulkMoveSubjectId);
    if (!target) {
      toast.error("Choose a destination subject.");
      return;
    }
    setBulkMoving(true);
    try {
      const result = await apiFetchAdmin<{
        ok: boolean;
        updated?: number;
        subjectId?: string;
      }>(API_PATHS.admin.questionsReassignSubject, {
        method: "POST",
        body: JSON.stringify({ questionIds: ids, subjectId: target }),
      });
      const updated = Number(result?.updated ?? ids.length);
      const destName =
        visibleSubjects.find((s) => s.id === target)?.name ?? target;
      toast.success(
        `Moved ${updated} question${updated === 1 ? "" : "s"} to ${destName}.`,
      );
      setSelectedQuestionIds(new Set());
      await publishQuestionBank();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to move questions.");
    } finally {
      setBulkMoving(false);
    }
  };

  const handleRetagMethodsTopics = async () => {
    setRetaggingMethodsTopics(true);
    try {
      const result = await apiFetchAdmin<{ ok: boolean; updated?: number; total?: number }>(
        API_PATHS.admin.methodsRetagTopics,
        { method: "POST" },
      );
      const updated = Number(result?.updated ?? 0);
      const total = Number(result?.total ?? 0);
      toast.success(
        `Updated topic for ${updated} of ${total} Mathematical Methods question${total === 1 ? "" : "s"}.`,
      );
      await publishQuestionBank();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to retag Methods topics.");
    } finally {
      setRetaggingMethodsTopics(false);
    }
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
      await publishQuestionBank();
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
        rows: [] as Array<{ section: "A" | "B" | "C"; book: string; prompt: string }>,
        message: "Paste a header + at least one prompt row.",
      };
    }

    const isHeader = /^section\s*(?:\t|[ ,|]+)\s*book\s*(?:\t|[ ,|]+)\s*prompt$/i.test(lines[0]!);
    const dataLines = lines.slice(isHeader ? 1 : 0);
    const rows: Array<{ section: "A" | "B" | "C"; book: string; prompt: string }> = [];
    const badRows: number[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const raw = dataLines[i]!;

      // Format:
      // A <book> ## <prompt>
      // B <book> ## <prompt>
      // C <book> ## <prompt>
      const hashMatch = raw.match(/^\s*([ABC])\s+(.+?)\s*##\s*(.+)\s*$/i);
      if (hashMatch) {
        const section = String(hashMatch[1] ?? "").toUpperCase() as "A" | "B" | "C";
        const book = (hashMatch[2] ?? "").trim();
        const prompt = (hashMatch[3] ?? "").trim();
        if (!book || !prompt) {
          badRows.push((isHeader ? 2 : 1) + i);
          continue;
        }
        rows.push({ section, book, prompt });
        continue;
      }

      // Also allow strict TSV row if user provides it.
      const parts = raw.split("\t");
      if (parts.length === 3) {
        const section = (parts[0] ?? "").trim().toUpperCase();
        const book = (parts[1] ?? "").replace(/\s*##\s*$/g, "").trim();
        const prompt = (parts[2] ?? "").trim();
        if ((section === "A" || section === "B" || section === "C") && book && prompt) {
          rows.push({ section: section as "A" | "B" | "C", book, prompt });
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
          e ? ` â€¢ ${e} row(s) skipped` : ""
        }${sampleErrors ? ` â€¢ sample: ${sampleErrors}` : ""}`,
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

  const clearSelections = () => {
    setSelectedQuestionIds(new Set());
    setSelectedEnglishPromptIds(new Set());
  };

  const bulkDeleteSelected = async () => {
    const qIds = Array.from(selectedQuestionIds)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    const pIds = Array.from(selectedEnglishPromptIds)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!qIds.length && !pIds.length) {
      toast.error("Select at least one question or prompt to delete.");
      return;
    }
    setBulkDeleting(true);
    try {
      if (qIds.length) {
        await apiFetchAdmin(API_PATHS.admin.questionsBulkDelete, {
          method: "POST",
          body: JSON.stringify({ ids: qIds }),
        });
      }
      if (pIds.length) {
        await apiFetchAdmin(API_PATHS.admin.englishPromptsBulkDelete, {
          method: "POST",
          body: JSON.stringify({ ids: pIds }),
        });
      }
      toast.success(`Deleted ${qIds.length} question(s) and ${pIds.length} prompt(s).`);
      clearSelections();
      await Promise.all([publishQuestionBank(), fetchEnglishPrompts()]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Bulk delete failed.";
      toast.error(msg);
    } finally {
      setBulkDeleting(false);
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

  const mathsBankStats = useMemo(() => {
    const mathsIds = baseSubjects
      .filter((s) => s.id !== "english")
      .map((s) => s.id);
    return mathsIds.map((sid) => {
      const count = questions.filter(
        (q) => canonicalSubjectId(String(q.subjectId ?? "")) === sid,
      ).length;
      const name = visibleSubjects.find((s) => s.id === sid)?.name ?? sid;
      return { sid, name, count };
    });
  }, [questions]);

  const allBankGroups = useMemo((): [string, AdminQuestion[]][] => {
    const mathsEntries = Object.entries(groupedQuestions).sort(([a], [b]) =>
      a.localeCompare(b),
    ) as [string, AdminQuestion[]][];
    const englishEntries: [string, AdminQuestion[]][] = englishPrompts.length
      ? [
          [
            "English prompts",
            englishPrompts.map((p) => ({
              id: `english-${p.id}`,
              subjectId: "english",
              subjectName: "English",
              type: "long_answer" as QuestionType,
              question: p.prompt,
              marks: 0,
              _english: true,
              _book: p.book,
              _section: p.section,
            })),
          ],
        ]
      : [];
    return [...mathsEntries, ...englishEntries];
  }, [groupedQuestions, englishPrompts]);

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

  const editTopicOptions = useMemo(() => {
    return adminTopicOptionsForSubject(String(editDraft.subjectId ?? ""));
  }, [editDraft.subjectId]);

  const renderMathsQuestionEditForm = (q: AdminQuestion) => (
    <div className="mt-2 space-y-2 rounded-lg border border-brand/25 bg-white/80 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Subject</Label>
          <Select
            value={canonicalSubjectId(String(editDraft.subjectId ?? q.subjectId))}
            onValueChange={(val: string | null) => {
              if (!val) return;
              setEditDraft((d) => ({ ...d, subjectId: val }));
            }}
          >
            <SelectTrigger className="h-8 w-full">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {visibleSubjects
                .filter((s) => s.id !== "english")
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Which subject bank students see this question in.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Topic</Label>
          {editTopicOptions.length > 0 ? (
            <Select
              value={editDraft.topic ?? q.topic ?? ""}
              onValueChange={(val: string | null) => {
                if (val) setEditDraft((d) => ({ ...d, topic: val }));
              }}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {editTopicOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
                {editDraft.topic &&
                !editTopicOptions.includes(editDraft.topic) ? (
                  <SelectItem value={editDraft.topic}>{editDraft.topic}</SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8"
              value={editDraft.topic ?? ""}
              onChange={(e) =>
                setEditDraft((d) => ({ ...d, topic: e.target.value }))
              }
            />
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Marks</Label>
          <Input
            type="number"
            min={1}
            max={20}
            className="h-8"
            value={editDraft.marks ?? q.marks}
            onChange={(e) =>
              setEditDraft((d) => ({ ...d, marks: Number(e.target.value) }))
            }
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Question text</Label>
        <Textarea
          rows={4}
          className="bg-white/70 text-sm"
          value={editDraft.question ?? ""}
          onChange={(e) =>
            setEditDraft((d) => ({ ...d, question: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Passage text</Label>
        <Textarea
          rows={2}
          className="bg-white/70 text-xs"
          value={editDraft.passage ?? q.passage ?? ""}
          onChange={(e) =>
            setEditDraft((d) => ({ ...d, passage: e.target.value }))
          }
        />
      </div>
      <AdminQuestionImageEditor
        imageUrls={editDraft.imageUrls ?? q.imageUrls ?? []}
        onChange={(imageUrls) => setEditDraft((d) => ({ ...d, imageUrls }))}
      />
      {editDraft.type === "mcq" || q.type === "mcq" ? (
        <>
          <div className="space-y-1">
            <Label className="text-xs">Options (one per line)</Label>
            <Textarea
              rows={4}
              className="bg-white/70 text-xs"
              value={(editDraft.options ?? q.options ?? []).join("\n")}
              onChange={(e) =>
                setEditDraft((d) => ({
                  ...d,
                  options: e.target.value.split("\n").map((x) => x.trim()),
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Correct answer</Label>
            <Input
              className="h-8"
              value={editDraft.correctAnswer ?? q.correctAnswer ?? ""}
              onChange={(e) =>
                setEditDraft((d) => ({ ...d, correctAnswer: e.target.value }))
              }
            />
          </div>
        </>
      ) : (
        <>
          {editDraft.type === "long_answer" || q.type === "long_answer" ? (
            <div className="space-y-1">
              <Label className="text-xs">Marking guidance</Label>
              <Textarea
                rows={2}
                className="bg-white/70 text-xs"
                value={editDraft.guidance ?? q.guidance ?? ""}
                onChange={(e) =>
                  setEditDraft((d) => ({ ...d, guidance: e.target.value }))
                }
              />
            </div>
          ) : null}
          {(editDraft.answerParts?.length ?? 0) >= 2 ? (
            <MultipartAnswerPartsEditor
              parts={(editDraft.answerParts ?? []) as MultipartPartDraft[]}
              onChange={(parts) =>
                setEditDraft((d) => ({ ...d, answerParts: parts }))
              }
              onUploadPartImage={async (file, partIndex) => {
                setUploadingPartIndex(partIndex);
                try {
                  const url = await compressImageFileToDataUrl(file, {
                    maxWidth: 1000,
                    maxHeight: 1000,
                    quality: 0.65,
                    outputType: "image/jpeg",
                  });
                  setEditDraft((d) => {
                    const prev = (d.answerParts ?? []) as MultipartPartDraft[];
                    return {
                      ...d,
                      answerParts: prev.map((p, i) =>
                        i === partIndex ? { ...p, imageUrl: url } : p,
                      ),
                    };
                  });
                } finally {
                  setUploadingPartIndex(null);
                }
              }}
              uploadingPartIndex={uploadingPartIndex}
            />
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">Accepted answers (one per line)</Label>
              <Textarea
                rows={3}
                className="bg-white/70 text-xs"
                value={(editDraft.acceptedAnswers ?? q.acceptedAnswers ?? []).join("\n")}
                onChange={(e) =>
                  setEditDraft((d) => ({
                    ...d,
                    acceptedAnswers: e.target.value
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  }))
                }
              />
            </div>
          )}
          {(editDraft.answerParts?.length ?? 0) < 2 ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() =>
                setEditDraft((d) => ({
                  ...d,
                  answerParts: mergePartsWithAcceptedAnswers(
                    emptyMultipartParts(2),
                    d.acceptedAnswers ?? q.acceptedAnswers,
                  ),
                }))
              }
            >
              <Plus className="size-3.5" />
              Add answer parts
            </Button>
          ) : null}
        </>
      )}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={editSaving}
          onClick={() => void handleSaveQuestionEdit(String(q.id))}
        >
          {editSaving ? <Loader2 className="size-4 animate-spin" /> : "Save question"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={cancelEditingQuestion}>
          Cancel
        </Button>
      </div>
    </div>
  );

  /* ------ render ------ */

  if (!isAdmin) {
    return (
      <AppShell
        title="Admin Panel"
        subtitle="Manage custom questions"
        edgeToEdgeHeader
      >
        <div className="max-w-none space-y-6">
          <Card className="surface-card">
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
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <UserPlus className="size-5 text-brand" />
                Recent signups
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {totalUsers} real account{totalUsers === 1 ? "" : "s"} â€” latest 10 shown
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={recentUsersLoading}
              onClick={() => void fetchRecentUsers()}
            >
              {recentUsersLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {recentUsersLoading && recentUsers.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading signupsâ€¦
              </div>
            ) : recentUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No signups yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-black/10">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">Username</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentUsers.map((u) => (
                      <tr key={u.id} className="border-t border-black/5">
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {formatSignupWhen(u.createdAt)}
                        </td>
                        <td className="px-3 py-2 font-medium">{u.username || "â€”"}</td>
                        <td className="px-3 py-2">{u.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <AdminFeedbackPanel />

        <AdminPromptingPanel />

        <AdminPracticeExamPanel
          subjects={visibleSubjects.map((s) => ({ id: s.id, name: s.name }))}
          defaultSubjectId={subjectId}
        />

        <PdfQuestionImportPanel
          subjects={visibleSubjects.map((s) => ({ id: s.id, name: s.name }))}
          defaultSubjectId={subjectId}
          onImported={publishQuestionBank}
        />

        {/* Add Question Form */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <Plus className="size-5 text-brand" />
              Add Question
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Manual entry. For exam PDFs, use{" "}
              <span className="font-medium text-foreground">Import questions</span> above — extract
              stems from the PDF, match TSV answers, crop figures per question/subpart.
            </p>
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
                  {visibleSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {visibleSubjects.length === 0 && (
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

            {questionType !== "mcq" && !(questionType === "long_answer" && multipartEnabled) && (
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

            <AdminQuestionImageEditor
              imageUrls={imageUrlsText
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean)}
              onChange={(urls) => setImageUrlsText(urls.join("\n"))}
            />

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
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={multipartEnabled}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setMultipartEnabled(on);
                      if (on && answerParts.length < 2) {
                        setAnswerParts(emptyMultipartParts(2));
                      }
                    }}
                    className="size-4 rounded border-black/20"
                  />
                  <span className="font-medium">Multipart question</span>
                  <span className="text-muted-foreground">
                    (separate answer box per part â€” ideal for Demo)
                  </span>
                </label>

                {multipartEnabled ? (
                  <MultipartAnswerPartsEditor
                    parts={answerParts}
                    onChange={setAnswerParts}
                    onUploadPartImage={uploadPartImage}
                    uploadingPartIndex={uploadingPartIndex}
                  />
                ) : null}

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

                {!multipartEnabled ? (
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
                ) : null}
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                variant="accent"
                className="gap-1.5"
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

        {/* Questions & prompts bank (maths + English together) */}
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Questions &amp; prompts bank
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The question bank in the database is the source of truth. Each row&apos;s{" "}
                <span className="font-medium text-foreground">Subject</span> controls which course it
                appears in; built-in sets only seed missing questions on first load. Edit a question or
                use <span className="font-medium text-foreground">Move selected</span> to reassign subjects.
                {builtinSyncing ? (
                  <span className="ml-1 inline-flex items-center gap-1 text-foreground">
                    <Loader2 className="size-3 animate-spin" /> Syncingâ€¦
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {mathsBankStats.map((s) => (
                  <Badge key={s.sid} variant="secondary">
                    {s.name}: {s.count} question{s.count === 1 ? "" : "s"}
                  </Badge>
                ))}
                {englishPrompts.length ? (
                  <Badge variant="secondary">
                    English: {englishPrompts.length} prompt{englishPrompts.length === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Import English prompts</p>
              <p className="text-xs text-muted-foreground">
                Paste TSV: section, book, prompt. Imported prompts appear in the list below with maths questions.
              </p>
              <Textarea
                value={englishBulkText}
                onChange={(e) => {
                  setEnglishBulkText(e.target.value);
                  setEnglishMsg("");
                  setEnglishPreviewRows([]);
                }}
                rows={5}
                className="bg-white/60"
                placeholder={`section\tbook\tprompt
A\tThe Women of Troy\tHow does Euripides show power and helplessness?
B\tSection B Curated Prompts\tTitle: Origins â€” write a crafted text on belonging.
C\tSection C Argument Prompts\tWrite an argument on patience in modern life.`}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={previewEnglishPrompts}
                  className="gap-2"
                  disabled={englishBusy}
                >
                  Preview import
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  onClick={() => void importEnglishPrompts()}
                  className="gap-2"
                  disabled={englishBusy || englishPreviewRows.length === 0}
                >
                  {englishBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Confirm import
                </Button>
                {englishMsg ? (
                  <p className="text-sm text-muted-foreground">{englishMsg}</p>
                ) : null}
              </div>
            </div>

            <Separator />

            <div className="mb-4 space-y-1.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label>Filter by Subject</Label>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <AlertDialog>
                    <AlertDialogTrigger
                      type="button"
                      disabled={
                        bulkDeleting ||
                        (!selectedQuestionIds.size && !selectedEnglishPromptIds.size)
                      }
                      className={cn(
                        buttonVariants({ variant: "destructive", size: "sm" }),
                        "gap-2",
                      )}
                    >
                      {bulkDeleting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                      Delete selected ({selectedQuestionIds.size + selectedEnglishPromptIds.size})
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete selected items?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the selected questions/prompts. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => void bulkDeleteSelected()}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={bulkMoveSubjectId}
                      onValueChange={(val: string | null) =>
                        val && setBulkMoveSubjectId(val)
                      }
                    >
                      <SelectTrigger className="h-8 w-[11.5rem]">
                        <SelectValue placeholder="Move to subjectâ€¦" />
                      </SelectTrigger>
                      <SelectContent>
                        {visibleSubjects
                          .filter((s) => s.id !== "english")
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={bulkMoving || !selectedQuestionIds.size || !bulkMoveSubjectId}
                      onClick={() => void bulkMoveSelectedToSubject()}
                    >
                      {bulkMoving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="size-4" />
                      )}
                      Move selected ({selectedQuestionIds.size})
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={
                      bulkDeleting ||
                      (!selectedQuestionIds.size && !selectedEnglishPromptIds.size)
                    }
                    onClick={clearSelections}
                  >
                    Clear selection
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={retaggingMethodsTopics}
                    onClick={() => void handleRetagMethodsTopics()}
                  >
                    {retaggingMethodsTopics ? <Loader2 className="size-4 animate-spin" /> : null}
                    Retag Methods (VCAA areas)
                  </Button>
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
              </div>
              <Select value={subjectFilter} onValueChange={(val: string | null) => val && setSubjectFilter(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {visibleSubjects.map((s) => (
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
            ) : questions.length === 0 && !englishPrompts.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No questions or prompts yet. Add maths questions above or import English prompts here.
              </p>
            ) : subjectFilter !== "all" && filteredQuestions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No questions for{" "}
                <span className="font-medium text-foreground">
                  {visibleSubjects.find((s) => s.id === subjectFilter)?.name ?? subjectFilter}
                </span>{" "}
                yet. Use Add Question or AI/PDF import with{" "}
                <code className="rounded bg-black/10 px-1">subject_id</code>{" "}
                <code className="rounded bg-black/10 px-1">{subjectFilter}</code>.
              </p>
            ) : (
              <div className="space-y-2">
                {subjectFilter === "all" ? (
                  allBankGroups.map(
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
                                  id={`admin-question-${q.id}`}
                                  className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                                >
                                  <div className="flex min-w-0 flex-1 gap-3">
                                    <input
                                      type="checkbox"
                                      className="mt-1 size-4 shrink-0 accent-brand"
                                      checked={
                                        String(q.id).startsWith("english-")
                                          ? selectedEnglishPromptIds.has(
                                              Number(
                                                String(q.id).replace(
                                                  /^english-/,
                                                  "",
                                                ),
                                              ),
                                            )
                                          : selectedQuestionIds.has(String(q.id))
                                      }
                                      onChange={(e) => {
                                        const idStr = String(q.id);
                                        if (idStr.startsWith("english-")) {
                                          const pid = Number(
                                            idStr.replace(/^english-/, ""),
                                          );
                                          setSelectedEnglishPromptIds((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) next.add(pid);
                                            else next.delete(pid);
                                            return next;
                                          });
                                          return;
                                        }
                                        setSelectedQuestionIds((prev) => {
                                          const next = new Set(prev);
                                          if (e.target.checked) next.add(idStr);
                                          else next.delete(idStr);
                                          return next;
                                        });
                                      }}
                                    />
                                    <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] uppercase"
                                      >
                                        {q._english ? `Section ${q._section}` : q.type.replace("_", " ")}
                                      </Badge>
                                      {!q._english && q.topic ? (
                                        <Badge variant="secondary" className="text-[11px]">
                                          {q.topic}
                                        </Badge>
                                      ) : null}
                                      {q._english ? (
                                        <Badge variant="secondary" className="text-[11px]">
                                          {q._book || "Section B Creative"}
                                        </Badge>
                                      ) : null}
                                    </div>
                                    {q._english ? (
                                      <p className="text-base font-semibold leading-relaxed text-foreground whitespace-pre-wrap">
                                        {q.question}
                                      </p>
                                    ) : editingQuestionId === String(q.id) ? (
                                      renderMathsQuestionEditForm(q)
                                    ) : (
                                      <>
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
                                    ) : null}
                                    {q.type === "mcq" ? (
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
                                      </>
                                    )}
                                    </div>
                                  </div>

                                  {!q._english && q.type !== "mcq" && editingQuestionId !== String(q.id) && (
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
                                    <div className="flex shrink-0 flex-col items-end gap-1">
                                      {editingQuestionId !== String(q.id) ? (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          className="h-8"
                                          onClick={() => startEditingQuestion(q)}
                                        >
                                          Edit
                                        </Button>
                                      ) : null}
                                    <AlertDialog>
                                    <AlertDialogTrigger
                                      type="button"
                                      className={cn(
                                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                                        "shrink-0 text-muted-foreground hover:text-danger",
                                      )}
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
                          <div className="flex min-w-0 flex-1 gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 size-4 shrink-0 accent-brand"
                              checked={selectedEnglishPromptIds.has(Number(r.id))}
                              onChange={(e) => {
                                const id = Number(r.id);
                                setSelectedEnglishPromptIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(id);
                                  else next.delete(id);
                                  return next;
                                });
                              }}
                            />
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
                          id={`admin-question-${q.id}`}
                          className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                        >
                          <div className="flex min-w-0 flex-1 gap-3">
                            <input
                              type="checkbox"
                              className="mt-1 size-4 shrink-0 accent-brand"
                              checked={selectedQuestionIds.has(String(q.id))}
                              onChange={(e) => {
                                const idStr = String(q.id);
                                setSelectedQuestionIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(idStr);
                                  else next.delete(idStr);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase"
                              >
                                {q.type.replace("_", " ")}
                              </Badge>
                            </div>
                            {editingQuestionId === String(q.id) ? (
                              renderMathsQuestionEditForm(q)
                            ) : (
                              <>
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
                              </>
                            )}
                            </div>
                          </div>

                          {q.type !== "mcq" && editingQuestionId !== String(q.id) && (
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

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            {editingQuestionId !== String(q.id) ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => startEditingQuestion(q)}
                              >
                                Edit
                              </Button>
                            ) : null}
                          <AlertDialog>
                            <AlertDialogTrigger
                              type="button"
                              className={cn(
                                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                                "shrink-0 text-muted-foreground hover:text-danger",
                              )}
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
