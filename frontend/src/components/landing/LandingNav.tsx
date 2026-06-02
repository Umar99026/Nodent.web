import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LandingLogoHero } from "@/components/landing/LandingLogoHero";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scrollToSection, useActiveSection } from "@/components/landing/useScrollReveal";
import { Menu, X } from "lucide-react";

const NAV_ITEMS = [
  { id: "product", label: "Product" },
  { id: "pricing", label: "Pricing" },
  { id: "demo", label: "Demo" },
  { id: "about", label: "About" },
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = useActiveSection(NAV_ITEMS.map((i) => i.id));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setMobileOpen(false);
    scrollToSection(id);
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled
          ? "border-b border-slate-200/80 bg-white/75 py-3 shadow-sm shadow-brand/5 backdrop-blur-xl"
          : "border-b border-transparent bg-[#f8fbff]/90 py-5 shadow-sm shadow-brand/5 backdrop-blur-md",
      )}
    >
      <button
        type="button"
        onClick={() => scrollToSection("top")}
        className="absolute left-9 top-1/2 z-[60] -translate-y-[calc(50%+0.65rem)] overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand sm:left-10"
        aria-label="Back to top"
      >
        <LandingLogoHero />
      </button>

      <div className="relative mx-auto flex w-full max-w-6xl items-center justify-end gap-4 px-5 sm:px-8">
        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                active === item.id
                  ? "bg-brand/10 text-brand-dark"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            to="/login"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-slate-700 hover:bg-slate-100",
            )}
          >
            Log in
          </Link>
          <Link
            to="/login"
            className={cn(
              buttonVariants(),
              "rounded-full bg-brand px-5 text-white shadow-md shadow-brand/25 hover:bg-brand-dark",
            )}
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg border border-slate-200 bg-white/80 text-slate-700 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl transition-all duration-300 md:hidden",
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0 border-t-transparent",
        )}
      >
        <nav className="flex flex-col gap-1 px-3 py-4 sm:px-4" aria-label="Mobile">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn(
                "rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                active === item.id ? "bg-brand/10 text-brand-dark" : "text-slate-700",
              )}
            >
              {item.label}
            </button>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-4">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className={cn(buttonVariants({ variant: "outline" }), "justify-center")}
            >
              Log in
            </Link>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className={cn(
                buttonVariants(),
                "justify-center bg-brand text-white hover:bg-brand-dark",
              )}
            >
              Get started
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
