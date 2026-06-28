/**
 * Normalize imported maths question text for storage and rendering:
 * integrals, bare LaTeX, plain powers, ln/log, and $...$ delimiters.
 */

function fixDoubleEscapes(text: string): string {
  return text
    .replace(
      /\\{2,}(frac|sqrt|begin|end|le|ge|ne|times|div|hat|ln|log|sin|cos|tan)(?=_|\b|\{)/g,
      "\\$1",
    )
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

function normalizeComplexNotation(text: string): string {
  return text
    .replace(/\\frac\\pi([0-9]+)/g, "\\frac{\\pi}{$1}")
    .replace(/(?<!\\operatorname\{)(?<![A-Za-z])cis\s*\(/g, "\\operatorname{cis}(")
    .replace(/(?<!\\operatorname\{)(?<![A-Za-z])Re\s*\(/g, "\\operatorname{Re}(")
    .replace(/(?<!\\operatorname\{)(?<![A-Za-z])Im\s*\(/g, "\\operatorname{Im}(");
}

/** e.g. Let z=8.800cis(1.540). Find Re(z^{2}) → Let $z=8.800\operatorname{cis}(1.540)$. Find $\operatorname{Re}(z^{2})$ */
function wrapLetComplexStems(text: string): string {
  let out = text.replace(
    /\bLet\s+z\s*=\s*([0-9.]+(?:\\operatorname\{cis\}|cis)\([^)]+\))\s*\.\s*Find\s+(?:\\operatorname\{Re\}|Re)\s*\(\s*z\s*\^(\{)?2(\})?\s*\)([^$]*)/gi,
    (_m, zExpr, _open, _close, tail) => {
      let z = String(zExpr).trim();
      z = z.replace(/(?<!\\operatorname\{)(?<![A-Za-z])cis\s*\(/g, "\\operatorname{cis}(");
      z = normalizePowers(z);
      return `Let $z=${z}$. Find $\\operatorname{Re}(z^{2})$` + tail;
    },
  );
  // Repair partial import: math delimiter swallowed trailing prose.
  out = out.replace(
    /Find\s+\$\\operatorname\{Re\}\(z\^\{2\}\)\s+(?=to\b)/g,
    "Find $\\operatorname{Re}(z^{2})$ ",
  );
  return out;
}

function normalizeTrigAndLog(text: string): string {
  let out = text
    .replace(/\\log_\{e\}/g, "\\ln")
    .replace(/\\log_e\b/g, "\\ln")
    .replace(/\\hat\s+([A-Za-z])/g, "\\hat{$1}");

  out = out
    .replace(/(^|[^\\A-Za-z])ln\s*\(/g, "$1\\ln(")
    .replace(/(?<!\\)log\s*_\s*\{([0-9A-Za-z]+)\}/g, "\\log_{$1}")
    .replace(/(?<!\\)log\s*_\s*([0-9A-Za-z]+)/g, "\\log_{$1}")
    .replace(/(?<!\\)log\s*\(/g, "\\log(")
    .replace(/(?<!\\)sin\s*\(/g, "\\sin(")
    .replace(/(?<!\\)cos\s*\(/g, "\\cos(")
    .replace(/(?<!\\)tan\s*\(/g, "\\tan(");

  return out;
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

/** dy/dx, d^2y/dx^2, dx/dt → \frac{dy}{dx} etc. (also repairs dy/dt inside $...$). */
function normalizeDerivativeSlashes(segment: string): string {
  return segment.replace(
    /\bd(\^2)?([a-z])\s*\/\s*d(\^2)?([a-z])\b/gi,
    (_m, numSq: string | undefined, numVar: string, denSq: string | undefined, denVar: string) => {
      const num = `d${numSq ?? ""}${numVar}`;
      const den = `d${denSq ?? ""}${denVar}`;
      return `\\frac{${num}}{${den}}`;
    },
  );
}

function wrapOdeAndFunctionNotation(segment: string): string {
  let out = segment;

  out = out.replace(
    /\bSolve\s+((?:\\frac\{d[^{}]+\}\{d[^{}]+\})[^$]+?)(?=\s+with\b|[,.]|\s+given\b|\s+for\b|$)/gi,
    (_m, eq: string) => `Solve $${eq.trim().replace(/\s+/g, " ")}$`,
  );

  out = out.replace(
    /\bFor\s+((?:\\frac\{d[^{}]+\}\{d[^{}]+\})[^$]+?)(?=\s*,\s|\.\s|$)/gi,
    (_m, eq: string) => `For $${eq.trim().replace(/\s+/g, " ")}$`,
  );

  out = out.replace(
    /\b([fgh]|y)\s*\(\s*([^)]+?)\s*\)\s*=\s*([^,\s;.]+)/gi,
    (_m, fn: string, arg: string, val: string) => `$${fn}(${arg.trim()})=${val.trim()}$`,
  );

  out = out.replace(
    /\b(find|evaluate|determine|calculate|compute|hence\s+find)\s+([fgh]|y)\s*\(\s*([^)]+?)\s*\)/gi,
    (_m, verb: string, fn: string, arg: string) => `${verb} $${fn}(${arg.trim()})$`,
  );

  return out;
}

function mathifyDerivativesAndOdes(text: string): string {
  return text
    .split(/(\$[^$]*\$)/g)
    .map((part) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        const inner = normalizeDerivativeSlashes(part.slice(1, -1));
        return `$${inner}$`;
      }
      let out = normalizeDerivativeSlashes(part);
      out = wrapOdeAndFunctionNotation(out);
      return out;
    })
    .join("");
}

function segmentLooksMath(segment: string): boolean {
  return /f\s*\(\s*x\s*\)|\\int|∫|\^|e\^|\\[a-zA-Z]+|f'|d\/dx|d\^2[a-z]\/d[a-z]|[a-z]\/d[a-z]|[0-9][a-zA-Z]\^|cis\s*\(|\\operatorname\{cis\}|Re\s*\(|\\operatorname\{Re\}|\b(?:dy|dx|dt)\//i.test(
    segment,
  );
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

  // Periodic models d(t)=A\cos(...)+k (Tide, Ferris wheel, etc.)
  out = out.replace(
    /(?<!\$)\b([a-z])\(\s*t\s*\)\s*=\s*((?:[\d.]+\s*)?\\(?:sin|cos|tan)[\s\S]*?\\right\s*\)\s*(?:\+\s*[\d.]+)?)/gi,
    (_m, fn, expr) => `$${fn}(t)=${mathifyIntegrand(expr.replace(/\s+/g, " "))}$`,
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
  out = wrapLetComplexStems(out);
  out = normalizeComplexNotation(out);
  out = normalizePowers(out);
  out = mathifyDerivativesAndOdes(out);

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
