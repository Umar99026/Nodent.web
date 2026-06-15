import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { stripMcqOptionPrefix } from "@/lib/questionDisplay";

type BattleState = {
  id: string;
  status: "active" | "completed";
  subjectId: string;
  topic: string;
  player1: { id: string; username: string };
  player2: { id: string; username: string };
  player1Score: number;
  player2Score: number;
  currentIndex: number;
  timeRemainingSeconds: number;
  currentQuestion: any | null;
  winnerId: string | null;
};

export default function DojoBattlePage() {
  const navigate = useNavigate();
  const { battleId } = useParams<{ battleId: string }>();

  const [battle, setBattle] = useState<BattleState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submitBusy, setSubmitBusy] = useState(false);

  const [selectedMcqOption, setSelectedMcqOption] = useState<string>("");
  const [shortAnswer, setShortAnswer] = useState<string>("");

  const fetchBattle = async () => {
    if (!battleId) return;
    setIsLoading(true);
    try {
      const data = await apiFetch<{ battle: BattleState }>(
        API_PATHS.dojo.battle(battleId),
      );
      setBattle(data?.battle ?? null);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to load battle.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchBattle();
    const interval = setInterval(() => {
      void fetchBattle();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleId]);

  // Reset inputs whenever question changes.
  useEffect(() => {
    setSelectedMcqOption("");
    setShortAnswer("");
  }, [battle?.currentIndex]);

  const question = battle?.currentQuestion ?? null;
  const isMcq = question?.type === "mcq";
  const isShort =
    question?.type === "short" || question?.type === "short_answer";

  const handleSubmit = async () => {
    if (!battle || !battleId || !battle.currentQuestion) return;
    if (submitBusy) return;
    if (battle.status !== "active") return;

    const questionIndex = battle.currentIndex;
    const payload: Record<string, unknown> = { questionIndex };
    if (isMcq) {
      if (!selectedMcqOption.trim()) return;
      payload.answer = selectedMcqOption;
      payload.selectedOption = selectedMcqOption;
    } else if (isShort) {
      if (!shortAnswer.trim()) return;
      payload.answer = shortAnswer;
    } else {
      return;
    }

    setSubmitBusy(true);
    try {
      await apiFetch(API_PATHS.dojo.answer(battleId), {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        // Stale submissions are expected in head-to-head mode; ignore.
        if (err.status !== 409) toast.error(err.message);
      } else {
        toast.error("Failed to submit answer.");
      }
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <AppShell title="Dojo Battle" subtitle="Same questions, first correct wins.">
      <div className="mx-auto max-w-4xl space-y-6">
        {isLoading && !battle ? (
          <div className="py-16 text-center text-black/70">Loading battle…</div>
        ) : !battle ? (
          <div className="py-16 text-center text-black/70">Battle not found.</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
              <Card className="border-black/10 bg-white text-black">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Player 1</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{battle.player1.username}</div>
                      <div className="text-xs text-black/60">Score</div>
                    </div>
                    <div className="text-3xl font-display font-bold text-black tabular-nums">
                      {battle.player1Score}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-black/10 bg-white text-black">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Player 2</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{battle.player2.username}</div>
                      <div className="text-xs text-black/60">Score</div>
                    </div>
                    <div className="text-3xl font-display font-bold text-black tabular-nums">
                      {battle.player2Score}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="rounded-2xl border border-black/10 bg-white p-5 text-black">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-white text-black border border-black/10">
                      {battle.subjectId}
                    </Badge>
                    <Badge variant="outline" className="border-black/20 text-black/80">
                      {battle.topic}
                    </Badge>
                  </div>
                  <div className="text-sm text-black/70">
                    Question {battle.currentIndex + 1} / 10
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-display text-4xl font-bold tabular-nums">
                    {battle.status === "active" ? battle.timeRemainingSeconds : 0}s
                  </div>
                  <div className="text-xs text-black/60">per question timer</div>
                </div>
              </div>
            </div>

            {battle.status === "completed" ? (
              <div className="rounded-2xl border border-black/10 bg-white p-5 text-black space-y-3">
                <div className="text-lg font-display font-semibold">Battle finished</div>
                <div className="text-sm text-black/70">
                  Final score: {battle.player1Score} - {battle.player2Score}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                    onClick={() => navigate("/dojo")}
                  >
                    Back to Dojo
                  </Button>
                </div>
              </div>
            ) : question ? (
              <div className="rounded-2xl border border-black/10 bg-white p-5 text-black space-y-4">
                <div className="space-y-2">
                  <div className="text-sm text-black/60">
                    {question.type === "mcq" ? "Multiple Choice" : "Short Answer"}
                  </div>
                  <div className="font-display text-2xl font-semibold leading-relaxed">
                    <RichQuestionContent
                      text={question.question}
                      className="prose prose-sm max-w-none prose-p:my-0"
                    />
                  </div>
                </div>

                {isMcq && Array.isArray(question.options) ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {question.options.map((opt: string, index: number) => {
                      const active = selectedMcqOption === opt;
                      const letter = String.fromCharCode(65 + index);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedMcqOption(opt)}
                          className={`rounded-xl border p-4 text-left transition-colors ${
                            active
                              ? "border-brand bg-brand/15"
                              : "border-black/15 bg-white hover:bg-white/70"
                          }`}
                        >
                          <div className="text-sm font-semibold">
                            <RichQuestionContent
                              text={stripMcqOptionPrefix(opt, letter)}
                              className="prose prose-sm max-w-none prose-p:my-0"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {isShort ? (
                  <div className="space-y-2">
                    <Label>Answer</Label>
                    <Textarea
                      value={shortAnswer}
                      onChange={(e) => setShortAnswer(e.target.value)}
                      placeholder="Type your short answer..."
                      rows={5}
                      className="bg-white border-black/10 text-black placeholder:text-black/50"
                    />
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    className="border-black/20 bg-white text-black hover:bg-white/80"
                    onClick={() => navigate("/dojo")}
                    disabled={submitBusy}
                  >
                    Leave battle
                  </Button>
                  <Button
                    onClick={() => void handleSubmit()}
                    disabled={
                      submitBusy ||
                      battle.status !== "active" ||
                      (isMcq && !selectedMcqOption.trim()) ||
                      (isShort && !shortAnswer.trim())
                    }
                    className="bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                  >
                    Submit
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-black/70">No question.</div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

