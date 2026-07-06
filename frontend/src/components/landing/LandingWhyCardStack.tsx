import { useCallback, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Target, Timer, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const WHY_CARDS: {
  icon: LucideIcon;
  quote: string;
  title: string;
  body: string;
}[] = [
  {
    icon: Wallet,
    quote: "Don't want to spend hundreds per week on a tutor? We can help.",
    title: "Tutor-level insight, not tutor prices",
    body: "Get targeted feedback on practice and essays without stacking another weekly bill on top of school.",
  },
  {
    icon: Target,
    quote: "Stop guessing what to improve.",
    title: "Know your weak spots",
    body: "See which topics cost you marks, what you wrote wrong, and what to fix before your next SAC.",
  },
  {
    icon: Timer,
    quote: "Feedback in seconds — not days.",
    title: "Improve while it's still fresh",
    body: "Smart marking lands right after you submit, so you can fix mistakes in the same study session.",
  },
];

const FAN_SLOTS = [
  { rotate: 0, x: 0, y: 0, scale: 1, z: 30 },
  { rotate: -14, x: -52, y: 8, scale: 0.9, z: 20 },
  { rotate: 14, x: 52, y: 8, scale: 0.9, z: 10 },
] as const;

export function LandingWhyCardStack() {
  const [active, setActive] = useState(1);

  const advance = useCallback(() => {
    setActive((i) => (i + 1) % WHY_CARDS.length);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center lg:ml-auto lg:mr-0">
      <div className="relative h-[21rem] w-full max-w-sm sm:h-[22rem]">
        {WHY_CARDS.map((card, i) => {
          const slot = (i - active + WHY_CARDS.length) % WHY_CARDS.length;
          const t = FAN_SLOTS[slot];
          const isFront = slot === 0;

          return (
            <article
              key={card.title}
              className={cn(
                "absolute bottom-0 left-1/2 w-[min(100%,17.5rem)] cursor-pointer rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-lg transition-all duration-500 ease-out sm:p-7",
                isFront && "ring-2 ring-brand/25 shadow-xl",
              )}
              style={{
                transform: `translate(calc(-50% + ${t.x}px), ${t.y}px) rotate(${t.rotate}deg) scale(${t.scale})`,
                transformOrigin: "center bottom",
                zIndex: t.z,
              }}
              onClick={() => (isFront ? advance() : setActive(i))}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  isFront ? advance() : setActive(i);
                }
              }}
              role="button"
              tabIndex={isFront ? 0 : -1}
              aria-label={isFront ? `Show next: ${card.title}` : `Show ${card.title}`}
              aria-hidden={!isFront}
            >
              <card.icon className="size-6 text-brand" />
              <p className="mt-3 font-display text-base font-semibold italic text-brand-dark sm:text-lg">
                &ldquo;{card.quote}&rdquo;
              </p>
              <h4 className="mt-3 font-semibold">{card.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-center gap-2">
        {WHY_CARDS.map((card, i) => (
          <button
            key={card.title}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "h-2 rounded-full transition-all",
              i === active ? "w-6 bg-brand" : "w-2 bg-slate-300 hover:bg-slate-400",
            )}
            aria-label={`Show ${card.title}`}
            aria-current={i === active ? "true" : undefined}
          />
        ))}
      </div>
    </div>
  );
}
