import type { ReactNode } from "react";

export function FooterCard({
  label,
  value,
  hint,
  hintTone = "success",
  icon,
  tone = "green",
}: {
  label: string;
  value: string;
  hint: string;
  hintTone?: "success" | "muted";
  icon: ReactNode;
  tone?: "green" | "amber";
}) {
  const iconBg =
    tone === "amber"
      ? "linear-gradient(135deg, #FBBF24, #F59E0B)"
      : "linear-gradient(135deg, #14F195, #4ADE80)";
  return (
    <div className="flex items-center justify-between rounded-card border border-border bg-surface px-4 py-3.5 panel-shadow">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-1 text-[15px] font-bold text-text">{value}</div>
        <div
          className="mt-0.5 text-[11px] font-bold"
          style={{ color: hintTone === "success" ? "var(--color-success)" : "var(--color-muted)" }}
        >
          {hint}
        </div>
      </div>
      <div
        className="grid h-9 w-9 place-items-center rounded-control text-white"
        style={{ background: iconBg }}
      >
        {icon}
      </div>
    </div>
  );
}
