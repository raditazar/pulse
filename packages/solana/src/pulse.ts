import { PublicKey } from "@solana/web3.js";

export const DEFAULT_PULSE_PROGRAM_ID = new PublicKey(
  process.env.PULSE_PROGRAM_ID ?? "Gh2NP3fBQfdARCkTerXx8vzgEY1yFhH5ApM8v79rj8d2",
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
