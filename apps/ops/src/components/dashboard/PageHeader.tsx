import type { ReactNode } from "react";
import { ChevronDown } from "./icons";

export function PageHeader({
  title,
  subtitle,
  trailing,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
      <div>
        <h1 className="text-[18px] font-extrabold tracking-tight text-text sm:text-[22px]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[12px] text-muted sm:text-[13px]">{subtitle}</p>}
      </div>
      {trailing}
    </header>
  );
}

export function DatePill({ children }: { children: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-text">
      {children}
      <ChevronDown size={11} />
    </div>
  );
}
