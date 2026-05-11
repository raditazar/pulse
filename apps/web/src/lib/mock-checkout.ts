export function formatUsdc(amountUsdc: string | number) {
  const value = Number(amountUsdc);
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  return `${formatted} USDC`;
}

export function formatNetworkLabel(cluster: string) {
  if (cluster === "localnet") return "Solana Localnet";
  if (cluster === "devnet") return "Solana Devnet";
  return `Solana ${cluster}`;
}

export function buildMockTxSignature() {
  return `pulse_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
