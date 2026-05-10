"use client";

import { useState } from "react";
import type { DisplayCurrency, Transaction } from "@/lib/mock-data";
import { ChevronDown, SearchIcon } from "./icons";
import { ChipVariant } from "./primitives";

const statusVariant: Record<Transaction["status"], "success" | "error" | "pending"> = {
  success: "success",
  failed: "error",
  pending: "pending",
};

const statusLabel: Record<Transaction["status"], string> = {
  success: "Successful",
  failed: "Failed",
  pending: "Pending",
};

export type TxStatusFilter = "all" | Transaction["status"];

export function TxFilters({
  query,
  status,
  onQueryChange,
  onStatusChange,
}: {
  query: string;
  status: TxStatusFilter;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: TxStatusFilter) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (status !== "all" ? 1 : 0) + (query.trim() ? 1 : 0);

  return (
    <div className="mb-3 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        className="focus-ring flex items-center justify-between rounded-[8px] border border-border bg-bg-soft px-3 py-2 text-[11px] font-bold text-muted hover:text-text"
        aria-expanded={filtersOpen}
      >
        <span>Filter</span>
        <span className="inline-flex items-center gap-1.5">
          {activeFilterCount > 0 && (
            <span className="rounded-pill bg-lavender px-2 py-0.5 text-[10px] text-purple">
              {activeFilterCount} active
            </span>
          )}
          <ChevronDown size={11} />
        </span>
      </button>

      {filtersOpen && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr]">
          <label className="flex items-center justify-between gap-1.5 rounded-[8px] border border-border bg-bg-soft px-3 py-2 text-[11px] text-muted">
            <select
              value={status}
              onChange={(event) => onStatusChange(event.target.value as TxStatusFilter)}
              className="min-w-0 flex-1 appearance-none bg-transparent font-semibold text-text outline-none"
              aria-label="Filter transactions by status"
            >
              <option value="all">All</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>
            <ChevronDown size={11} />
          </label>
          <label className="flex items-center gap-1.5 rounded-[8px] border border-border bg-bg-soft px-3 py-2 text-[11px] text-muted">
            <SearchIcon size={11} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent font-semibold text-text outline-none placeholder:text-muted"
              aria-label="Search transactions"
            />
          </label>
        </div>
      )}
    </div>
  );
}

export function TxTable({
  rows,
  currency = "USD",
}: {
  rows: Transaction[];
  currency?: DisplayCurrency;
}) {
  const handleCopyWallet = async (wallet: string) => {
    if (wallet === "—") return;
    await navigator.clipboard?.writeText(wallet);
  };

  return (
    <div className="-mx-2 overflow-x-auto sm:mx-0">
      <div className="min-w-[560px] px-2 sm:min-w-0 sm:px-0">
        <div className="grid grid-cols-[0.8fr_1fr_1fr_0.9fr_1.1fr] gap-2 border-b border-border pb-2 text-[11px] font-bold text-muted">
          <div>Time</div>
          <div>Merchant</div>
          <div>Amount</div>
          <div>Status</div>
          <div>Wallet / Tx</div>
        </div>
        {rows.length > 0 ? (
          rows.map((r) => (
            <div
              key={r.time + r.wallet}
              className="grid grid-cols-[0.8fr_1fr_1fr_0.9fr_1.1fr] items-center gap-2 border-b border-border py-2.5 text-[11px] last:border-b-0"
            >
              <div className="num text-muted">{r.time}</div>
              <div className="text-[10px] font-bold text-text">{r.merchant}</div>
              <div className="text-[11px] font-bold text-text">{r.amount[currency]}</div>
              <div>
                <ChipVariant variant={statusVariant[r.status]}>{statusLabel[r.status]}</ChipVariant>
              </div>
              <button
                type="button"
                onClick={() => handleCopyWallet(r.wallet)}
                className="focus-ring num rounded-[6px] text-left text-[10px] text-muted hover:text-purple disabled:hover:text-muted"
                disabled={r.wallet === "—"}
                aria-label={`Copy wallet or transaction ${r.wallet}`}
              >
                {r.wallet}
              </button>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-[12px] font-semibold text-muted">
            No transactions match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
