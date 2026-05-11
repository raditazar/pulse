/**
 * `PulseLzPayload` codec — TypeScript mirror dari Rust struct di
 * `contracts/programs/pulse_lz_oapp/src/payload_codec.rs`.
 *
 * Layout 64 bytes BE:
 * | offset | size | field         |
 * |--------|------|---------------|
 * | 0      | 32   | sessionId     |
 * | 32     | 8    | amount (u64)  |
 * | 40     | 20   | payer (EVM)   |
 * | 60     | 4    | sourceEid     |
 *
 * EVM-side (Solidity) encode pakai `abi.encodePacked(sessionId, amount, payer, sourceEid)`
 * — keccak alignment tidak perlu karena bukan ABI-encoded structure.
 */

export const PULSE_LZ_PAYLOAD_LEN = 64;

export interface PulseLzPayload {
  /** 32-byte session id (random, di-generate saat NFC tap di sisi Pulse). */
  sessionId: Uint8Array;
  /** USDC amount dalam base units (6 decimals). */
  amount: bigint;
  /** EVM address user (raw 20 bytes). */
  payer: Uint8Array;
  /** LayerZero EID asal (40161 = Sepolia, 40231 = Arb Sepolia, 40245 = Base Sepolia). */
  sourceEid: number;
}

export function encodePulseLzPayload(p: PulseLzPayload): Uint8Array {
  if (p.sessionId.length !== 32) throw new Error(`sessionId must be 32 bytes, got ${p.sessionId.length}`);
  if (p.payer.length !== 20) throw new Error(`payer must be 20 bytes, got ${p.payer.length}`);
  if (p.amount < 0n || p.amount > 0xffffffffffffffffn) throw new Error("amount out of u64 range");
  if (p.sourceEid < 0 || p.sourceEid > 0xffffffff) throw new Error("sourceEid out of u32 range");

  const buf = new Uint8Array(PULSE_LZ_PAYLOAD_LEN);
  buf.set(p.sessionId, 0);

  // u64 BE
  const view = new DataView(buf.buffer);
  view.setBigUint64(32, p.amount, false);

  buf.set(p.payer, 40);

  view.setUint32(60, p.sourceEid, false);
  return buf;
}

export function decodePulseLzPayload(buf: Uint8Array): PulseLzPayload {
  if (buf.length !== PULSE_LZ_PAYLOAD_LEN) {
    throw new Error(`PulseLzPayload must be ${PULSE_LZ_PAYLOAD_LEN} bytes, got ${buf.length}`);
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const sessionId = buf.slice(0, 32);
  const amount = view.getBigUint64(32, false);
  const payer = buf.slice(40, 60);
  const sourceEid = view.getUint32(60, false);
  return { sessionId, amount, payer, sourceEid };
}
