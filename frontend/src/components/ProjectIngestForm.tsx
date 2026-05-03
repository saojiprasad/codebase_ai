import { ChangeEvent, FormEvent, ReactNode, useState } from "react";
import { Github, HardDrive, Loader2, UploadCloud } from "lucide-react";
import { api } from "../api/client";
import type { Job, Project } from "../types";

export function ProjectIngestForm({ onCreated }: { onCreated?: (project: Project, job: Job) => void }) {
  const [mode, setMode] = useState<"github_url" | "local_path" | "zip">("github_url");
  const [repoUrl, setRepoUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response =
        mode === "zip"
          ? await api.uploadZip(assertFile(file), name || undefined)
          : await api.ingestLocal({
              source_type: mode,
              repo_url: mode === "github_url" ? repoUrl : undefined,
              local_path: mode === "local_path" ? localPath : undefined,
              name: name || undefined
            });
      onCreated?.(response.project, response.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start ingestion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-panel p-5 shadow-glow">
      <div className="mb-5 grid gap-2 sm:grid-cols-3">
        <ModeButton active={mode === "github_url"} icon={<Github size={17} />} label="GitHub" onClick={() => setMode("github_url")} />
        <ModeButton active={mode === "local_path"} icon={<HardDrive size={17} />} label="Local Path" onClick={() => setMode("local_path")} />
        <ModeButton active={mode === "zip"} icon={<UploadCloud size={17} />} label="ZIP Upload" onClick={() => setMode("zip")} />
      </div>
      <div className="grid gap-4">
        <label className="grid gap-2 text-sm text-zinc-300">
          Project name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Optional display name" className="input" />
        </label>
        {mode === "github_url" ? (
          <label className="grid gap-2 text-sm text-zinc-300">
            GitHub repository URL
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="https://github.com/org/repo.git" className="input" required />
          </label>
        ) : null}
        {mode === "local_path" ? (
          <label className="grid gap-2 text-sm text-zinc-300">
            Local folder path on backend machine
            <input value={localPath} onChange={(event) => setLocalPath(event.target.value)} placeholder="/Users/me/projects/repo" className="input" required />
          </label>
        ) : null}
        {mode === "zip" ? (
          <label className="grid min-h-36 cursor-pointer place-items-center rounded-lg border border-dashed border-line bg-ink/50 p-6 text-center text-sm text-zinc-400">
            <UploadCloud className="mb-3 text-cyan" />
            <span>{file ? file.name : "Drop or choose a repository ZIP"}</span>
            <input type="file" accept=".zip" className="hidden" onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)} required />
          </label>
        ) : null}
      </div>
      {error ? <div className="mt-4 rounded-lg border border-rose/30 bg-rose/10 p-3 text-sm text-rose">{error}</div> : null}
      <button className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white" disabled={loading}>
        {loading ? <Loader2 className="animate-spin" size={17} /> : <UploadCloud size={17} />}
        Start analysis
      </button>
    </form>
  );
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
        active ? "border-cyan bg-cyan/10 text-cyan" : "border-line bg-ink/40 text-zinc-400 hover:text-zinc-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function assertFile(file: File | null): File {
  if (!file) throw new Error("Choose a ZIP file first.");
  return file;
}
