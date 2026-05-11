import assert from "node:assert/strict";

import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.PulsePayment as anchor.Program;

function merchantPda(authority: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("merchant"), authority.toBuffer()],
    program.programId
  );
}

function sessionPda(merchant: PublicKey, sessionId: Uint8Array) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("session"), merchant.toBuffer(), Buffer.from(sessionId)],
    program.programId
  );
}

function statusName(status: unknown): string {
  return Object.keys(status as Record<string, unknown>)[0]!;
}

async function airdrop(pubkey: PublicKey, lamports = 2 * anchor.web3.LAMPORTS_PER_SOL) {
  const sig = await provider.connection.requestAirdrop(pubkey, lamports);
  await provider.connection.confirmTransaction(sig, "confirmed");
}

async function waitForChainTimePast(targetUnixTs: number) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const slot = await provider.connection.getSlot("confirmed");
    const blockTime = await provider.connection.getBlockTime(slot);
    if (blockTime !== null && blockTime > targetUnixTs) {
      return;
    }

    await airdrop(Keypair.generate().publicKey, 1_000_000);
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error(`chain clock did not advance past ${targetUnixTs}`);
}

async function expectThrows(fn: () => Promise<unknown>, label: string) {
  let thrown = false;
  try {
    await fn();
  } catch {
    thrown = true;
  }
  assert.equal(thrown, true, label);
}

