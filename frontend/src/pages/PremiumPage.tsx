import { AppShell } from "@/components/layout/AppShell";
import { PremiumPlanPanel } from "@/components/premium/PremiumPlanPanel";

export default function PremiumPage() {
  return (
    <AppShell title="Plan & limits" subtitle="See your usage and unlock the full Nodent experience">
      <div className="mx-auto max-w-5xl">
        <PremiumPlanPanel />
      </div>
    </AppShell>
  );
}
