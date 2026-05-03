import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ProjectPicker } from "../components/ProjectPicker";

export function ReadmePage() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const [readme, setReadme] = useState("");

  useEffect(() => {
    if (!projectId) return;
    api.readme(projectId).then(setReadme).catch(() => setReadme(""));
  }, [projectId]);

  return (
    <div className="grid gap-5 py-6">
      <ProjectPicker currentId={projectId} />
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">Documentation</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Generated README</h1>
      </div>
      <pre className="min-h-[640px] overflow-auto rounded-lg border border-line bg-panel p-5 text-sm leading-7 text-zinc-300">{readme || "No README generated yet."}</pre>
    </div>
  );
}

