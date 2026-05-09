"use client";

import { useState } from "react";
import type { CheckoutPhase } from "./types";

const STATES: { key: CheckoutPhase; label: string }[] = [
  { key: "loading", label: "Loading" },
  { key: "checkout", label: "Checkout" },
  { key: "wallet", label: "Wallet" },
  { key: "processing", label: "Processing" },
  { key: "success", label: "Success" },
  { key: "error", label: "Error" },
];

export function DevStateSwitcher({
  current,
  onChange,
}: {
  current: CheckoutPhase;
  onChange: (s: CheckoutPhase) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-1 rounded-card border border-border bg-surface px-2 py-2 panel-shadow">
          {STATES.map((s) => {
            const active = s.key === current;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => onChange(s.key)}
                className={`focus-ring rounded-pill px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "bg-text text-surface" : "text-muted hover:text-text"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted panel-shadow hover:text-text"
        aria-expanded={open}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple" />
        Mock state
      </button>
    </div>
  );
}
