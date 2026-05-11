/**
 * Viem PublicClient factory untuk read-only ops (allowance check, fee quote,
 * tx receipt wait). WalletClient di-build di konsumer karena butuh EIP-1193
 * provider dari wallet adapter (Privy / wagmi / dll.).
 */

import { createPublicClient, http, type PublicClient } from "viem";
import { PULSE_EVM_ADDRESSES, type EvmChainKey } from "./addresses";
import { pulseChains } from "./chains";

const cache = new Map<EvmChainKey, PublicClient>();

export function getPulsePublicClient(chainKey: EvmChainKey): PublicClient {
  const cached = cache.get(chainKey);
  if (cached) return cached;
  const cfg = PULSE_EVM_ADDRESSES[chainKey];
  const client = createPublicClient({
    chain: pulseChains[chainKey],
    transport: http(cfg.rpcUrl),
  });
  cache.set(chainKey, client);
  return client;
}
