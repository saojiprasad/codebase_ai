import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Project } from "../types";

export function useProject(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setLoading(true);
    api
      .getProject(projectId)
      .then((data) => {
        if (active) setProject(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { project, loading, error };
}

