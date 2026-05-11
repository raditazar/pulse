import type { ReactNode } from "react";

export function FooterCard({
  label,
  value,
  hint,
  hintTone = "success",
  icon,
  tone = "pulse",
  compact = false,
}: {
  label: string;
  value: string;
  hint: string;
  hintTone?: "success" | "muted";
  icon: ReactNode;
  tone?: "pulse" | "mint" | "violet";
  compact?: boolean;
}) {
  const tones = {
    pulse: {
      iconBg: "linear-gradient(135deg, #7235FF, #B871FF)",
      wash: "linear-gradient(90deg, rgba(153,69,255,0.11), rgba(184,113,255,0))",
      rail: "#9945FF",
      iconColor: "#FFFFFF",
    },
    mint: {
      iconBg: "linear-gradient(135deg, #14F195, #9945FF)",
      wash: "linear-gradient(90deg, rgba(20,241,149,0.13), rgba(153,69,255,0))",
      rail: "#14F195",
      iconColor: "#FFFFFF",
    },
    violet: {
      iconBg: "linear-gradient(135deg, #B871FF, #D463FF)",
      wash: "linear-gradient(90deg, rgba(212,99,255,0.12), rgba(153,69,255,0))",
      rail: "#B871FF",
      iconColor: "#FFFFFF",
    },
  }[tone];

  return (
    <div
      className={`relative flex items-center justify-between overflow-hidden rounded-card border border-border bg-surface panel-shadow ${
        compact ? "px-3 py-2.5" : "px-4 py-3.5"
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: tones.rail }} />
      <div className="absolute inset-y-0 left-0 w-28" style={{ background: tones.wash }} />
      <div className="relative">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted sm:text-[11px]">{label}</div>
        <div className={`${compact ? "mt-0.5 text-[13px]" : "mt-1 text-[15px]"} font-bold text-text`}>{value}</div>
        <div
          className={`${compact ? "mt-0 text-[10px]" : "mt-0.5 text-[11px]"} font-bold`}
          style={{ color: hintTone === "success" ? "var(--color-success)" : "var(--color-muted)" }}
        >
          {hint}
        </div>
      </div>
      <div
        className={`relative grid place-items-center rounded-[12px] ${
          compact ? "h-8 w-8" : "h-10 w-10"
        }`}
        style={{
          background: tones.iconBg,
          color: tones.iconColor,
          boxShadow: "0 10px 22px -14px rgba(114,53,255,0.8)",
        }}
      >
        {icon}
      </div>
    </div>
  );
}
