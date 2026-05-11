/**
 * `PulseLzPayload` codec — mirror dari Rust `payload_codec.rs` & Solidity
 * `PulseSender._encodePayload`. 64-byte BE layout:
 *
 * | offset | size | field      |
 * |--------|------|------------|
 * | 0      | 32   | sessionId  |
 * | 32     | 8    | amount u64 |
 * | 40     | 20   | payer EVM  |
 * | 60     | 4    | sourceEid  |
 */

export const PULSE_LZ_PAYLOAD_LEN = 64;

export interface PulseLzPayload {
  sessionId: Uint8Array;
  amount: bigint;
  /** EVM address (20 raw bytes). */
  payer: Uint8Array;
  sourceEid: number;
}

export function encodePulseLzPayload(p: PulseLzPayload): Uint8Array {
  if (p.sessionId.length !== 32) {
    throw new Error(`sessionId must be 32 bytes, got ${p.sessionId.length}`);
  }
  if (p.payer.length !== 20) {
    throw new Error(`payer must be 20 bytes, got ${p.payer.length}`);
  }
  if (p.amount < 0n || p.amount > 0xffffffffffffffffn) {
    throw new Error("amount out of u64 range");
  }
  if (p.sourceEid < 0 || p.sourceEid > 0xffffffff) {
    throw new Error("sourceEid out of u32 range");
  }

  const buf = new Uint8Array(PULSE_LZ_PAYLOAD_LEN);
  buf.set(p.sessionId, 0);
  const view = new DataView(buf.buffer);
  view.setBigUint64(32, p.amount, false);
  buf.set(p.payer, 40);
  view.setUint32(60, p.sourceEid, false);
  return buf;
}

export function decodePulseLzPayload(buf: Uint8Array): PulseLzPayload {
  if (buf.length !== PULSE_LZ_PAYLOAD_LEN) {
    throw new Error(
      `PulseLzPayload must be ${PULSE_LZ_PAYLOAD_LEN} bytes, got ${buf.length}`,
    );
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return {
    sessionId: buf.slice(0, 32),
    amount: view.getBigUint64(32, false),
    payer: buf.slice(40, 60),
    sourceEid: view.getUint32(60, false),
  };
}

/**
 * Convert hex string ke 32-byte Uint8Array. Throws kalau format salah.
 */
export function hex32(value: string): Uint8Array {
  const hex = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`expected 32-byte hex, got "${value}"`);
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}

/**
 * Convert 20-byte EVM address string ke Uint8Array.
 */
export function evmAddressBytes(addr: string): Uint8Array {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr;
  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error(`expected EVM address 0x..40hex, got "${addr}"`);
  }
  return Uint8Array.from(Buffer.from(hex, "hex"));
}
