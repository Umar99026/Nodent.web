import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { scrollToSection } from "@/components/landing/useScrollReveal";

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
      <SheetContent side="right" className="w-[min(100%,18rem)] border-l border-black/8 bg-[#faf9f7] p-0">
        <SheetHeader className="border-b border-black/8 px-6 py-5">
          <SheetTitle className="font-display text-lg font-semibold text-[#0b0f19]">Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col px-4 py-3" aria-label="Site">
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
      </SheetContent>
    </Sheet>
  );
}
