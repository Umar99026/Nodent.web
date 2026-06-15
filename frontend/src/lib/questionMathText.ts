import { mathifyQuestionText } from "@/lib/mathifyQuestionText";
import { stripScenarioLabelPrefix } from "@/lib/questionDisplay";

/**
 * Normalise imported / dechunked question text so recurrence relations and finance
 * notation render with KaTeX ($A_{n+1}$, $L_0$, etc.) instead of broken letter-per-line OCR.
 */

const GLUED_WORDS: [RegExp, string][] = [
  [/annualrate/gi, "annual rate"],
  [/monthlyrepayment/gi, "monthly repayment"],
  [/startingbalance/gi, "starting balance"],
  [/compoundingmonthly/gi, "compounding monthly"],
  [/reducingbalance/gi, "reducing balance"],
  [/effectiveannual/gi, "effective annual"],
  [/recurrencerelation/gi, "recurrence relation"],
  [/month1/gi, "month-1"],
];

/**
 * Fix inline math segments for remark-math + KaTeX.
 * - Convert `\(...\)` / `\[...\]` to `$...$` / `$$...$$` (more reliable than paren delimiters).
 * - Repair bare `( \mathbf{a} ... )` when `\(` delimiters were lost on import.
 * - Collapse OCR newlines inside $...$ (keep spaces so `\sin x` stays valid).
 * - Escape `\pi)` / `\infty)` etc. — remark-math treats `\)` as a math end delimiter.
 */
export function convertLatexParenDelimiters(text: string): string {
  let out = String(text ?? "");

  // `\(...\)` inline → $...$
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner: string) => `$${inner.trim()}$`);

  // `\[...\]` display → $$...$$
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner: string) => `$$${inner.trim()}$$`);

  // Bare `( \mathbf{a} ... )` with LaTeX commands but no `\(` opener.
  out = out.replace(/\(\s*((?:\\[a-zA-Z]+[\s\S]*?))\s*\)/g, (match, inner: string) => {
    if (!/\\(?:mathbf|vec|langle|rangle|frac|dfrac|tfrac|sqrt|hat|cdot|times|div|pm|mp|pi|theta|alpha|beta|gamma|omega|sin|cos|tan|log|ln|int|sum|prod|lim|leq|geq|neq|approx|operatorname|text|left|right|begin|end)\b/.test(inner)) {
      return match;
    }
    return `$${inner.trim()}$`;
  });

  return out;
}

export function fixInlineMathDelimiters(text: string): string {
  const converted = convertLatexParenDelimiters(text);
  return converted.replace(/\$([^$]*)\$/g, (_, inner: string) => {
    let fixed = inner.replace(/\s*[\r\n]+\s*/g, "");
    fixed = fixed.replace(
      /\\(pi|infty|theta|phi|alpha|beta|gamma|omega)\s*\)/gi,
      "\\$1\\text{)}",
    );
    return `$${fixed}$`;
  });
}

