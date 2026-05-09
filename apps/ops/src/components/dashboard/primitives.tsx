import type { ButtonHTMLAttributes, ReactNode } from "react";
import { currencies, type DisplayCurrency } from "@/lib/mock-data";

export function Panel({
  children,
  className = "",
  noPadding = false,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={`flex flex-col rounded-[14px] border border-border bg-surface panel-shadow ${noPadding ? "" : "p-4 sm:p-5"} ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <header className="mb-3">
      <h3 className="text-[14px] font-bold text-text sm:text-[15px]">{title}</h3>
      {sub && <p className="mt-1 text-[11px] text-muted">{sub}</p>}
    </header>
  );
}

export function ChipVariant({
  variant,
  children,
}: {
  variant: "success" | "processing" | "pending" | "error" | "muted";
  children: ReactNode;
}) {
  const map: Record<string, { bg: string; color: string; dot: string }> = {
    success: { bg: "var(--color-success-bg)", color: "var(--color-success)", dot: "var(--color-success)" },
    processing: { bg: "var(--color-processing-bg)", color: "var(--color-processing)", dot: "var(--color-processing)" },
    pending: { bg: "var(--color-warn-bg)", color: "var(--color-warn)", dot: "var(--color-warn)" },
    error: { bg: "#FEE2E2", color: "#B91C1C", dot: "#B91C1C" },
    muted: { bg: "var(--color-bg)", color: "var(--color-muted)", dot: "var(--color-muted)" },
  };
  const v = map[variant];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2 py-1 text-[10px] font-bold"
      style={{ background: v.bg, color: v.color, border: variant === "muted" ? "1px solid var(--color-border)" : undefined }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: v.dot }} />
      {children}
    </span>
  );
}

export function CtaButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`focus-ring inline-flex w-full items-center justify-center gap-2 rounded-[10px] px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-95 active:opacity-90 ${className}`}
      style={{
        background: "linear-gradient(90deg, #9945FF, #B871FF)",
        boxShadow: "0 6px 18px -8px rgba(153,69,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-[11px] font-semibold text-muted">{children}</div>;
}

export function ReadonlyInput({ children, mono = false, trailing }: { children: ReactNode; mono?: boolean; trailing?: ReactNode }) {
  return (
    <div
      className={`flex items-center justify-between rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[12px] font-semibold text-text ${mono ? "num text-[11px]" : ""}`}
    >
      <span>{children}</span>
      {trailing}
    </div>
  );
}

export function CurrencyToggle({
  currency,
  onChange,
}: {
  currency: DisplayCurrency;
  onChange: (currency: DisplayCurrency) => void;
}) {
  return (
    <div className="inline-grid grid-cols-2 rounded-[10px] border border-border bg-bg-soft p-1">
      {currencies.map((item) => {
        const active = item === currency;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`focus-ring rounded-[8px] px-3 py-1.5 text-[11px] font-bold transition-colors ${
              active ? "bg-surface text-purple panel-shadow" : "text-muted hover:text-text"
            }`}
            aria-pressed={active}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
