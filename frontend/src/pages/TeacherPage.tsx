import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchClassMembers,
  fetchClassStats,
  fetchStudentClassStats,
  fetchTeacherClass,
  teacherJoinUrl,
  updateTeacherClassName,
  type ClassMember,
  type ClassStats,
  type StudentClassStats,
  type TeacherClassInfo,
} from "@/lib/teacherClass";
import { subjectsForUser } from "@/lib/subjects";
import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Loader2,
  PenLine,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

function subjectLabel(id: string, subjects: ReturnType<typeof subjectsForUser>): string {
  return subjects.find((s) => s.id === id)?.name ?? id;
}

export default function TeacherPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const subjects = useMemo(() => subjectsForUser({ isAdmin }), [isAdmin]);

  const [loading, setLoading] = useState(true);
  const [classInfo, setClassInfo] = useState<TeacherClassInfo | null>(null);
  const [classNameDraft, setClassNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentStats, setStudentStats] = useState<StudentClassStats | null>(null);
  const [studentLoading, setStudentLoading] = useState(false);

  const subjectId = subjectFilter === "all" ? undefined : subjectFilter;
  const joinUrl = classInfo ? teacherJoinUrl(classInfo.joinCode) : "";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cls, classStats, roster] = await Promise.all([
        fetchTeacherClass(),
        fetchClassStats(subjectId),
        fetchClassMembers(subjectId),
      ]);
      setClassInfo(cls);
      setClassNameDraft(cls.className);
      setStats(classStats);
      setMembers(roster);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not load teacher page.");
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedStudentId) {
      setStudentStats(null);
      return;
    }
    let cancelled = false;
    setStudentLoading(true);
    void fetchStudentClassStats(selectedStudentId, subjectId)
      .then((data) => {
        if (!cancelled) setStudentStats(data);
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : "Could not load student stats.");
        }
      })
      .finally(() => {
        if (!cancelled) setStudentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStudentId, subjectId]);

  const copyCode = async () => {
    if (!classInfo) return;
    try {
      await navigator.clipboard.writeText(classInfo.joinCode);
      setCopiedCode(true);
      toast.success("Class code copied.");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error("Could not copy code.");
    }
  };

  const copyLink = async () => {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopiedLink(true);
      toast.success("Join link copied.");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Could not copy link.");
    }
  };

  const saveClassName = async () => {
    const name = classNameDraft.trim();
    if (!name || !classInfo) return;
    setSavingName(true);
    try {
      await updateTeacherClassName(name);
      setClassInfo({ ...classInfo, className: name });
      toast.success("Class name updated.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save class name.");
    } finally {
      setSavingName(false);
    }
  };

  const selectedMember = members.find((m) => m.userId === selectedStudentId) ?? null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#0b0f19]">Teacher</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your class code so students can join, then track their progress.
            </p>
          </div>
          <Button
            className="gap-2 shrink-0"
            onClick={() => navigate("/teacher/create")}
          >
            <PenLine className="size-4" />
            Create
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <Card className="border-black/10">
                <CardHeader>
                  <CardTitle className="text-lg">Your class</CardTitle>
                  <CardDescription>
                    Students scan the QR or enter the code at Join class.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <label className="text-sm font-medium">Class name</label>
                      <div className="flex gap-2">
                        <Input
                          value={classNameDraft}
                          onChange={(e) => setClassNameDraft(e.target.value)}
                          className="h-10"
                        />
                        <Button
                          variant="secondary"
                          disabled={savingName || classNameDraft.trim() === classInfo?.className}
                          onClick={() => void saveClassName()}
                        >
                          {savingName ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-[#f8fafc] p-4">
                    <div>
                      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Class code
                      </div>
                      <div className="font-mono text-3xl font-bold tracking-[0.25em] text-[#0b0f19]">
                        {classInfo?.joinCode}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copyCode()}>
                      {copiedCode ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      Copy code
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void copyLink()}>
                      {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      Copy link
                    </Button>
                  </div>

                  {joinUrl ? (
                    <div className="flex flex-col items-center gap-3 rounded-xl border border-black/10 bg-white p-5 sm:flex-row sm:items-start">
                      <QRCodeSVG
                        value={joinUrl}
                        size={180}
                        level="M"
                        marginSize={2}
                        bgColor="#ffffff"
                        fgColor="#0b0f19"
                        title="Class join QR code"
                      />
                      <div className="min-w-0 flex-1 space-y-2 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground">Scan to join</p>
                        <p>Students open the camera on their phone, scan this code, and join your class when logged in.</p>
                        <code className="block break-all rounded-lg bg-black/5 px-2 py-1.5 text-xs text-foreground/80">
                          {joinUrl}
                        </code>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="border-black/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Class snapshot</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold tabular-nums">{stats?.memberCount ?? 0}</div>
                      <div className="text-xs text-muted-foreground">Students joined</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">
                      {stats?.avgPercent != null ? `${stats.avgPercent}%` : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">Class mark average</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats?.activeStudents ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Students with attempts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums">{stats?.questionCount ?? 0}</div>
                    <div className="text-xs text-muted-foreground">Question attempts</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Filter by subject</span>
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-black/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <AlertTriangle className="size-4 text-amber-600" />
                    Weak topics (class)
                  </CardTitle>
                  <CardDescription>Lowest class averages — focus revision here.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!stats?.weakTopics?.length ? (
                    <p className="text-sm text-muted-foreground">
                      No topic data yet. Students need to attempt questions first.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {stats.weakTopics.map((t) => (
                        <div key={`${t.subjectId}-${t.topic}`} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="font-medium">{t.topic}</span>
                            <Badge variant="secondary">{t.percent}%</Badge>
                          </div>
                          <Progress value={t.percent} className="h-2" />
                          <div className="text-xs text-muted-foreground">
                            {subjectLabel(t.subjectId, subjects)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-black/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="size-4 text-brand" />
                    Topic breakdown
                  </CardTitle>
                  <CardDescription>Mark % by topic across your class.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!stats?.topicStats?.length ? (
                    <p className="text-sm text-muted-foreground">No attempts recorded yet.</p>
                  ) : (
                    <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                      {stats.topicStats.map((t) => (
                        <div key={`${t.subjectId}-${t.topic}`} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate font-medium">{t.topic}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{t.percent}%</span>
                          </div>
                          <Progress value={t.percent} className="h-1.5" />
                          {subjectFilter === "all" ? (
                            <div className="text-[11px] text-muted-foreground">
                              {subjectLabel(t.subjectId, subjects)}
                              {t.studentsAttempted != null ? ` · ${t.studentsAttempted} students` : ""}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-black/10">
              <CardHeader>
                <CardTitle className="text-lg">Students</CardTitle>
                <CardDescription>Click a student to see their individual stats.</CardDescription>
              </CardHeader>
              <CardContent>
                {!members.length ? (
                  <p className="text-sm text-muted-foreground">
                    No students have joined yet. Share your class code or QR above.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="text-right">Questions</TableHead>
                        <TableHead className="text-right">Mark %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((m) => (
                        <TableRow
                          key={m.userId}
                          className={cn(
                            "cursor-pointer",
                            selectedStudentId === m.userId && "bg-brand/5",
                          )}
                          onClick={() => setSelectedStudentId(m.userId)}
                        >
                          <TableCell>
                            <div className="font-medium">{m.username || "Student"}</div>
                            <div className="text-xs text-muted-foreground">{m.email}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{m.questionCount}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {m.marksAttempted > 0 ? `${m.percent}%` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {selectedStudentId && selectedMember ? (
              <Card className="border-black/10">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedMember.username}</CardTitle>
                  <CardDescription>Individual progress{subjectId ? ` · ${subjectLabel(subjectId, subjects)}` : ""}</CardDescription>
                </CardHeader>
                <CardContent>
                  {studentLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : studentStats ? (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-lg border border-black/10 p-3 text-center">
                            <div className="text-xl font-bold tabular-nums">{studentStats.percent}%</div>
                            <div className="text-xs text-muted-foreground">Mark avg</div>
                          </div>
                          <div className="rounded-lg border border-black/10 p-3 text-center">
                            <div className="text-xl font-bold tabular-nums">{studentStats.questionCount}</div>
                            <div className="text-xs text-muted-foreground">Questions</div>
                          </div>
                          <div className="rounded-lg border border-black/10 p-3 text-center">
                            <div className="text-xl font-bold tabular-nums">
                              {studentStats.marksCorrect}/{studentStats.marksAttempted}
                            </div>
                            <div className="text-xs text-muted-foreground">Marks</div>
                          </div>
                        </div>
                        {subjectFilter === "all" && studentStats.subjects.length > 0 ? (
                          <div className="space-y-2">
                            <div className="text-sm font-medium">By subject</div>
                            {studentStats.subjects.map((s) => (
                              <div key={s.subjectId} className="flex items-center justify-between text-sm">
                                <span>{subjectLabel(s.subjectId, subjects)}</span>
                                <span className="tabular-nums">{s.percent}%</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Weakest topics</div>
                        {!studentStats.weakTopics.length ? (
                          <p className="text-sm text-muted-foreground">Not enough data yet.</p>
                        ) : (
                          studentStats.weakTopics.map((t) => (
                            <div key={`${t.subjectId}-${t.topic}`} className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>{t.topic}</span>
                                <span className="tabular-nums">{t.percent}%</span>
                              </div>
                              <Progress value={t.percent} className="h-1.5" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
