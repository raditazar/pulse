/**
 * Cross-chain pay orchestrator for Pulse. Handles EVM approval + payment
 * transactions through the Privy Ethereum wallet and reports UI phases.
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
  MockUSDCAbi,
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
  /** 32-byte hex session id, with or without the 0x prefix. */
  sessionSeed: string;
  /** Human-readable amount string, e.g. "1.50". */
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

export interface FaucetPmUsdcInput {
  wallet: ConnectedWallet;
  chainKey: EvmChainKey;
  amountUsdc?: string;
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
      `sessionSeed must be a 32-byte hex string (64 characters), got "${value}" (${hex.length} chars)`,
      "validation",
    );
  }
  return `0x${hex.toLowerCase()}` as Hex;
}

function expectedChainIdFor(chainKey: EvmChainKey): number {
  return PULSE_EVM_ADDRESSES[chainKey].chainId;
}

async function buildWalletClientForChain(wallet: ConnectedWallet, chainKey: EvmChainKey) {
  const expectedChainId = expectedChainIdFor(chainKey);
  const walletChainId = Number(wallet.chainId?.split(":").pop() ?? 0);
  if (walletChainId !== expectedChainId) {
    await wallet.switchChain(expectedChainId);
  }

  const provider = await wallet.getEthereumProvider();
  return createWalletClient({
    account: wallet.address as Address,
    chain: pulseChains[chainKey],
    transport: custom(provider),
  });
}

export async function faucetPmUsdc(input: FaucetPmUsdcInput): Promise<Hex> {
  const cfg = PULSE_EVM_ADDRESSES[input.chainKey];
  if (!cfg.mockUsdc) {
    throw new CrossChainPayError(
      `Missing MockUSDC address for ${input.chainKey}`,
      "validation",
    );
  }

  const walletClient = await buildWalletClientForChain(input.wallet, input.chainKey);
  const hash = await walletClient.writeContract({
    chain: walletClient.chain,
    account: input.wallet.address as Address,
    address: cfg.mockUsdc,
    abi: MockUSDCAbi,
    functionName: "faucet",
    args: [parseUnits(input.amountUsdc ?? "100", 6)],
  });
  await getPulsePublicClient(input.chainKey).waitForTransactionReceipt({ hash });
  return hash;
}

/**
 * Executes the full flow: approve when needed, then pay PulseSender. The EVM
 * transaction is confirmed before the checkout moves to success.
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

  // Preflight: make sure balance is sufficient before opening the wallet popup.
  const balance = await readUsdcBalance(publicClient, chainKey, payer);
  if (balance < amountUnits) {
    throw new CrossChainPayError(
      `Insufficient pmUSDC balance: available ${balance}, required ${amountUnits}`,
      "preflight",
    );
  }

  if (Number(wallet.chainId?.split(":").pop() ?? 0) !== expectedChainId) {
    onPhase?.("switching-chain");
    try {
      await wallet.switchChain(expectedChainId);
    } catch (error) {
      throw new CrossChainPayError(
        `Failed to switch wallet to chain ${expectedChainId}`,
        "switching-chain",
        error,
      );
    }
  }

  const walletClient = await buildWalletClientForChain(wallet, chainKey);

  // Approve when allowance is too low.
  const allowance = await readUsdcAllowance(publicClient, chainKey, payer, amountUnits);
  let approveTxHash: Hex | null = null;
  if (allowance.needsApproval) {
    onPhase?.("approve-wallet");
    try {
      approveTxHash = await approveUsdcMax(walletClient, chainKey, payer);
    } catch (error) {
      throw new CrossChainPayError(
        "Approval was cancelled or failed in the wallet",
        "approve-wallet",
        error,
      );
    }
    onPhase?.("approve-confirming");
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  // Quote the LayerZero native fee. PulseSender calls endpoint.send internally.
  const nativeFee = await quotePayNativeFee(publicClient, {
    chainKey,
    sessionId,
    amountUnits,
    payer,
  });

  // Submit payment.
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
      "Payment was cancelled or failed in the wallet",
      "pay-wallet",
      error,
    );
  }
  onPhase?.("pay-confirming");
  await publicClient.waitForTransactionReceipt({ hash: payTxHash });

  // EVM tx confirmed. The relayer listens for PaymentIntentSent and settles on
  // Solana. This short settling state is UI-only; a future version can poll the
  // PaymentSession PDA directly.
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
 * Resolves the Privy wallet chain key. Unsupported chains return null so the UI
 * can ask the user to switch or choose another chain.
 */
export function detectChainKey(wallet: ConnectedWallet | undefined): EvmChainKey | null {
  if (!wallet?.chainId) return null;
  const id = Number(wallet.chainId.split(":").pop() ?? 0);
  return chainKeyFromId(id);
}
