"use client";

import { useEffect, useMemo, useState } from "react";
import { useMerchant } from "@/components/dashboard/MerchantProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, PanelHeading } from "@/components/dashboard/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { TxTable, type DashboardTransaction } from "@/components/dashboard/TxTable";
import { VolumeChart, type VolumeChartPoint } from "@/components/dashboard/VolumeChart";
import {
  getMerchantSummary,
  getMerchantTransactions,
  getMerchantVolume,
  type MerchantSummary,
} from "@/lib/api";
import {
  formatUsdc,
  mapTransaction,
  mapVolumePoints,
} from "@/lib/dashboard-data";

export default function OverviewPage() {
  const { merchant } = useMerchant();
  const [summary, setSummary] = useState<MerchantSummary | null>(null);
  const [volume, setVolume] = useState<VolumeChartPoint[]>([]);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const merchantRef = merchant?.id;

  useEffect(() => {
    if (!merchant || !merchantRef) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getMerchantSummary(merchantRef),
      getMerchantVolume(merchantRef, 14),
      getMerchantTransactions(merchantRef, { limit: 5 }),
    ])
      .then(([nextSummary, nextVolume, nextTransactions]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setVolume(mapVolumePoints(nextVolume));
        setTransactions(
          nextTransactions.map((tx) => mapTransaction(tx, merchant.name ?? "Pulse Merchant")),
        );
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [merchant, merchantRef]);

  const stats = useMemo(
    () => [
      {
        label: "Total Volume",
        value: formatUsdc(summary?.totalVolumeUsdc),
        delta: "Today",
        deltaUp: true,
      },
      {
        label: "Total Transactions",
        value: String(summary?.totalTransactions ?? 0),
        delta: "Today",
        deltaUp: true,
      },
      {
        label: "Successful",
        value: String(summary?.successfulTransactions ?? 0),
        delta:
          summary && summary.totalTransactions > 0
            ? `${Math.round((summary.successfulTransactions / summary.totalTransactions) * 100)}%`
            : "0%",
        deltaUp: true,
        accent: "success" as const,
      },
    ],
    [summary],
  );
  const todayPoint = volume[volume.length - 1];
  const todayTransactions = todayPoint?.transactions ?? 0;
  const todayVolume = formatUsdc(todayPoint?.usdc ?? 0);
  const lastPayment = transactions[0]?.amount ?? "No payments yet";
  const successRate =
    summary && summary.totalTransactions > 0
      ? `${Math.round((summary.successfulTransactions / summary.totalTransactions) * 100)}%`
      : "0%";

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title={`Good morning, ${merchant?.name ?? "Merchant"}`}
        subtitle={isLoading ? "Loading payment summary..." : "Here is your payment summary."}
      />

      {error && (
        <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px] font-semibold text-muted">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading
            title="Volume (Last 14 Days)"
            sub="Total successful payments in USDC."
          />
          <VolumeChart points={volume} />
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel>
            <PanelHeading title="Today" sub="Daily payment activity." />
            <div className="divide-y divide-border rounded-[10px] border border-border bg-bg-soft">
              <InsightRow label="Volume" value={todayVolume} />
              <InsightRow label="Transactions" value={String(todayTransactions)} />
              <InsightRow label="Last Payment" value={lastPayment} />
              <InsightRow label="Success Rate" value={successRate} />
            </div>
          </Panel>

          <Panel>
            <PanelHeading title="Operations" sub="Current cashier state." />
            <div className="grid grid-cols-3 gap-2">
              <StatusTile
                label="Network"
                value="Solana Devnet"
                tone="mint"
              />
              <StatusTile
                label="Pending"
                value={String(summary?.pendingSessions ?? 0)}
                tone="pulse"
              />
              <StatusTile
                label="Cashier NFC"
                value={`${summary?.activeTerminals ?? 0} active`}
                tone="violet"
              />
            </div>
          </Panel>
        </div>
      </div>

      <Panel>
        <PanelHeading title="Latest Transactions" sub="Last 5 payments." />
        <TxTable rows={transactions} />
      </Panel>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-[54px] items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="num text-right text-[14px] font-extrabold text-text">{value}</span>
    </div>
  );
}

function StatusTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "mint" | "pulse" | "violet";
}) {
  const toneClass = {
    mint: "border-l-[#14F195]",
    pulse: "border-l-[#9945FF]",
    violet: "border-l-[#B871FF]",
  }[tone];

  return (
    <div className={`flex min-h-[96px] flex-col justify-between rounded-[10px] border border-l-4 border-border bg-bg-soft p-3 ${toneClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</div>
      <div className="num mt-3 whitespace-normal break-words text-[15px] font-extrabold leading-tight text-text">
        {value}
      </div>
    </div>
  );
}
