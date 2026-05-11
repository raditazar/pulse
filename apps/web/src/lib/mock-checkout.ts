export type DisplayCurrency = "USDC" | "SOL";

export function formatUsdc(amountUsdc: string | number) {
  const value = Number(amountUsdc);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatSolFromUsdc(amountUsdc: string | number) {
  const value = Number(amountUsdc);
  const sol = (Number.isFinite(value) ? value : 0) / 150;
  return `${sol.toFixed(4)} SOL`;
}

export function formatNetworkLabel(cluster: string) {
  if (cluster === "localnet") return "Solana Localnet";
  if (cluster === "devnet") return "Solana Devnet";
  return `Solana ${cluster}`;
}

export function buildMockTxSignature() {
  return `pulse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
