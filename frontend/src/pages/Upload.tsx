import { useState } from "react";
import { Link } from "react-router-dom";
import { ProjectIngestForm } from "../components/ProjectIngestForm";
import { StatusPill } from "../components/StatusPill";
import type { Job, Project } from "../types";

export function Upload() {
  const [created, setCreated] = useState<{ project: Project; job: Job } | null>(null);
  return (
    <div className="grid gap-6 py-6 lg:grid-cols-[0.75fr_1.25fr]">
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">Ingestion</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Connect a repository</h1>
        <p className="mt-4 max-w-xl text-zinc-400">
          The backend reads files, ignores generated folders, extracts structure, builds embeddings, and prepares the AI chat workspace.
        </p>
      </div>
      <div className="grid gap-4">
        <ProjectIngestForm onCreated={(project, job) => setCreated({ project, job })} />
        {created ? (
          <div className="rounded-lg border border-mint/30 bg-mint/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-mint">Indexing started</div>
                <div className="mt-1 text-sm text-zinc-400">Job {created.job.id}</div>
              </div>
              <StatusPill status={created.project.status} />
            </div>
            <Link to={`/dashboard?project=${created.project.id}`} className="mt-4 inline-flex text-sm font-medium text-mint hover:text-zinc-100">
              Track it on the dashboard
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}

