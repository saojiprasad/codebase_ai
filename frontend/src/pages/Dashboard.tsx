import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { ProjectRow } from "../components/ProjectPicker";
import type { Project } from "../types";

export function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const ready = projects.filter((project) => project.status === "ready").length;
  const files = projects.reduce((sum, project) => sum + (project.scan_result.file_count ?? 0), 0);
  const embeddings = projects.reduce((sum, project) => sum + (project.scan_result.embedding_count ?? 0), 0);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  return (
    <div className="grid gap-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-cyan">Workspace</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal">Repository intelligence</h1>
        </div>
        <Link to="/upload" className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-ink hover:bg-white">
          New analysis
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Projects" value={projects.length} detail={`${ready} ready`} accent="cyan" />
        <MetricCard label="Files" value={files} detail="Indexed source files" accent="mint" />
        <MetricCard label="Vectors" value={embeddings} detail="Semantic chunks" accent="amber" />
        <MetricCard label="Mode" value="Local" detail="Ollama-ready" accent="rose" />
      </div>
      <div className="grid gap-3">
        {projects.length ? projects.map((project) => <ProjectRow key={project.id} project={project} />) : <EmptyState />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-line bg-panel p-8 text-center">
      <div className="text-lg font-medium">No repositories indexed yet</div>
      <p className="mt-2 text-sm text-zinc-500">Start with a GitHub URL, ZIP, or local path.</p>
    </div>
  );
}

