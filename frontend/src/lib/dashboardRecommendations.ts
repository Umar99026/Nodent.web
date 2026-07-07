import type { Subject } from "@/lib/subjects";
import {
  displayTopicLabel,
  improvementTitleForTopic,
  isPracticeExamTopic,
  practiceHrefForTopic,
} from "@/lib/topicDisplay";

export type DashboardActionTone = "urgent" | "focus" | "steady" | "celebrate";

export type DashboardAction = {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  tone: DashboardActionTone;
};

export type DashboardScorecard = {
  studyStreak?: number;
  overallRank?: number | null;
  overallPercentile?: number | null;
  weakestSubjectId?: string | null;
  bestSubjectId?: string | null;
  reportSubjects?: Array<{
    subjectId: string;
    attempts: number;
    rank: number | null;
    rankedStudents: number;
    percentile: number | null;
    subjectPercent: number;
    weakestTopic: { topic: string; percent: number; percentile: number | null } | null;
    strongestTopic: { topic: string; percent: number; percentile: number | null } | null;
  }>;
};

/** Minimum recommendations shown on the dashboard. */
const MIN_DASHBOARD_RECOMMENDATIONS = 5;
/** Maximum recommendations shown on the dashboard. */
const MAX_DASHBOARD_RECOMMENDATIONS = 8;
/** Topic score below this → urgent practice recommendation. */
const WEAK_TOPIC_PERCENT = 55;
/** Subject cohort percentile below this → focus practice on weakest topic. */
const POOR_SUBJECT_PERCENTILE = 45;

function subjectName(subjects: Subject[], id: string): string {
  return subjects.find((s) => s.id === id)?.name ?? id;
}

function practiceCtaForTopic(topic: string): string {
  return isPracticeExamTopic(topic) ? "Open practice exam" : "Practice now";
}

function defaultFillerActions(subjects: Subject[]): DashboardAction[] {
  const fillers: DashboardAction[] = [];

  for (const subject of subjects) {
    fillers.push({
      id: `filler-subject-${subject.id}`,
      title: `Practice ${subject.name}`,
      subtitle: "Pick a topic and work through questions at your own pace",
      cta: "Open practice",
      href: `/practice/${subject.id}`,
      tone: "steady",
    });
    fillers.push({
      id: `filler-stats-${subject.id}`,
      title: `Review ${subject.name} stats`,
      subtitle: "See topic breakdowns and where to improve next",
      cta: "View stats",
      href: `/quiz/${subject.id}/summary`,
      tone: "steady",
    });
  }

  fillers.push(
    {
      id: "filler-essay",
      title: "Mark your essay",
      subtitle: "Upload writing and get AI feedback on structure and expression",
      cta: "Mark essay",
      href: "/quiz/english",
      tone: "steady",
    },
    {
      id: "filler-track-habit",
      title: "Build a study habit",
      subtitle: "Log a short session to keep momentum through the week",
      cta: "Track study",
      href: "/track",
      tone: "steady",
    },
  );

  if (subjects[0]) {
    fillers.push({
      id: "filler-exams",
      title: "Try a practice exam",
      subtitle: `Browse past papers for ${subjects[0].name}`,
      cta: "View exams",
      href: `/practice/${subjects[0].id}/exams`,
      tone: "steady",
    });
  }

  if (!subjects.length) {
    fillers.push(
      {
        id: "filler-explore",
        title: "Add your subjects",
        subtitle: "Choose VCE subjects to unlock personalised practice",
        cta: "Open dashboard",
        href: "/dashboard",
        tone: "steady",
      },
      {
        id: "filler-english-start",
        title: "Try English essay marking",
        subtitle: "Upload a response and get structured feedback",
        cta: "Mark essay",
        href: "/quiz/english",
        tone: "steady",
      },
    );
  }

  return fillers;
}

