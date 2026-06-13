import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, MessageSquareHeart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;
export const FEEDBACK_PATH = "/feedback";

export function WelcomeFeedbackSection({ visible }: { visible: boolean }) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => {
      document.getElementById("feedback")?.scrollIntoView({ behavior: "smooth" });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (message.trim().length < 3) {
      setError("Please share at least a few words.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiFetch(API_PATHS.feedback, {
        method: "POST",
        body: JSON.stringify({ message: message.trim(), rating }),
      });
      setSubmitted(true);
      setMessage("");
      setRating(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not send feedback. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="feedback"
      className="landing-section scroll-mt-24 border-t border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-2xl px-5 sm:px-8">
        <Reveal className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-dark">
            <MessageSquareHeart className="size-6" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-dark">
            Feedback
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {user?.username ? `Thanks for joining, ${user.username}` : "Thanks for joining"}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            You&apos;re one of our early users — we&apos;d love to hear what you think so far.
          </p>
        </Reveal>

        <Reveal delayMs={80} className="mt-10">
          {submitted ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center">
              <Check className="mx-auto size-10 text-emerald-600" />
              <p className="mt-4 text-lg font-medium text-emerald-900">
                Thank you — your feedback means a lot to us.
              </p>
              <Link to="/login" className="mt-6 inline-block">
                <Button variant="outline" className="rounded-full">
                  Start revising
                </Button>
              </Link>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="space-y-2">
                <Label htmlFor="feedback-rating">How is Nodent so far? (optional)</Label>
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(rating === value ? null : value)}
                      className={cn(
                        "min-w-10 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                        rating === value
                          ? "border-brand bg-brand text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand/40",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                  <span className="self-center text-sm text-slate-500">1 = poor, 5 = great</span>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Label htmlFor="feedback-message">Your feedback</Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What’s working well? What could be better?"
                  rows={5}
                  maxLength={4000}
                  className="resize-y"
                />
              </div>

              {error ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-6">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-full bg-[#0b0f19] hover:bg-[#0b0f19]/90"
                >
                  {isSubmitting ? "Sending…" : "Send feedback"}
                </Button>
              </div>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
