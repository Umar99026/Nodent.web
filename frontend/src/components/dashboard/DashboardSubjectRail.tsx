import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, BookOpen, ChevronRight, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { baseSubjects, subjectsForUser, type Subject } from "@/lib/subjects";

type DashboardSubjectRailProps = {
  subjects: Subject[];
  confidenceRanks: Record<string, number>;
  selectedSubjectId: string | null;
  onSelectSubject: (id: string) => void;
  onAddSubject: (subject: Subject) => void;
  onRemoveSubject: (subjectId: string) => void;
  isAdmin: boolean;
};

export function DashboardSubjectRail({
  subjects,
  confidenceRanks,
  selectedSubjectId,
  onSelectSubject,
  onAddSubject,
  onRemoveSubject,
  isAdmin,
}: DashboardSubjectRailProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const sorted = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const ra = confidenceRanks[a.id] ?? 999;
      const rb = confidenceRanks[b.id] ?? 999;
      return ra - rb;
    });
  }, [subjects, confidenceRanks]);

  const activeId = selectedSubjectId ?? sorted[0]?.id ?? null;
  const active = sorted.find((s) => s.id === activeId) ?? null;

  const availableSubjects = useMemo(() => {
    const myIds = new Set(subjects.map((s) => s.id));
    const visible = subjectsForUser({ isAdmin });
    return visible.filter(
      (s) =>
        !myIds.has(s.id) &&
        s.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [subjects, searchQuery, isAdmin]);

  return (
    <aside className="flex min-h-0 flex-col rounded-3xl border border-black/8 bg-white shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100dvh-6rem)]">
      <div className="border-b border-black/8 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0b0f19]">My subjects</h2>
            <p className="text-xs text-muted-foreground">Practice & statistics</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger>
              <button
                type="button"
                aria-label="Add subject"
                className="flex size-9 items-center justify-center rounded-full border border-black/10 bg-black/[0.04] text-[#0b0f19] hover:bg-black/[0.08]"
              >
                <Plus className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[min(100vw-1.5rem,360px)] p-0" align="end">
              <div className="px-3 pb-2 pt-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search subjects…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <ScrollArea className="max-h-[280px] px-3 pb-3">
                {availableSubjects.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    {baseSubjects.length === 0
                      ? "No subjects available."
                      : "No more subjects to add."}
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {availableSubjects.map((subject) => (
                      <button
                        key={subject.id}
                        type="button"
                        onClick={() => onAddSubject(subject)}
                        className="flex w-full items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                      >
                        <span className="font-medium">{subject.name}</span>
                        <Plus className="size-4 text-brand" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2 sm:p-3">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <BookOpen className="mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium text-[#0b0f19]">No subjects yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tap + to add your VCE subjects
              </p>
            </div>
          ) : (
            sorted.map((subject) => {
              const isActive = subject.id === activeId;
              return (
                <div key={subject.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelectSubject(subject.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl px-3 py-3 text-left transition-colors",
                      isActive
                        ? "bg-[#0b0f19] text-white"
                        : "hover:bg-black/[0.04] text-[#0b0f19]",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{subject.name}</p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "size-4 shrink-0",
                        isActive ? "text-white/70" : "text-muted-foreground",
                      )}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveSubject(subject.id)}
                    className="absolute right-2 top-2 hidden size-7 items-center justify-center rounded-full bg-red-500/90 text-white group-hover:flex"
                    aria-label={`Remove ${subject.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {active ? (
        <div className="shrink-0 space-y-2 border-t border-black/8 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {active.name}
          </p>
          <Button
            className="h-11 w-full bg-brand text-white hover:bg-brand/90"
            onClick={() =>
              navigate(active.id === "english" ? "/quiz/english" : `/practice/${active.id}`)
            }
          >
            Practice
          </Button>
          <Button
            variant="outline"
            className="h-11 w-full border-black/10"
            onClick={() => navigate(`/quiz/${active.id}/summary`)}
          >
            <BarChart3 className="mr-2 size-4" />
            Statistics
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
