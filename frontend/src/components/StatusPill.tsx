export function StatusPill({ status }: { status: string }) {
  const classes =
    status === "ready"
      ? "border-mint/30 bg-mint/10 text-mint"
      : status === "failed"
        ? "border-rose/30 bg-rose/10 text-rose"
        : "border-amber/30 bg-amber/10 text-amber";
  return <span className={`rounded-md border px-2 py-1 text-xs uppercase tracking-wider ${classes}`}>{status}</span>;
}

