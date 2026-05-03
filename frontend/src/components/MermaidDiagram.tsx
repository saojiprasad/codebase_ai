import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "strict",
  themeVariables: {
    background: "#11151d",
    primaryColor: "#151b24",
    primaryTextColor: "#f4f4f5",
    lineColor: "#39d9ff",
    tertiaryColor: "#10141b"
  }
});

export function MermaidDiagram({ code }: { code?: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    mermaid
      .render(`diagram-${id}`, code)
      .then((result) => {
        setSvg(result.svg);
        setError(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [code, id]);

  if (!code) return <div className="rounded-lg border border-line bg-panel p-6 text-sm text-zinc-500">No diagram generated yet.</div>;
  if (error) return <pre className="overflow-auto rounded-lg border border-rose/30 bg-rose/10 p-4 text-xs text-rose">{error}</pre>;
  return <div className="overflow-auto rounded-lg border border-line bg-panel p-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}

