import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronLeft, MessageSquareHeart } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reveal } from "@/components/landing/Reveal";
import { cn } from "@/lib/utils";

const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;
const STEPS = ["Rating", "VCE student", "Stand-out features", "Your feedback"] as const;

export const FEEDBACK_PATH = "/feedback";

export function WelcomeFeedbackSection({
  visible,
  variant = "welcome",
}: {
  visible: boolean;
  variant?: "welcome" | "landing";
}) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [vceStudent, setVceStudent] = useState<"yes" | "no" | null>(null);
  const [featuresStandOut, setFeaturesStandOut] = useState("");
  const [message, setMessage] = useState("");
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

  const resetForm = () => {
    setStep(0);
    setRating(null);
    setVceStudent(null);
    setFeaturesStandOut("");
    setMessage("");
    setError("");
  };

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 0 && rating == null) {
      return "Please choose a rating from 1 to 5.";
    }
    if (currentStep === 1 && !vceStudent) {
      return "Please tell us whether you are a VCE student.";
    }
    if (currentStep === 2 && featuresStandOut.trim().length < 3) {
      return "Please mention at least one feature that stands out.";
    }
    if (currentStep === 3 && message.trim().length < 3) {
      return "Please share at least a few words of feedback.";
    }
    return null;
  };

  const goNext = () => {
    setError("");
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  };

  const handleSubmit = async () => {
    setError("");
    for (let i = 0; i < STEPS.length; i++) {
      const validationError = validateStep(i);
      if (validationError) {
        setStep(i);
        setError(validationError);
        return;
      }
    }
    setIsSubmitting(true);
    try {
      await apiFetch(API_PATHS.feedback, {
        method: "POST",
        body: JSON.stringify({
          rating,
          vceStudent,
          featuresStandOut: featuresStandOut.trim(),
          message: message.trim(),
        }),
      });
      setSubmitted(true);
      resetForm();
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
            {variant === "landing"
              ? "We'd love your feedback"
              : user?.username
                ? `Thanks for joining, ${user.username}`
                : "Thanks for joining"}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600">
            {variant === "landing"
              ? "Four quick questions — it only takes a minute."
              : "Four quick questions to help us improve Nodent."}
          </p>
        </Reveal>

        <Reveal delayMs={80} className="mt-10">
          {submitted ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-8 text-center">
              <Check className="mx-auto size-10 text-emerald-600" />
              <p className="mt-4 text-lg font-medium text-emerald-900">
                Thank you — your feedback means a lot to us.
              </p>
              <Link to={variant === "landing" ? "/" : "/login"} className="mt-6 inline-block">
                <Button variant="outline" className="rounded-full">
                  {variant === "landing" ? "Back to home" : "Start revising"}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-8 flex items-center justify-center gap-2">
                {STEPS.map((label, index) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        index === step
                          ? "bg-[#0b0f19] text-white"
                          : index < step
                            ? "bg-brand/15 text-brand-dark"
                            : "bg-slate-100 text-slate-500",
                      )}
                      aria-current={index === step ? "step" : undefined}
                    >
                      {index + 1}
                    </div>
                    {index < STEPS.length - 1 ? (
                      <div
                        className={cn(
                          "hidden h-px w-6 sm:block",
                          index < step ? "bg-brand/40" : "bg-slate-200",
                        )}
                      />
                    ) : null}
                  </div>
                ))}
              </div>

              {step === 0 ? (
                <div className="space-y-2">
                  <Label>How is Nodent so far?</Label>
                  <p className="text-sm text-slate-500">1 = poor, 5 = great</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {RATING_OPTIONS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className={cn(
                          "min-w-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          rating === value
                            ? "border-brand bg-brand text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand/40",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-3">
                  <Label>Are you a VCE student?</Label>
                  <div className="flex flex-wrap gap-3">
                    {(["yes", "no"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setVceStudent(value)}
                        className={cn(
                          "rounded-full border px-5 py-2.5 text-sm font-medium capitalize transition-colors",
                          vceStudent === value
                            ? "border-brand bg-brand text-white"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand/40",
                        )}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-2">
                  <Label htmlFor="feedback-features">What features stand out to you?</Label>
                  <Textarea
                    id="feedback-features"
                    value={featuresStandOut}
                    onChange={(e) => setFeaturesStandOut(e.target.value)}
                    placeholder="e.g. smart marking, rankings, English practice, topic quizzes…"
                    rows={4}
                    maxLength={2000}
                    className="resize-y"
                  />
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-2">
                  <Label htmlFor="feedback-message">Your feedback</Label>
                  <Textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What's working well? What could be better?"
                    rows={5}
                    maxLength={4000}
                    className="resize-y"
                  />
                </div>
              ) : null}

              {error ? (
                <p className="mt-4 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={step === 0 || isSubmitting}
                  onClick={goBack}
                >
                  <ChevronLeft className="mr-1 size-4" />
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button
                    type="button"
                    className="rounded-full bg-[#0b0f19] hover:bg-[#0b0f19]/90"
                    onClick={goNext}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={isSubmitting}
                    className="rounded-full bg-[#0b0f19] hover:bg-[#0b0f19]/90"
                    onClick={() => void handleSubmit()}
                  >
                    {isSubmitting ? "Sending…" : "Send feedback"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </Reveal>
      </div>
    </section>
  );
}
