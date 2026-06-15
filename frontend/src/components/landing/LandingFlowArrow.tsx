import { cn } from "@/lib/utils";

type LandingFlowArrowProps = {
  visible: boolean;
  className?: string;
};

export function LandingFlowArrow({ visible, className }: LandingFlowArrowProps) {
  return (
    <div
        className={cn(
        "flex justify-center overflow-hidden transition-all duration-700 ease-out",
        visible ? "my-12 sm:my-14 landing-flow-arrow-visible" : "landing-flow-arrow-hidden",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 132"
        className="h-28 w-6 text-brand sm:h-36"
        fill="currentColor"
      >
        <path d="M9.5 0h5v97H19L12 132 5 97h4.5V0Z" />
      </svg>
    </div>
  );
}
