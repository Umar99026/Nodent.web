import { cn } from "@/lib/utils";

type LandingLogoHeroProps = {
  className?: string;
  size?: "nav" | "hero";
};

export function LandingLogoHero({ className, size = "nav" }: LandingLogoHeroProps) {
  const nBox =
    size === "hero" ? "h-24 w-[4.5rem] sm:h-32 sm:w-24" : "h-16 w-12 sm:h-[4.5rem] sm:w-14";
  const nImg = size === "hero" ? "max-h-32 sm:max-h-36" : "max-h-16 sm:max-h-[4.5rem]";

  return (
    <div
      className={cn("flex items-center justify-center leading-none", className)}
      aria-label="Nodent"
    >
      <img
        src="/logo.png"
        alt=""
        className={cn("h-full w-full object-contain object-center select-none", nBox, nImg)}
        draggable={false}
      />
    </div>
  );
}
