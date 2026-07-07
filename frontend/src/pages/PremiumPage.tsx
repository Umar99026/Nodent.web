import { AppShell } from "@/components/layout/AppShell";
import { PremiumPlanPanel } from "@/components/premium/PremiumPlanPanel";

export default function PremiumPage() {
  return (
    <AppShell title="Plan & limits" subtitle="Free and Premium features">
      <div className="mx-auto max-w-3xl">
        <PremiumPlanPanel />
      </div>
    </AppShell>
  );
}
