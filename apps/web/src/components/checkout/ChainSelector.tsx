"use client";

import type { CheckoutChainKey } from "@/lib/chain";
import { chainShortLabel } from "@/lib/chain";

interface ChainSelectorProps {
  available: CheckoutChainKey[];
  selected: CheckoutChainKey | null;
  onSelect: (key: CheckoutChainKey) => void;
}

const chainAccent: Record<CheckoutChainKey, string> = {
  solana: "from-[#9945FF] to-[#14F195]",
  baseSepolia: "from-[#0052FF] to-[#4F8BFF]",
  arbSepolia: "from-[#28A0F0] to-[#94D7FF]",
};

export function ChainSelector({ available, selected, onSelect }: ChainSelectorProps) {
  if (available.length <= 1) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        Pay from
      </span>
      <div className="flex flex-wrap gap-2">
        {available.map((key) => {
          const active = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-pressed={active}
              className={`focus-ring relative overflow-hidden rounded-pill border px-3 py-1.5 text-[12px] font-bold transition-all ${
                active
                  ? "border-purple bg-purple text-white shadow-[0_8px_18px_-12px_rgba(124,58,237,0.65)]"
                  : "border-border bg-surface text-text hover:border-purple/50 hover:bg-lavender"
              }`}
            >
              <span
                aria-hidden
                className={`absolute inset-0 -z-10 bg-gradient-to-br opacity-0 transition-opacity ${chainAccent[key]} ${
                  active ? "opacity-100" : ""
                }`}
              />
              {chainShortLabel(key)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
