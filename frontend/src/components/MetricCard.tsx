import { ReactNode } from "react";

export function MetricCard({ label, value, detail, accent = "cyan" }: { label: string; value: ReactNode; detail?: string; accent?: "cyan" | "mint" | "amber" | "rose" }) {
  const color = {
    cyan: "text-cyan border-cyan/25 bg-cyan/10",
    mint: "text-mint border-mint/25 bg-mint/10",
    amber: "text-amber border-amber/25 bg-amber/10",
    rose: "text-rose border-rose/25 bg-rose/10"
  }[accent];
  return (
    <div className="rounded-lg border border-line bg-panel p-4 shadow-glow">
      <div className={`mb-4 inline-flex rounded-md border px-2 py-1 text-xs ${color}`}>{label}</div>
      <div className="text-3xl font-semibold tracking-normal">{value}</div>
      {detail ? <p className="mt-2 text-sm text-zinc-500">{detail}</p> : null}
    </div>
  );
}

