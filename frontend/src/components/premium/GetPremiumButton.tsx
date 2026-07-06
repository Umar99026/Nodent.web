import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PREMIUM_PATH } from "@/lib/premium";
import { Sparkles } from "lucide-react";

type GetPremiumButtonProps = {
  label?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
  variant?: "default" | "accent" | "outline";
};

export function GetPremiumButton({
  label = "Get Premium",
  className,
  size = "sm",
  variant = "accent",
}: GetPremiumButtonProps) {
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() => navigate(PREMIUM_PATH)}
    >
      <Sparkles className="mr-1.5 size-4" />
      {label}
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
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 text-center">
      <p className="text-sm text-[#0b0f19]">
        {message ?? "This feature is included with Premium."}
      </p>
      <div className="mt-3 flex justify-center">
        <GetPremiumButton />
      </div>
    </div>
  );
}
