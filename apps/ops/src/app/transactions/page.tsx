"use client";

import { useState } from "react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CurrencyToggle, Panel, PanelHeading } from "@/components/dashboard/primitives";
import { TxFilters, TxTable } from "@/components/dashboard/TxTable";
import { transactions, type DisplayCurrency } from "@/lib/mock-data";

export default function TransactionsPage() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const total = transactions.length;
  const success = transactions.filter((t) => t.status === "success").length;
  const failed = transactions.filter((t) => t.status === "failed").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Transactions"
        subtitle="On-chain payment history from all stickers."
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
        <TxFilters />
        <TxTable rows={transactions} currency={currency} />
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
