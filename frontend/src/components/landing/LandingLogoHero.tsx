import { cn } from "@/lib/utils";

type LandingLogoHeroProps = {
  className?: string;
  size?: "nav" | "hero";
};

export function LandingLogoHero({ className, size = "nav" }: LandingLogoHeroProps) {
  const nBox =
    size === "hero" ? "h-24 w-[4.5rem] sm:h-32 sm:w-24" : "h-12 w-9 sm:h-[4.5rem] sm:w-14";

  return (
    <div
      className={cn("flex items-center justify-center leading-none", nBox, className)}
      aria-label="Nodent"
    >
      <img
        src="/logo.png"
        alt="Nodent logo"
        width={size === "hero" ? 96 : 56}
        height={size === "hero" ? 128 : 72}
        loading="eager"
        decoding="async"
        fetchPriority="high"
        className="h-full w-full object-contain object-center select-none"
        draggable={false}
      />
    </div>
  );
}
