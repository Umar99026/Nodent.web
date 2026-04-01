import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { toast } from "sonner";
import { Loader2, UserPlus, Check, X, Swords } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Friend = { userId: number; username: string; email: string; since: string };
type FriendRequest = {
  requestId: number;
  userId: number;
  username: string;
  email: string;
  createdAt: string;
};

type AssignmentMessage = {
  id: number;
  fromUserId: number;
  toUserId: number;
  fromUsername: string;
  toUsername: string;
  subjectId: string;
  questionKey: string;
  question: any;
  createdAt: string;
  answer: any | null;
  answeredAt: string | null;
  isCorrect: boolean | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function FriendsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { friendId } = useParams<{ friendId?: string }>();
  const activeFriendId = friendId ? Number(friendId) : null;
  const myUserId = Number(user?.id ?? 0);

  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);

  const [search, setSearch] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<
    { userId: number; username: string; email: string }[]
  >([]);

  const [threadLoading, setThreadLoading] = useState(false);
  const [thread, setThread] = useState<AssignmentMessage[]>([]);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [friendScorecard, setFriendScorecard] = useState<{
    userId: number;
    username: string;
    points: number;
    correctAnswers: number;
    attempts: number;
  } | null>(null);

  const activeFriend = useMemo(
    () => friends.find((f) => f.userId === activeFriendId) ?? null,
    [friends, activeFriendId],
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([
        apiFetch<{ friends: Friend[] }>(API_PATHS.friends.list),
        apiFetch<{ incoming: FriendRequest[]; outgoing: FriendRequest[] }>(
          API_PATHS.friends.requests,
        ),
      ]);
      setFriends(f.friends ?? []);
      setIncoming(r.incoming ?? []);
      setOutgoing(r.outgoing ?? []);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not load friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadThread = useCallback(async () => {
    if (!activeFriendId) return;
    setThreadLoading(true);
    try {
      const t = await apiFetch<{ messages: AssignmentMessage[] }>(
        API_PATHS.friends.thread(activeFriendId),
      );
      setThread(t.messages ?? []);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not load thread.");
      setThread([]);
    } finally {
      setThreadLoading(false);
    }
  }, [activeFriendId]);

  const loadFriendScorecard = useCallback(async () => {
    if (!activeFriendId) return;
    setScorecardLoading(true);
    try {
      const r = await apiFetch<{
        userId: number;
        username: string;
        points: number;
        correctAnswers: number;
        attempts: number;
      }>(API_PATHS.friends.friendScorecard(activeFriendId));
      setFriendScorecard(r);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not load scorecard.");
      setFriendScorecard(null);
    } finally {
      setScorecardLoading(false);
    }
  }, [activeFriendId]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const doSearch = useCallback(async () => {
    const q = search.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const r = await apiFetch<{ users: { userId: number; username: string; email: string }[] }>(
        API_PATHS.friends.search(q),
      );
      setSearchResults(r.users ?? []);
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }, [search]);

  const sendRequest = async (toUserId: number) => {
    try {
      await apiFetch(API_PATHS.friends.sendRequest, {
        method: "POST",
        body: JSON.stringify({ toUserId }),
      });
      toast.success("Friend request sent.");
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not send request.");
    }
  };

  const accept = async (requestId: number) => {
    try {
      await apiFetch(API_PATHS.friends.acceptRequest(requestId), { method: "POST" });
      toast.success("Friend request accepted.");
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not accept request.");
    }
  };

  const reject = async (requestId: number) => {
    try {
      await apiFetch(API_PATHS.friends.rejectRequest(requestId), { method: "POST" });
      toast.success("Request rejected.");
      await loadAll();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not reject request.");
    }
  };

  const answerAssignment = async (assignmentId: number, answer: any) => {
    try {
      await apiFetch(API_PATHS.friends.answerAssignment(assignmentId), {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
      toast.success("Answer sent.");
      await loadThread();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not submit answer.");
    }
  };

  const relationshipLabel = (userId: number) => {
    if (friends.some((f) => f.userId === userId)) return "Friend";
    if (outgoing.some((r) => r.userId === userId)) return "Requested";
    if (incoming.some((r) => r.userId === userId)) return "Incoming";
    return null;
  };

  return (
    <AppShell title="Friends" subtitle="Send requests, challenge friends, and assign questions.">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="paper-texture border-black/10 bg-white text-black">
          <CardHeader>
            <CardTitle className="font-display text-lg">People</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search username or email…"
                  className="h-10 border-black/10 bg-white text-black"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void doSearch();
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10"
                  onClick={() => void doSearch()}
                  disabled={searchLoading}
                >
                  {searchLoading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
                </Button>
              </div>

              {searchResults.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-black/10 bg-[#faf8f5] p-3">
                  {searchResults.map((u) => {
                    const rel = relationshipLabel(u.userId);
                    return (
                      <div key={u.userId} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{u.username}</div>
                          <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        {rel ? (
                          <Badge variant="secondary">{rel}</Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="gap-2 bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                            onClick={() => void sendRequest(u.userId)}
                          >
                            <UserPlus className="size-4" />
                            Add
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            <Separator className="bg-black/10" />

            {incoming.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Incoming requests</div>
                <div className="space-y-2">
                  {incoming.map((r) => (
                    <div
                      key={r.requestId}
                      className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#faf8f5] p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{r.username}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => void accept(r.requestId)}>
                          <Check className="size-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void reject(r.requestId)}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <div className="text-sm font-semibold">Friends</div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              ) : friends.length === 0 ? (
                <div className="text-sm text-muted-foreground">No friends yet.</div>
              ) : (
                <div className="space-y-2">
                  {friends.map((f) => (
                    <button
                      key={f.userId}
                      type="button"
                      onClick={() => navigate(`/friends/${f.userId}`)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        f.userId === activeFriendId
                          ? "border-brand/40 bg-brand/10"
                          : "border-black/10 bg-white hover:bg-[#faf8f5]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{f.username}</div>
                          <div className="truncate text-xs text-muted-foreground">{f.email}</div>
                        </div>
                        {outgoing.some((r) => r.userId === f.userId) ? (
                          <Badge variant="secondary">Requested</Badge>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="paper-texture border-black/10 bg-white text-black">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle className="font-display text-lg">
              {activeFriend ? `Thread with ${activeFriend.username}` : "Select a friend"}
            </CardTitle>
            {activeFriend ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setScorecardOpen(true);
                    void loadFriendScorecard();
                  }}
                >
                  Scorecard
                </Button>
                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={() =>
                    navigate(`/dojo?opponent=${encodeURIComponent(activeFriend.username)}`)
                  }
                >
                  <Swords className="size-4" />
                  Challenge
                </Button>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            {!activeFriend ? (
              <div className="text-sm text-muted-foreground">
                Click a friend on the left to see assigned questions.
              </div>
            ) : threadLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading thread…
              </div>
            ) : thread.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No assigned questions yet. Use Practice → Assign to send one.
              </div>
            ) : (
              <div className="space-y-3">
                {thread.map((m) => {
                  const isMine = m.fromUserId === myUserId;
                  const isToMe = m.toUserId === myUserId;
                  const q = m.question as any;
                  const qType = String(q?.type ?? "").toLowerCase();
                  return (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-4 ${
                        isMine ? "border-brand/30 bg-brand/5" : "border-black/10 bg-[#faf8f5]"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium text-black/80">
                            {isMine ? "You →" : `${m.fromUsername} →`}
                          </span>{" "}
                          {m.toUsername} • {formatWhen(m.createdAt)}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{m.subjectId}</Badge>
                          <Badge variant="secondary">{qType || "question"}</Badge>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="font-medium">{q?.question ?? "(question)"}</div>
                        {qType === "mcq" && Array.isArray(q?.options) ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {q.options.map((opt: string) => (
                              <Button
                                key={opt}
                                variant="outline"
                                className="justify-start"
                                disabled={!!m.answeredAt || !isToMe}
                                onClick={() =>
                                  void answerAssignment(m.id, { selectedOption: opt })
                                }
                              >
                                {opt}
                              </Button>
                            ))}
                          </div>
                        ) : null}

                        {qType === "short" || qType === "short_answer" ? (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Your answer…"
                              className="h-10 border-black/10 bg-white text-black"
                              disabled={!!m.answeredAt || !isToMe}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                const v = (e.target as HTMLInputElement).value;
                                if (!v.trim()) return;
                                void answerAssignment(m.id, { answerText: v });
                                (e.target as HTMLInputElement).value = "";
                              }}
                            />
                            <Button
                              disabled={!isToMe || !!m.answeredAt}
                              onClick={(e) => {
                                const input = (e.currentTarget
                                  .parentElement?.querySelector("input") ??
                                  null) as HTMLInputElement | null;
                                const v = input?.value ?? "";
                                if (!v.trim()) return;
                                void answerAssignment(m.id, { answerText: v });
                                if (input) input.value = "";
                              }}
                            >
                              Send
                            </Button>
                          </div>
                        ) : null}

                        {qType === "long" || qType === "long_answer" ? (
                          <div className="space-y-2">
                            <textarea
                              className="w-full rounded-xl border border-black/10 bg-white p-3 text-sm text-black outline-none"
                              placeholder="Write your response…"
                              disabled={!!m.answeredAt || !isToMe}
                              rows={4}
                            />
                            <Button
                              disabled={!isToMe || !!m.answeredAt}
                              onClick={(e) => {
                                const ta = (e.currentTarget
                                  .parentElement?.querySelector("textarea") ??
                                  null) as HTMLTextAreaElement | null;
                                const v = ta?.value ?? "";
                                if (!v.trim()) return;
                                void answerAssignment(m.id, { answerText: v });
                                if (ta) ta.value = "";
                              }}
                            >
                              Send response
                            </Button>
                          </div>
                        ) : null}

                        {m.answeredAt ? (
                          <div className="mt-2 rounded-lg border border-black/10 bg-white p-3 text-sm">
                            <div className="text-xs text-muted-foreground">
                              Answered • {formatWhen(m.answeredAt)}
                            </div>
                            <div className="mt-1">
                              <span className="font-medium">Answer:</span>{" "}
                              {m.answer?.selectedOption ??
                                m.answer?.answerText ??
                                JSON.stringify(m.answer)}
                            </div>
                            {m.isCorrect !== null ? (
                              <div className="mt-1">
                                <span className="font-medium">Result:</span>{" "}
                                {m.isCorrect ? (
                                  <span className="text-success">Correct</span>
                                ) : (
                                  <span className="text-danger">Incorrect</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={scorecardOpen} onOpenChange={setScorecardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Friend scorecard</DialogTitle>
            <DialogDescription>
              Points = total marks from correct answers (all time).
            </DialogDescription>
          </DialogHeader>
          {scorecardLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : friendScorecard ? (
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-black">{friendScorecard.username}</div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Points</span>
                <span className="font-semibold tabular-nums">{friendScorecard.points}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Correct</span>
                <span className="font-semibold tabular-nums">{friendScorecard.correctAnswers}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Questions attempted</span>
                <span className="font-semibold tabular-nums">{friendScorecard.attempts}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No scorecard data.</div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

