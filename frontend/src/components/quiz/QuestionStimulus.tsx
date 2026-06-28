import { Card, CardContent } from "@/components/ui/card";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import {
  collectStimulusFromText,
  hasVisibleStimulus,
} from "@/lib/questionDisplay";
import { normalizeImageUrls, resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import { convertLatexParenDelimiters } from "@/lib/questionMathText";
import { plainSqrtToLatex } from "@/lib/typedMathDisplay";
import { cn } from "@/lib/utils";
import katex from "katex";
import "katex/dist/katex.min.css";

function autoMathify(text: string): string {
  // Lightweight helper: upgrade common plain-text math into KaTeX at render time.
  // This keeps already-uploaded questions readable without rewriting DB text.
  //
  // Users can still write full LaTeX like $x^2 + 1$ or $$...$$.
  let out = convertLatexParenDelimiters(text);
  // Normalize over-escaped LaTeX pasted from JSON/CSV imports.
  out = out.replace(/\\{2,}(frac|sqrt|begin|end|le|ge|ne|times|div|hat)\b/g, "\\$1");
  out = out.replace(/\\{2,}int\b/g, "\\int");
  // Normalize malformed exponent braces: ^{{2}}, ^{ {2} }, ^{{{2}}} -> ^{2}
  for (let i = 0; i < 4; i++) {
    const prev = out;
    out = out.replace(/\^\s*\{\s*\{\s*([^{}]+?)\s*\}\s*\}/g, "^{$1}");
    out = out.replace(/\^\{+\s*([^{}]+?)\s*\}+/g, "^{$1}");
    if (out === prev) break;
  }

  // Strip zero-width/odd spacing artifacts from OCR/imports.
  out = out.replace(/[\u200B-\u200D\uFEFF]/g, "");
  // Rebuild broken integral bounds from OCR/newline splits:
  // "\int 0 ^{1}" or "\int\n0\n^{1}" -> "\int_{0}^{1}"
  out = out.replace(
    /\\int\s*[_]?\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s*\}?\s*\^\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s*\}?/g,
    "\\int_{$1}^{$2}",
  );
  // Also support compact variant with no explicit ^ braces after split cleanup.
  out = out.replace(
    /\\int\s*_\{\s*([+\-]?\d+(?:\.\d+)?)\s*\}\s*\^\{\s*([+\-]?\d+(?:\.\d+)?)\s*\}/g,
    "\\int_{$1}^{$2}",
  );
  // Compact unicode integral pattern: ∫01(...)dx -> \int_{0}^{1}(...)dx
  out = out.replace(
    /∫\s*([+\-]?\d+(?:\.\d+)?)\s*([+\-]?\d+(?:\.\d+)?)\s*(\([^)]+\))\s*d([A-Za-z])/g,
    "\\int_{$1}^{$2}$3\\,d$4",
  );
  // OCR corruption: "?(a to b)" is usually a definite integral.
  out = out.replace(
    /\?\s*\(\s*([^\s)]+)\s*to\s*([^\s)]+)\s*\)/gi,
    "\\int_{$1}^{$2}",
  );
  // Plain text: ∫(0 to 1) (e^(4x)-3x) dx
  out = out.replace(
    /∫\s*\(\s*([^)]+?)\s+to\s+([^)]+?)\s*\)\s*\(([^)]+)\)\s*dx/gi,
    (_m, a, b, integrand) => {
      const body = String(integrand)
        .replace(/e\^\(([^)]+)\)/gi, "e^{$1}")
        .replace(/e\^([0-9]+[a-z])/gi, "e^{$1}");
      return `\\int_{${String(a).trim()}}^{${String(b).trim()}} (${body})\\,dx`;
    },
  );
  out = out.replace(/e\^\(([^)]+)\)/gi, "e^{$1}");
  // Common OCR shorthand: "e 7x" -> "e^{7x}" (exponential term).
  out = out.replace(/\be\s+([+-]?\d+(?:\.\d+)?\s*[A-Za-z])\b/g, (_m, p1) => {
    const exp = String(p1).replace(/\s+/g, "");
    return `e^{${exp}}`;
  });
  // Normalize some common ASCII comparators to LaTeX tokens.
  out = out.replace(/<=/g, "\\le").replace(/>=/g, "\\ge").replace(/!=/g, "\\ne");
  // Common estimate notation: p-hat / p hat / p̂ -> \hat{p}
  out = out.replace(/\b([A-Za-z])\s*-\s*hat\b/gi, "\\hat{$1}");
  out = out.replace(/\b([A-Za-z])\s+hat\b/gi, "\\hat{$1}");
  out = out.replace(/\b([A-Za-z])\u0302\b/g, "\\hat{$1}");
  // Unit shorthand m/s^2 -> \frac{m}{s^2}
  out = out.replace(/\bm\s*\/\s*s\s*\^\s*2\b/gi, "\\frac{m}{s^2}");
  // Fractions with grouped denominator/numerator e.g. 1/(4+3i), (x+1)/(x-1)
  out = out.replace(
    /(\b\d+(?:\.\d+)?|\([^()]+\))\s*\/\s*(\([^()]+\))/g,
    "\\frac{$1}{$2}",
  );
  // Recurrence notation only — not "t = 1" in kinematics (would break v(t) questions).
  out = out.replace(/\b([ABLPablp])\s+(\d+)\b/g, "$1_{$2}");
  // sqrt(...) — vinculum spans the full radicand
  out = out.replace(/\bsqrt\s*\(\s*([^)]+?)\s*\)/gi, (_m, inner) => plainSqrtToLatex(inner));
  // Common fractions like 3/4 or x/y -> \frac{3}{4}
  out = out.replace(
    /\b([A-Za-z]?\d+(?:\.\d+)?|[A-Za-z])\s*\/\s*([A-Za-z]?\d+(?:\.\d+)?|[A-Za-z])\b/g,
    "\\frac{$1}{$2}",
  );
  // Multiplication/division glyphs in plain text
  out = out.replace(/(\d|\))\s*[xX*]\s*(\d|\()/g, "$1 \\times $2");
  out = out.replace(/(\d|\))\s*[÷]\s*(\d|\()/g, "$1 \\div $2");
  // OCR often replaces multiplication with "?" between terms.
  out = out.replace(/([A-Za-z0-9\)])\s*\?\s*([A-Za-z0-9(])/g, "$1 \\times $2");
  // Spaced variable groups before powers: "s m ^2" -> "sm^2"
  out = out.replace(/\b([A-Za-z](?:\s+[A-Za-z]){1,5})\s*\^\s*(\d+)\b/g, (_m, base, exp) => {
    const b = String(base).replace(/\s+/g, "");
    return `${b}^${exp}`;
  });
  // Bracket-list matrices like [[a,b],[c,d]] or [[1,2,3],[4,5,6],[7,8,9]]
  out = out.replace(/\[\[\s*[\s\S]*?\s*\]\]/g, (m) => {
    const inner = m.slice(2, -2).trim();
    const rows = inner
      .split(/\]\s*,\s*\[/)
      .map((r) => r.trim())
      .filter(Boolean);
    if (rows.length < 2) return m;
    const latexRows = rows
      .map((r) =>
        r
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
          .join(" & "),
      )
      .join("\\\\");
    if (!latexRows.includes("&")) return m;
    return `\\begin{bmatrix}${latexRows}\\end{bmatrix}`;
  });
  // Matrix style [a b; c d] -> bmatrix
  out = out.replace(
    /\[\s*([^\[\]]+?)\s*;\s*([^\[\]]+?)\s*\]/g,
    (_m, r1, r2) => {
      const row1 = String(r1).trim().replace(/\s+/g, " & ");
      const row2 = String(r2).trim().replace(/\s+/g, " & ");
      return `\\begin{bmatrix}${row1}\\\\${row2}\\end{bmatrix}`;
    },
  );
  // Parenthesized 2-row matrices like (a b; c d)
  out = out.replace(
    /\(\s*([^()]+?)\s*;\s*([^()]+?)\s*\)/g,
    (_m, r1, r2) => {
      const row1 = String(r1).trim().replace(/\s+/g, " & ");
      const row2 = String(r2).trim().replace(/\s+/g, " & ");
      if (!row1.includes("&") && !row2.includes("&")) return _m;
      return `\\begin{bmatrix}${row1}\\\\${row2}\\end{bmatrix}`;
    },
  );

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

  // Match comparators/fractions/sqrt/subscripts and caret-powers.
  const re =
    /\\int(?:_\{[^}]+\})?(?:\^\{[^}]+\})?|\\(?:le|ge|ne|times|div)|\\hat\{[^}]+\}|\\frac\{[^{}]+\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\\sqrt\{[^}]+\}|\\begin\{bmatrix\}[\s\S]*?\\end\{bmatrix\}|[A-Za-z]_\{\d+\}|[A-Za-z]_\d+|(?:\|[^|\n]{1,80}\||\([^\n]{1,80}?\)|\b[A-Za-z][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)\s*\^\s*(?:\b\d+(?:\.\d+)?\b|\b[A-Za-z][A-Za-z0-9_]*\b|\([^\n]{1,60}?\))/g;

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
      const exp = expRaw
        .replace(/^\((.*)\)$/, "$1")
        .replace(/^\{(.*)\}$/, "$1");
      latex = `${base}^{${exp}}`;
    } else {
      // Normalize plain subscripts to LaTeX brace form.
      latex = latex.replace(/\b([A-Za-z])_(\d+)\b/g, "$1_{$2}");
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
    <div className={cn(className, "whitespace-normal")}>
      {renderTextWithMath(text)}
    </div>
  );
}

