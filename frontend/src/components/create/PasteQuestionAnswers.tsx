import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { QuestionDraft } from "@/lib/createAssessmentDraft";
import {
  applyPastedAnswerText,
  countDraftAnswerSlots,
  fillDraftAnswersWithAi,
} from "@/lib/createPdfAnswerImport";

type PasteQuestionAnswersProps = {
  draft: QuestionDraft;
  onChange: (draft: QuestionDraft) => void;
};

export function PasteQuestionAnswers({ draft, onChange }: PasteQuestionAnswersProps) {
  const [solutionsText, setSolutionsText] = useState("");
  const [formattedPaste, setFormattedPaste] = useState("");
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const slotCount = countDraftAnswerSlots(draft);

  const fillFromSolutions = async () => {
    if (!solutionsText.trim()) {
      toast.error("Paste your solutions text first.");
      return;
    }
    setLoading(true);
    try {
      const { question, filled, message } = await fillDraftAnswersWithAi(draft, solutionsText);
      if (!filled) {
        toast.error(message || "Could not match answers — check your parts match the solutions.");
        return;
      }
      onChange(question);
      toast.success(message || "Answers filled — check the fields above.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Auto-fill failed.");
    } finally {
      setLoading(false);
    }
  };

  const applyManual = () => {
    if (!formattedPaste.trim()) {
      toast.error("Paste formatted answers first.");
      return;
    }
    const { question, filled, warnings } = applyPastedAnswerText(draft, formattedPaste);
    if (!filled) {
      toast.error("Couldn't parse that format.");
      return;
    }
    onChange(question);
    warnings.forEach((warning) => toast.message(warning));
    toast.success("Answers applied.");
  };

  return (
    <div className="space-y-2 rounded-xl border border-brand/20 bg-brand/[0.03] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Solutions → answers
        </Label>
        {slotCount > 0 ? (
          <span className="text-[11px] text-muted-foreground">
            {slotCount} answer slot{slotCount === 1 ? "" : "s"} in this question
          </span>
        ) : null}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Paste solutions for <strong className="font-medium text-foreground">this question only</strong>.
        Use <strong className="font-medium text-foreground">Split into parts</strong> first so slot count
        matches VCAA (e.g. 9 parts if b and d have sub-parts). Each part needs its real question text,
        not just &quot;a)&quot;.
      </p>
      <Textarea
        className="min-h-[8rem] border-black/10 bg-white text-xs"
        placeholder="Paste solutions for this question — messy VCAA text is fine…"
        value={solutionsText}
        onChange={(e) => setSolutionsText(e.target.value)}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={loading}
        onClick={() => void fillFromSolutions()}
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
        Auto-fill from solutions
      </Button>

      <button
        type="button"
        className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setShowManual((open) => !open)}
      >
        {showManual ? "Hide manual paste" : "Manual paste ([[ANSWER]] format)"}
      </button>

      {showManual ? (
        <div className="space-y-2 border-t border-black/8 pt-2">
          <Textarea
            className="min-h-[6rem] border-black/10 bg-white font-mono text-xs"
            placeholder={"[[TEXT]] a) …\n[[ANSWER]] 14"}
            value={formattedPaste}
            onChange={(e) => setFormattedPaste(e.target.value)}
          />
          <Button type="button" variant="outline" size="sm" onClick={applyManual}>
            Apply manual paste
          </Button>
        </div>
      ) : null}
    </div>
  );
}
