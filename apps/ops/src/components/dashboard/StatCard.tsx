export function StatCard({
  label,
  value,
  delta,
  deltaUp = true,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  deltaUp?: boolean;
  accent?: "success";
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 panel-shadow sm:p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      <div
        className={`mt-2 text-[22px] font-extrabold leading-tight sm:text-[26px] ${accent === "success" ? "text-[var(--color-success)]" : "text-text"}`}
      >
        {value}
      </div>
      <div
        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold"
        style={{ color: deltaUp ? "var(--color-success)" : "var(--color-error)" }}
      >
        <span>{deltaUp ? "↑" : "↓"}</span>
        {delta}
      </div>
    </div>
  );
}
