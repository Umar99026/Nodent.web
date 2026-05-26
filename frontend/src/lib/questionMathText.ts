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

function dechunkOcrLines(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return text;

  const singleCharLines = lines.filter((l) => /^[A-Za-z0-9]$/.test(l)).length;
  const shouldDechunk =
    lines.length >= 6 &&
    (singleCharLines / lines.length >= 0.35 ||
      lines.some((l) => l === "," || l === "." || l === ":" || l === ";"));

  if (!shouldDechunk) return lines.join("\n");

  let out = lines.join("");
  for (const [re, rep] of GLUED_WORDS) out = out.replace(re, rep);
  return out
    .replace(/\s+/g, " ")
    .replace(/\s*([,.;:!?])\s*/g, "$1 ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/(\d),([A-Za-z])/g, "$1, $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
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
  let out = String(raw ?? "").replace(/\r\n?/g, "\n").trim();
  if (!out) return "";

  // Do not flatten newlines / tables in study overviews or other markdown notes.
  if (looksLikeStructuredMarkdown(out)) return out;

  out = dechunkOcrLines(out);
  for (const [re, rep] of GLUED_WORDS) out = out.replace(re, rep);

  out = out
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/annual\s*rate\s*(\d)/gi, "annual rate $1")
    .replace(/\s+/g, " ")
    .trim();

  out = rewriteFinanceTemplates(out);
  out = normalizeRecurrenceNotation(out);
  out = wrapMathSegments(out);

  return out;
}
