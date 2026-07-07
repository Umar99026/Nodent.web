import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PREMIUM_PATH } from "@/lib/premium";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type GetPremiumButtonProps = {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "accent" | "outline";
};

export function GetPremiumButton({
  label = "Upgrade",
  className,
  size = "sm",
  variant = "outline",
}: GetPremiumButtonProps) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn("gap-1.5 rounded-lg border-black/12 font-medium", className)}
      onClick={() => navigate(PREMIUM_PATH)}
    >
      {label}
      <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
    </Button>
  );
}

type PremiumGateProps = {
  allowed: boolean;
  message?: string;
  children?: React.ReactNode;
};

export function PremiumGate({ allowed, message, children }: PremiumGateProps) {
  if (allowed) return <>{children}</>;
  return (
    <div className="rounded-xl border border-black/10 bg-[#f8fafc] p-4 text-center">
      <p className="text-sm text-[#0b0f19]">
        {message ?? "This feature is included with Premium."}
      </p>
      <div className="mt-3 flex justify-center">
        <GetPremiumButton label="See plans" />
      </div>
    </div>
  );
}
