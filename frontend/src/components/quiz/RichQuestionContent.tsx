import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { RichMathText } from "@/components/quiz/QuestionStimulus";
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
  return /(\d+\s*\/\s*\d+)|(\b[a-zA-Z]\s*\^\s*\d+)|(\bsqrt\s*\()|([<>]=|!=)|([xX*]\s*\d)|(\d\s*[xX*]\s*\d)|(\[\[.+\],\s*\[.+\]\])|(\[[^\]]+;[^\]]+\])/.test(
    t,
  );
}

function looksLikeStructuredMarkdown(text: string): boolean {
  const t = String(text ?? "");
  return /(^|\n)\s*[-*]\s+|(^|\n)\s*\d+\.\s+|(^|\n)\s*>|(^|\n)\s*#{1,6}\s|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|```/.test(
    t,
  );
}

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
  const body = normalizeQuestionMathText(rawBody);

  // Never send structured Markdown (headings, lists, tables) through RichMathText — it blanks long notes.
  const useRichMathBranch =
    !preferMarkdown &&
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
          ? "prose max-w-none text-foreground dark:prose-invert"
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
