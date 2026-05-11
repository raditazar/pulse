/**
 * Viem chain configs untuk testnet yang dipakai Pulse. Re-export dari viem/chains
 * supaya konsumer (web app, relayer, etc.) tidak perlu import dua tempat.
 */

import { arbitrumSepolia, baseSepolia } from "viem/chains";
import type { Chain } from "viem";
import { PULSE_EVM_ADDRESSES, type EvmChainKey } from "./addresses";

// Override rpcUrls.default supaya viem (public + wallet client) dan Privy
// supportedChains pakai RPC private kalau di-set di env. Default viem
// `baseSepolia` pakai drpc.org public tier yang gampang kena rate limit.
function withCustomRpc(base: Chain, rpcUrl: string): Chain {
  return {
    ...base,
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  };
}

export const pulseChains: Record<EvmChainKey, Chain> = {
  baseSepolia: withCustomRpc(baseSepolia, PULSE_EVM_ADDRESSES.baseSepolia.rpcUrl),
  arbSepolia: withCustomRpc(arbitrumSepolia, PULSE_EVM_ADDRESSES.arbSepolia.rpcUrl),
};

export function chainKeyFromId(chainId: number): EvmChainKey | null {
  if (chainId === baseSepolia.id) return "baseSepolia";
  if (chainId === arbitrumSepolia.id) return "arbSepolia";
  return null;
}
