import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { Project } from "../types";
import { StatusPill } from "./StatusPill";

export function ProjectPicker({ currentId }: { currentId?: string }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    if (!currentId && projects.length) {
      navigate(`?project=${projects[0].id}`, { replace: true });
    }
  }, [currentId, navigate, projects]);

  if (!projects.length) {
    return <p className="rounded-lg border border-line bg-panel p-4 text-sm text-zinc-500">Index a repository to activate this workspace.</p>;
  }

  return (
    <select
      value={currentId ?? projects[0]?.id}
      onChange={(event) => navigate(`?project=${event.target.value}`)}
      className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan"
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name} - {project.status}
        </option>
      ))}
    </select>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  return (
    <Link to={`/overview?project=${project.id}`} className="flex items-center justify-between gap-4 rounded-lg border border-line bg-panel p-4 transition hover:border-cyan">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{project.name}</div>
        <div className="truncate text-xs text-zinc-500">{project.root_path}</div>
      </div>
      <StatusPill status={project.status} />
    </Link>
  );
}
