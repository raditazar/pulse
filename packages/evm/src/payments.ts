/**
 * Cross-chain payment helper untuk Pulse — wrap PulseSender + MockUSDC interaksi
 * via viem. Konsumer (web app) lewati WalletClient (dari Privy/MetaMask) untuk
 * sign tx; helper ini handle: allowance check, fee quote, approve, dan pay.
 */

import {
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { MockUSDCAbi, PulseSenderAbi } from "./abi";
import {
  PULSE_EVM_ADDRESSES,
  SOLANA_DEVNET_EID,
  type EvmChainKey,
} from "./addresses";

/** Max uint256 — kita approve unlimited supaya buyer tidak harus approve setiap pay. */
export const MAX_UINT256 = (1n << 256n) - 1n;

export interface PayIntent {
  chainKey: EvmChainKey;
  /** 32-byte hex sessionId (sama dengan `sessionSeed` di Solana side). */
  sessionId: Hex;
  /** USDC amount dalam 6-decimal base units. */
  amountUnits: bigint;
  /** Payer EVM address (msg.sender). */
  payer: Address;
}

export interface AllowanceState {
  current: bigint;
  required: bigint;
  needsApproval: boolean;
}

function assertConfigured(chainKey: EvmChainKey) {
  const cfg = PULSE_EVM_ADDRESSES[chainKey];
  if (!cfg.mockUsdc || !cfg.pulseSender) {
    throw new Error(
      `EVM chain "${chainKey}" belum dikonfigurasi — set NEXT_PUBLIC_MOCK_USDC_* dan NEXT_PUBLIC_PULSE_SENDER_* env vars.`,
    );
  }
  return cfg as typeof cfg & { mockUsdc: Address; pulseSender: Address };
}

/**
 * Read allowance(buyer → PulseSender) untuk MockUSDC. Return apakah perlu approve
 * sebelum bisa `pay(amountUnits)`.
 */
export async function readUsdcAllowance(
  client: PublicClient,
  chainKey: EvmChainKey,
  owner: Address,
  amountUnits: bigint,
): Promise<AllowanceState> {
  const cfg = assertConfigured(chainKey);
  const current = (await client.readContract({
    address: cfg.mockUsdc,
    abi: MockUSDCAbi,
    functionName: "allowance",
    args: [owner, cfg.pulseSender],
  })) as bigint;
  return {
    current,
    required: amountUnits,
    needsApproval: current < amountUnits,
  };
}

/** Read pmUSDC balance buyer. */
export async function readUsdcBalance(
  client: PublicClient,
  chainKey: EvmChainKey,
  owner: Address,
): Promise<bigint> {
  const cfg = assertConfigured(chainKey);
  return (await client.readContract({
    address: cfg.mockUsdc,
    abi: MockUSDCAbi,
    functionName: "balanceOf",
    args: [owner],
  })) as bigint;
}

/**
 * Quote LayerZero native fee untuk `pay`. PulseSender masih panggil endpoint.send
 * internally (LZ vestige) jadi kita harus include fee meskipun delivery diabaikan
 * di sisi Solana.
 */
export async function quotePayNativeFee(
  client: PublicClient,
  intent: PayIntent,
): Promise<bigint> {
  const cfg = assertConfigured(intent.chainKey);
  const fee = (await client.readContract({
    address: cfg.pulseSender,
    abi: PulseSenderAbi,
    functionName: "quotePay",
    args: [SOLANA_DEVNET_EID, intent.sessionId, intent.amountUnits, "0x"],
    account: intent.payer,
  })) as { nativeFee: bigint; lzTokenFee: bigint };
  return fee.nativeFee;
}

/**
 * Submit `approve(PulseSender, MAX_UINT256)` ke MockUSDC. Return tx hash.
 * Konsumer waitForTransactionReceipt sebelum lanjut ke `pay`.
 */
export async function approveUsdcMax(
  wallet: WalletClient,
  chainKey: EvmChainKey,
  account: Address,
): Promise<Hex> {
  const cfg = assertConfigured(chainKey);
  return wallet.writeContract({
    chain: wallet.chain,
    account,
    address: cfg.mockUsdc,
    abi: MockUSDCAbi,
    functionName: "approve",
    args: [cfg.pulseSender, MAX_UINT256],
  });
}

/**
 * Submit `PulseSender.pay(40168, sessionId, amount, "0x")` dengan nativeFee
 * sebagai msg.value. Return tx hash.
 */
export async function submitPay(
  wallet: WalletClient,
  intent: PayIntent,
  nativeFee: bigint,
): Promise<Hex> {
  const cfg = assertConfigured(intent.chainKey);
  return wallet.writeContract({
    chain: wallet.chain,
    account: intent.payer,
    address: cfg.pulseSender,
    abi: PulseSenderAbi,
    functionName: "pay",
    args: [SOLANA_DEVNET_EID, intent.sessionId, intent.amountUnits, "0x"],
    value: nativeFee,
  });
}
