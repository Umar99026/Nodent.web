import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS, isAdminUser } from "@/lib/constants";
import {
  loadPracticeBank,
  readCustomQuestionsCache,
  refreshCustomQuestionsCache,
  QUESTIONS_UPDATED_EVENT,
} from "@/lib/questionBankCache";
import { canonicalPracticeTopic } from "@/lib/practiceQuestions";
import { baseSubjects, subjectsForUser, type Question } from "@/lib/subjects";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BattleQuestion =
  | { type: "mcq"; question: string; options: string[]; answer: string; topic?: string }
  | { type: "short" | "short_answer"; question: string; acceptedAnswers: string[]; topic?: string };

interface Challenge {
  id: string;
  challengerId: string;
  challengerUsername: string;
  subjectId: string;
  topic: string;
  createdAt: string;
}

function toBattleQuestion(q: Question): BattleQuestion | null {
  if (q.type === "mcq" && q.options?.length && q.answer) {
    return {
      type: "mcq",
      question: q.question,
      options: q.options,
      answer: q.answer,
      topic: q.topic,
    };
  }
  if (q.type === "short" && q.acceptedAnswers?.length) {
    return {
      type: "short",
      question: q.question,
      acceptedAnswers: q.acceptedAnswers,
      topic: q.topic,
    };
  }
  return null;
}

function filterByTopic(
  subjectId: string,
  questions: Question[],
  topicMode: string,
): Question[] {
  const pool = questions.filter((q) => q.type === "mcq" || q.type === "short");
  if (topicMode === "mix") return pool;
  return pool.filter(
    (q) => canonicalPracticeTopic(subjectId, q) === topicMode,
  );
}

