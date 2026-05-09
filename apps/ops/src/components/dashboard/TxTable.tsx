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

export function TxFilters() {
  return (
    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1.4fr]">
      <div className="flex items-center justify-center gap-1.5 rounded-[8px] border border-border bg-bg-soft px-3 py-1.5 text-[11px] text-muted">
        Filter
      </div>
      <div className="flex items-center justify-between gap-1.5 rounded-[8px] border border-border bg-bg-soft px-3 py-1.5 text-[11px] text-muted">
        <span>All</span>
        <ChevronDown size={11} />
      </div>
      <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-bg-soft px-3 py-1.5 text-[11px] text-muted">
        <SearchIcon size={11} />
        <span>Search...</span>
      </div>
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
        {rows.map((r) => (
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
            <div className="num text-[10px] text-muted">{r.wallet}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
