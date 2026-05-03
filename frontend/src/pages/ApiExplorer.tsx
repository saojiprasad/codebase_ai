import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { ProjectPicker } from "../components/ProjectPicker";
import type { ApiEndpoint } from "../types";

export function ApiExplorer() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);

  useEffect(() => {
    if (!projectId) return;
    api.apiMap(projectId).then((data) => setEndpoints(data.endpoints ?? [])).catch(() => setEndpoints([]));
  }, [projectId]);

  return (
    <div className="grid gap-5 py-6">
      <ProjectPicker currentId={projectId} />
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">API explorer</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Detected endpoints</h1>
      </div>
      <div className="grid gap-3">
        {endpoints.length ? (
          endpoints.map((endpoint) => (
            <article key={`${endpoint.handler_file}-${endpoint.path}-${endpoint.methods.join("")}`} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex flex-wrap items-center gap-3">
                {endpoint.methods.map((method) => (
                  <span key={method} className="rounded-md border border-mint/25 bg-mint/10 px-2 py-1 font-mono text-xs text-mint">
                    {method}
                  </span>
                ))}
                <code className="text-cyan">{endpoint.path}</code>
              </div>
              <div className="mt-3 text-sm text-zinc-500">
                {endpoint.handler_file}:{endpoint.line ?? 1}
              </div>
              <div className="mt-4 grid gap-2 text-sm text-zinc-400 md:grid-cols-3">
                <p>{endpoint.auth_hint}</p>
                <p>{endpoint.request_hint}</p>
                <p>{endpoint.response_hint}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-lg border border-line bg-panel p-6 text-sm text-zinc-500">No REST, GraphQL, or WebSocket routes were detected by the static scan.</div>
        )}
      </div>
    </div>
  );
}

