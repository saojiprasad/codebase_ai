import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { MermaidDiagram } from "../components/MermaidDiagram";
import { ProjectPicker } from "../components/ProjectPicker";

export function Architecture() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const [diagrams, setDiagrams] = useState<Record<string, string>>({});
  const [active, setActive] = useState("architecture");

  useEffect(() => {
    if (!projectId) return;
    api.architecture(projectId).then((data) => setDiagrams(data.diagrams ?? {})).catch(() => setDiagrams({}));
  }, [projectId]);

  const tabs = Object.keys(diagrams).length ? Object.keys(diagrams) : ["architecture", "dependencies", "api_flow"];
  return (
    <div className="grid gap-5 py-6">
      <ProjectPicker currentId={projectId} />
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">System design</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Architecture diagrams</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button key={tab} onClick={() => setActive(tab)} className={`rounded-lg border px-3 py-2 text-sm ${active === tab ? "border-cyan bg-cyan/10 text-cyan" : "border-line text-zinc-400"}`}>
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>
      <MermaidDiagram code={diagrams[active]} />
    </div>
  );
}

