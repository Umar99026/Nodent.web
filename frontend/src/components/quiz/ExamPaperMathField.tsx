import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import {
  renderTypedMathHtmlUpToCursor,
  renderTypedMathLineHtml,
} from "@/lib/typedMathDisplay";
import {
  arrowRightExitsSubscript,
  arrowRightExitsSuperscript,
  expandCaretToSuperscript,
  expandUnderscoreToSubscript,
} from "@/lib/typedMathInput";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  lineHeightPx?: number;
};

type CaretPos = { left: number; top: number };

export function ExamPaperMathField({
  value,
  onChange,
  disabled = false,
  className,
  lineHeightPx = 32,
}: Props) {
  const fieldRef = useRef<HTMLTextAreaElement | null>(null);
  const displayRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [caret, setCaret] = useState<CaretPos>({ left: 0, top: 0 });
  const [caretVisible, setCaretVisible] = useState(false);

  const syncScroll = () => {
    if (displayRef.current && fieldRef.current) {
      displayRef.current.scrollTop = fieldRef.current.scrollTop;
      displayRef.current.scrollLeft = fieldRef.current.scrollLeft;
    }
  };

  const updateCaret = useCallback(() => {
    const el = fieldRef.current;
    const measure = measureRef.current;
    const display = displayRef.current;
    if (!el || !measure || !display) return;

    const pos = el.selectionStart ?? 0;
    const focused = document.activeElement === el;
    setCaretVisible(focused && !disabled);

    const before = value.slice(0, pos);
    const lineIndex = before.split("\n").length - 1;
    const lineStart = value.lastIndexOf("\n", pos - 1) + 1;
    const lineEnd = value.indexOf("\n", pos);
    const line = value.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
    const lineCursor = pos - lineStart;

    measure.innerHTML = renderTypedMathHtmlUpToCursor(line, lineCursor);

    const lineEl = display.querySelectorAll<HTMLElement>(".exam-paper-math-line")[lineIndex];
    const lineTop = lineEl?.offsetTop ?? lineIndex * lineHeightPx;
    measure.style.top = `${lineTop}px`;

    setCaret({
      left: measure.offsetWidth - display.scrollLeft,
      top: lineTop - display.scrollTop,
    });
  }, [disabled, lineHeightPx, value]);

  useLayoutEffect(() => {
    updateCaret();
  }, [updateCaret]);

  const setCaretIndex = (pos: number) => {
    const el = fieldRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.selectionStart = pos;
      el.selectionEnd = pos;
      updateCaret();
    });
  };

  const handleCaretEvent = (_e: SyntheticEvent<HTMLTextAreaElement>) => {
    updateCaret();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const el = fieldRef.current;
    if (!el || disabled) return;

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    if (start !== end) return;

    if (e.key === "ArrowRight") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = value.indexOf("\n", start);
      const line = value.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
      const lineCursor = start - lineStart;
      const exit =
        arrowRightExitsSuperscript(line, lineCursor) ??
        arrowRightExitsSubscript(line, lineCursor);
      if (exit !== null) {
        e.preventDefault();
        const nextLine = exit.text ?? line;
        if (exit.text !== undefined) {
          const lineSuffix = lineEnd < 0 ? "" : value.slice(lineEnd);
          onChange(value.slice(0, lineStart) + nextLine + lineSuffix);
        }
        setCaretIndex(lineStart + exit.cursor);
      }
      return;
    }

    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === "_") {
        const expanded = expandUnderscoreToSubscript(value, start);
        if (expanded) {
          e.preventDefault();
          onChange(expanded.text);
          setCaretIndex(expanded.cursor);
        }
        return;
      }
      if (e.key === "^") {
        const expanded = expandCaretToSuperscript(value, start);
        if (expanded) {
          e.preventDefault();
          onChange(expanded.text);
          setCaretIndex(expanded.cursor);
        }
      }
    }
  };

  const lines = value.split("\n");

  return (
    <div className="exam-paper-math-field relative h-full w-full">
      <div ref={displayRef} className="exam-paper-math-display" aria-hidden="true">
        {lines.map((line, index) => (
          <div
            key={index}
            className="exam-paper-math-line"
            dangerouslySetInnerHTML={{ __html: renderTypedMathLineHtml(line) }}
          />
        ))}
        <span
          ref={measureRef}
          className="exam-paper-math-line exam-paper-math-caret-measure"
          aria-hidden="true"
        />
        {caretVisible ? (
          <span
            className="exam-paper-math-caret"
            style={{ left: caret.left, top: caret.top }}
          />
        ) : null}
      </div>
      <textarea
        ref={fieldRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleCaretEvent}
        onClick={handleCaretEvent}
        onSelect={handleCaretEvent}
        onFocus={handleCaretEvent}
        onBlur={() => setCaretVisible(false)}
        onScroll={syncScroll}
        disabled={disabled}
        rows={1}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          "exam-paper-input-field exam-paper-input-field--typed",
          className,
        )}
      />
    </div>
  );
}
