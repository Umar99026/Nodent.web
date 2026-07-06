import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PremiumGate } from "@/components/premium/GetPremiumButton";
import { isPremiumUser, PREMIUM_PATH } from "@/lib/premium";
import { Textarea } from "@/components/ui/textarea";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import type { Question } from "@/lib/subjects";
import { requestQuestionHelp, type HelpChatTurn } from "@/lib/questionHelp";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

type QuestionHelpChatProps = {
  subjectId: string;
  questionKey: string;
  question: Question;
};

export function QuestionHelpChat({ subjectId, questionKey, question }: QuestionHelpChatProps) {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const navigate = useNavigate();
  const [messages, setMessages] = useState<HelpChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [questionKey]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    if (!premium) {
      navigate(PREMIUM_PATH);
      return;
    }
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userTurn: HelpChatTurn = { role: "user", content: text };
    const nextMessages = [...messages, userTurn];
    setMessages(nextMessages);
    if (!overrideText) setInput("");
    setSending(true);

    try {
      const reply = await requestQuestionHelp(subjectId, questionKey, {
        messages: nextMessages,
        question,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(messages);
      if (!overrideText) setInput(text);
      toast.error(err instanceof Error ? err.message : "Could not get help.");
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, subjectId, questionKey, question, premium, navigate]);

  if (!premium) {
    return (
      <div className="flex min-h-0 max-w-full flex-col gap-3 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
          <div className="practice-card-header shrink-0">
            <p className="practice-card-header-title">Question help</p>
            <p className="practice-card-header-meta">AI tutor for this question</p>
          </div>
          <div className="p-4 sm:p-5">
            <PremiumGate
              allowed={false}
              message="Question help is included with Premium."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 max-w-full flex-col gap-3 overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <div className="practice-card-header shrink-0">
          <p className="practice-card-header-title">Question help</p>
          <p className="practice-card-header-meta">AI tutor for this question</p>
        </div>

        <div className="min-h-[min(280px,40vh)] flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {!messages.length ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Get a starting hint or ask a follow-up. No full answers.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sending}
                className="border-black/10"
                onClick={() =>
                  void sendMessage(
                    "Give me one hint — a concrete first step to get started. Do not restate the question.",
                  )
                }
              >
                Get a hint
              </Button>
            </div>
          ) : (
            messages.map((turn, idx) => (
              <div
                key={`${turn.role}-${idx}`}
                className={
                  turn.role === "user"
                    ? "ml-6 rounded-lg bg-[#0b0f19] px-3 py-2.5 text-sm text-white"
                    : "mr-2 rounded-lg border border-black/10 bg-[#f8fafc] px-3 py-2.5 text-sm text-[#0b0f19]"
                }
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {turn.role === "user" ? "You" : "Tutor"}
                </p>
                {turn.role === "assistant" ? (
                  <RichQuestionContent
                    text={turn.content}
                    feedbackMode
                    className="prose prose-sm max-w-none prose-p:my-1 prose-p:leading-relaxed"
                  />
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{turn.content}</p>
                )}
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Thinking…
            </div>
          ) : null}
          <div ref={chatEndRef} />
        </div>

        <div className="shrink-0 border-t border-black/10 p-3">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              placeholder="Ask about this question…"
              disabled={sending}
              className="min-h-0 flex-1 resize-none border-black/10 bg-white text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
            />
            <Button
              type="button"
              variant="accent"
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              className="shrink-0 self-end px-3"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