function dechunkOcrLines(text: string): string {
  const collapsed = fixInlineMathDelimiters(text);
  // Keep author-written LaTeX intact — OCR dechunking mangles $v(t)=3t^2-2$ etc.
  if (
    /\$[^$\n]+\$/.test(collapsed) ||
    /\$\$[\s\S]+?\$\$/.test(collapsed) ||
    /\\\([\s\S]+?\\\)/.test(collapsed) ||
    /\\\[[\s\S]+?\\\]/.test(collapsed)
  ) {
    return collapsed;
  }

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return collapsed;

  const singleCharLines = lines.filter((l) => /^[A-Za-z0-9]$/.test(l)).length;
  const shouldDechunk =
    lines.length >= 6 &&
    (singleCharLines / lines.length >= 0.35 ||
      lines.some((l) => l === "," || l === "." || l === ":" || l === ";"));

  const shortLines = lines.filter((l) => l.length > 0 && l.length <= 4).length;
  const shouldDechunkShort =
    lines.length >= 4 && shortLines / lines.length >= 0.5;
  if (!shouldDechunk && !shouldDechunkShort) return collapsed;

  let out = lines.join("");
  for (const [re, rep] of GLUED_WORDS) out = out.replace(re, rep);
  return fixInlineMathDelimiters(
    out
      .replace(/\s+/g, " ")
      .replace(/\s*([,.;:!?])\s*/g, "$1 ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/(\d),([A-Za-z])/g, "$1, $2")
      .replace(/([A-Za-z])(\d)/g, "$1 $2")
      .replace(/(\d)([A-Za-z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Rewrite common mangled probability / stats stems into clean LaTeX. */
function repairBareMathStems(text: string): string {
  let out = text;

  out = out.replace(
    /\b(?:Binomial:\s*)?n\s*=\s*(\d+)\s*,?\s*p\s*=\s*([0-9.]+)\s*\.?\s*P\s*\(\s*X\s*=\s*(\d+)\s*\)\s*(?:as\s+fraction)?/gi,
    "For $n=$1$, $p=$2$, find $P(X=$3)$ as a fraction.",
  );
  out = out.replace(
    /\bSample:\s*(\d+)\s*success(?:es)?\s+in\s+(\d+)\s+trials\.?\s*(?:\\hat\{p\}|p-hat|p̂|\^?p)\s*=\s*\??/gi,
    "In a sample, $1$ successes in $2$ trials. Find $\\hat{p}$",
  );
  out = out.replace(
    /\bComposite:\s*f\s*\(\s*x\s*\)\s*=\s*([^,]+),\s*g\s*\(\s*x\s*\)\s*=\s*([^.]+\.?)\s*Find\s*\(f\\circ\s*g\)\s*\(\s*(\d+)\s*\)/gi,
    "Given $f(x)=$1$ and $g(x)=$2$, find $(f\\circ g)($3)$.",
  );
  out = out.replace(
    /Smallest positive solution to\s*\\?sin\s*x\s*=\s*(?:\\?dfrac\s*\{)?\\?sqrt\s*\{?\s*2\s*\}?\s*\}?\s*\{?\s*2\s*\}?\s*\.?\s*on\s*\[?\s*0\s*,\s*2\s*\\?pi\s*\)?[^.]*(?:\\?dfrac\s*\{)?\\?pi\s*\}?\s*\{?\s*k\s*\}?/gi,
    "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.",
  );

  return out;
}

function formatMoney(n: string): string {
  const num = Number(String(n).replace(/,/g, ""));
  if (!Number.isFinite(num)) return n;
  return num.toLocaleString("en-AU");
}

/** Rebuild common mangled finance stems when numbers are still parseable. */
function rewriteFinanceTemplates(text: string): string {
  let out = text;

  const reducing = out.match(
    /reducing[-\s]?balance[\s\S]*?starting balance\s*\$?\s*([+-]?\d[\d,]*(?:\.\d+)?)[\s\S]*?annual\s*rate\s*([+-]?\d+(?:\.\d+)?)\s*%?[\s\S]*?(?:compounding\s+)?monthly[\s\S]*?(?:repayment\s*)?\$?\s*([+-]?\d[\d,]*(?:\.\d+)?)/i,
  );
  if (reducing && /month-?1\s*interest/i.test(out)) {
    const balance = formatMoney(reducing[1]);
    const rate = reducing[2];
    const repayment = formatMoney(reducing[3]);
    out = `A reducing-balance loan has starting balance $${balance}$, annual rate ${rate}% compounding monthly, monthly repayment $${repayment}$. Find the month-1 interest charge ($, 2 d.p.).`;
    if (/new balance/i.test(text)) {
      out += " Also find the balance immediately after the first repayment ($, nearest dollar).";
    }
    return out;
  }

  const loanRec = out.match(
    /loan[\s\S]*?L\s*0\s*=\s*([+-]?\d[\d,]*(?:\.\d+)?)[\s,]*L\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\*?\s*L\s*\(\s*n\s*\)\s*-\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (loanRec || /L\s*0\s*=\s*\d+[\s,]*L\s*\(/i.test(out)) {
    const m =
      loanRec ??
      out.match(
        /L\s*0\s*=\s*([+-]?\d[\d,]*(?:\.\d+)?)[\s,]*L\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\*?\s*L\s*\(\s*n\s*\)\s*-\s*([+-]?\d+(?:\.\d+)?)/i,
      );
    if (m) {
      const L0 = formatMoney(m[1]);
      const mult = m[2];
      const pay = formatMoney(m[3]);
      const extra = /effective annual rate/i.test(out)
        ? " Find the effective annual rate (% p.a., 2 d.p.) and $L_{52}$ (2 d.p.)."
        : /L\s*52/i.test(out)
          ? " Determine $L_{52}$ (2 d.p.)."
          : "";
      return `A loan follows $L_0 = ${L0}$, $L_{n+1} = ${mult}\\,L_n - ${pay}$.${extra}`;
    }
  }

  return out;
}

function normalizeRecurrenceNotation(text: string): string {
  let out = text;

  // A(n+1) = A(n)(1+r)  or  A n+1 = A n (1+r)
  out = out.replace(
    /\bA\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*A\s*\(\s*n\s*\)\s*\(\s*1\s*\+\s*r\s*\)/gi,
    "A_{n+1} = A_n(1+r)",
  );
  out = out.replace(
    /\bA\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*A_n\s*\(\s*1\s*\+\s*r\s*\)/gi,
    "A_{n+1} = A_n(1+r)",
  );
  out = out.replace(
    /\bA_{n\+1}\s*=\s*A_n\s*\(\s*1\s*\+\s*r\s*\)/gi,
    "A_{n+1} = A_n(1+r)",
  );

  // A_{n+1} = A_n(1+r) + D
  out = out.replace(
    /\bA\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*A\s*\(\s*n\s*\)\s*\(\s*1\s*\+\s*r\s*\)\s*\+\s*D/gi,
    "A_{n+1} = A_n(1+r) + D",
  );

  // B_{n+1} = B_n(1+r) - R
  out = out.replace(
    /\bB\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*B\s*\(\s*n\s*\)\s*\(\s*1\s*\+\s*r\s*\)\s*[−-]\s*R/gi,
    "B_{n+1} = B_n(1+r) - R",
  );
  out = out.replace(
    /\bB_{n\+1}\s*=\s*B_n\s*\(\s*1\s*\+\s*r\s*\)\s*[−-]\s*R/gi,
    "B_{n+1} = B_n(1+r) - R",
  );

  // L(n+1) = r*L(n) - p
  out = out.replace(
    /\bL\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:\*|×)?\s*L\s*\(\s*n\s*\)\s*[−-]\s*([+-]?\d+(?:\.\d+)?)/gi,
    "L_{n+1} = $1 L_n - $2",
  );
  out = out.replace(
    /\bL_{n\+1}\s*=\s*([+-]?\d+(?:\.\d+)?)\s*(?:\*|×)?\s*L_n\s*[−-]\s*([+-]?\d+(?:\.\d+)?)/gi,
    "L_{n+1} = $1 L_n - $2",
  );

  // L 0 = 48800  /  L0=48800
  out = out.replace(/\bL\s*0\s*=/gi, "L_0 =");
  out = out.replace(/\bL0\s*=/gi, "L_0 =");
  out = out.replace(/\bA\s*1\s*=/gi, "A_1 =");
  out = out.replace(/\bA\s*(\d+)\s*=/gi, "A_$1 =");
  out = out.replace(/\bB\s*0\s*=/gi, "B_0 =");
  out = out.replace(/\bB\s*(\d+)\s*=/gi, "B_$1 =");
  out = out.replace(/\bL\s*(\d+)\b/g, "L_$1");

  // First-order: A_{n+1} = A_n + D
  out = out.replace(
    /\bA\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*A\s*\(\s*n\s*\)\s*\+\s*D/gi,
    "A_{n+1} = A_n + D",
  );

  return out;
}

/** Wrap recurrence / formula fragments in $...$ for remark-math when not already delimited. */
function wrapMathSegments(text: string): string {
  const parts: string[] = [];
  const re =
    /(\$[^$\n]+\$|A_{n\+1}\s*=\s*A_n\(1\+r\)(?:\s*\+\s*D)?|B_{n\+1}\s*=\s*B_n\(1\+r\)\s*[−-]\s*R|L_{n\+1}\s*=\s*[+-]?\d+(?:\.\d+)?\s*L_n\s*[−-]\s*[+-]?\d+(?:\.\d+)?|L_0\s*=\s*[+-]?\d[\d,]*(?:\.\d+)?|A_{n\+1}\s*=\s*A_n\s*\+\s*D)/g;

  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (start > last) parts.push(text.slice(last, start));
    const seg = m[0];
    parts.push(seg.startsWith("$") ? seg : `$${seg}$`);
    last = end;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.join("");
}

/**
 * Full pipeline for question / passage / guidance text from sheets or DB.
 */
function looksLikeStructuredMarkdown(text: string): boolean {
  return /(^|\n)\s*[-*]\s+|(^|\n)\s*\d+\.\s+|(^|\n)\s*>|(^|\n)\s*#{1,6}\s|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|```|(^|\n)\|.+\|/.test(
    text,
  );
}

export function normalizeQuestionMathText(raw: unknown): string {
  let out = stripScenarioLabelPrefix(String(raw ?? "").replace(/\r\n?/g, "\n").trim());
  if (!out) return "";

  // Do not flatten newlines / tables in study overviews or other markdown notes.
  if (looksLikeStructuredMarkdown(out)) return out;

  out = fixInlineMathDelimiters(out);
  out = dechunkOcrLines(out);
  out = repairBareMathStems(out);
  for (const [re, rep] of GLUED_WORDS) out = out.replace(re, rep);

  const hasDollarMath = /\$[^$\n]+\$/.test(out);
  if (!hasDollarMath) {
    out = out.replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  out = out
    .replace(/annual\s*rate\s*(\d)/gi, "annual rate $1")
    .replace(/\s+/g, " ")
    .trim();

  out = rewriteFinanceTemplates(out);
  out = normalizeRecurrenceNotation(out);
  out = wrapMathSegments(out);
  out = mathifyQuestionText(out);
  out = fixInlineMathDelimiters(out);

  return out;
}
