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
  overallPercentile?: number | null;
  weakestSubjectId?: string | null;
  bestSubjectId?: string | null;
  reportSubjects?: Array<{
    subjectId: string;
    attempts: number;
    percentile: number | null;
    weakestTopic: { topic: string; percent: number } | null;
    strongestTopic: { topic: string; percent: number } | null;
  }>;
};

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

  const toneOrder: Record<DashboardActionTone, number> = {
    urgent: 0,
    focus: 1,
    steady: 2,
    celebrate: 3,
  };

  return actions
    .sort((a, b) => toneOrder[a.tone] - toneOrder[b.tone])
    .slice(0, 8);
}
