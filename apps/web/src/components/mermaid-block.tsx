"use client";

import { useEffect, useId, useState } from "react";

/** Renders a ```mermaid block on the client; the library is loaded on demand. */
export function MermaidBlock({ source }: { source: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dark = document.documentElement.getAttribute("data-theme") === "dark";
        mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "neutral",
          fontFamily: "var(--font-sans)",
          securityLevel: "strict",
        });
        const { svg: out } = await mermaid.render(`m-${id}`, source);
        if (!cancelled) setSvg(out);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not render diagram");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return (
      <pre>
        <code>{source}</code>
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="mermaid-block my-4 h-32 animate-pulse rounded-lg border border-rule bg-paper-2" />
    );
  }
  return (
    <div
      className="mermaid-block my-4 overflow-x-auto rounded-lg border border-rule bg-paper-2 p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