/** Shared passage / stimulus block for MCQ, short, and long practice questions. */
export function PassageBlock({
  passage,
  imageUrls,
}: {
  passage?: string;
  imageUrls?: string[];
}) {
  const stimulus = collectStimulusFromText(passage, imageUrls);
  if (!hasVisibleStimulus(stimulus)) return null;

  const stimulusImages = normalizeImageUrls(stimulus.imageUrls);
  const prose = stimulus.passage;

  return (
    <Card className="border-l-4 border-l-brand/40 bg-muted/60">
      <CardContent className="space-y-4 pt-4">
        {stimulusImages?.length ? (
          <QuestionImageGrid urls={stimulusImages} title="" />
        ) : null}
        {prose ? (
          <blockquote className="text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
            <RichQuestionContent
              text={prose}
              preferMarkdown
              className="max-w-none leading-relaxed [&_p]:font-semibold"
            />
          </blockquote>
        ) : null}
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
      {title ? (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((src, i) => {
            const resolved = resolveQuestionImageSrc(src);
            return (
            <a
              key={`fig-${i}-${resolved.slice(0, 48)}`}
              href={resolved}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm outline-none ring-brand/30 focus-visible:ring-2"
              title="Open image in new tab"
            >
              <img
                src={resolved}
                alt="Question figure"
                className="w-full bg-muted/20 object-contain object-center"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.alt = "Image failed to load";
                  e.currentTarget.classList.add("opacity-70");
                }}
              />
            </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
