import { PublicKey } from "@solana/web3.js";

export const SOLANA_CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

export const DEFAULT_PULSE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PULSE_PAYMENT_PROGRAM_ID ??
    process.env.PULSE_PAYMENT_PROGRAM_ID ??
    process.env.PULSE_PROGRAM_ID ??
    "2q7mj25BboC3th75YesFFdcSR3e76a45mKKJukQXAUiF",
);

export function derivePulseMerchantPda(
  authority: PublicKey,
  programId = DEFAULT_PULSE_PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), authority.toBuffer()],
    programId,
  );
}

export function derivePulseSessionPda(
  merchantPda: PublicKey,
  sessionSeed: Uint8Array,
  programId = DEFAULT_PULSE_PROGRAM_ID,
) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("session"), merchantPda.toBuffer(), Buffer.from(sessionSeed)],
    programId,
  );
}

export function normalizeSessionSeed(seed: string) {
  const hex = seed.startsWith("0x") ? seed.slice(2) : seed;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("session seed must be 32-byte hex");
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

export function encodeSessionSeed(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

export function createRandomSessionSeed() {
  return crypto.getRandomValues(new Uint8Array(32));
}
