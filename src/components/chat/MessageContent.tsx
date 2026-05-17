import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

// Allow a small, safe set of inline HTML tags so model output that uses
// `<br>` inside table cells (the only way to line-break inside markdown
// tables) renders as actual breaks. Everything else is stripped.
const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "br"],
};

// ---------------------------------------------------------------------------
// CopyButton — used inside code blocks
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground bg-muted/60 hover:bg-muted hover:text-foreground transition-colors"
      aria-label="Copy code"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// MessageContent — renders markdown with code syntax highlighting
// ---------------------------------------------------------------------------

export default function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
      components={{
        // Code blocks + inline code
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className ?? "");
          const lang = match ? match[1] : "";
          const codeText = String(children).replace(/\n$/, "");
          const isBlock = codeText.includes("\n") || !!match;

          if (!isBlock) {
            return (
              <code
                className="rounded px-1 py-0.5 font-mono text-[13px] bg-muted text-foreground"
                {...rest}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="relative my-3 overflow-hidden rounded-md border border-border">
              {lang && (
                <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-1">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {lang}
                  </span>
                </div>
              )}
              <CopyButton text={codeText} />
              <SyntaxHighlighter
                style={oneLight}
                language={lang || "text"}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "13px",
                  fontFamily: "'JetBrains Mono', monospace",
                  background: "transparent",
                  lineHeight: 1.6,
                }}
                codeTagProps={{
                  style: { fontFamily: "'JetBrains Mono', monospace" },
                }}
              >
                {codeText}
              </SyntaxHighlighter>
            </div>
          );
        },
        // Paragraphs
        p({ children }) {
          return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
        },
        // Lists
        ul({ children }) {
          return <ul className="mb-3 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="mb-3 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        // Headings
        h1({ children }) {
          return <h1 className="mb-2 mt-4 text-base font-semibold first:mt-0">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="mb-1.5 mt-3 text-sm font-medium first:mt-0">{children}</h3>;
        },
        // Bold / emphasis
        strong({ children }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-muted-foreground">{children}</em>;
        },
        // Blockquote
        blockquote({ children }) {
          return (
            <blockquote className="my-3 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
              {children}
            </blockquote>
          );
        },
        // Horizontal rule
        hr() {
          return <hr className="my-4 border-border" />;
        },
        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          );
        },
        // Tables
        table({ children }) {
          return (
            <div className="my-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-xs">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-muted text-left">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="px-3 py-2 font-medium text-muted-foreground">{children}</th>
          );
        },
        td({ children }) {
          return (
            <td className="border-t border-border px-3 py-2 text-foreground">{children}</td>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
