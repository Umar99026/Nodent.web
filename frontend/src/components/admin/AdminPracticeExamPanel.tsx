import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DiagramLabelInputs } from "@/components/quiz/DiagramLabelInputs";
import { ExamMcqPageOverlay } from "@/components/quiz/ExamMcqPageOverlay";
import {
  overlayFromAnswerSlot,
  type AnswerSlotSource,
} from "@/lib/answerSlotOverlays";
import {
  clampOverlay,
  type DiagramLabelPart,
  type OverlayRect,
} from "@/lib/diagramLabels";
import {
  applySolutionTextToPalette,
  isMcqSlotKey,
  loadExamPdfPages,
  placedSlotKeys,
  shortLabelFromSlotKey,
  splitPaletteIntoMcqAndWritten,
  mergeMcqItems,
  buildMcqRows,
  normalizeMcqLetter,
} from "@/lib/practiceExamImport";
import {
  defaultMcqCount,
  defaultPracticeExamLayout,
  practiceExamLayoutLabel,
} from "@/lib/practiceExamLayout";
import { autoAlignMcqItemsFromPdf } from "@/lib/practiceExamMcqDetection";
import {
  boundsFromMcqOverlays,
  clampMcqGroupBounds,
  finalizeMcqButtonPlacement,
  firstMissingMcqLetter,
  getMcqButtonSizePct,
  inferMcqGroupLayout,
  layoutMcqGroupInBounds,
  mcqButtonRectAtCenter,
  MCQ_BUTTON_SIZE_PCT,
  MCQ_BUTTON_SIZE_MIN_PCT,
  MCQ_BUTTON_SIZE_SLIDER_MAX_PCT,
  reflowMcqItemPlacements,
  isMcqFullyPlaced,
  mcqPlacementCount,
  nextMcqPlacementLetter,
  normalizeMcqItems,
  sortMcqItemsByQuestion,
  translateMcqOverlays,
  type McqOverlayRef,
} from "@/lib/practiceExamMcq";
import {
  deletePracticeExam,
  fetchAdminPracticeExamMeta,
  fetchAdminPracticeExamPage,
  savePracticeExamMeta,
  savePracticeExamPage,
} from "@/lib/practiceExamApi";
import { compressExamPageForStorage } from "@/lib/imageCompressor";
import {
  PRACTICE_EXAM_NUMBERS,
  PRACTICE_EXAM_YEARS,
  practiceExamFullLabel,
  type PracticeExamNumber,
} from "@/lib/practiceExams";
import type {
  PracticeExamLayout,
  PracticeExamMcqItem,
  PracticeExamPage,
  PracticeExamSlot,
  McqOptionLetter,
} from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";
import { toast } from "sonner";
import { FileText, ExternalLink, Loader2, Plus, Save, Trash2, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SubjectOption = { id: string; name: string };

type Props = {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
};

function slotToDiagramPart(slot: PracticeExamSlot): DiagramLabelPart {
  return {
    key: slot.key,
    label: "",
    acceptedAnswer: slot.acceptedAnswer,
    marks: slot.marks,
    overlayX: slot.overlayX,
    overlayY: slot.overlayY,
    overlayW: slot.overlayW,
    overlayH: slot.overlayH,
    sourcePartKey: slot.key,
    transparentInput: slot.transparentInput,
  };
}

function diagramPartToSlot(
  part: DiagramLabelPart,
  pageNumber: number,
  existing?: PracticeExamSlot,
): PracticeExamSlot {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    pageNumber,
    key: part.sourcePartKey ?? part.key,
    label: part.label,
    acceptedAnswer: part.acceptedAnswer ?? "",
    marks: part.marks ?? 1,
    overlayX: part.overlayX,
    overlayY: part.overlayY,
    overlayW: part.overlayW,
    overlayH: part.overlayH,
    transparentInput: part.transparentInput ?? existing?.transparentInput,
  };
}

