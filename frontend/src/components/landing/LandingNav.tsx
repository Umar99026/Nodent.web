import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LandingLogoHero } from "@/components/landing/LandingLogoHero";
import { LandingMenuSheet } from "@/components/landing/LandingMenuSheet";
import { buttonVariants } from "@/components/ui/button";
import { scrollToSection } from "@/components/landing/useScrollReveal";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [onHero, setOnHero] = useState(true);

  useEffect(() => {
    const hero = document.getElementById("top");
    if (!hero) return;

    const io = new IntersectionObserver(
      ([entry]) => setOnHero(entry.isIntersecting),
      { threshold: 0.08 },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div className="safe-top pointer-events-none fixed left-0 top-0 z-50 p-5 sm:p-8">
        <button
          type="button"
          onClick={() => scrollToSection("top")}
          className="pointer-events-auto outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          aria-label="Back to top"
        >
          <LandingLogoHero
            className={cn("transition-[filter] duration-300", onHero && "brightness-0 invert")}
          />
        </button>
      </div>

      <header className="safe-top pointer-events-none fixed inset-x-0 top-0 z-40 bg-transparent">
        <div className="mx-auto flex max-w-7xl justify-end gap-2 px-5 py-4 sm:px-8 sm:py-5">
          <Link
            to="/login"
            className={cn(
              buttonVariants({ size: "sm" }),
              "pointer-events-auto",
              onHero
                ? "rounded-full border border-white/50 bg-white/10 px-4 text-white backdrop-blur-sm hover:bg-white/20 sm:px-5"
                : "rounded-full bg-brand px-4 text-white hover:bg-brand-dark sm:px-5",
            )}
          >
            Get started
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={cn(
              "touch-target pointer-events-auto inline-flex size-10 items-center justify-center rounded-full transition-colors sm:size-11",
              onHero
                ? "border border-white/50 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                : "border border-black/10 bg-white/80 text-[#0b0f19] shadow-sm hover:bg-white",
            )}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <LandingMenuSheet open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
