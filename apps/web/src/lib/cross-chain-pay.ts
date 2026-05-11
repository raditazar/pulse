/**
 * Cross-chain pay orchestrator untuk Pulse — handle EVM approve + pay tx via
 * Privy ethereum wallet, dengan callback fase supaya UI bisa transition antar
 * screens (wallet popup → tx confirm → settle).
 */

import {
  type Address,
  createWalletClient,
  custom,
  type Hex,
  parseUnits,
} from "viem";
import {
  approveUsdcMax,
  chainKeyFromId,
  getPulsePublicClient,
  PULSE_EVM_ADDRESSES,
  pulseChains,
  quotePayNativeFee,
  readUsdcAllowance,
  readUsdcBalance,
  submitPay,
  type EvmChainKey,
} from "@pulse/evm";
import type { ConnectedWallet } from "@privy-io/react-auth";

export type CrossChainPayPhase =
  | "preflight"
  | "switching-chain"
  | "approve-wallet"
  | "approve-confirming"
  | "pay-wallet"
  | "pay-confirming"
  | "settling";

export interface CrossChainPayInput {
  wallet: ConnectedWallet;
  chainKey: EvmChainKey;
  /** 32-byte hex sessionId, dengan atau tanpa prefix 0x. */
  sessionSeed: string;
  /** Human amount string, mis. "1.50". */
  amountUsdc: string;
  onPhase?: (phase: CrossChainPayPhase) => void;
}

export interface CrossChainPayResult {
  chainKey: EvmChainKey;
  payerAddress: Address;
  approveTxHash: Hex | null;
  payTxHash: Hex;
  amountUnits: bigint;
  nativeFeeWei: bigint;
}

export class CrossChainPayError extends Error {
  constructor(
    message: string,
    readonly phase: CrossChainPayPhase | "validation",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CrossChainPayError";
  }
}

function normalizeSessionIdHex(value: string): Hex {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new CrossChainPayError(
      `sessionSeed harus 32-byte hex (64 karakter), got "${value}" (${hex.length} chars)`,
      "validation",
    );
  }
  return `0x${hex.toLowerCase()}` as Hex;
}

function expectedChainIdFor(chainKey: EvmChainKey): number {
  return PULSE_EVM_ADDRESSES[chainKey].chainId;
}

/**
 * Eksekusi flow lengkap: approve (jika perlu) + pay PulseSender. Tx
 * dikonfirmasi via publicClient supaya kita yakin EVM side selesai
 * sebelum show success.
 */
export async function executeCrossChainPay(
  input: CrossChainPayInput,
): Promise<CrossChainPayResult> {
  const { wallet, chainKey, sessionSeed, amountUsdc, onPhase } = input;

  onPhase?.("preflight");

  const sessionId = normalizeSessionIdHex(sessionSeed);
  const expectedChainId = expectedChainIdFor(chainKey);
  const payer = wallet.address as Address;
  const amountUnits = parseUnits(amountUsdc, 6);

  const publicClient = getPulsePublicClient(chainKey);

  // Pre-flight: pastikan saldo cukup sebelum minta wallet popup.
  const balance = await readUsdcBalance(publicClient, chainKey, payer);
  if (balance < amountUnits) {
    throw new CrossChainPayError(
      `Saldo pmUSDC tidak cukup: punya ${balance}, butuh ${amountUnits}`,
      "preflight",
    );
  }

  // Switch chain di wallet jika belum match.
  const walletChainId = Number(wallet.chainId?.split(":").pop() ?? 0);
  if (walletChainId !== expectedChainId) {
    onPhase?.("switching-chain");
    try {
      await wallet.switchChain(expectedChainId);
    } catch (error) {
      throw new CrossChainPayError(
        `Gagal switch wallet ke chain ${expectedChainId}`,
        "switching-chain",
        error,
      );
    }
  }

  // Build viem WalletClient dari EIP-1193 provider Privy.
  const provider = await wallet.getEthereumProvider();
  const walletClient = createWalletClient({
    account: payer,
    chain: pulseChains[chainKey],
    transport: custom(provider),
  });

  // Approve jika allowance kurang.
  const allowance = await readUsdcAllowance(publicClient, chainKey, payer, amountUnits);
  let approveTxHash: Hex | null = null;
  if (allowance.needsApproval) {
    onPhase?.("approve-wallet");
    try {
      approveTxHash = await approveUsdcMax(walletClient, chainKey, payer);
    } catch (error) {
      throw new CrossChainPayError(
        "Approve dibatalkan atau gagal di wallet",
        "approve-wallet",
        error,
      );
    }
    onPhase?.("approve-confirming");
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  // Quote LZ native fee — PulseSender masih panggil endpoint.send internally.
  const nativeFee = await quotePayNativeFee(publicClient, {
    chainKey,
    sessionId,
    amountUnits,
    payer,
  });

  // Submit pay.
  onPhase?.("pay-wallet");
  let payTxHash: Hex;
  try {
    payTxHash = await submitPay(
      walletClient,
      { chainKey, sessionId, amountUnits, payer },
      nativeFee,
    );
  } catch (error) {
    throw new CrossChainPayError(
      "Pay dibatalkan atau gagal di wallet",
      "pay-wallet",
      error,
    );
  }
  onPhase?.("pay-confirming");
  await publicClient.waitForTransactionReceipt({ hash: payTxHash });

  // Tx EVM confirmed. Relayer di backend akan listen event PaymentIntentSent
  // dan settle ke Solana via execute_trusted_split. UI tampilin "settling"
  // sebentar supaya buyer melihat cross-chain story; durasi ini kira-kira
  // matching relayer poll interval (5s) — bukan polling status real, future
  // work bisa cek PaymentSession PDA on-chain langsung.
  onPhase?.("settling");
  await new Promise((resolve) => setTimeout(resolve, 2500));

  return {
    chainKey,
    payerAddress: payer,
    approveTxHash,
    payTxHash,
    amountUnits,
    nativeFeeWei: nativeFee,
  };
}

/**
 * Resolve chain key dari wallet Privy. Jika wallet bukan di Base/Arb Sepolia
 * yang kita support, return null — UI bisa minta user switch atau pilih chain.
 */
export function detectChainKey(wallet: ConnectedWallet | undefined): EvmChainKey | null {
  if (!wallet?.chainId) return null;
  const id = Number(wallet.chainId.split(":").pop() ?? 0);
  return chainKeyFromId(id);
}
