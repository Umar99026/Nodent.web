import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function PremiumPage() {
  const navigate = useNavigate();
  return (
    <AppShell title="Premium" subtitle="Unlock full Nodent">
      <div className="mx-auto max-w-lg rounded-3xl border border-black/8 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand/15">
          <Sparkles className="size-7 text-brand" />
        </div>
        <h2 className="font-display text-2xl font-bold text-[#0b0f19]">Nodent Premium</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Unlimited AI marking, question help, mark breakdown, practice exams, and English
          essay feedback. Payments coming soon.
        </p>
        <Button type="button" variant="outline" className="mt-6" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    </AppShell>
  );
}