function scrollToMcqPage(pageNumber: number) {
  document.getElementById(`mcq-page-${pageNumber}`)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function McqPageEditor({
  page,
  items,
  armed,
  selectedItemId,
  hidePdfLetters,
  onSelectItem,
  onPlaceOverlay,
  onMoveMcqGroup,
  onResizeMcqGroup,
  onMoveMcqButton,
}: {
  page: PracticeExamPage;
  items: PracticeExamMcqItem[];
  armed: McqOverlayRef | null;
  selectedItemId: string | null;
  hidePdfLetters?: boolean;
  onSelectItem: (itemId: string | null) => void;
  onPlaceOverlay: (pageNumber: number, ref: McqOverlayRef, rect: OverlayRect) => void;
  onMoveMcqGroup: (itemId: string, bounds: OverlayRect) => void;
  onResizeMcqGroup: (itemId: string, bounds: OverlayRect) => void;
  onMoveMcqButton: (itemId: string, letter: McqOptionLetter, rect: OverlayRect) => void;
}) {
  const pageItems = sortMcqItemsByQuestion(
    items.filter(
      (item) => item.pageNumber === page.pageNumber && mcqPlacementCount(item) > 0,
    ),
  );

  return (
    <div
      id={`mcq-page-${page.pageNumber}`}
      className="scroll-mt-4 rounded-xl border border-black/10 bg-white shadow-sm"
    >
      <div className="border-b border-black/8 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Page {page.pageNumber} — MCQ buttons
        {pageItems.length ? (
          <span className="ml-2 font-normal normal-case text-muted-foreground">
            ({pageItems.map((i) => `Q${i.questionNumber}`).join(", ")})
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "relative p-2",
          armed && "ring-2 ring-inset ring-brand/30",
        )}
      >
        <ExamMcqPageOverlay
          imageUrl={page.imageDataUrl}
          items={pageItems}
          editorMode
          showAnswerKey
          hidePdfLetters={hidePdfLetters}
          armed={armed}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          onPlaceOverlay={(ref, rect) => onPlaceOverlay(page.pageNumber, ref, rect)}
          onMoveMcqGroup={onMoveMcqGroup}
          onResizeMcqGroup={onResizeMcqGroup}
          onMoveMcqButton={onMoveMcqButton}
        />
      </div>
    </div>
  );
}

function ExamPageEditor({
  page,
  slots,
  armedPaletteIndex,
  armedPaletteSlot,
  selectedSlotId,
  onSelectSlot,
  onSlotsChange,
  onPlaceArmedRect,
}: {
  page: PracticeExamPage;
  slots: PracticeExamSlot[];
  armedPaletteIndex: number | null;
  armedPaletteSlot: AnswerSlotSource | null;
  selectedSlotId: string | null;
  onSelectSlot: (id: string | null) => void;
  onSlotsChange: (pageNumber: number, next: PracticeExamSlot[]) => void;
  onPlaceArmedRect: (pageNumber: number, rect: OverlayRect) => void;
}) {
  const pageSlots = slots.filter((s) => s.pageNumber === page.pageNumber);
  const parts = pageSlots.map(slotToDiagramPart);
  const selectedIndex = pageSlots.findIndex((s) => s.id === selectedSlotId);

  const updatePageSlots = (nextParts: DiagramLabelPart[]) => {
    const next = nextParts.map((part, i) =>
      diagramPartToSlot(part, page.pageNumber, pageSlots[i]),
    );
    onSlotsChange(page.pageNumber, next);
  };

  const handleAddRect = (rect: OverlayRect) => {
    if (armedPaletteSlot) {
      onPlaceArmedRect(page.pageNumber, rect);
      return;
    }
    const id = crypto.randomUUID();
    const nextSlot: PracticeExamSlot = {
      id,
      pageNumber: page.pageNumber,
      key: `p${page.pageNumber}-${pageSlots.length + 1}`,
      label: "",
      acceptedAnswer: "",
      marks: 1,
      transparentInput: true,
      ...clampOverlay(rect),
    };
    onSelectSlot(id);
    onSlotsChange(page.pageNumber, [...pageSlots, nextSlot]);
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="border-b border-black/8 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Page {page.pageNumber}
      </div>
      <div
        className={cn(
          "relative p-2",
          armedPaletteIndex != null && "ring-2 ring-inset ring-brand/30",
        )}
      >
        <DiagramLabelInputs
          imageUrl={page.imageDataUrl}
          parts={parts}
          editorMode
          examPaperMode
          selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
          onSelectIndex={(index) => {
            onSelectSlot(index == null ? null : pageSlots[index]?.id ?? null);
          }}
          onMovePart={(index, overlay) => {
            const next = parts.map((p, i) =>
              i === index ? { ...p, ...clampOverlay(overlay) } : p,
            );
            updatePageSlots(next);
          }}
          onResizePart={(index, overlay) => {
            const next = parts.map((p, i) =>
              i === index ? { ...p, ...clampOverlay(overlay) } : p,
            );
            updatePageSlots(next);
          }}
          onAddRect={handleAddRect}
          preciseOverlayDraw
        />
      </div>
    </div>
  );
}

export function AdminPracticeExamPanel({
  subjects,
  defaultSubjectId = "",
}: Props) {
  const navigate = useNavigate();
  const examFileRef = useRef<HTMLInputElement | null>(null);
  const examPdfFileRef = useRef<File | null>(null);

  const [subjectId, setSubjectId] = useState(defaultSubjectId || subjects[0]?.id || "");
  const [year, setYear] = useState<number>(PRACTICE_EXAM_YEARS[PRACTICE_EXAM_YEARS.length - 1]!);
  const [examNumber, setExamNumber] = useState<PracticeExamNumber>(1);
  const [pages, setPages] = useState<PracticeExamPage[]>([]);
  const [slots, setSlots] = useState<PracticeExamSlot[]>([]);
  const [layout, setLayout] = useState<PracticeExamLayout>("written");
  const [mcqCount, setMcqCount] = useState(0);
  const [mcqItems, setMcqItems] = useState<PracticeExamMcqItem[]>([]);
  const [palette, setPalette] = useState<AnswerSlotSource[]>([]);
  const [pasteSolutionsText, setPasteSolutionsText] = useState("");
  const [armedPaletteIndex, setArmedPaletteIndex] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [adminPlaceMode, setAdminPlaceMode] = useState<"mcq" | "written">("mcq");
  const [selectedMcqItemId, setSelectedMcqItemId] = useState<string | null>(null);
  const [hideMcqPdfLetters, setHideMcqPdfLetters] = useState(true);
  const [armedMcq, setArmedMcq] = useState<McqOverlayRef | null>(null);
  const [savedPublished, setSavedPublished] = useState(false);
  const [savedHasPages, setSavedHasPages] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const placedKeys = useMemo(() => placedSlotKeys(slots), [slots]);
  const placedByKey = useMemo(
    () => new Map(slots.map((slot) => [slot.key.trim().toLowerCase(), slot])),
    [slots],
  );
  const selectedSlot = slots.find((s) => s.id === selectedSlotId) ?? null;
  const subjectName =
    subjects.find((s) => s.id === subjectId)?.name ?? subjectId;
  const studentExamPath =
    subjectId && year
      ? `/practice/${subjectId}/exams/${year}/${examNumber}`
      : "";
  const studentExamsListPath = subjectId ? `/practice/${subjectId}/exams` : "";

  const loadExam = useCallback(async () => {
    if (!subjectId || !year) return;
    setLoading(true);
    try {
      const meta = await fetchAdminPracticeExamMeta(subjectId, year, examNumber);
      const legacyTransparent = !!(meta as { transparentInputs?: boolean }).transparentInputs;
      const nextLayout =
        meta.layout ?? defaultPracticeExamLayout(subjectId, examNumber);
      const nextMcqCount = meta.mcqCount || defaultMcqCount(subjectId, examNumber);
      setLayout(nextLayout);
      setMcqCount(nextMcqCount);
      try {
        setMcqItems(
          nextLayout === "mcq_then_written" && nextMcqCount > 0
            ? normalizeMcqItems(nextMcqCount, meta.mcqItems ?? [])
            : meta.mcqItems ?? [],
        );
      } catch {
        setMcqItems(meta.mcqItems ?? []);
      }
      const loadedSlots = (meta.slots ?? []).map((slot) => ({
        ...slot,
        transparentInput:
          slot.transparentInput ?? (legacyTransparent ? true : undefined),
      }));
      const writtenSlots =
        nextLayout === "mcq_then_written"
          ? loadedSlots.filter((slot) => !isMcqSlotKey(slot.key))
          : loadedSlots;
      setSlots(writtenSlots);
      setPalette(
        writtenSlots.map((slot) => ({
          key: slot.key,
          descriptor: shortLabelFromSlotKey(slot.key),
          acceptedAnswer: slot.acceptedAnswer,
          marks: slot.marks ?? 1,
          transparentInput: slot.transparentInput,
        })),
      );
      const isPublished = !!meta.published;
      setSavedPublished(isPublished);
      setSavedHasPages(!!meta.pages?.length);

      if (!meta.pages?.length) {
        setPages([]);
        return;
      }

      const loaded: PracticeExamPage[] = [];
      for (const p of meta.pages) {
        const page = await fetchAdminPracticeExamPage(subjectId, year, examNumber, p.pageNumber);
        if (page) loaded.push(page);
      }
      loaded.sort((a, b) => a.pageNumber - b.pageNumber);
      setPages(loaded);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load exam.");
      setPages([]);
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, year, examNumber]);

  useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const handleExamPdf = async (file: File) => {
    setBusy(true);
    try {
      examPdfFileRef.current = file;
      const nextPages = await loadExamPdfPages(file, (done, total) => {
        if (done === 0 || done === total) return;
      });
      setPages(nextPages);
      if (layout === "mcq_then_written") {
        const count =
          mcqCount || defaultMcqCount(subjectId, examNumber);
        if (!mcqCount && count > 0) setMcqCount(count);
        if (count > 0) {
          const base = buildMcqRows(count, mcqItems);
          await runAutoAlignMcq(file, base, count);
        }
      }
      toast.success(`Loaded ${nextPages.length} page(s) from exam PDF.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read exam PDF.");
    } finally {
      setBusy(false);
      if (examFileRef.current) examFileRef.current.value = "";
    }
  };

  const runAutoAlignMcq = async (
    file: File,
    items: PracticeExamMcqItem[],
    count: number,
  ) => {
    try {
      const { items: aligned, aligned: n, warnings } = await autoAlignMcqItemsFromPdf(
        file,
        items,
        count,
      );
      setMcqItems(normalizeMcqItems(count, aligned));
      if (n > 0) {
        toast.success(`Auto-placed A–D buttons for ${n} MCQ question(s).`);
      } else {
        toast.message("No MCQ letter groups found — place buttons manually on the page.");
      }
      for (const w of warnings) toast.message(w, { duration: 7000 });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "MCQ auto-align failed.");
    }
  };

  const applyPastedSolutions = () => {
    const parsed = applySolutionTextToPalette(pasteSolutionsText);
    if (!parsed.length) {
      toast.error(
        "Couldn't parse that TSV. Use columns: question, part, answer, marks — or key, label, answer.",
      );
      return;
    }
    if (layout === "mcq_then_written") {
      const { mcq, written } = splitPaletteIntoMcqAndWritten(parsed);
      setPalette(written);
      const count = mcqCount || defaultMcqCount(subjectId, examNumber);
      if (!mcqCount && count > 0) setMcqCount(count);
      const merged = mergeMcqItems(mcqItems, mcq);
      const base = buildMcqRows(count, merged);
      setMcqItems(base);
      setAdminPlaceMode("mcq");
      const file = examPdfFileRef.current;
      if (file && count > 0) {
        void runAutoAlignMcq(file, base, count);
      }
      toast.success(`Loaded ${mcq.length} MCQ answer(s) and ${written.length} written slot(s).`);
      return;
    }
    setPalette(parsed);
    toast.success(`Loaded ${parsed.length} answer slot(s) from pasted TSV.`);
  };

  const addManualPaletteSlot = () => {
    const n = palette.length + 1;
    const key = `slot-${n}`;
    setPalette((prev) => [
      ...prev,
      {
        key,
        descriptor: `Answer ${n}`,
        acceptedAnswer: "",
        marks: 1,
      },
    ]);
    setArmedPaletteIndex(palette.length);
  };

  const placeArmedSlotRect = (pageNumber: number, rect: OverlayRect) => {
    if (armedPaletteIndex == null) return;
    const slot = palette[armedPaletteIndex];
    if (!slot) return;
    if (placedKeys.has(slot.key.trim().toLowerCase())) {
      toast.error(`${shortLabelFromSlotKey(slot.key)} is already placed on the exam.`);
      return;
    }
    const placed = overlayFromAnswerSlot(slot, rect);
    const next: PracticeExamSlot = {
      id: crypto.randomUUID(),
      pageNumber,
      key: slot.key,
      label: "",
      acceptedAnswer: slot.acceptedAnswer,
      marks: slot.marks,
      overlayX: placed.overlayX,
      overlayY: placed.overlayY,
      overlayW: placed.overlayW,
      overlayH: placed.overlayH,
      transparentInput: slot.transparentInput ?? true,
    };
    setSlots((prev) => [...prev, next]);
    setArmedPaletteIndex(null);
    setSelectedSlotId(next.id);
    toast.success(`Placed ${shortLabelFromSlotKey(slot.key)}.`);
  };

  const updateSlotsForPage = (pageNumber: number, pageSlots: PracticeExamSlot[]) => {
    setSlots((prev) => [
      ...prev.filter((s) => s.pageNumber !== pageNumber),
      ...pageSlots,
    ]);
  };

  const updateSelectedSlot = (patch: Partial<PracticeExamSlot>) => {
    if (!selectedSlotId) return;
    setSlots((prev) =>
      prev.map((s) => (s.id === selectedSlotId ? { ...s, ...patch } : s)),
    );
    if ("transparentInput" in patch && selectedSlot) {
      const key = selectedSlot.key.trim().toLowerCase();
      setPalette((prev) =>
        prev.map((entry) =>
          entry.key.trim().toLowerCase() === key
            ? { ...entry, transparentInput: patch.transparentInput }
            : entry,
        ),
      );
    }
  };

  const updatePaletteEntry = (index: number, patch: Partial<AnswerSlotSource>) => {
    setPalette((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );
  };

  const moveMcqGroup = (itemId: string, bounds: OverlayRect) => {
    const clamped = clampMcqGroupBounds(bounds);
    setMcqItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const prevBounds =
          item.mcqGroupBounds ?? boundsFromMcqOverlays(item.optionOverlays);
        if (!prevBounds) {
          return { ...item, mcqGroupBounds: clamped };
        }
        const dx = clamped.overlayX - prevBounds.overlayX;
        const dy = clamped.overlayY - prevBounds.overlayY;
        return {
          ...item,
          optionOverlays: translateMcqOverlays(item.optionOverlays, dx, dy),
          mcqGroupBounds: clamped,
        };
      }),
    );
  };

  const resizeMcqGroup = (itemId: string, bounds: OverlayRect) => {
    const clamped = clampMcqGroupBounds(bounds);
    setMcqItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const layout = item.mcqGroupLayout ?? inferMcqGroupLayout(clamped);
        const optionOverlays = layoutMcqGroupInBounds(
          clamped,
          layout,
          getMcqButtonSizePct(item),
        );
        return {
          ...item,
          mcqButtonsSeparated: false,
          optionOverlays,
          mcqGroupBounds: clamped,
          mcqGroupLayout: layout,
        };
      }),
    );
  };

  const updateMcqButtonSize = (itemId: string, sizePct: number) => {
    setMcqItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return reflowMcqItemPlacements({
          ...item,
          mcqButtonSizePct: sizePct,
        });
      }),
    );
  };

  const moveMcqButton = (
    itemId: string,
    letter: McqOptionLetter,
    rect: OverlayRect,
  ) => {
    const placed = finalizeMcqButtonPlacement(rect);
    setMcqItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const optionOverlays = { ...item.optionOverlays, [letter]: placed };
        return {
          ...item,
          optionOverlays,
          mcqGroupBounds: boundsFromMcqOverlays(optionOverlays) ?? undefined,
        };
      }),
    );
  };

  const placeMcqOverlay = (pageNumber: number, ref: McqOverlayRef, bounds: OverlayRect) => {
    const item = mcqItems.find((i) => i.id === ref.itemId);
    const qn = item?.questionNumber ?? "?";

    if (item?.mcqButtonsSeparated) {
      const placed =
        bounds.overlayW <= MCQ_BUTTON_SIZE_PCT * 1.25 &&
        bounds.overlayH <= MCQ_BUTTON_SIZE_PCT * 1.25
          ? finalizeMcqButtonPlacement(bounds)
          : mcqButtonRectAtCenter(
              bounds.overlayX + bounds.overlayW / 2,
              bounds.overlayY + bounds.overlayH / 2,
              Math.min(getMcqButtonSizePct(item), bounds.overlayW, bounds.overlayH),
            );
      setMcqItems((prev) =>
        prev.map((row) => {
          if (row.id !== ref.itemId) return row;
          const optionOverlays = { ...row.optionOverlays, [ref.letter]: placed };
          return {
            ...row,
            pageNumber,
            optionOverlays,
            mcqGroupBounds: boundsFromMcqOverlays(optionOverlays) ?? undefined,
          };
        }),
      );
      const next = nextMcqPlacementLetter(ref.letter);
      if (next) {
        setArmedMcq({ itemId: ref.itemId, letter: next });
        toast.success(`Placed Q${qn} ${ref.letter} — now place ${next}.`);
      } else {
        setArmedMcq(null);
        toast.success(`Placed Q${qn} ${ref.letter} (all letters done).`);
      }
      return;
    }

    const clamped = clampMcqGroupBounds(bounds);
    const groupLayout = inferMcqGroupLayout(clamped);
    const layouts = layoutMcqGroupInBounds(
      clamped,
      groupLayout,
      item ? getMcqButtonSizePct(item) : MCQ_BUTTON_SIZE_PCT,
    );
    setMcqItems((prev) =>
      prev.map((row) => {
        if (row.id !== ref.itemId) return row;
        return {
          ...row,
          pageNumber,
          mcqButtonsSeparated: false,
          optionOverlays: layouts,
          mcqGroupBounds: clamped,
          mcqGroupLayout: groupLayout,
        };
      }),
    );
    setArmedMcq(null);
    toast.success(`Placed Q${qn} A–D on page ${pageNumber}.`);
  };

  const clearMcqPlacement = (itemId: string) => {
    setMcqItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          pageNumber: undefined,
          optionOverlays: {},
          mcqGroupBounds: undefined,
          mcqGroupLayout: undefined,
        };
      }),
    );
    if (armedMcq?.itemId === itemId) setArmedMcq(null);
    if (selectedMcqItemId === itemId) setSelectedMcqItemId(null);
    const qn = mcqItems.find((i) => i.id === itemId)?.questionNumber ?? "?";
    toast.message(`Cleared Q${qn} buttons — place again manually.`);
  };

  const toggleMcqSeparated = (itemId: string) => {
    const item = mcqItems.find((i) => i.id === itemId);
    if (!item) {
      toast.error("Could not find that MCQ item.");
      return;
    }
    const willSeparate = !item?.mcqButtonsSeparated;
    const qn = item?.questionNumber ?? "?";
    setMcqItems((prev) =>
      prev.map((row) => {
        if (row.id !== itemId) return row;
        return {
          ...row,
          mcqButtonsSeparated: willSeparate,
          mcqGroupBounds: willSeparate
            ? undefined
            : boundsFromMcqOverlays(row.optionOverlays) ?? row.mcqGroupBounds,
        };
      }),
    );
    setSelectedMcqItemId(itemId);
    if (willSeparate) {
      const letter = firstMissingMcqLetter(item) ?? "A";
      setArmedMcq({ itemId, letter });
      toast.message(
        `Q${qn}: drag each A–D on its own. Click a letter in the sidebar, then click the PDF.`,
      );
    } else {
      setArmedMcq(null);
      toast.message(`Q${qn}: buttons move together as a group.`);
    }
  };

  const startManualMcqPlace = (item: PracticeExamMcqItem) => {
    const letter = firstMissingMcqLetter(item) ?? "A";
    setMcqItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, mcqButtonsSeparated: true } : row,
      ),
    );
    setSelectedMcqItemId(item.id);
    setArmedMcq({ itemId: item.id, letter });
    setArmedPaletteIndex(null);
    setSelectedSlotId(null);
    if (item.pageNumber) scrollToMcqPage(item.pageNumber);
  };

  const armMcqLetter = (itemId: string, letter: McqOptionLetter) => {
    setSelectedMcqItemId(itemId);
    setArmedMcq({ itemId, letter });
    setArmedPaletteIndex(null);
    setSelectedSlotId(null);
    const page = mcqItems.find((i) => i.id === itemId)?.pageNumber;
    if (page) scrollToMcqPage(page);
  };

  const selectMcqItem = (itemId: string) => {
    setSelectedMcqItemId(itemId);
    setArmedPaletteIndex(null);
    setSelectedSlotId(null);
    const page = mcqItems.find((i) => i.id === itemId)?.pageNumber;
    if (page) scrollToMcqPage(page);
  };

  const armedPaletteSlot =
    armedPaletteIndex != null ? palette[armedPaletteIndex] ?? null : null;

  const removeSelectedSlot = () => {
    if (!selectedSlotId) return;
    setSlots((prev) => prev.filter((s) => s.id !== selectedSlotId));
    setSelectedSlotId(null);
  };

  const handleSave = async (publishToStudents: boolean) => {
    if (!subjectId || !year) return;
    if (!pages.length) {
      toast.error("Upload an exam PDF first.");
      return;
    }
    const willPublish = publishToStudents;
    if (willPublish && layout === "written" && !slots.length) {
      toast.message(
        "No answer boxes placed yet — the paper will publish but students won't have input fields.",
        { duration: 6000 },
      );
    }
    if (
      willPublish &&
      layout === "mcq_then_written" &&
      !mcqItems.length &&
      !slots.length
    ) {
      toast.message(
        "No MCQ answers or written boxes yet — students won't be able to answer.",
        { duration: 6000 },
      );
    }
    setSaving(true);
    try {
      for (const page of pages) {
        const imageDataUrl = await compressExamPageForStorage(page.imageDataUrl);
        await savePracticeExamPage(subjectId, year, examNumber, {
          pageNumber: page.pageNumber,
          imageDataUrl,
        });
      }
      const writtenSlots =
        layout === "mcq_then_written"
          ? slots.filter((slot) => !isMcqSlotKey(slot.key))
          : slots;
      await savePracticeExamMeta(subjectId, year, examNumber, {
        slots: writtenSlots,
        published: willPublish,
        layout,
        mcqCount: layout === "mcq_then_written" ? mcqCount : 0,
        mcqItems:
          layout === "mcq_then_written"
            ? normalizeMcqItems(
                mcqCount,
                buildMcqRows(mcqCount, mcqItems),
              )
            : [],
      });
      setSavedPublished(willPublish);
      setSavedHasPages(true);
      await loadExam();

      const studentPath = `Practice → ${subjectName} → Exams → ${practiceExamFullLabel(year, examNumber)}`;
      if (willPublish) {
        toast.success(`${practiceExamFullLabel(year, examNumber)} published. Students: ${studentPath}.`, {
          duration: 10000,
        });
        navigate(studentExamPath);
      } else if (savedPublished) {
        toast.success(`Changes saved for ${practiceExamFullLabel(year, examNumber)}.`);
      } else {
        toast.success(
          `Draft saved for ${practiceExamFullLabel(year, examNumber)}. Only you can preview it until you publish.`,
          { duration: 8000 },
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!subjectId || !year) return;
    if (!window.confirm(`Delete ${year} Exam ${examNumber} for this subject?`)) return;
    setSaving(true);
    try {
      await deletePracticeExam(subjectId, year, examNumber);
      setPages([]);
      setSlots([]);
      setPalette([]);
      setPasteSolutionsText("");
      setSavedPublished(false);
      setSavedHasPages(false);
      toast.success("Exam deleted.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="font-display flex items-center gap-2 text-lg">
          <FileText className="size-5 text-brand" />
          Practice exams
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload the exam PDF, paste answers as TSV, place A–D buttons on the paper for MCQs, then
          written boxes for Part B.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Subject" />
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
          <div className="space-y-1.5">
            <Label>Exam year</Label>
            <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {PRACTICE_EXAM_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Exam paper</Label>
            <Select
              value={String(examNumber)}
              onValueChange={(v) => v && setExamNumber(Number(v) === 2 ? 2 : 1)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Exam" />
              </SelectTrigger>
              <SelectContent>
                {PRACTICE_EXAM_NUMBERS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Exam {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Layout</Label>
            <Select
              value={layout}
              onValueChange={(v) => {
                const next: PracticeExamLayout =
                  v === "mcq_then_written" ? "mcq_then_written" : "written";
                setLayout(next);
                if (next === "mcq_then_written") {
                  setMcqCount(defaultMcqCount(subjectId, examNumber));
                  setAdminPlaceMode("mcq");
                } else {
                  setMcqCount(0);
                  setMcqItems([]);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="written">{practiceExamLayoutLabel("written")}</SelectItem>
                <SelectItem value="mcq_then_written">
                  {practiceExamLayoutLabel("mcq_then_written")}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {subjectId === "methods" && examNumber === 1
                ? "Methods Exam 1 is fully written."
                : subjectId === "methods" && examNumber === 2
                  ? "Methods Exam 2: Q1–20 multiple choice, then written."
                  : "Choose how students answer this paper."}
            </p>
          </div>
          <div className="flex items-end sm:col-span-2">
            <input
              ref={examFileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleExamPdf(file);
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full gap-2"
              disabled={busy || saving}
              onClick={() => examFileRef.current?.click()}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Exam PDF
            </Button>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-black/10 bg-[#fafbfc] p-3">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Answers (TSV)
          </Label>
          <Textarea
            value={pasteSolutionsText}
            onChange={(e) => setPasteSolutionsText(e.target.value)}
            placeholder={
              layout === "mcq_then_written"
                ? "question\tpart\tanswer\tmarks\n1\tmcq\tB\t1\n2\tmcq\tD\t1\n21\ta\t42\t2"
                : "question\tpart\tanswer\tmarks\n1\ta\t42\t2"
            }
            rows={layout === "mcq_then_written" ? 7 : 6}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {layout === "mcq_then_written"
              ? "Use part=mcq for Q1–20, then a/b for written parts. MCQ buttons are placed on the PDF."
              : "Header row optional. Use part letters a, b, c for subparts."}
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={applyPastedSolutions}>
            Parse TSV
          </Button>
        </div>

        {layout === "mcq_then_written" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={adminPlaceMode === "mcq" ? "accent" : "outline"}
              onClick={() => {
                setAdminPlaceMode("mcq");
                setArmedPaletteIndex(null);
                setSelectedSlotId(null);
              }}
            >
              Place MCQ buttons
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!pages.length || busy}
              onClick={() => {
                const file = examPdfFileRef.current;
                if (file) void runAutoAlignMcq(file, mcqItems, mcqCount);
              }}
            >
              Re-align from PDF
            </Button>
            <Button
              type="button"
              size="sm"
              variant={adminPlaceMode === "written" ? "accent" : "outline"}
              onClick={() => {
                setAdminPlaceMode("written");
                setArmedMcq(null);
                setSelectedMcqItemId(null);
                setArmedPaletteIndex(null);
              }}
            >
              Place written boxes
            </Button>
          </div>
        ) : null}

        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            savedPublished && savedHasPages
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : savedHasPages
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-black/10 bg-[#fafbfc] text-muted-foreground"
          }`}
        >
          <p className="font-medium">
            {savedPublished && savedHasPages
              ? "Published — students can open this exam"
              : savedHasPages
                ? "Draft — only you can preview (students see “Coming soon”)"
                : "Not saved yet — upload a PDF and save when ready"}
          </p>
          <p className="mt-1 text-[12px] opacity-90">
            Slot: <strong>{subjectName}</strong> · <strong>{year}</strong> ·{" "}
            <strong>Exam {examNumber}</strong>
            {savedHasPages ? (
              <>
                {" "}
                · Student path: Practice → {subjectName} → Exams →{" "}
                {practiceExamFullLabel(year, examNumber)}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {pages.length > 0 && studentExamPath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(studentExamPath)}
            >
              <ExternalLink className="size-4" />
              {savedPublished ? "Open as student" : "Preview (admin only)"}
            </Button>
          ) : null}
          {savedPublished && studentExamsListPath ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(studentExamsListPath)}
            >
              <ExternalLink className="size-4" />
              Exams list
            </Button>
          ) : null}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || loading}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={saving || loading || busy || !pages.length}
              onClick={() => void handleSave(savedPublished)}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {savedPublished ? "Save changes" : "Save draft"}
            </Button>
            {!savedPublished ? (
              <Button
                type="button"
                variant="accent"
                size="sm"
                className="gap-1.5"
                disabled={saving || loading || busy || !pages.length}
                onClick={() => void handleSave(true)}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Publish to students
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/15 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading exam…
          </div>
        ) : layout === "mcq_then_written" && adminPlaceMode === "mcq" && !pages.length ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-[#fafbfc] px-6 py-10 text-center text-sm text-muted-foreground">
            Upload the exam PDF, parse TSV answers, then place A–D buttons on each page.
          </div>
        ) : layout === "mcq_then_written" && adminPlaceMode === "mcq" ? (
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3 rounded-xl border border-black/10 bg-[#fafbfc] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                MCQ questions
              </p>
              <p className="text-[11px] text-muted-foreground">
                Questions are listed Q1–Q20 in order. Green letter = correct answer. Use{" "}
                <strong>Place manually</strong> when auto-detect fails (e.g. image options). Use{" "}
                <strong>Separate</strong> to place and drag each letter individually (opaque white
                behind each button).
              </p>
              <label className="flex cursor-pointer items-start gap-2 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={hideMcqPdfLetters}
                  onChange={(e) => setHideMcqPdfLetters(e.target.checked)}
                />
                <span>
                  Hide printed A–D on the PDF behind buttons (turns off while placing a letter).
                </span>
              </label>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {buildMcqRows(mcqCount, mcqItems).map((item) => {
                  const placed = mcqPlacementCount(item);
                  const isSelected = selectedMcqItemId === item.id;
                  const page = item.pageNumber;
                  const complete = isMcqFullyPlaced(item);
                  const answerLetter = normalizeMcqLetter(item.acceptedAnswer);
                  const hasAnswer = Boolean(answerLetter);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-xs",
                        isSelected
                          ? "border-brand bg-brand/10"
                          : !complete
                            ? "border-amber-400/60 bg-amber-50/50"
                            : "border-black/10 bg-white",
                      )}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 text-left"
                        onClick={() => selectMcqItem(item.id)}
                      >
                        <span className="font-medium">
                          Q{item.questionNumber}
                          {item.mcqButtonsSeparated ? (
                            <span className="ml-1 rounded bg-brand/15 px-1 py-px text-[9px] font-semibold text-brand">
                              sep
                            </span>
                          ) : null}
                          {hasAnswer ? (
                            <span className="ml-1.5 text-[10px] font-bold text-success">
                              = {answerLetter}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                            complete
                              ? "bg-success/15 text-success"
                              : placed > 0
                                ? "bg-amber-100 text-amber-800"
                                : "bg-black/5 text-muted-foreground",
                          )}
                        >
                          {placed}/4{page ? ` · p.${page}` : placed === 4 ? " · no page" : ""}
                        </span>
                      </button>
                      <div className="mt-2 flex gap-1">
                        {MCQ_OPTION_LETTERS.map((letter) => {
                          const isKey = answerLetter === letter;
                          const isPlaced = Boolean(item.optionOverlays?.[letter]);
                          return (
                            <button
                              key={letter}
                              type="button"
                              className={cn(
                                "flex-1 rounded border py-1 text-center text-[11px] font-bold",
                                armedMcq?.itemId === item.id && armedMcq.letter === letter
                                  ? "border-brand bg-brand text-white"
                                  : isKey
                                    ? "border-success bg-success text-white ring-1 ring-success/40"
                                    : isPlaced
                                      ? "border-black/20 bg-white text-[#0b0f19]"
                                      : "border-black/15 bg-white hover:bg-black/5",
                              )}
                              onClick={() => armMcqLetter(item.id, letter)}
                            >
                              {letter}
                            </button>
                          );
                        })}
                      </div>
                      {placed > 0 ? (
                        <label
                          className="mt-2 block space-y-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Button size</span>
                            <span>
                              {(item.mcqButtonSizePct ?? MCQ_BUTTON_SIZE_PCT).toFixed(1)}%
                            </span>
                          </span>
                          <input
                            type="range"
                            min={MCQ_BUTTON_SIZE_MIN_PCT}
                            max={MCQ_BUTTON_SIZE_SLIDER_MAX_PCT}
                            step={0.1}
                            value={item.mcqButtonSizePct ?? MCQ_BUTTON_SIZE_PCT}
                            onChange={(e) =>
                              updateMcqButtonSize(item.id, Number(e.target.value))
                            }
                            className="h-1.5 w-full cursor-pointer accent-brand"
                          />
                          <span className="text-[9px] text-muted-foreground">
                            Drag the box corner to spread A–D apart; slider changes circle size.
                          </span>
                        </label>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!complete ? (
                          <Button
                            type="button"
                            variant="accent"
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => startManualMcqPlace(item)}
                          >
                            Place manually
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => toggleMcqSeparated(item.id)}
                        >
                          {item.mcqButtonsSeparated ? "Link group" : "Separate"}
                        </Button>
                        {placed > 0 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-danger"
                            onClick={() => clearMcqPlacement(item.id)}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {armedMcq ? (
                <p className="border-t border-black/10 pt-2 text-[11px] text-muted-foreground">
                  {(() => {
                    const armedItem = mcqItems.find((i) => i.id === armedMcq.itemId);
                    const qn = armedItem?.questionNumber ?? "?";
                    if (armedItem?.mcqButtonsSeparated) {
                      return `Placing Q${qn} letter ${armedMcq.letter} — click or drag on the PDF.`;
                    }
                    return `Placing Q${qn} A–D together — drag a box on the page. Small drag = tight; larger = spread apart.`;
                  })()}
                </p>
              ) : null}
            </aside>
            <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
              {pages.map((page) => (
                <McqPageEditor
                  key={`mcq-${page.pageNumber}`}
                  page={page}
                  items={mcqItems}
                  armed={armedMcq}
                  hidePdfLetters={hideMcqPdfLetters}
                  selectedItemId={selectedMcqItemId}
                  onSelectItem={setSelectedMcqItemId}
                  onPlaceOverlay={placeMcqOverlay}
                  onMoveMcqGroup={moveMcqGroup}
                  onResizeMcqGroup={resizeMcqGroup}
                  onMoveMcqButton={moveMcqButton}
                />
              ))}
            </div>
          </div>
        ) : !pages.length ? (
          <div className="rounded-xl border border-dashed border-black/15 bg-[#fafbfc] px-6 py-10 text-center text-sm text-muted-foreground">
            Upload an exam PDF to place written answer boxes.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-3 rounded-xl border border-black/10 bg-[#fafbfc] p-3">
              <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Answer slots
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={addManualPaletteSlot}
                >
                  <Plus className="size-3" />
                  Add
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {layout === "mcq_then_written"
                  ? "Written subparts only (Q21a, Q22b, …). Place boxes on the exam paper for Part B."
                  : "Each row is one subpart (Q1a, Q1b, …). Select a subpart, then drag on the exam page to draw its box."}
              </p>
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {palette.length ? (
                  palette.map((slot, index) => {
                    const placed = placedByKey.get(slot.key.trim().toLowerCase());
                    const isArmed = armedPaletteIndex === index;
                    const isPlacedSelected = placed?.id === selectedSlotId;
                    return (
                      <button
                        key={`${slot.key}-${index}`}
                        type="button"
                        className={cn(
                          "w-full rounded-lg border px-2 py-2 text-left text-xs transition-colors",
                          isArmed || isPlacedSelected
                            ? "border-brand bg-brand/10"
                            : placed
                              ? "border-black/10 bg-white/60 hover:bg-white/80"
                              : "border-black/10 bg-white hover:bg-white/80",
                        )}
                        onClick={() => {
                          if (placed) {
                            setArmedPaletteIndex(null);
                            setSelectedSlotId(placed.id);
                            return;
                          }
                          setSelectedSlotId(null);
                          setArmedPaletteIndex((current) =>
                            current === index ? null : index,
                          );
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium text-foreground">
                            {shortLabelFromSlotKey(slot.key)}
                          </div>
                          <span
                            className={cn(
                              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              placed
                                ? "bg-success/15 text-success"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {placed ? "Placed" : "Place"}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-muted-foreground">
                          {slot.acceptedAnswer}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Paste answers as TSV above, or use Add.
                  </p>
                )}
              </div>

              {armedPaletteSlot ? (
                <div className="space-y-2 border-t border-black/10 pt-3">
                  <p className="text-xs font-semibold text-foreground">
                    Placing — {shortLabelFromSlotKey(armedPaletteSlot.key)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Drag on the exam page to draw this box. Drawn boxes are transparent by
                    default (no white fill or dotted lines).
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-black/20"
                      checked={!armedPaletteSlot.transparentInput}
                      onChange={(e) =>
                        updatePaletteEntry(armedPaletteIndex!, {
                          transparentInput: !e.target.checked,
                        })
                      }
                    />
                    White ruled box (visible on PDF)
                  </label>
                </div>
              ) : selectedSlot ? (
                <div className="space-y-2 border-t border-black/10 pt-3">
                  <p className="text-xs font-semibold text-foreground">
                    Selected box — {shortLabelFromSlotKey(selectedSlot.key)}
                  </p>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="size-3.5 rounded border-black/20"
                      checked={!selectedSlot.transparentInput}
                      onChange={(e) =>
                        updateSelectedSlot({ transparentInput: !e.target.checked })
                      }
                    />
                    White ruled box (visible on PDF)
                  </label>
                  <Input
                    value={selectedSlot.acceptedAnswer}
                    onChange={(e) => updateSelectedSlot({ acceptedAnswer: e.target.value })}
                    placeholder="Correct answer (from solutions)"
                    className="h-8 text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={removeSelectedSlot}
                  >
                    Remove box
                  </Button>
                </div>
              ) : null}
              </>
            </aside>

            <div className="max-h-[70vh] space-y-6 overflow-y-auto pr-1">
              {pages.map((page) => (
                <ExamPageEditor
                  key={page.pageNumber}
                  page={page}
                  slots={slots}
                  armedPaletteIndex={armedPaletteIndex}
                  armedPaletteSlot={armedPaletteSlot}
                  selectedSlotId={selectedSlotId}
                  onSelectSlot={setSelectedSlotId}
                  onSlotsChange={updateSlotsForPage}
                  onPlaceArmedRect={placeArmedSlotRect}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