function pickRandomQuestions<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default function DojoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const visibleSubjects = useMemo(() => subjectsForUser({ isAdmin }), [isAdmin]);

  const [subjectId, setSubjectId] = useState<string>(() => visibleSubjects[0]?.id ?? baseSubjects[0]?.id ?? "");
  const [topicMode, setTopicMode] = useState<string>("mix"); // "mix" or a specific topic

  const [isChallenging, setIsChallenging] = useState(false);

  const [customQuestionsCache, setCustomQuestionsCache] = useState(
    readCustomQuestionsCache,
  );

  const [rangeMode, setRangeMode] = useState<"all" | "week" | "daily">("all");
  const [leaderboard, setLeaderboard] = useState<
    { username: string; percent: number; correct: number; total: number }[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const [incomingChallenges, setIncomingChallenges] = useState<Challenge[]>([]);
  const seenChallengeIdsRef = useRef<Set<string>>(new Set());

  const [topicDialogOpen, setTopicDialogOpen] = useState(false);
  const [challengeOpponentUsername, setChallengeOpponentUsername] = useState<string | null>(null);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const opp = (qs.get("opponent") || "").trim();
    if (opp) setChallengeOpponentUsername(opp);
  }, [location.search]);

  const practiceQuestions = useMemo(() => {
    if (!subjectId) return [];
    return loadPracticeBank(subjectId, customQuestionsCache);
  }, [subjectId, customQuestionsCache]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    for (const q of practiceQuestions) {
      if (q.type !== "mcq" && q.type !== "short") continue;
      set.add(canonicalPracticeTopic(subjectId, q));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [practiceQuestions, subjectId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const map = await refreshCustomQuestionsCache();
        if (!cancelled) setCustomQuestionsCache(map);
      } catch {
        /* use localStorage cache */
      }
    })();
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent<Record<string, unknown[]>>).detail;
      if (detail) setCustomQuestionsCache(detail);
      else setCustomQuestionsCache(readCustomQuestionsCache());
    };
    window.addEventListener(QUESTIONS_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(QUESTIONS_UPDATED_EVENT, onUpdated);
    };
  }, []);

  const fetchIncoming = async () => {
    const data = await apiFetch<{ challenges: Challenge[] }>(API_PATHS.dojo.challenges);
    setIncomingChallenges(data.challenges ?? []);

    // Toast for newly seen challenge ids (ephemeral notification)
    for (const c of data.challenges ?? []) {
      if (!seenChallengeIdsRef.current.has(c.id)) {
        seenChallengeIdsRef.current.add(c.id);
        toast.message(`Challenge from ${c.challengerUsername} (${c.subjectId})`, { duration: 5000 });
      }
    }
  };

  // Load incoming + mark as read when you open dojo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiFetch(API_PATHS.dojo.readChallenges, { method: "POST" });
      } catch {
        // ignore
      }
      if (cancelled) return;
      try {
        await fetchIncoming();
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll incoming challenges
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchIncoming().catch(() => {});
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const buildQuestionSetForChallenge = useMemo(() => {
    return () => {
      const filtered = filterByTopic(subjectId, practiceQuestions, topicMode);
      const battle = filtered
        .map(toBattleQuestion)
        .filter((q): q is BattleQuestion => q != null);
      if (battle.length < 10) return [];
      return pickRandomQuestions(battle, 10);
    };
  }, [practiceQuestions, topicMode, subjectId]);

  const canStartBattle = useMemo(() => {
    const filtered = filterByTopic(subjectId, practiceQuestions, topicMode);
    return filtered.length >= 10;
  }, [practiceQuestions, topicMode, subjectId]);

  const handleChallenge = async (opponentUsername: string) => {
    if (!subjectId) return;

    const questionSet = buildQuestionSetForChallenge();
    if (!questionSet || questionSet.length !== 10) {
      toast.error("Not enough questions for that topic. Try 'Mix all'.");
      return;
    }

    setIsChallenging(true);
    try {
      await apiFetch<{ ok: true; challengeId: string }>(API_PATHS.dojo.createChallenge, {
        method: "POST",
        body: JSON.stringify({
          opponentUsername,
          subjectId,
          topic: topicMode === "mix" ? "General" : topicMode,
          questionSet,
        }),
      });
      toast.success(`Challenge sent to ${opponentUsername}`);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to send challenge.");
    } finally {
      setIsChallenging(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!subjectId) return;
      try {
        setLeaderboardLoading(true);
        const data = await apiFetch<{
          leaderboard?: { username: string; percent: number; correct: number; total: number }[];
        }>(
          `/api/competition/${subjectId}/stats?range=${rangeMode}`,
        );
        if (cancelled) return;
        setLeaderboard(data?.leaderboard ?? []);
      } catch {
        if (cancelled) return;
        setLeaderboard([]);
      } finally {
        if (cancelled) return;
        setLeaderboardLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [subjectId, rangeMode]);

  return (
    <AppShell title="Dojo" subtitle="Battle friends in timed question matches.">
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
          <Card className="paper-texture border-black/10 bg-white text-black">
            <CardHeader>
              <CardTitle className="font-display text-xl">Challenge a player</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <Select
                    value={subjectId}
                    onValueChange={(val) => val && setSubjectId(val)}
                  >
                    <SelectTrigger className="h-11 border-black/10 bg-white text-black">
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent className="bg-white text-black border border-black/10">
                      {visibleSubjects.map((s) => (
                        <SelectItem
                          key={s.id}
                          value={s.id}
                          className="text-black focus:bg-white/90"
                        >
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-black/70">
                    Pick opponent from the leaderboard
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className={
                        rangeMode === "all"
                          ? "bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                          : "bg-white text-black hover:bg-white/90 border border-black/10"
                      }
                      onClick={() => setRangeMode("all")}
                      disabled={leaderboardLoading}
                    >
                      Main
                    </Button>
                    <Button
                      size="sm"
                      className={
                        rangeMode === "week"
                          ? "bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                          : "bg-white text-black hover:bg-white/90 border border-black/10"
                      }
                      onClick={() => setRangeMode("week")}
                      disabled={leaderboardLoading}
                    >
                      Weekly
                    </Button>
                    <Button
                      size="sm"
                      className={
                        rangeMode === "daily"
                          ? "bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                          : "bg-white text-black hover:bg-white/90 border border-black/10"
                      }
                      onClick={() => setRangeMode("daily")}
                      disabled={leaderboardLoading}
                    >
                      Daily
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-black/10 bg-white px-2 py-2">
                  {leaderboardLoading ? (
                    <div className="px-4 py-6 text-sm text-black/70">
                      Loading…
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-black/60">
                      No leaderboard data yet.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[#0b0f19]/60">
                            Player
                          </TableHead>
                          <TableHead className="text-right text-[#0b0f19]/60">
                            %
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaderboard.map((row, idx) => {
                          const isMe = (user?.username ?? "") === row.username;
                          return (
                            <TableRow key={`${row.username}-${idx}`}>
                              <TableCell className="font-medium text-[#0b0f19]">
                                <button
                                  type="button"
                                  disabled={isMe}
                                  className={`block w-full text-left ${
                                    isMe
                                      ? "cursor-not-allowed opacity-50"
                                      : "hover:underline"
                                  }`}
                                  onClick={() => {
                                    if (isMe) return;
                                    setChallengeOpponentUsername(row.username);
                                    setTopicMode("mix");
                                    setTopicDialogOpen(true);
                                  }}
                                >
                                  {idx + 1}. {row.username}
                                </button>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-[#0b0f19] tabular-nums">
                                {row.percent}%
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-black/10 bg-white text-black paper-texture">
              <CardHeader className="pb-4">
                <CardTitle className="font-display text-xl">Incoming challenges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {incomingChallenges.length === 0 ? (
                  <div className="rounded-xl border border-black/10 bg-white px-4 py-4 text-sm text-black/60">
                    No one has challenged you yet.
                  </div>
                ) : (
                  incomingChallenges.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-black/10 bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-black">{c.challengerUsername}</div>
                          <div className="text-xs text-black/60">
                            {c.subjectId} • {c.topic}
                          </div>
                          <div className="text-[11px] text-black/40 mt-1">
                            {new Date(c.createdAt).toLocaleString()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="h-9 bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                          onClick={() =>
                            void (async () => {
                              try {
                                const data = await apiFetch<{ ok: true; battleId: string }>(
                                  API_PATHS.dojo.acceptChallenge(c.id),
                                  { method: "POST" },
                                );
                                if (data?.battleId) {
                                  navigate(`/dojo/battle/${data.battleId}`);
                                }
                              } catch (err) {
                                if (err instanceof ApiError) toast.error(err.message);
                                else toast.error("Failed to accept challenge.");
                              }
                            })()
                          }
                        >
                          Accept
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={topicDialogOpen}
        onOpenChange={(nextOpen) => {
          setTopicDialogOpen(nextOpen);
        }}
      >
        <DialogContent className="border border-black/10 bg-white text-black p-6">
          <DialogHeader>
            <DialogTitle>
              Challenge{" "}
              {challengeOpponentUsername ? (
                <span className="text-brand">{challengeOpponentUsername}</span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Pick a topic (MCQ + Short Answer only).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Select
                value={topicMode}
                onValueChange={(val) => val && setTopicMode(val)}
              >
                <SelectTrigger className="h-11 border-black/10 bg-white text-black">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-black border border-black/10">
                  <SelectItem
                    value="mix"
                    className="text-black focus:bg-white/90"
                  >
                    Mix all topics
                  </SelectItem>
                  {availableTopics.map((t) => (
                    <SelectItem
                      key={t}
                      value={t}
                      className="text-black focus:bg-white/90"
                    >
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!canStartBattle && (
              <p className="text-sm text-muted-foreground">
                Battles need at least 10 MCQ or Short Answer questions for this subject (add them in Admin).
              </p>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="border-black/20 text-black hover:bg-black/5"
              onClick={() => setTopicDialogOpen(false)}
              disabled={isChallenging}
            >
              Cancel
            </Button>
            <Button
              className="bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
              onClick={() => {
                if (!challengeOpponentUsername) return;
                void handleChallenge(challengeOpponentUsername);
                setTopicDialogOpen(false);
              }}
              disabled={isChallenging || !challengeOpponentUsername || !canStartBattle}
            >
              Challenge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

