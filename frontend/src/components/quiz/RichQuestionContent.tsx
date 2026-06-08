import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { RichMathText } from "@/components/quiz/QuestionStimulus";
import { absolutizeMarkdownAssetUrls } from "@/lib/questionDisplay";
import {
  fixInlineMathDelimiters,
  normalizeQuestionMathText,
} from "@/lib/questionMathText";

const RICH_FORCE =
  /^(?:%%\s*rich|:::rich)\s*(?:\r?\n|\r)/i;

/** Allow KaTeX + diagrams; `data:` on img for pasted figures. */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      "className",
      "style",
      "aria-hidden",
    ],
    math: ["xmlns", "display"],
    semantics: [],
    mrow: [],
    mi: [],
    mo: [],
    mn: [],
    msup: [],
    msub: [],
    mfrac: [],
    msqrt: [],
    mtable: [],
    mtr: [],
    mtd: [],
  },
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "math",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "msup",
    "msub",
    "mfrac",
    "msqrt",
    "mtable",
    "mtr",
    "mtd",
  ],
  protocols: {
    ...defaultSchema.protocols,
    href: ["http", "https", "mailto", "tel", ...(defaultSchema.protocols?.href ?? [])],
    cite: ["http", "https", ...(defaultSchema.protocols?.cite ?? [])],
    src: ["http", "https", "data", ...(defaultSchema.protocols?.src ?? [])],
  },
} as const;

function stripRichForcePrefix(text: string): { forced: boolean; body: string } {
  const t = String(text ?? "");
  if (RICH_FORCE.test(t)) {
    return { forced: true, body: t.replace(RICH_FORCE, "").trimStart() };
  }
  return { forced: false, body: t };
}

/**
 * Optional: plain-only questions can opt out of Markdown with %%plain on line 1.
 * Otherwise we always use Markdown+KaTeX so $...$, $$...$$, tables, and ![](...) work.
 */
function stripPlainOptOut(text: string): { usePlainFallback: boolean; body: string } {
  const t = String(text ?? "");
  if (/^%%\s*plain\s*(?:\r?\n|\r)/i.test(t)) {
    return { usePlainFallback: true, body: t.replace(/^%%\s*plain\s*(?:\r?\n|\r)/i, "").trimStart() };
  }
  return { usePlainFallback: false, body: t };
}

function looksLikePlainMathText(text: string): boolean {
  const t = String(text ?? "");
  // If the author already used markdown/math syntax, keep markdown renderer.
  if (/[`#>|]|!\[[^\]]*\]\([^)]+\)|\$\$?/.test(t)) return false;
  // Heuristic math patterns from imports/paste.
  return /(\d+\s*\/\s*\d+)|([0-9A-Za-z]\^[0-9({])|(\b[a-zA-Z]\s*\^\s*\d+)|(\bsqrt\s*\()|([<>]=|!=)|([xX*]\s*\d)|(\d\s*[xX*]\s*\d)|(\[\[.+\],\s*\[.+\]\])|(\[[^\]]+;[^\]]+\])|(\\int|∫)|(\\ln|\\log|\\sin|\\cos|\\tan)|(\bf'\s*\()|(\be\^\{)/.test(
    t,
  );
}

function looksLikeStructuredMarkdown(text: string): boolean {
  const t = String(text ?? "");
  return /(^|\n)\s*[-*]\s+|(^|\n)\s*\d+\.\s+|(^|\n)\s*>|(^|\n)\s*#{1,6}\s|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|```/.test(
    t,
  );
}

/** Study overview prose — compact, readable body; display font on headings only. */
const overviewBodyMarkdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="overview-heading mb-5 mt-10 font-display text-2xl font-semibold tracking-tight text-slate-900 first:mt-0 sm:mb-6 sm:mt-12 sm:text-[1.75rem]">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="overview-heading mb-4 mt-9 border-b border-slate-200/90 pb-2.5 font-display text-lg font-semibold tracking-tight text-slate-900 sm:mb-5 sm:mt-11 sm:text-xl">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="overview-heading mb-3 mt-7 text-[0.8125rem] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:mt-8 sm:text-sm">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="overview-body my-4 text-[0.9375rem] leading-[1.72] text-slate-700 sm:my-5 sm:text-base sm:leading-[1.75]">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="overview-body my-4 list-disc space-y-2.5 pl-5 marker:text-brand/80 sm:my-5 sm:pl-6">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="overview-body my-4 list-decimal space-y-2.5 pl-5 marker:font-medium marker:text-slate-400 sm:my-5 sm:pl-6">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-[0.9375rem] leading-[1.72] text-slate-700 sm:text-base sm:leading-[1.75]">
      {children}
    </li>
  ),
  hr: () => (
    <hr className="my-8 border-0 border-t border-slate-200/90 sm:my-10" aria-hidden />
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-slate-900">{children}</strong>
  ),
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-deep underline decoration-brand/50 decoration-1 underline-offset-[3px] transition-colors hover:text-brand hover:decoration-brand"
    >
      {children}
    </a>
  ),
} as const;

