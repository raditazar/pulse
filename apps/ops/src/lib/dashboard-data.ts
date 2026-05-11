import type { DashboardNfcTile } from "@/components/dashboard/NfcTile";
import type { DashboardTransaction, DashboardTxStatus } from "@/components/dashboard/TxTable";
import type { VolumeChartPoint } from "@/components/dashboard/VolumeChart";
import type { MerchantTerminal, MerchantTransaction, MerchantVolumePoint } from "@/lib/api";
import type { PulseMerchantRecord, PulseSessionStatus } from "@pulse/types";

export function formatUsdc(amount: number | string | null | undefined) {
  const value = Number(amount ?? 0);
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USDC`;
}

export function formatDateLabel(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function shortAddress(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function mapVolumePoints(points: MerchantVolumePoint[]): VolumeChartPoint[] {
  return points.map((point) => {
    return {
      day: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
        new Date(`${point.date}T00:00:00`),
      ),
      usdc: Number(point.volumeUsdc),
      transactions: point.transactions,
    };
  });
}

export function mapTransaction(
  tx: MerchantTransaction,
  merchantName: string,
): DashboardTransaction {
  return {
    id: tx.id,
    time: formatTime(tx.paidAt ?? tx.confirmedAt ?? tx.session.createdAt),
    merchant: merchantName,
    amount: formatUsdc(tx.amountUsdc ?? tx.session.amountUsdc),
    status: "success",
    wallet: shortAddress(tx.txSignature || tx.payerAddress),
  };
}

export function mapSessionStatus(status: PulseSessionStatus): DashboardTxStatus {
  if (status === "failed" || status === "expired" || status === "cancelled") return "failed";
  if (status === "confirmed" || status === "paid") return "success";
  return "pending";
}

export function mapTerminal(
  terminal: MerchantTerminal,
  merchant: PulseMerchantRecord,
): DashboardNfcTile {
  const active = Boolean(terminal.currentSessionId);
  return {
    id: terminal.nfcCode,
    name: terminal.label,
    merchant: merchant.name ?? "Pulse Merchant",
    status: active ? "active" : "inactive",
    lastTap: active ? `Active session ${shortAddress(terminal.currentSessionId)}` : "No active session",
    lastTapTone: active ? "success" : "muted",
  };
}
