import { AppShell } from "@/components/layout/AppShell";
import { PremiumPlanPanel } from "@/components/premium/PremiumPlanPanel";

export default function PremiumPage() {
  return (
    <AppShell title="Plan & limits" subtitle="Compare Free and Pro, then upgrade securely with Stripe">
      <div className="mx-auto max-w-5xl">
        <PremiumPlanPanel />
      </div>
    </AppShell>
  );
}