type RichQuestionContentProps = {
  text: string;
  className?: string;
  /**
   * For long humanities / English prose: always use Markdown rendering instead of the
   * plain-math heuristic (which treats common phrases like `3/4` as math and can blank
   * or mangle normal sentences via {@link RichMathText}).
   */
  preferMarkdown?: boolean;
  /** Practice topic overviews — larger prose and tables (General / Specialist Maths). */
  overviewMode?: boolean;
};

/**
 * Renders question/passage text with optional GitHub-flavoured Markdown, math ($$…$$ / blocks),
 * safe inline HTML (incl. `<img src="data:…">`), and embedded images via `![](…)`.
 */
export function RichQuestionContent({
  text,
  className,
  preferMarkdown = false,
  overviewMode = false,
}: RichQuestionContentProps) {
  const { forced, body: afterForce } = stripRichForcePrefix(text);
  const { usePlainFallback, body: rawBody } = stripPlainOptOut(afterForce);

  // normalizeQuestionMathText collapses all whitespace (including newlines), which destroys
  // overview markdown (tables, headings, lists). Only run it on plain imported question text.
  const preserveMarkdownStructure =
    preferMarkdown ||
    overviewMode ||
    looksLikeStructuredMarkdown(rawBody);
  const body = fixInlineMathDelimiters(
    preserveMarkdownStructure
      ? absolutizeMarkdownAssetUrls(rawBody)
      : normalizeQuestionMathText(rawBody),
  );

  // Never send structured Markdown (headings, lists, tables) through RichMathText — it blanks long notes.
  const useRichMathBranch =
    !preferMarkdown &&
    !overviewMode &&
    !forced &&
    !looksLikeStructuredMarkdown(body) &&
    ((usePlainFallback && !forced) || looksLikePlainMathText(body));

  // For plain imported text (across all subjects), use RichMathText so
  // fractions/powers/matrices are consistently rendered in notation.
  if (useRichMathBranch) {
    return <RichMathText text={body} className={className} />;
  }

  return (
    <div
      className={cn(
        overviewMode
          ? "overview-markdown max-w-none text-foreground [&_.katex]:text-[1em] sm:[&_.katex]:text-[1.02em]"
          : "prose prose-sm max-w-none text-foreground dark:prose-invert",
        "[&_.katex]:text-foreground [&_.katex-display]:my-3",
        "[&_img]:mx-auto [&_img]:block [&_img]:max-h-[min(70vh,560px)] [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-black/10 [&_img]:bg-muted/20 [&_img]:object-contain",
        !overviewMode &&
          "[&_table]:text-sm [&_th]:border [&_td]:border [&_th]:border-black/10 [&_td]:border-black/10",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }], remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
          rehypeKatex,
        ]}
        components={{
          ...(overviewMode
            ? {
                ...overviewBodyMarkdownComponents,
                table: ({ children }) => (
                  <div className="my-6 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.03] sm:my-8">
                    <table className="w-full min-w-[min(100%,280px)] border-collapse text-[0.8125rem] sm:text-sm [&_.katex]:text-[1em]">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-slate-200/90 bg-slate-50/95 px-3.5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4 sm:text-[0.8125rem]">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-slate-100 px-3.5 py-2.5 align-top text-[0.8125rem] leading-snug text-slate-700 sm:px-4 sm:text-sm [&_.katex]:whitespace-nowrap">
                    {children}
                  </td>
                ),
              }
            : {}),
          img: ({ node: _n, ...props }) => (
            <img
              {...props}
              className={cn(
                "max-h-[min(70vh,560px)] w-auto max-w-full rounded-lg border border-black/10 bg-muted/20 object-contain",
                props.className,
              )}
              loading="lazy"
              decoding="async"
              alt={props.alt ?? ""}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
