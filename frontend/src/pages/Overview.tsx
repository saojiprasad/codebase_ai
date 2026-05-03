import { useSearchParams } from "react-router-dom";
import { FileTree } from "../components/FileTree";
import { MetricCard } from "../components/MetricCard";
import { ProjectPicker } from "../components/ProjectPicker";
import { StatusPill } from "../components/StatusPill";
import { useProject } from "../hooks/useProject";

export function Overview() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const { project, loading, error } = useProject(projectId);
  const scan = project?.scan_result ?? {};

  return (
    <div className="grid gap-6 py-6">
      <ProjectPicker currentId={projectId} />
      {loading ? <p className="text-zinc-500">Loading repository...</p> : null}
      {error ? <p className="text-rose">{error}</p> : null}
      {project ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal">{project.name}</h1>
              <p className="mt-2 max-w-4xl truncate text-zinc-500">{project.root_path}</p>
            </div>
            <StatusPill status={project.status} />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard label="Files" value={scan.file_count ?? 0} accent="cyan" />
            <MetricCard label="Folders" value={scan.folder_count ?? 0} accent="mint" />
            <MetricCard label="Embeddings" value={scan.embedding_count ?? 0} accent="amber" />
            <MetricCard label="Quality" value={scan.bugs?.score ?? "N/A"} accent="rose" />
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="mb-4 text-lg font-semibold">File explorer</h2>
              <div className="max-h-[620px] overflow-auto">
                <FileTree node={scan.tree} />
              </div>
            </section>
            <section className="rounded-lg border border-line bg-panel p-4">
              <h2 className="mb-4 text-lg font-semibold">Tech stack</h2>
              <p className="mb-4 text-sm text-zinc-400">{scan.tech_stack?.summary ?? "No stack summary available."}</p>
              <div className="flex flex-wrap gap-2">
                {(scan.tech_stack?.detected ?? []).map((item) => (
                  <span key={item} className="rounded-md border border-cyan/25 bg-cyan/10 px-2 py-1 text-sm text-cyan">
                    {item}
                  </span>
                ))}
              </div>
              <h3 className="mt-6 text-sm font-medium text-zinc-300">Dependencies</h3>
              <div className="mt-3 grid max-h-72 gap-2 overflow-auto text-sm text-zinc-500">
                {(scan.tech_stack?.dependencies ?? []).slice(0, 120).map((dependency) => (
                  <span key={dependency}>{dependency}</span>
                ))}
              </div>
              <h3 className="mt-6 text-sm font-medium text-zinc-300">Database</h3>
              <p className="mt-3 text-sm text-zinc-500">{scan.database_map?.summary ?? "No database map generated yet."}</p>
              <h3 className="mt-6 text-sm font-medium text-zinc-300">Improvement engine</h3>
              <div className="mt-3 grid gap-2">
                {(scan.improvements?.suggestions ?? []).slice(0, 5).map((suggestion) => (
                  <div key={`${suggestion.category}-${suggestion.recommendation}`} className="rounded-lg border border-line bg-ink p-3 text-sm text-zinc-400">
                    <span className="text-cyan">{suggestion.category}</span> {suggestion.recommendation}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
