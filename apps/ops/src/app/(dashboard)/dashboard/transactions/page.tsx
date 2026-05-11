"use client";

import { useEffect, useMemo, useState } from "react";
import { useMerchant } from "@/components/dashboard/MerchantProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, PanelHeading } from "@/components/dashboard/primitives";
import {
  TxFilters,
  TxTable,
  type DashboardTransaction,
  type TxStatusFilter,
} from "@/components/dashboard/TxTable";
import { getMerchantSummary, getMerchantTransactions, type MerchantSummary } from "@/lib/api";
import { mapTransaction } from "@/lib/dashboard-data";

export default function TransactionsPage() {
  const { merchant } = useMerchant();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TxStatusFilter>("all");
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [summary, setSummary] = useState<MerchantSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const merchantRef = merchant?.id;

  useEffect(() => {
    if (!merchant || !merchantRef) return;

    let cancelled = false;
    setError(null);

    Promise.all([
      getMerchantTransactions(merchantRef, { limit: 100 }),
      getMerchantSummary(merchantRef),
    ])
      .then(([nextTransactions, nextSummary]) => {
        if (cancelled) return;
        setTransactions(
          nextTransactions.map((tx) => mapTransaction(tx, merchant.name ?? "Pulse Merchant")),
        );
        setSummary(nextSummary);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load transactions");
      });

    return () => {
      cancelled = true;
    };
  }, [merchant, merchantRef]);

  const visibleTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesStatus = status === "all" || transaction.status === status;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [transaction.merchant, transaction.wallet, transaction.amount, transaction.status, transaction.time]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  }), [query, status, transactions]);
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
        <SummaryStat label="Total" value={String(summary?.totalTransactions ?? total)} />
        <SummaryStat label="Successful" value={String(summary?.successfulTransactions ?? success)} accent="success" />
        <SummaryStat label="Failed" value={String(summary?.failedSessions ?? failed)} accent="error" />
      </div>

      {error && (
        <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px] font-semibold text-muted">
          {error}
        </div>
      )}

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeading title="Latest Transactions" sub="USDC payments." />
        </div>
        <TxFilters
          query={query}
          status={status}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
        />
        <TxTable rows={visibleTransactions} />
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
