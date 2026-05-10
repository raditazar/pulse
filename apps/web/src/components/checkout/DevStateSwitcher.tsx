"use client";

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
  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-50 w-[min(380px,calc(100vw-2rem))] rounded-card border border-border bg-surface/95 p-2 panel-shadow backdrop-blur">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted">
            Client view
          </div>
          <div className="text-[11px] font-semibold text-text">Develop FE pages</div>
        </div>
        <div className="rounded-pill bg-lavender px-2 py-0.5 text-[10px] font-bold text-purple">
          {STATES.find((state) => state.key === current)?.label}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {STATES.map((s) => {
          const active = s.key === current;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key)}
              aria-pressed={active}
              className="focus-ring rounded-[8px] px-2 py-1.5 text-[11px] font-bold transition-[background,color,transform,box-shadow] hover:-translate-y-0.5 active:scale-[0.98]"
              style={
                active
                  ? {
                      background: "linear-gradient(90deg, #9945FF, #B871FF)",
                      color: "#FFFFFF",
                      boxShadow: "0 8px 18px -12px rgba(153,69,255,0.9)",
                    }
                  : {
                      background: "var(--color-bg-soft)",
                      color: "var(--color-muted)",
                    }
              }
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
