"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutSessionResponse } from "@pulse/types";
import { ClientPageTransition } from "@/components/checkout/ClientPageTransition";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import {
  CheckoutScreen,
  ErrorScreen,
  LoadingScreen,
  ProcessingScreen,
  SuccessScreen,
  WalletPendingScreen,
} from "@/components/checkout/screens";
import type { CheckoutPhase } from "@/components/checkout/types";
import type { DisplayCurrency } from "@/lib/mock-checkout";
import {
  buildMockTxSignature,
} from "@/lib/mock-checkout";
import {
  fetchCheckoutSession,
  recordCheckoutTransaction,
} from "@/lib/api";

export default function CheckoutSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<CheckoutPhase>("loading");
  const [currency, setCurrency] = useState<DisplayCurrency>("USDC");
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [errorReason, setErrorReason] = useState("Unable to load checkout session");
  const [txSignature, setTxSignature] = useState<string>("");

  useEffect(() => {
    params.then((resolved) => setSessionId(resolved.sessionId));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    fetchCheckoutSession(sessionId)
      .then((payload) => {
        setSession(payload);
        setPhase(payload.session.status === "paid" ? "success" : "checkout");
      })
      .catch((error: Error) => {
        setErrorReason(error.message);
        setPhase("error");
      });
  }, [sessionId]);

  const resolvedSession = useMemo(() => session, [session]);

  const handlePay = async (payerAddress?: string) => {
    if (!resolvedSession) return;
    setPhase("wallet");
    const mockSignature = buildMockTxSignature();
    setTxSignature(mockSignature);
    window.setTimeout(async () => {
      setPhase("processing");
      try {
        await recordCheckoutTransaction({
          sessionId: resolvedSession.session.id,
          sessionPda: resolvedSession.session.sessionPda,
          txSignature: mockSignature,
          payerAddress: payerAddress ?? "wallet-pending",
          chain: "solana",
          amountUsdc: resolvedSession.session.amountUsdc,
          splitBreakdown: {
            primaryBeneficiary: resolvedSession.merchant.primaryBeneficiary,
            splitBasisPoints: String(resolvedSession.merchant.splitBasisPoints),
          },
        });
        setPhase("success");
      } catch (error) {
        setErrorReason(error instanceof Error ? error.message : "Payment failed");
        setPhase("error");
      }
    }, 1000);
  };

  return (
    <CheckoutShell>
      <ClientPageTransition pageKey={phase}>
        {phase === "loading" && <LoadingScreen />}
        {phase === "checkout" && resolvedSession && (
          <CheckoutScreen
            session={resolvedSession}
            currency={currency}
            onCurrencyChange={setCurrency}
            onPay={handlePay}
            onBack={() => router.push("/")}
          />
        )}
        {phase === "wallet" && <WalletPendingScreen onBack={() => setPhase("checkout")} />}
        {phase === "processing" && (
          <ProcessingScreen onBack={() => setPhase("checkout")} />
        )}
        {phase === "success" && resolvedSession && (
          <SuccessScreen
            session={resolvedSession}
            currency={currency}
            txSignature={txSignature}
            onDone={() => router.push("/")}
          />
        )}
        {phase === "error" && (
          <ErrorScreen
            reason={errorReason}
            session={resolvedSession}
            onRetry={() => setPhase(resolvedSession ? "checkout" : "loading")}
            onBack={() => router.push("/")}
          />
        )}
      </ClientPageTransition>
    </CheckoutShell>
  );
}
