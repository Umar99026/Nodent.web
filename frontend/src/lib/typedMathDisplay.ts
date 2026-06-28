import katex from "katex";

export type TypedMathSegment =
  | { kind: "text"; text: string }
  | { kind: "math"; latex: string }
  | {
      kind: "script";
      marker: "^" | "_";
      baseRaw: string;
      innerRaw: string;
      latex: string;
    };

type Span = {
  start: number;
  end: number;
  latex: string;
  script?: { marker: "^" | "_"; baseRaw: string; innerRaw: string };
};

function readBalancedParens(
  text: string,
  openIndex: number,
): { inner: string; end: number } | null {
  if (text[openIndex] !== "(") return null;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")") {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(openIndex + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function isInside(pos: number, spans: Span[]): boolean {
  return spans.some((s) => pos >= s.start && pos < s.end);
}

function mergeSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Span[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start < cursor) continue;
    out.push(span);
    cursor = span.end;
  }
  return out;
}

function readTokenBefore(text: string, end: number): { value: string; start: number } | null {
  let i = end;
  while (i > 0 && /\s/.test(text[i - 1]!)) i--;
  if (i <= 0) return null;
  if (text[i - 1] === ")") {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (text[j] === ")") depth++;
      if (text[j] === "(") {
        depth--;
        if (depth === 0) return { value: text.slice(j, i), start: j };
      }
    }
    return null;
  }
  let start = i;
  while (start > 0 && /[a-zA-Z0-9.]/.test(text[start - 1]!)) start--;
  if (start === i) return null;
  return { value: text.slice(start, i), start };
}

function readTokenAfter(text: string, start: number): { value: string; end: number } | null {
  let i = start;
  while (i < text.length && /\s/.test(text[i]!)) i++;
  if (i >= text.length) return null;
  if (text[i] === "(") {
    const group = readBalancedParens(text, i);
    if (!group) return null;
    return { value: text.slice(i, group.end), end: group.end };
  }
  if (text[i] === "-") {
    const afterMinus = i + 1;
    if (text[afterMinus] === "(") {
      const group = readBalancedParens(text, afterMinus);
      if (group) return { value: text.slice(i, group.end), end: group.end };
    }
    let end = afterMinus;
    while (end < text.length && /[a-zA-Z0-9.]/.test(text[end]!)) end++;
    if (end > afterMinus) return { value: text.slice(i, end), end };
    return null;
  }
  let end = i;
  while (end < text.length && /[a-zA-Z0-9.]/.test(text[end]!)) end++;
  if (end === i) return null;
  return { value: text.slice(i, end), end };
}

function innerToLatexOperands(raw: string): string {
  const inner = raw.startsWith("(") && raw.endsWith(")") ? raw.slice(1, -1) : raw;
  return segmentTypedMathLine(inner)
    .map((seg) => {
      if (seg.kind === "text") return seg.text;
      return seg.latex;
    })
    .join("");
}

/** Build sqrt radicand — full expression inside \\sqrt{…} so the vinculum spans all of it. */
function sqrtRadicandLatex(inner: string): string {
  return innerToLatexOperands(inner);
}

function collectSqrtSpans(line: string, occupied: Span[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < line.length; i++) {
    if (isInside(i, occupied)) continue;
    if (!/^sqrt\s*\(/i.test(line.slice(i))) continue;
    const open = line.indexOf("(", i);
    if (open < 0) continue;
    const group = readBalancedParens(line, open);
    if (!group) continue;
    const radicand = sqrtRadicandLatex(group.inner);
    spans.push({
      start: i,
      end: group.end,
      latex: radicand ? `\\sqrt{${radicand}}` : "\\sqrt{}",
    });
    i = group.end - 1;
  }
  return spans;
}

function collectFractionSpans(line: string, occupied: Span[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "/" || isInside(i, occupied)) continue;
    const num = readTokenBefore(line, i);
    const den = readTokenAfter(line, i + 1);
    if (!num || !den) continue;
    if (isInside(num.start, occupied) || isInside(den.end - 1, occupied)) continue;
    spans.push({
      start: num.start,
      end: den.end,
      latex: `\\frac{${innerToLatexOperands(num.value)}}{${innerToLatexOperands(den.value)}}`,
    });
    i = den.end - 1;
  }
  return spans;
}

