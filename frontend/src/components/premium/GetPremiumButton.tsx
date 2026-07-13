import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PREMIUM_CHECKOUT_URL, PREMIUM_PATH } from "@/lib/premium";
import { cn } from "@/lib/utils";
import { ArrowRight, ArrowUpRight, Lock } from "lucide-react";

type GetPremiumButtonProps = {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "accent" | "outline";
  destination?: "checkout" | "plans";
};

export function GetPremiumButton({
  label = "Upgrade",
  className,
  size = "sm",
  variant = "outline",
  destination = "plans",
}: GetPremiumButtonProps) {
  const navigate = useNavigate();
  const opensCheckout = destination === "checkout";
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5 rounded-lg border-black/12 font-medium", className)}
      onClick={() => {
        if (opensCheckout) {
          window.location.assign(PREMIUM_CHECKOUT_URL);
          return;
        }
        navigate(PREMIUM_PATH);
      }}
    >
      {label}
      {opensCheckout ? (
        <ArrowUpRight className="size-3.5" aria-hidden />
      ) : (
        <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
      )}
    </Button>
  );
}

type PremiumGateProps = {
  allowed: boolean;
  message?: string;
  children?: React.ReactNode;
};

export function PremiumGate({ allowed, message, children }: PremiumGateProps) {
  const navigate = useNavigate();
  if (allowed) return <>{children}</>;
  return (
    <div className="rounded-xl border border-black/10 bg-[#f8fafc] p-4 text-center">
      <button
        type="button"
        onClick={() => navigate(PREMIUM_PATH)}
        className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full border border-black/10 bg-white text-muted-foreground hover:bg-white/80"
        aria-label="Locked — see Pro plans"
      >
        <Lock className="size-4" aria-hidden />
      </button>
      <p className="text-sm text-[#0b0f19]">
        {message ?? "This feature is included with Pro."}
      </p>
      <div className="mt-3 flex justify-center">
        <GetPremiumButton label="See plans" destination="plans" />
      </div>
    </div>
  );
}