export function buildDashboardActions(input: {
  subjects: Subject[];
  scorecard: DashboardScorecard | null;
  confidenceRanks: Record<string, number>;
}): DashboardAction[] {
  const { subjects, scorecard, confidenceRanks } = input;
  const actions: DashboardAction[] = [];
  const used = new Set<string>();
  const subjectsWithTopicRec = new Set<string>();
  const report = scorecard?.reportSubjects ?? [];

  const push = (action: DashboardAction) => {
    if (used.has(action.id)) return;
    used.add(action.id);
    actions.push(action);
  };

  // Weak topics and poor overall subject rankings → practise that area.
  for (const row of report) {
    const weak = row.weakestTopic;
    if (!weak) continue;

    const label = displayTopicLabel(weak.topic);
    const name = subjectName(subjects, row.subjectId);
    const poorTopic = weak.percent < WEAK_TOPIC_PERCENT;
    const poorSubject =
      row.attempts >= 10 &&
      row.percentile != null &&
      row.percentile < POOR_SUBJECT_PERCENTILE;

    if (!poorTopic && !poorSubject) continue;

    push({
      id: `improve-${row.subjectId}-${weak.topic}`,
      title: improvementTitleForTopic(weak.topic),
      subtitle: poorTopic
        ? `${name} — ${weak.percent}% on ${label}. A focused session here will help.`
        : `${name} is one of your tougher subjects — start with ${label}.`,
      cta: practiceCtaForTopic(weak.topic),
      href: practiceHrefForTopic(row.subjectId, weak.topic),
      tone: poorTopic ? "urgent" : "focus",
    });
    subjectsWithTopicRec.add(row.subjectId);
  }

  // Weakest subject overall (when not already covered by a topic recommendation).
  if (scorecard?.weakestSubjectId) {
    const sid = scorecard.weakestSubjectId;
    if (!subjectsWithTopicRec.has(sid)) {
      const row = report.find((r) => r.subjectId === sid);
      const weak = row?.weakestTopic;
      const name = subjectName(subjects, sid);
      push({
        id: `weak-subject-${sid}`,
        title: `Strengthen ${name}`,
        subtitle: weak
          ? `Your results here are lowest across subjects — begin with ${displayTopicLabel(weak.topic)}.`
          : "Your results here are lowest across subjects — build consistency with practice.",
        cta: "Start practice",
        href: weak
          ? practiceHrefForTopic(sid, weak.topic)
          : `/practice/${sid}`,
        tone: "focus",
      });
    }
  }

  const lowConfidence = [...subjects].sort((a, b) => {
    const ra = confidenceRanks[a.id] ?? 999;
    const rb = confidenceRanks[b.id] ?? 999;
    return rb - ra;
  });
  const leastConfident = lowConfidence[0];
  if (leastConfident && !subjectsWithTopicRec.has(leastConfident.id)) {
    push({
      id: `confidence-${leastConfident.id}`,
      title: `Build confidence in ${leastConfident.name}`,
      subtitle: "You ranked this as a subject to work on — start with a short session",
      cta: "Start practice",
      href: `/practice/${leastConfident.id}`,
      tone: "focus",
    });
  }

  for (const row of report) {
    if (row.attempts >= 10 && row.weakestTopic) continue;
    if (row.attempts >= 3) continue;
    push({
      id: `warmup-${row.subjectId}`,
      title: `Get started in ${subjectName(subjects, row.subjectId)}`,
      subtitle:
        row.attempts === 0
          ? "No attempts yet — answer a few questions to unlock topic insights"
          : `${row.attempts} attempts so far — keep going to unlock rankings`,
      cta: "Practice now",
      href: `/practice/${row.subjectId}`,
      tone: "steady",
    });
  }

  if ((scorecard?.studyStreak ?? 0) >= 3) {
    push({
      id: "streak",
      title: `${scorecard!.studyStreak}-day study streak`,
      subtitle: "Keep the momentum — even 15 minutes today counts",
      cta: "Track study",
      href: "/track",
      tone: "celebrate",
    });
  } else {
    push({
      id: "study-habit",
      title: "Log today's study",
      subtitle: "Track minutes per subject to spot patterns over the week",
      cta: "Open tracker",
      href: "/track",
      tone: "steady",
    });
  }

  if (subjects.length > 0 && report.length === 0) {
    const first = subjects[0]!;
    push({
      id: `first-practice-${first.id}`,
      title: `Start with ${first.name}`,
      subtitle: "Complete a few questions to unlock personalised recommendations",
      cta: "Begin practice",
      href: `/practice/${first.id}`,
      tone: "steady",
    });
  }

  push({
    id: "mixed-practice",
    title: "Mixed topic practice",
    subtitle: "Pick a subject and choose topics yourself",
    cta: "Choose subject",
    href: subjects[0] ? `/practice/${subjects[0].id}` : "/dashboard",
    tone: "steady",
  });

  for (const filler of defaultFillerActions(subjects)) {
    if (actions.length >= MIN_DASHBOARD_RECOMMENDATIONS) break;
    push(filler);
  }

  const toneOrder: Record<DashboardActionTone, number> = {
    urgent: 0,
    focus: 1,
    steady: 2,
    celebrate: 3,
  };

  return actions
    .sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone])
    .slice(0, MAX_DASHBOARD_RECOMMENDATIONS);
}
