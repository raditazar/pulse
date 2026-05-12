import {
  getPulsePublicClient,
  MAX_UINT256,
  MockUSDCAbi,
  PULSE_EVM_ADDRESSES,
  PulseSenderAbi,
  quotePayNativeFee,
  readUsdcAllowance,
  SOLANA_DEVNET_EID,
  type EvmChainKey,
} from "@pulse/evm";
import { formatEther, parseUnits, type Address, type Hex } from "viem";

export type CheckoutFeeQuote =
  | {
      status: "ready";
      gasFeeLabel: string;
      cctpFeeLabel: string;
      includesApprovalGas: boolean;
    }
  | {
      status: "loading";
      gasFeeLabel: string;
      cctpFeeLabel: string;
    }
  | {
      status: "unavailable";
      gasFeeLabel: string;
      cctpFeeLabel: string;
      reason?: string;
    };

function normalizeSessionSeed(value: string): Hex {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("sessionSeed must be a 32-byte hex string");
  }
  return `0x${hex.toLowerCase()}` as Hex;
}

function formatNativeFee(wei: bigint) {
  if (wei <= 0n) return "0 ETH";
  const eth = Number(formatEther(wei));
  if (!Number.isFinite(eth)) return `${formatEther(wei)} ETH`;
  if (eth < 0.000001) return "< 0.000001 ETH";
  return `≈ ${eth.toFixed(6)} ETH`;
}

export async function quoteEvmCheckoutFees(input: {
  chainKey: EvmChainKey;
  payer: Address;
  sessionSeed: string;
  amountUsdc: string;
}): Promise<Extract<CheckoutFeeQuote, { status: "ready" }>> {
  const sessionId = normalizeSessionSeed(input.sessionSeed);
  const amountUnits = parseUnits(input.amountUsdc, 6);
  const publicClient = getPulsePublicClient(input.chainKey);
  const cfg = PULSE_EVM_ADDRESSES[input.chainKey];

  if (!cfg.mockUsdc || !cfg.pulseSender) {
    throw new Error(`Missing contract addresses for ${input.chainKey}`);
  }

  const nativeFee = await quotePayNativeFee(publicClient, {
    chainKey: input.chainKey,
    sessionId,
    amountUnits,
    payer: input.payer,
  });

  const allowance = await readUsdcAllowance(
    publicClient,
    input.chainKey,
    input.payer,
    amountUnits,
  );

  const payGas = await publicClient.estimateContractGas({
    address: cfg.pulseSender,
    abi: PulseSenderAbi,
    functionName: "pay",
    args: [SOLANA_DEVNET_EID, sessionId, amountUnits, "0x"],
    account: input.payer,
    value: nativeFee,
  });

  const approvalGas = allowance.needsApproval
    ? await publicClient.estimateContractGas({
        address: cfg.mockUsdc,
        abi: MockUSDCAbi,
        functionName: "approve",
        args: [cfg.pulseSender, MAX_UINT256],
        account: input.payer,
      })
    : 0n;

  const gasPrice = await publicClient.getGasPrice();
  const gasFeeWei = (payGas + approvalGas) * gasPrice;

  return {
    status: "ready",
    gasFeeLabel: formatNativeFee(gasFeeWei),
    cctpFeeLabel: formatNativeFee(nativeFee),
    includesApprovalGas: allowance.needsApproval,
  };
}

export function solanaCheckoutFeeQuote(): CheckoutFeeQuote {
  return {
    status: "ready",
    gasFeeLabel: "< 0.00001 SOL",
    cctpFeeLabel: "0 SOL",
    includesApprovalGas: false,
  };
}
