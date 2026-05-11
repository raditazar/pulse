/**
 * Pulse EVM address registry. Per-chain alamat MockUSDC + PulseSender + LZ Endpoint.
 *
 * Diisi via env (NEXT_PUBLIC_* / runtime), supaya web app & relayer baca dari single
 * source. Build-time fallback ke `null` agar TS-aware konsumer wajib handle missing
 * deployment.
 */

export type EvmChainKey = "baseSepolia" | "arbSepolia";

export interface EvmChainAddresses {
  chainId: number;
  /** LayerZero V2 endpoint ID untuk chain ini. */
  eid: number;
  lzEndpoint: `0x${string}`;
  mockUsdc: `0x${string}` | null;
  pulseSender: `0x${string}` | null;
  rpcUrl: string;
  blockExplorer: string;
  /** Native fee token symbol — informational only. */
  nativeSymbol: "ETH";
}

const parseAddress = (name: string, raw: string | undefined) => {
  if (!raw) return null;
  if (!raw.startsWith("0x") || raw.length !== 42) {
    throw new Error(`${name} harus address hex 0x... 40 chars, got "${raw}"`);
  }
  return raw as `0x${string}`;
};

// NOTE: Next.js hanya inline NEXT_PUBLIC_* kalau diakses sebagai literal string.
// Jangan diganti jadi dynamic indexing (process.env[name]) — value akan undefined
// di client bundle.
export const PULSE_EVM_ADDRESSES: Record<EvmChainKey, EvmChainAddresses> = {
  baseSepolia: {
    chainId: 84_532,
    eid: 40_245,
    lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    mockUsdc: parseAddress(
      "NEXT_PUBLIC_MOCK_USDC_BASE_SEPOLIA",
      process.env.NEXT_PUBLIC_MOCK_USDC_BASE_SEPOLIA,
    ),
    pulseSender: parseAddress(
      "NEXT_PUBLIC_PULSE_SENDER_BASE_SEPOLIA",
      process.env.NEXT_PUBLIC_PULSE_SENDER_BASE_SEPOLIA,
    ),
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA ?? "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    nativeSymbol: "ETH",
  },
  arbSepolia: {
    chainId: 421_614,
    eid: 40_231,
    lzEndpoint: "0x6EDCE65403992e310A62460808c4b910D972f10f",
    mockUsdc: parseAddress(
      "NEXT_PUBLIC_MOCK_USDC_ARB_SEPOLIA",
      process.env.NEXT_PUBLIC_MOCK_USDC_ARB_SEPOLIA,
    ),
    pulseSender: parseAddress(
      "NEXT_PUBLIC_PULSE_SENDER_ARB_SEPOLIA",
      process.env.NEXT_PUBLIC_PULSE_SENDER_ARB_SEPOLIA,
    ),
    rpcUrl:
      process.env.NEXT_PUBLIC_RPC_ARB_SEPOLIA ??
      "https://sepolia-rollup.arbitrum.io/rpc",
    blockExplorer: "https://sepolia.arbiscan.io",
    nativeSymbol: "ETH",
  },
};

export const SOLANA_DEVNET_EID = 40_168;

/**
 * Resolve chain key dari LayerZero EID. Berguna saat decode payload di relayer.
 */
export function chainKeyFromEid(eid: number): EvmChainKey | "solanaDevnet" | null {
  switch (eid) {
    case 40_245:
      return "baseSepolia";
    case 40_231:
      return "arbSepolia";
    case 40_168:
      return "solanaDevnet";
    default:
      return null;
  }
}
