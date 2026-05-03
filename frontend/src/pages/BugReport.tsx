import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { MetricCard } from "../components/MetricCard";
import { ProjectPicker } from "../components/ProjectPicker";
import type { BugReport as BugReportType, Issue } from "../types";

export function BugReport() {
  const [params] = useSearchParams();
  const projectId = params.get("project") ?? undefined;
  const [report, setReport] = useState<BugReportType>({});

  useEffect(() => {
    if (!projectId) return;
    api.bugs(projectId).then(setReport).catch(() => setReport({}));
  }, [projectId]);

  const issues = report.issues ?? [];
  return (
    <div className="grid gap-5 py-6">
      <ProjectPicker currentId={projectId} />
      <div>
        <p className="text-sm uppercase tracking-widest text-cyan">Quality analysis</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-normal">Bug and security report</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Score" value={report.score ?? "N/A"} accent="cyan" />
        <MetricCard label="Critical" value={report.summary?.Critical ?? 0} accent="rose" />
        <MetricCard label="High" value={report.summary?.High ?? 0} accent="rose" />
        <MetricCard label="Medium" value={report.summary?.Medium ?? 0} accent="amber" />
        <MetricCard label="Low" value={report.summary?.Low ?? 0} accent="mint" />
      </div>
      <div className="grid gap-3">
        {issues.length ? issues.map((issue, index) => <IssueCard key={`${issue.file}-${issue.line}-${index}`} issue={issue} />) : <div className="rounded-lg border border-line bg-panel p-6 text-sm text-zinc-500">No issues detected yet.</div>}
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const tone = issue.severity === "Critical" || issue.severity === "High" ? "text-rose border-rose/30 bg-rose/10" : issue.severity === "Medium" ? "text-amber border-amber/30 bg-amber/10" : "text-mint border-mint/30 bg-mint/10";
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-md border px-2 py-1 text-xs ${tone}`}>{issue.severity}</span>
        <span className="text-sm text-zinc-500">{issue.category}</span>
      </div>
      <h2 className="mt-3 text-lg font-semibold">{issue.title}</h2>
      <p className="mt-2 text-sm text-zinc-500">{issue.file ? `${issue.file}:${issue.line ?? 1}` : "Repository-level issue"}</p>
      <p className="mt-3 text-sm text-zinc-400">{issue.details}</p>
      <p className="mt-3 text-sm text-mint">{issue.recommendation}</p>
    </article>
  );
}

