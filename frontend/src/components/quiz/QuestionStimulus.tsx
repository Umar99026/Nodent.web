import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeImageUrls } from "@/lib/practiceQuestions";
import katex from "katex";
import "katex/dist/katex.min.css";

function autoMathify(text: string): string {
  // Lightweight helper: upgrade common plain-text math into KaTeX at render time.
  // This keeps already-uploaded questions readable without rewriting DB text.
  //
  // Users can still write full LaTeX like \(x^2 + 1\) or $$...$$.
  let out = text;

  // Normalize some common ASCII comparators to LaTeX tokens.
  out = out.replace(/<=/g, "\\le").replace(/>=/g, "\\ge").replace(/!=/g, "\\ne");

  return out;
}

function renderInlineLatex(latex: string): string {
  return katex.renderToString(latex, {
    throwOnError: false,
    strict: "ignore",
    output: "html",
  });
}

function renderTextWithMath(text: string): React.ReactNode {
  const src = autoMathify(text);

  // Match comparators (\le, \ge, \ne) and caret-powers (t^3, at^2, (x+1)^2, 10^5).
  const re =
    /\\(?:le|ge|ne)|(?:\([^\n]{1,80}?\)|\b[A-Za-z][A-Za-z0-9_]*\b|\b\d+\b)\s*\^\s*(?:\b\d+\b|\b[A-Za-z][A-Za-z0-9_]*\b|\([^\n]{1,60}?\))/g;

  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > last) parts.push(src.slice(last, start));

    let latex = m[0].trim();
    const caretIdx = latex.indexOf("^");
    if (caretIdx >= 0) {
      const base = latex.slice(0, caretIdx).trim();
      const expRaw = latex.slice(caretIdx + 1).trim();
      const exp = expRaw.replace(/^\((.*)\)$/, "$1");
      latex = `${base}^{${exp}}`;
    }

    parts.push(
      <span
        key={`${start}-${end}`}
        dangerouslySetInnerHTML={{ __html: renderInlineLatex(latex) }}
      />,
    );
    last = end;
  }
  if (last < src.length) parts.push(src.slice(last));

  // Preserve newlines
  const out: React.ReactNode[] = [];
  parts.forEach((p, idx) => {
    if (typeof p !== "string") {
      out.push(p);
      return;
    }
    const lines = p.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) out.push(lines[i]);
      if (i < lines.length - 1) out.push(<br key={`br-${idx}-${i}`} />);
    }
  });

  return <>{out}</>;
}

export function RichMathText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={(className ?? "") + " whitespace-pre-wrap"}>
      {renderTextWithMath(text)}
    </div>
  );
}

/** Shared passage / stimulus block for MCQ, short, and long practice questions. */
export function PassageBlock({ passage }: { passage?: string }) {
  if (!passage?.trim()) return null;
  return (
    <Card className="border-l-4 border-l-brand/40 bg-muted/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-muted-foreground">
          <BookOpen className="size-5 shrink-0" />
          Stimulus / passage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <blockquote className="text-lg leading-relaxed text-foreground/90 sm:text-xl">
          <RichMathText
            text={passage.trim()}
            className="max-w-none whitespace-pre-wrap leading-relaxed"
          />
        </blockquote>
      </CardContent>
    </Card>
  );
}

/**
 * Renders question images (URLs or data URLs from Sheets `image_urls_json`).
 * Uses object-contain so diagrams and charts are not over-cropped.
 */
export function QuestionImageGrid({
  urls,
  title = "Figures & images",
}: {
  urls?: string[];
  title?: string;
}) {
  const normalized = normalizeImageUrls(urls);
  if (!normalized?.length) return null;
  const list = normalized.map((u) => u.trim()).filter(Boolean);
  if (!list.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm outline-none ring-brand/30 focus-visible:ring-2"
              title="Open image in new tab"
            >
              <img
                src={src}
                alt="Question figure"
                className="max-h-72 w-full bg-muted/20 object-contain object-center sm:max-h-80"
                loading="lazy"
                decoding="async"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
