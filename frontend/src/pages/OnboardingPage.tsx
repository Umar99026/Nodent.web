import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { subjectsForUser, type Subject } from "@/lib/subjects";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Step = "vce" | "subjects" | "rank";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, completeOnboarding } = useAuth();
  const isAdmin = false;
  const catalog = useMemo(() => subjectsForUser({ isAdmin }), [isAdmin]);

  const [step, setStep] = useState<Step>("vce");
  const [isVce, setIsVce] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Subject[]>([]);
  const [ranked, setRanked] = useState<Subject[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleSubject = (subject: Subject) => {
    setSelected((prev) => {
      const exists = prev.some((s) => s.id === subject.id);
      if (exists) return prev.filter((s) => s.id !== subject.id);
      return [...prev, subject];
    });
  };

  const goToRank = () => {
    if (selected.length === 0) {
      toast.error("Pick at least one subject.");
      return;
    }
    setRanked([...selected]);
    setStep("rank");
  };

  const moveRank = (index: number, dir: -1 | 1) => {
    setRanked((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const tmp = next[index]!;
      next[index] = next[target]!;
      next[target] = tmp;
      return next;
    });
  };

  const finish = async () => {
    if (!user || ranked.length === 0) return;
    setSaving(true);
    try {
      const data = await apiFetch<{
        user: typeof user;
        subjects: { subjectId: string; confidenceRank: number }[];
      }>(API_PATHS.onboarding.complete, {
        method: "POST",
        body: JSON.stringify({
          isVceStudent: isVce,
          subjects: ranked.map((s, idx) => ({
            subjectId: s.id,
            confidenceRank: idx + 1,
          })),
        }),
      });
      completeOnboarding(data.user);
      toast.success("You're all set!");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save setup.");
    } finally {
      setSaving(false);
    }
  };

  const stepNumber = step === "vce" ? 1 : step === "subjects" ? 2 : 3;

  return (
    <AuthLayout authMode="signup">
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-8 sm:py-12">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Step {stepNumber} of 3
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-[#0b0f19] sm:text-3xl">
          {step === "vce" && "Are you a VCE student?"}
          {step === "subjects" && "Which subjects are you taking?"}
          {step === "rank" && "Rank your confidence"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {step === "vce" &&
            "We'll tailor your dashboard and recommendations for VCE study."}
          {step === "subjects" &&
            "Choose every subject you want on your dashboard. You can add more later."}
          {step === "rank" &&
            "Most confident at the top, least confident at the bottom. This shapes your study plan."}
        </p>

        {step === "vce" ? (
          <div className="mt-8 space-y-3">
            {[
              { value: true, label: "Yes — I'm studying VCE" },
              { value: false, label: "Not right now" },
            ].map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setIsVce(opt.value)}
                className={cn(
                  "w-full rounded-xl border px-4 py-4 text-left text-sm font-medium transition-colors",
                  isVce === opt.value
                    ? "border-brand bg-brand/10 text-[#0b0f19]"
                    : "border-black/10 hover:bg-black/[0.03]",
                )}
              >
                {opt.label}
              </button>
            ))}
            <Button
              className="mt-4 h-11 w-full"
              disabled={isVce === null}
              onClick={() => setStep("subjects")}
            >
              Continue
            </Button>
          </div>
        ) : null}

        {step === "subjects" ? (
          <div className="mt-8">
            <div className="max-h-[min(50vh,360px)] space-y-2 overflow-y-auto pr-1">
              {catalog.map((subject) => {
                const on = selected.some((s) => s.id === subject.id);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => toggleSubject(subject)}
                    className={cn(
                      "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                      on
                        ? "border-brand bg-brand/10"
                        : "border-black/10 hover:bg-black/[0.03]",
                    )}
                  >
                    <p className="font-medium text-[#0b0f19]">{subject.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subject.description}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setStep("vce")}>
                Back
              </Button>
              <Button className="h-11 flex-1" onClick={goToRank}>
                Continue ({selected.length})
              </Button>
            </div>
          </div>
        ) : null}

        {step === "rank" ? (
          <div className="mt-8">
            <div className="space-y-2">
              {ranked.map((subject, idx) => (
                <div
                  key={subject.id}
                  className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-3"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0b0f19] text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{subject.name}</p>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveRank(idx, -1)}
                      className="rounded border border-black/10 p-1 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      <ChevronUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === ranked.length - 1}
                      onClick={() => moveRank(idx, 1)}
                      className="rounded border border-black/10 p-1 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              #1 = most confident · higher numbers = more practice focus
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="h-11 flex-1" onClick={() => setStep("subjects")}>
                Back
              </Button>
              <Button className="h-11 flex-1" disabled={saving} onClick={() => void finish()}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : "Finish setup"}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </AuthLayout>
  );
}
