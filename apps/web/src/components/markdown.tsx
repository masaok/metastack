"use client";

import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";

import { MermaidBlock } from "@/components/mermaid-block";
import { cn } from "@/lib/utils";

const isExternal = (href?: string) => /^[a-z]+:\/\//i.test(href ?? "");

export function Markdown({
  source,
  className,
  headingIds = false,
}: {
  source: string;
  className?: string;
  /** Give h2/h3 the ids `headingsOf()` predicts, so a table of contents can link to them. */
  headingIds?: boolean;
}) {
  return (
    <div className={cn("answer", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={headingIds ? [rehypeSlug] : []}
        components={{
          a: ({ href, children }) =>
            isExternal(href) ? (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            ) : (
              <a href={href}>{children}</a>
            ),
          code: ({ className: codeClass, children, ...rest }) => {
            const match = /language-(\w+)/.exec(codeClass ?? "");
            const text = String(children).replace(/\n$/, "");
            if (match?.[1] === "mermaid") {
              return <MermaidBlock source={text} />;
            }
            return (
              <code className={codeClass} {...rest}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => {
            // Mermaid renders its own container; unwrap the <pre> in that case.
            const child = Array.isArray(children) ? children[0] : children;
            if (
              child &&
              typeof child === "object" &&
              "props" in child &&
              /language-mermaid/.test(
                String((child as { props?: { className?: string } }).props?.className ?? ""),
              )
            ) {
              return <>{children}</>;
            }
            return <pre>{children}</pre>;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
