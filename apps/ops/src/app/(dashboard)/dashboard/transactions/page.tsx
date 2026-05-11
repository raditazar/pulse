"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CurrencyToggle, Panel, PanelHeading } from "@/components/dashboard/primitives";
import { TxFilters, TxTable, type TxStatusFilter } from "@/components/dashboard/TxTable";
import { transactions, type DisplayCurrency } from "@/lib/mock-data";

export default function TransactionsPage() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TxStatusFilter>("all");
  const visibleTransactions = transactions.filter((transaction) => {
    const matchesStatus = status === "all" || transaction.status === status;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [transaction.merchant, transaction.wallet, transaction.amount[currency], transaction.status, transaction.time]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });
  const total = visibleTransactions.length;
  const success = visibleTransactions.filter((t) => t.status === "success").length;
  const failed = visibleTransactions.filter((t) => t.status === "failed").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transactions"
        subtitle="On-chain payment history from the cashier NFC."
      />

      <div className="grid grid-cols-3 gap-3">
        <SummaryStat label="Total" value={String(total)} />
        <SummaryStat label="Successful" value={String(success)} accent="success" />
        <SummaryStat label="Failed" value={String(failed)} accent="error" />
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeading title="Latest Transactions" sub="Last 5 payments." />
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>
        <TxFilters
          query={query}
          status={status}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
        />
        <TxTable rows={visibleTransactions} currency={currency} />
      </Panel>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "error";
}) {
  const color =
    accent === "success" ? "text-[var(--color-success)]" : accent === "error" ? "text-[var(--color-error)]" : "text-text";
  return (
    <div className="rounded-card border border-border bg-surface p-4 panel-shadow">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1.5 text-[22px] font-extrabold sm:text-[26px] ${color}`}>{value}</div>
    </div>
  );
}
