import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { scrollToSection } from "@/components/landing/useScrollReveal";
import { InstagramIcon } from "@/components/icons/InstagramIcon";
import { Link } from "react-router-dom";

const INSTAGRAM_URL = "https://www.instagram.com/nodent.learning/";

const MENU_ITEMS = [
  { id: "product", label: "Product" },
  { id: "demo", label: "Demo" },
  { id: "pricing", label: "Pricing" },
] as const;

type LandingMenuSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LandingMenuSheet({ open, onOpenChange }: LandingMenuSheetProps) {
  const go = (id: string) => {
    onOpenChange(false);
    scrollToSection(id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[min(100%,18rem)] flex-col border-l border-black/8 bg-[#faf9f7] p-0">
        <SheetHeader className="border-b border-black/8 px-6 py-5">
          <SheetTitle className="font-display text-lg font-semibold text-[#0b0f19]">Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col px-4 py-3" aria-label="Site">
          <Link
            to="/vce-resources"
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-[#0b0f19]/80 transition-colors hover:bg-black/[0.04] hover:text-[#0b0f19]"
          >
            Free VCE resources
          </Link>
          <Link
            to="/free-vce-practice-exams"
            onClick={() => onOpenChange(false)}
            className="flex min-h-12 items-center rounded-lg px-3 text-sm font-medium text-[#0b0f19]/80 transition-colors hover:bg-black/[0.04] hover:text-[#0b0f19]"
          >
            Practice exams
          </Link>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className="min-h-12 rounded-lg px-3 text-left text-sm font-medium text-[#0b0f19]/80 transition-colors hover:bg-black/[0.04] hover:text-[#0b0f19]"
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-black/8 px-4 py-4">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-[#0b0f19]/80 transition-colors hover:bg-black/[0.04] hover:text-[#0b0f19]"
          >
            <InstagramIcon className="size-4" />
            Follow us @nodent.learning
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
