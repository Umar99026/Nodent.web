import type { ReactNode, CSSProperties } from "react";
import { useScrollReveal } from "@/components/landing/useScrollReveal";
import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "article" | "li";
};

export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: RevealProps) {
  const { ref, className: revealClass } = useScrollReveal<HTMLElement>();

  const style: CSSProperties | undefined =
    delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : undefined;

  return (
    <Tag ref={ref as never} className={cn(revealClass, className)} style={style}>
      {children}
    </Tag>
  );
}
