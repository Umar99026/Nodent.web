/**
 * Normalize imported maths question text for storage and rendering:
 * integrals, bare LaTeX, plain powers, ln/log, and $...$ delimiters.
 */

function fixDoubleEscapes(text: string): string {
  return text
    .replace(/\\{2,}(frac|sqrt|begin|end|le|ge|ne|times|div|hat|ln|log|sin|cos|tan)\b/g, "\\$1")
    .replace(/\\{2,}int\b/g, "\\int");
}

function normalizePowers(text: string): string {
  let out = text;
  for (let i = 0; i < 4; i++) {
    const prev = out;
    out = out.replace(/\^\s*\{\s*\{\s*([^{}]+?)\s*\}\s*\}/g, "^{$1}");
    out = out.replace(/\^\{+\s*([^{}]+?)\s*\}+/g, "^{$1}");
    if (out === prev) break;
  }
  out = out.replace(/([0-9A-Za-z)\]])\^([0-9]+)/g, "$1^{$2}");
  out = out.replace(/([0-9A-Za-z)\]])\^\(([^)]+)\)/g, "$1^{$2}");
  out = out.replace(/e\^\(([^)]+)\)/gi, "e^{$1}");
  return out;
}

function normalizeTrigAndLog(text: string): string {
  return text
    .replace(/(^|[^\\A-Za-z])ln\s*\(/g, "$1\\ln(")
    .replace(/\blog\s*_\s*\{/g, "\\log_{")
    .replace(/\blog\s*_\s*([0-9A-Za-z]+)/g, "\\log_{$1}")
    .replace(/\blog\s*\(/g, "\\log(")
    .replace(/\bsin\s*\(/g, "\\sin(")
    .replace(/\bcos\s*\(/g, "\\cos(")
    .replace(/\btan\s*\(/g, "\\tan(");
}

function mathifyIntegrand(s: string): string {
  return normalizeTrigAndLog(normalizePowers(String(s)));
}

function fixIntegralNotation(text: string): string {
  let q = text;
  q = q.replace(
    /Evaluate\s*∫\s*\(\s*([^)]+?)\s+to\s+([^)]+?)\s*\)\s*\((.+)\)\s*dx\.?/gi,
    (_m, a, b, integrand) => {
      const body = mathifyIntegrand(integrand);
      return `Evaluate $\\displaystyle\\int_{${String(a).trim()}}^{${String(b).trim()}} (${body})\\,dx$.`;
    },
  );
  q = q.replace(
    /∫\s*\(\s*([^)]+?)\s+to\s+([^)]+?)\s*\)\s*\((.+)\)\s*dx/gi,
    (_m, a, b, integrand) =>
      `$\\displaystyle\\int_{${String(a).trim()}}^{${String(b).trim()}} (${mathifyIntegrand(integrand)})\\,dx$`,
  );
  q = q.replace(
    /∫\s*([+\-]?\d+(?:\.\d+)?)\s*([+\-]?\d+(?:\.\d+)?)\s*(\([^)]+\))\s*d([A-Za-z])/g,
    "\\int_{$1}^{$2}$3\\,d$4",
  );
  q = q.replace(
    /\\int\s*[_]?\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s*\}?\s*\^\s*\{?\s*([+\-]?\d+(?:\.\d+)?)\s*\}?/g,
    "\\int_{$1}^{$2}",
  );
  return q;
}

function segmentLooksMath(segment: string): boolean {
  return /f\s*\(\s*x\s*\)|\\int|∫|\^|e\^|\\[a-zA-Z]+|f'|d\/dx|[0-9][a-zA-Z]\^/.test(segment);
}

function wrapBareMathSegments(text: string): string {
  let out = text;

  // f'(1.2) or f'(x)
  out = out.replace(/\bf'\s*\(\s*([^)]+)\s*\)/gi, (_m, arg) => `$f'(${String(arg).trim()})$`);

  // Let f(x)= ... up to sentence end (. ) or clause (, )
  out = out.replace(
    /\bLet\s+(f|g|h)\s*\(\s*x\s*\)\s*=\s*(.+?)(?=\.\s|,\s|$)/gi,
    (_m, fn, expr) => `Let $${fn}(x)=${mathifyIntegrand(expr)}$`,
  );

  // For f(x)=..., 
  out = out.replace(
    /\bFor\s+(f|g|h)\s*\(\s*x\s*\)\s*=\s*(.+?)(?=,\s)/gi,
    (_m, fn, expr) => `For $${fn}(x)=${mathifyIntegrand(expr)}$`,
  );

  // Standalone f(x)= when not yet wrapped
  out = out.replace(
    /(?<!\$)\b(f|g|h)\s*\(\s*x\s*\)\s*=\s*(.+?)(?=\.\s|,\s|$)/gi,
    (_m, fn, expr) => {
      if (expr.includes("$")) return _m;
      return `$${fn}(x)=${mathifyIntegrand(expr)}$`;
    },
  );

  // Evaluate \int... without $
  if (/\\int|∫/.test(out) && !/\$[^$]*\\int/.test(out)) {
    const m = out.match(/^(Evaluate\s+)(\\int[\s\S]+?)([.,]\s*Give[\s\S]*)?$/i);
    if (m) {
      out = `${m[1]}$${m[2].trim()}$${m[3] ?? ""}`;
    }
  }

  return out;
}

function wrapOutsideExistingDollars(text: string): string {
  const parts = text.split(/(\$[^$]*\$)/g);
  return parts
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$")) return part;
      return wrapBareMathSegments(part);
    })
    .join("");
}

/**
 * Full pipeline for question / option / guidance text from imports.
 */
export function mathifyQuestionText(raw: unknown): string {
  let out = String(raw ?? "").replace(/\r\n?/g, "\n").trim();
  if (!out) return "";

  out = fixDoubleEscapes(out);
  out = fixIntegralNotation(out);
  out = normalizeTrigAndLog(out);
  out = normalizePowers(out);

  if (segmentLooksMath(out)) {
    out = wrapOutsideExistingDollars(out);
  }

  return out;
}

export function questionNeedsMathFormat(raw: unknown): boolean {
  const before = String(raw ?? "").trim();
  if (!before) return false;
  const after = mathifyQuestionText(before);
  return after !== before;
}
