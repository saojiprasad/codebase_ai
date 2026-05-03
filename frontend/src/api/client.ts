import type { ApiMap, BugReport, ChatCitation, Job, Project } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });
  if (!response.ok) {
    const detail = await readError(response);
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json();
    return payload.detail ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  getJob: (id: string) => request<Job>(`/api/jobs/${id}`),
  ingestLocal: (payload: { source_type: "local_path" | "github_url"; local_path?: string; repo_url?: string; name?: string }) =>
    request<{ project: Project; job: Job }>("/api/projects/ingest", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  uploadZip: async (file: File, name?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (name) form.append("name", name);
    const response = await fetch(`${API_BASE}/api/projects/upload`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await readError(response));
    return response.json() as Promise<{ project: Project; job: Job }>;
  },
  chat: (projectId: string, message: string) =>
    request<{ answer: string; citations: ChatCitation[] }>(`/api/projects/${projectId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message, top_k: 8, stream: false })
    }),
  architecture: (projectId: string) => request<{ diagrams: Record<string, string> }>(`/api/projects/${projectId}/architecture`),
  apiMap: (projectId: string) => request<ApiMap>(`/api/projects/${projectId}/api`),
  bugs: (projectId: string) => request<BugReport>(`/api/projects/${projectId}/bugs`),
  readme: async (projectId: string) => {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}/readme`);
    if (!response.ok) throw new Error(await readError(response));
    return response.text();
  }
};

