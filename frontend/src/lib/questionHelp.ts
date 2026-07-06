import { AI_FETCH_TIMEOUT_MS, apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { buildSmartMarkPayload } from "@/lib/questionAiMarking";
import { competitionMarksForQuestion, displayMarks } from "@/lib/questionDisplay";
import type { Question } from "@/lib/subjects";
import { questionHelpUserError } from "@/lib/userFacingErrors";

export type HelpChatTurn = { role: "user" | "assistant"; content: string };

export function buildQuestionHelpPayload(question: Question) {
  if (question.type === "mcq") {
    return {
      type: "mcq" as const,
      question: question.question,
      topic: question.topic,
      marks: displayMarks(question.marks, "mcq"),
      options: question.options,
      passage: question.passage,
    };
  }

  const marks = competitionMarksForQuestion(question);
  const payload = buildSmartMarkPayload(question, {
    marks,
    expectedAnswers:
      question.type === "short" || question.type === "long"
        ? (question.acceptedAnswers ?? [])
        : [],
  });

  const { acceptedAnswers: _omit, ...safe } = payload;
  void _omit;
  return safe;
}

export async function requestQuestionHelp(
  subjectId: string,
  questionKey: string,
  input: {
    messages: HelpChatTurn[];
    question: Question;
  },
): Promise<string> {
  try {
    const data = await apiFetch<{ reply: string }>(
      API_PATHS.written.help(subjectId, questionKey),
      {
        method: "POST",
        timeoutMs: AI_FETCH_TIMEOUT_MS,
        body: JSON.stringify({
          messages: input.messages,
          question: buildQuestionHelpPayload(input.question),
        }),
      },
    );
    return String(data.reply ?? "").trim();
  } catch (err) {
    throw new Error(questionHelpUserError(err instanceof Error ? err.message : err));
  }
}