function collectPowerSpans(line: string, occupied: Span[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "^" || isInside(i, occupied)) continue;
    const base = readTokenBefore(line, i);
    if (!base || isInside(base.start, occupied)) continue;

    const expStart = i + 1;
    if (expStart >= line.length) continue;

    let expEnd: number;
    let expRaw: string;
    let braced = false;
    if (line[expStart] === "{") {
      const group = readBalancedBraces(line, expStart);
      if (!group) continue;
      expRaw = group.inner;
      expEnd = group.end;
      braced = true;
    } else {
      const exp = readTokenAfter(line, i + 1);
      if (!exp) continue;
      expRaw = exp.value.startsWith("(") && exp.value.endsWith(")")
        ? exp.value.slice(1, -1)
        : exp.value;
      expEnd = exp.end;
    }

    const baseLatex = innerToLatexOperands(base.value);
    const expLatex = innerToLatexOperands(expRaw);
    const wrappedBase = base.value.startsWith("(") ? `{${baseLatex}}` : baseLatex;
    const span: Span = {
      start: base.start,
      end: expEnd,
      latex: `${wrappedBase}^{${expLatex}}`,
    };
    if (braced) {
      span.script = { marker: "^", baseRaw: base.value, innerRaw: expRaw };
    }
    spans.push(span);
    i = expEnd - 1;
  }
  return spans;
}

function readBalancedBraces(
  text: string,
  openIndex: number,
): { inner: string; end: number } | null {
  if (text[openIndex] !== "{") return null;
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(openIndex + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function collectSubscriptSpans(line: string, occupied: Span[]): Span[] {
  const spans: Span[] = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "_" || isInside(i, occupied)) continue;
    const base = readTokenBefore(line, i);
    if (!base || isInside(base.start, occupied)) continue;

    const subStart = i + 1;
    if (subStart >= line.length) continue;

    let subEnd: number;
    let subRaw: string;
    if (line[subStart] === "{") {
      const group = readBalancedBraces(line, subStart);
      if (!group) continue;
      subRaw = group.inner;
      subEnd = group.end;
    } else if (/[a-zA-Z0-9]/.test(line[subStart]!)) {
      subRaw = line[subStart]!;
      subEnd = subStart + 1;
    } else {
      continue;
    }

    const baseLatex = innerToLatexOperands(base.value);
    const subLatex = innerToLatexOperands(subRaw);
    const wrappedBase = base.value.startsWith("(") ? `{${baseLatex}}` : baseLatex;
    const braced = line[subStart] === "{";
    const span: Span = {
      start: base.start,
      end: subEnd,
      latex: `${wrappedBase}_{${subLatex}}`,
    };
    if (braced) {
      span.script = { marker: "_", baseRaw: base.value, innerRaw: subRaw };
    }
    spans.push(span);
    i = subEnd - 1;
  }
  return spans;
}

export function segmentTypedMathLine(line: string): TypedMathSegment[] {
  if (!line) return [];

  const sqrtSpans = collectSqrtSpans(line, []);
  const fracSpans = collectFractionSpans(line, sqrtSpans);
  const subSpans = collectSubscriptSpans(line, [...sqrtSpans, ...fracSpans]);
  const powerSpans = collectPowerSpans(line, [...sqrtSpans, ...fracSpans, ...subSpans]);
  const spans = mergeSpans([...sqrtSpans, ...fracSpans, ...subSpans, ...powerSpans]);

  if (!spans.length) return [{ kind: "text", text: line }];

  const segments: TypedMathSegment[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start > cursor) {
      segments.push({ kind: "text", text: line.slice(cursor, span.start) });
    }
    segments.push(
      span.script
        ? {
            kind: "script",
            marker: span.script.marker,
            baseRaw: span.script.baseRaw,
            innerRaw: span.script.innerRaw,
            latex: span.latex,
          }
        : { kind: "math", latex: span.latex },
    );
    cursor = span.end;
  }
  if (cursor < line.length) {
    segments.push({ kind: "text", text: line.slice(cursor) });
  }
  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const KATEX_OPTS = {
  throwOnError: false,
  strict: "ignore" as const,
  output: "html" as const,
  displayMode: false,
};

function renderKatex(latex: string): string {
  try {
    return katex.renderToString(latex, KATEX_OPTS);
  } catch {
    return `<span class="exam-paper-plain">${escapeHtml(latex)}</span>`;
  }
}

/** HTML for the visible prefix of a line (used to position the custom caret). */
export function renderTypedMathHtmlUpToCursor(line: string, cursor: number): string {
  if (cursor <= 0) return "";
  return renderTypedMathLineHtml(line.slice(0, cursor));
}

export function renderTypedMathLineHtml(line: string): string {
  if (!line) return '<span class="exam-paper-plain">&nbsp;</span>';

  return segmentTypedMathLine(line)
    .map((seg) => {
      if (seg.kind === "text") {
        return `<span class="exam-paper-plain">${escapeHtml(seg.text)}</span>`;
      }
      return renderKatex(seg.latex);
    })
    .join("");
}

/** Convert plain `sqrt(...)` radicand text to LaTeX for \\sqrt{…}. */
export function plainSqrtToLatex(inner: string): string {
  const radicand = sqrtRadicandLatex(inner);
  return radicand ? `\\sqrt{${radicand}}` : "\\sqrt{}";
}

/** @deprecated Used by answer normalisation — keep for marking. */
export function convertTypedLineToLatex(line: string): string {
  return segmentTypedMathLine(line)
    .map((seg) => {
      if (seg.kind === "text") return seg.text;
      return seg.latex;
    })
    .join("");
}
