/**
 * EVM-side listener: polling `getLogs` untuk event `PaymentIntentSent` di kontrak
 * `PulseSender` setiap chain (Base Sepolia, Arb Sepolia, dst.).
 *
 * Strategi: polling (bukan websocket) supaya kompatibel dengan RPC publik
 * (Base/Arb Sepolia public RPC tidak support `eth_subscribe`).
 *
 * Cursor: nomor block terakhir yang sudah di-scan. Restart → re-scan dari `getBlockNumber()` saat boot.
 */

import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { defineChain } from "viem";
import { logger } from "./logger";
import type { PulsePaymentIntent } from "./types";

export const PAYMENT_INTENT_SENT_EVENT = parseAbiItem(
  "event PaymentIntentSent(bytes32 indexed sessionId, uint32 indexed dstEid, address indexed payer, uint256 amount, bytes32 guid, uint64 nonce)",
);

export interface EvmChainConfig {
  /** Display label (untuk logging). */
  label: string;
  /** Chain ID native (84532 Base Sep, 421614 Arb Sep). */
  chainId: number;
  /** RPC HTTP endpoint. */
  rpcUrl: string;
  /** LayerZero EID untuk chain ini (40245 Base Sep, 40231 Arb Sep). */
  eid: number;
  /** Alamat PulseSender yang di-deploy di chain ini. */
  pulseSender: Address;
}

export class EvmPulseSenderListener {
  private client: PublicClient;
  private lastBlock: bigint = 0n;
  private running = false;

  constructor(
    private readonly chain: EvmChainConfig,
    private readonly onEvent: (intent: PulsePaymentIntent) => Promise<void>,
    private readonly pollIntervalMs = 5_000,
  ) {
    // viem butuh chain object — buat minimal untuk getLogs.
    const chainDef = defineChain({
      id: this.chain.chainId,
      name: this.chain.label,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [this.chain.rpcUrl] } },
    });
    this.client = createPublicClient({ chain: chainDef, transport: http(this.chain.rpcUrl) });
  }

  async start() {
    if (this.running) return;
    this.running = true;

    this.lastBlock = await this.client.getBlockNumber();
    logger.info(
      {
        chain: this.chain.label,
        chainId: this.chain.chainId,
        eid: this.chain.eid,
        pulseSender: this.chain.pulseSender,
        cursor: this.lastBlock.toString(),
        source: "evm",
      },
      "EVM PulseSender listener started",
    );

    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        logger.error(
          { err, chain: this.chain.label, source: "evm" },
          "tick failure (will retry)",
        );
      }
      await sleep(this.pollIntervalMs);
    }
  }

  stop() {
    this.running = false;
  }

  private async tick() {
    const current = await this.client.getBlockNumber();
    if (current <= this.lastBlock) return;

    // Cap block range untuk safety RPC (Base Sep batas ~10k blocks per getLogs).
    const fromBlock = this.lastBlock + 1n;
    const toBlock = current > fromBlock + 1_000n ? fromBlock + 1_000n : current;

    const logs = await this.client.getLogs({
      address: this.chain.pulseSender,
      event: PAYMENT_INTENT_SENT_EVENT,
      fromBlock,
      toBlock,
    });

    if (logs.length > 0) {
      logger.info(
        {
          chain: this.chain.label,
          count: logs.length,
          fromBlock: fromBlock.toString(),
          toBlock: toBlock.toString(),
          source: "evm",
        },
        "found PaymentIntentSent events",
      );
    }

    for (const log of logs) {
      try {
        const intent = parseLog(log, this.chain.eid);
        await this.onEvent(intent);
      } catch (err) {
        logger.error(
          { err, txHash: log.transactionHash, chain: this.chain.label, source: "evm" },
          "decode/handle failed",
        );
      }
    }

    this.lastBlock = toBlock;
  }
}

function parseLog(
  log: {
    args: { sessionId?: Hex; dstEid?: number; payer?: Address; amount?: bigint };
    transactionHash: Hex;
    address: Address;
  },
  sourceEid: number,
): PulsePaymentIntent {
  const { sessionId, payer, amount } = log.args;
  if (!sessionId || !payer || amount === undefined) {
    throw new Error("missing required event args");
  }
  return {
    sessionId: Uint8Array.from(Buffer.from(sessionId.slice(2), "hex")),
    sourceEid,
    sourcePayer: Uint8Array.from(Buffer.from(payer.slice(2), "hex")),
    amount,
    source: "evm",
    sourceTxHash: log.transactionHash,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
