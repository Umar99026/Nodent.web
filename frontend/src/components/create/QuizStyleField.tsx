import { cn } from "@/lib/utils";

type QuizStyleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  /** Large question stem typography */
  variant?: "stem" | "part" | "option" | "intro";
};

const variantClass: Record<NonNullable<QuizStyleFieldProps["variant"]>, string> = {
  intro:
    "font-display text-lg font-semibold leading-relaxed sm:text-xl",
  stem:
    "font-display text-[1.18rem] leading-relaxed sm:text-[1.45rem]",
  part:
    "font-display text-[0.98rem] leading-relaxed sm:text-[1.06rem]",
  option: "text-sm leading-relaxed",
};

export function QuizStyleField({
  value,
  onChange,
  onBlur,
  placeholder,
  multiline = false,
  rows = 3,
  className,
  variant = "stem",
}: QuizStyleFieldProps) {
  const shared =
    "w-full resize-none rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-foreground transition-colors placeholder:text-muted-foreground/50 hover:border-black/8 hover:bg-white/40 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/15";

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
        placeholder={placeholder}
        rows={rows}
        className={cn(shared, variantClass[variant], className)}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
      placeholder={placeholder}
      className={cn(shared, variantClass[variant], className)}
    />
  );
}
