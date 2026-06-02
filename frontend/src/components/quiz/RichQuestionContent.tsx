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
import { normalizeQuestionMathText } from "@/lib/questionMathText";

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

/** Large, airy body text for study overviews (tables use separate compact styles). */
const overviewBodyMarkdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-6 mt-12 font-display text-3xl font-bold leading-tight tracking-tight text-[#0b0f19] first:mt-0 sm:mb-8 sm:mt-14 sm:text-4xl">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-6 mt-14 border-b-2 border-brand/30 pb-3 font-display text-2xl font-bold leading-snug text-[#0b0f19] sm:mb-8 sm:mt-16 sm:text-3xl">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: ReactNode }) => (
    <h4 className="mb-4 mt-10 text-xl font-bold text-[#0b0f19] sm:mb-5 sm:mt-12 sm:text-2xl">
      {children}
    </h4>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="my-8 text-xl font-normal leading-[2] text-[#0b0f19]/92 sm:my-10 sm:text-2xl sm:leading-[2.1]">
      {children}
    </p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="my-8 list-disc space-y-5 pl-8 sm:my-10 sm:space-y-6 sm:pl-10">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="my-8 list-decimal space-y-5 pl-8 sm:my-10 sm:space-y-6 sm:pl-10">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => (
    <li className="text-xl leading-[2] text-[#0b0f19]/92 marker:text-brand sm:text-2xl sm:leading-[2.1]">
      {children}
    </li>
  ),
  hr: () => <hr className="my-14 border-0 border-t-2 border-black/12 sm:my-20" />,
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-bold text-[#0b0f19]">{children}</strong>
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
  const body = preserveMarkdownStructure
    ? absolutizeMarkdownAssetUrls(rawBody)
    : normalizeQuestionMathText(rawBody);

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
          ? "max-w-none text-foreground [&_.katex]:text-[1.05em] sm:[&_.katex]:text-[1.08em]"
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
                  <div className="my-8 overflow-x-auto rounded-xl border border-black/10 bg-white shadow-sm sm:my-10">
                    <table className="w-full min-w-[min(100%,280px)] border-collapse text-sm sm:text-base [&_.katex]:text-[1.05em]">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border-b border-black/12 bg-slate-100/90 px-3 py-2.5 text-left text-sm font-semibold sm:px-4 sm:text-base">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b border-black/8 px-3 py-2.5 align-top text-sm sm:px-4 sm:text-base [&_.katex]:whitespace-nowrap">
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