async function main() {
  const authority = (provider.wallet as anchor.Wallet).payer;
  const customer = Keypair.generate();
  const primary = Keypair.generate();
  const platform = Keypair.generate();
  const ops = Keypair.generate();
  const stranger = Keypair.generate();

  await Promise.all([
    airdrop(customer.publicKey),
    airdrop(primary.publicKey),
    airdrop(platform.publicKey),
    airdrop(ops.publicKey),
    airdrop(stranger.publicKey),
  ]);

  const mint = await createMint(
    provider.connection,
    authority,
    authority.publicKey,
    null,
    6
  );

  const customerAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    customer.publicKey
  );
  const primaryAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    primary.publicKey
  );
  const platformAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    platform.publicKey
  );
  const opsAta = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    authority,
    mint,
    ops.publicKey
  );

  await mintTo(
    provider.connection,
    authority,
    mint,
    customerAta.address,
    authority,
    5_000_000n
  );

  const [merchant] = merchantPda(authority.publicKey);

  await program.methods
    .initializeMerchant(primary.publicKey, [{ wallet: platform.publicKey, bps: 1_000, label: "platform" }], "ipfs://merchant")
    .accounts({
      authority: authority.publicKey,
      merchant,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const merchantAccount = await program.account.merchant.fetch(merchant);
  assert.equal(merchantAccount.authority.toBase58(), authority.publicKey.toBase58());
  assert.equal(merchantAccount.primaryBeneficiary.toBase58(), primary.publicKey.toBase58());
  assert.equal(merchantAccount.splitBeneficiaries.length, 1);
  assert.equal(merchantAccount.totalSplitBps, 10_000);

  await expectThrows(
    () =>
      program.methods
        .initializeMerchant(primary.publicKey, [{ wallet: platform.publicKey, bps: 11_000, label: "bad" }], "ipfs://bad")
        .accounts({
          authority: stranger.publicKey,
          merchant: merchantPda(stranger.publicKey)[0],
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
    "rejects invalid split config"
  );

  await expectThrows(
    () =>
      program.methods
        .initializeMerchant(
          primary.publicKey,
          [{ wallet: primary.publicKey, bps: 1_000, label: "duplicate-primary" }],
          "ipfs://dup-primary"
        )
        .accounts({
          authority: stranger.publicKey,
          merchant: merchantPda(stranger.publicKey)[0],
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
    "rejects duplicate beneficiary wallet"
  );

  await expectThrows(
    () =>
      program.methods
        .updateMerchantSplit(primary.publicKey, [{ wallet: platform.publicKey, bps: 500, label: "platform" }], null)
        .accounts({
          authority: stranger.publicKey,
          merchant,
        })
        .signers([stranger])
        .rpc(),
    "non-authority cannot update merchant"
  );

  const [inactiveMerchant] = merchantPda(stranger.publicKey);
  await program.methods
    .initializeMerchant(
      stranger.publicKey,
      [{ wallet: ops.publicKey, bps: 1_500, label: "ops" }],
      "ipfs://inactive"
    )
    .accounts({
      authority: stranger.publicKey,
      merchant: inactiveMerchant,
      systemProgram: SystemProgram.programId,
    })
    .signers([stranger])
    .rpc();

  await program.methods
    .deactivateMerchant()
    .accounts({
      authority: stranger.publicKey,
      merchant: inactiveMerchant,
    })
    .signers([stranger])
    .rpc();

  const inactiveSessionId = Uint8Array.from(Array.from({ length: 32 }, (_, i) => 90 + i));
  const [inactiveSession] = sessionPda(inactiveMerchant, inactiveSessionId);
  await expectThrows(
    () =>
      program.methods
        .createSession(
          Array.from(inactiveSessionId),
          new anchor.BN(100_000),
          new anchor.BN(Math.floor(Date.now() / 1000) + 300)
        )
        .accounts({
          authority: stranger.publicKey,
          merchant: inactiveMerchant,
          session: inactiveSession,
          systemProgram: SystemProgram.programId,
        })
        .signers([stranger])
        .rpc(),
    "inactive merchant cannot create session"
  );

  const sessionId = Uint8Array.from(Array.from({ length: 32 }, (_, i) => i + 1));
  const [session] = sessionPda(merchant, sessionId);
  const expiresAt = new anchor.BN(Math.floor(Date.now() / 1000) + 300);

  await program.methods
    .createSession(Array.from(sessionId), new anchor.BN(1_000_000), expiresAt)
    .accounts({
      authority: authority.publicKey,
      merchant,
      session,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await program.methods
    .executeSplitPayment()
    .accounts({
      payer: customer.publicKey,
      merchant,
      session,
      payerUsdcAta: customerAta.address,
      usdcMint: mint,
      primaryBeneficiaryAta: primaryAta.address,
      primaryBeneficiary: primary.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts([{ pubkey: platformAta.address, isSigner: false, isWritable: true }])
    .signers([customer])
    .rpc();

  const sessionAccount = await program.account.paymentSession.fetch(session);
  assert.equal(statusName(sessionAccount.status), "paid");
  assert.equal(sessionAccount.paidBy.toBase58(), customer.publicKey.toBase58());

  const primaryBalance = await getAccount(provider.connection, primaryAta.address);
  const platformBalance = await getAccount(provider.connection, platformAta.address);
  assert.equal(Number(primaryBalance.amount), 900_000);
  assert.equal(Number(platformBalance.amount), 100_000);

  await expectThrows(
    () =>
      program.methods
        .executeSplitPayment()
        .accounts({
          payer: customer.publicKey,
          merchant,
          session,
          payerUsdcAta: customerAta.address,
          usdcMint: mint,
          primaryBeneficiaryAta: primaryAta.address,
          primaryBeneficiary: primary.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([{ pubkey: platformAta.address, isSigner: false, isWritable: true }])
        .signers([customer])
        .rpc(),
    "double spend must fail"
  );

  await expectThrows(
    () =>
      program.methods
        .closeSession()
        .accounts({
          authority: stranger.publicKey,
          merchant,
          session,
        })
        .signers([stranger])
        .rpc(),
    "non-authority cannot close session"
  );

  await program.methods
    .closeSession()
    .accounts({
      authority: authority.publicKey,
      merchant,
      session,
    })
    .rpc();

  const closedPaidSession = await provider.connection.getAccountInfo(session);
  assert.equal(closedPaidSession, null);

  const expiringSessionId = Uint8Array.from(Array.from({ length: 32 }, (_, i) => 200 - i));
  const [expiringSession] = sessionPda(merchant, expiringSessionId);
  await program.methods
    .createSession(
      Array.from(expiringSessionId),
      new anchor.BN(500_000),
      new anchor.BN(Math.floor(Date.now() / 1000) + 1)
    )
    .accounts({
      authority: authority.publicKey,
      merchant,
      session: expiringSession,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await waitForChainTimePast(Math.floor(Date.now() / 1000) + 1);

  await expectThrows(
    () =>
      program.methods
        .executeSplitPayment()
        .accounts({
          payer: customer.publicKey,
          merchant,
          session: expiringSession,
          payerUsdcAta: customerAta.address,
          usdcMint: mint,
          primaryBeneficiaryAta: primaryAta.address,
          primaryBeneficiary: primary.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([{ pubkey: platformAta.address, isSigner: false, isWritable: true }])
        .signers([customer])
        .rpc(),
    "expired session cannot be settled"
  );

  await program.methods
    .closeSession()
    .accounts({
      authority: authority.publicKey,
      merchant,
      session: expiringSession,
    })
    .rpc();

  const closedExpiredSession = await provider.connection.getAccountInfo(expiringSession);
  assert.equal(closedExpiredSession, null);

  const derivedPrimaryAta = getAssociatedTokenAddressSync(mint, primary.publicKey);
  assert.equal(derivedPrimaryAta.toBase58(), primaryAta.address.toBase58());

  const [roundingMerchant] = merchantPda(ops.publicKey);
  await program.methods
    .initializeMerchant(
      primary.publicKey,
      [{ wallet: platform.publicKey, bps: 3_333, label: "platform" }],
      "ipfs://rounding"
    )
    .accounts({
      authority: ops.publicKey,
      merchant: roundingMerchant,
      systemProgram: SystemProgram.programId,
    })
    .signers([ops])
    .rpc();

  const roundingSessionId = Uint8Array.from(Array.from({ length: 32 }, (_, i) => 150 + i));
  const [roundingSession] = sessionPda(roundingMerchant, roundingSessionId);
  await program.methods
    .createSession(
      Array.from(roundingSessionId),
      new anchor.BN(100),
      new anchor.BN(Math.floor(Date.now() / 1000) + 300)
    )
    .accounts({
      authority: ops.publicKey,
      merchant: roundingMerchant,
      session: roundingSession,
      systemProgram: SystemProgram.programId,
    })
    .signers([ops])
    .rpc();

  await mintTo(provider.connection, authority, mint, customerAta.address, authority, 100n);

  await expectThrows(
    () =>
      program.methods
        .executeSplitPayment()
        .accounts({
          payer: customer.publicKey,
          merchant: roundingMerchant,
          session: roundingSession,
          payerUsdcAta: customerAta.address,
          usdcMint: mint,
          primaryBeneficiaryAta: primaryAta.address,
          primaryBeneficiary: primary.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts([{ pubkey: opsAta.address, isSigner: false, isWritable: true }])
        .signers([customer])
        .rpc(),
    "invalid beneficiary ordering must fail"
  );

  const primaryBefore = Number((await getAccount(provider.connection, primaryAta.address)).amount);
  const platformBefore = Number((await getAccount(provider.connection, platformAta.address)).amount);

  await program.methods
    .executeSplitPayment()
    .accounts({
      payer: customer.publicKey,
      merchant: roundingMerchant,
      session: roundingSession,
      payerUsdcAta: customerAta.address,
      usdcMint: mint,
      primaryBeneficiaryAta: primaryAta.address,
      primaryBeneficiary: primary.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts([{ pubkey: platformAta.address, isSigner: false, isWritable: true }])
    .signers([customer])
    .rpc();

  const primaryAfter = Number((await getAccount(provider.connection, primaryAta.address)).amount);
  const platformAfter = Number((await getAccount(provider.connection, platformAta.address)).amount);
  assert.equal(primaryAfter - primaryBefore, 67);
  assert.equal(platformAfter - platformBefore, 33);

  console.log("pulse_payment core tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
