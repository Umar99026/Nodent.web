/** Cursor helpers for VCE-style typed math in exam answer fields. */

export type ScriptExitResult = {
  cursor: number;
  /** When set, rewrite the current line to this text (e.g. wrap unbraced x^2 → x^{2}). */
  text?: string;
};

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

function isScriptBraceClose(text: string, closeIndex: number, marker: "_" | "^"): boolean {
  if (text[closeIndex] !== "}") return false;
  let depth = 0;
  for (let i = closeIndex - 1; i >= 0; i--) {
    if (text[i] === "}") depth++;
    if (text[i] === "{") {
      if (depth === 0) return i > 0 && text[i - 1] === marker;
      depth--;
    }
  }
  return false;
}

function readExponentBefore(text: string, end: number): { start: number; end: number } | null {
  let i = end;
  while (i > 0 && /\s/.test(text[i - 1]!)) i--;
  if (i <= 0) return null;

  let start = i;
  if (text[i - 1] === ")") {
    let depth = 0;
    for (let j = i - 1; j >= 0; j--) {
      if (text[j] === ")") depth++;
      if (text[j] === "(") {
        depth--;
        if (depth === 0) {
          start = j;
          break;
        }
      }
    }
    if (text[start] !== "(") return null;
  } else {
    while (start > 0 && /[a-zA-Z0-9.]/.test(text[start - 1]!)) start--;
  }

  if (start <= 0 || text[start - 1] !== "^") return null;
  if (text[start] === "{") return null;
  return { start, end: i };
}

function wrapUnbracedScript(
  text: string,
  cursor: number,
  marker: "_" | "^",
): ScriptExitResult | null {
  if (cursor <= 0) return null;

  let end = cursor;
  let start = end;

  if (end > 0 && text[end - 1] === ")") {
    let depth = 0;
    for (let j = end - 1; j >= 0; j--) {
      if (text[j] === ")") depth++;
      if (text[j] === "(") {
        depth--;
        if (depth === 0) {
          start = j;
          break;
        }
      }
    }
    if (text[start] !== "(") return null;
  } else {
    while (start > 0 && /[a-zA-Z0-9]/.test(text[start - 1]!)) start--;
  }

  if (start <= 0 || text[start - 1] !== marker) return null;
  if (text[start] === "{") return null;

  const script = text.slice(start, end);
  if (!script) return null;

  const markerIndex = start - 1;
  const wrapped = `${text.slice(0, markerIndex + 1)}{${script}}${text.slice(end)}`;
  return {
    text: wrapped,
    cursor: markerIndex + 1 + 1 + script.length + 1,
  };
}

/**
 * When the caret is at the end of a subscript (just before `}`), return the index
 * after the closing brace so Right Arrow exits subscript mode.
 */
export function arrowRightExitsSubscript(text: string, cursor: number): ScriptExitResult | null {
  if (cursor < text.length && text[cursor] === "}" && isScriptBraceClose(text, cursor, "_")) {
    return { cursor: cursor + 1 };
  }
  return wrapUnbracedScript(text, cursor, "_");
}

/**
 * When the caret is at the end of a superscript, exit to the baseline.
 * Handles both `x^{2}` (cursor before `}`) and unbraced `x^2` (wraps then exits).
 */
export function arrowRightExitsSuperscript(text: string, cursor: number): ScriptExitResult | null {
  if (cursor < text.length && text[cursor] === "}" && isScriptBraceClose(text, cursor, "^")) {
    return { cursor: cursor + 1 };
  }

  const exp = readExponentBefore(text, cursor);
  if (exp) {
    return wrapUnbracedScript(text, cursor, "^");
  }

  return null;
}

function expandScript(
  text: string,
  cursor: number,
  marker: "_" | "^",
): { text: string; cursor: number } | null {
  if (cursor <= 0) return null;
  const prev = text[cursor - 1]!;
  if (!/[a-zA-Z0-9)\]}]/.test(prev)) return null;

  const before = text.slice(0, cursor);
  const after = text.slice(cursor);
  return {
    text: `${before}${marker}{}${after}`,
    cursor: cursor + 2,
  };
}

/**
 * When `_` is typed after a base token, expand to `_{}` and place the caret inside.
 */
export function expandUnderscoreToSubscript(
  text: string,
  cursor: number,
): { text: string; cursor: number } | null {
  return expandScript(text, cursor, "_");
}

/**
 * When `^` is typed after a base token, expand to `^{}` and place the caret inside.
 */
export function expandCaretToSuperscript(
  text: string,
  cursor: number,
): { text: string; cursor: number } | null {
  return expandScript(text, cursor, "^");
}

export { readBalancedBraces, readBalancedParens };
