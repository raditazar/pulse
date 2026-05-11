"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { useBuyerWalletConnection } from "@/components/checkout/BuyerWalletConnect";
import { buildMockTxSignature } from "@/lib/mock-checkout";
import {
  fetchCheckoutSession,
  recordCheckoutTransaction,
} from "@/lib/api";
import {
  chainLabel,
  isEvmChain,
  transactionChainTag,
  type CheckoutChainKey,
} from "@/lib/chain";
import {
  CrossChainPayError,
  executeCrossChainPay,
  type CrossChainPayPhase,
} from "@/lib/cross-chain-pay";

export default function CheckoutSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<CheckoutPhase>("loading");
  const [session, setSession] = useState<CheckoutSessionResponse | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [errorReason, setErrorReason] = useState("Unable to load checkout session");
  const [txSignature, setTxSignature] = useState<string>("");
  const [resultChain, setResultChain] = useState<CheckoutChainKey>("solana");
  const [crossChainPhase, setCrossChainPhase] = useState<CrossChainPayPhase | null>(null);
  const [selectedChain, setSelectedChain] = useState<CheckoutChainKey | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const { ethereumWallet, availableChains } = useBuyerWalletConnection();

  // Default chain mengikuti wallet yang connect — EVM > Solana saat dua-duanya connect.
  useEffect(() => {
    if (availableChains.length === 0) return;
    setSelectedChain((current) => {
      if (current && availableChains.includes(current)) return current;
      return availableChains[0];
    });
  }, [availableChains]);

  useEffect(() => {
    params.then((resolved) => setSessionId(resolved.sessionId));
  }, [params]);

  useEffect(() => {
    if (!sessionId) return;
    setPhase("loading");
    setErrorReason("Unable to load checkout session");
    fetchCheckoutSession(sessionId)
      .then((payload) => {
        setSession(payload);
        if (payload.session.status === "paid") {
          setPhase("success");
          return;
        }
        if (
          payload.session.status === "expired" ||
          payload.session.status === "cancelled" ||
          payload.session.status === "failed" ||
          payload.session.status === "deactivated"
        ) {
          setErrorReason(`Payment session is ${payload.session.status}.`);
          setPhase("error");
          return;
        }
        setPhase("checkout");
      })
      .catch((error: Error) => {
        setErrorReason(error.message);
        setPhase("error");
      });
  }, [sessionId, loadAttempt]);

  const resolvedSession = useMemo(() => session, [session]);

  const handleSolanaMockPay = async (payerAddress: string) => {
    if (!resolvedSession) return;
    setResultChain("solana");
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
          payerAddress,
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

  const handleEvmCrossChainPay = async (chain: "baseSepolia" | "arbSepolia") => {
    if (!resolvedSession || !ethereumWallet) {
      setErrorReason("Ethereum wallet belum connect.");
      setPhase("error");
      return;
    }

    setResultChain(chain);
    setPhase("wallet");
    setCrossChainPhase("preflight");

    try {
      const result = await executeCrossChainPay({
        wallet: ethereumWallet,
        chainKey: chain,
        sessionSeed: resolvedSession.session.sessionSeed,
        amountUsdc: resolvedSession.session.amountUsdc,
        onPhase: (next) => {
          setCrossChainPhase(next);
          if (next === "approve-wallet" || next === "pay-wallet" || next === "switching-chain") {
            setPhase("wallet");
          } else if (
            next === "approve-confirming" ||
            next === "pay-confirming" ||
            next === "settling"
          ) {
            setPhase("processing");
          }
        },
      });

      setTxSignature(result.payTxHash);

      // Eager record — backend mark session 'paid'. Relayer settle ke Solana
      // jalan paralel via PaymentIntentSent event listener.
      await recordCheckoutTransaction({
        sessionId: resolvedSession.session.id,
        sessionPda: resolvedSession.session.sessionPda,
        txSignature: result.payTxHash,
        payerAddress: result.payerAddress,
        chain: transactionChainTag(chain),
        amountUsdc: resolvedSession.session.amountUsdc,
        splitBreakdown: {
          primaryBeneficiary: resolvedSession.merchant.primaryBeneficiary,
          splitBasisPoints: String(resolvedSession.merchant.splitBasisPoints),
          sourceChain: chain,
          evmTxHash: result.payTxHash,
          evmApproveTxHash: result.approveTxHash,
        },
      });

      setPhase("success");
      setCrossChainPhase(null);
    } catch (error) {
      const message =
        error instanceof CrossChainPayError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Cross-chain payment failed";
      setErrorReason(message);
      setPhase("error");
      setCrossChainPhase(null);
    }
  };

  const handlePay = async (payerAddress?: string) => {
    if (!resolvedSession) return;
    const chain = selectedChain ?? "solana";
    if (isEvmChain(chain)) {
      await handleEvmCrossChainPay(chain);
    } else {
      await handleSolanaMockPay(payerAddress ?? "wallet-pending");
    }
  };

  const walletScreenText = walletPhaseLabel(crossChainPhase);
  const processingScreenText = processingPhaseLabel(crossChainPhase, resultChain);
  const checkoutChain = selectedChain ?? "solana";
  const chainsForUi = availableChains.length > 0 ? availableChains : ["solana" as const];

  return (
    <CheckoutShell>
      <ClientPageTransition pageKey={phase}>
        {phase === "loading" && <LoadingScreen />}
        {phase === "checkout" && resolvedSession && (
          <CheckoutScreen
            session={resolvedSession}
            onPay={handlePay}
            onBack={() => router.push("/")}
            selectedChain={checkoutChain}
            availableChains={chainsForUi}
            onChainSelect={setSelectedChain}
          />
        )}
        {phase === "wallet" && (
          <WalletPendingScreen
            onBack={() => setPhase("checkout")}
            title={walletScreenText.title}
            subtitle={walletScreenText.subtitle}
          />
        )}
        {phase === "processing" && (
          <ProcessingScreen
            onBack={() => setPhase("checkout")}
            chain={resultChain}
            title={processingScreenText.title}
            subtitle={processingScreenText.subtitle}
          />
        )}
        {phase === "success" && resolvedSession && (
          <SuccessScreen
            session={resolvedSession}
            txSignature={txSignature}
            chain={resultChain}
            onDone={() => router.push("/")}
          />
        )}
        {phase === "error" && (
          <ErrorScreen
            reason={errorReason}
            session={resolvedSession}
            onRetry={() => {
              if (resolvedSession) {
                setPhase("checkout");
                return;
              }
              setLoadAttempt((current) => current + 1);
            }}
            onBack={() => router.push("/")}
          />
        )}
      </ClientPageTransition>
    </CheckoutShell>
  );
}

function walletPhaseLabel(phase: CrossChainPayPhase | null): {
  title: string;
  subtitle: string;
} {
  switch (phase) {
    case "approve-wallet":
      return {
        title: "Approve pmUSDC spend",
        subtitle: "Confirm the spend approval in your wallet — needed once per chain.",
      };
    case "pay-wallet":
      return {
        title: "Sign the payment",
        subtitle: "Confirm the pay transaction in your wallet.",
      };
    case "switching-chain":
      return {
        title: "Switch network",
        subtitle: "Confirm the network switch in your wallet.",
      };
    default:
      return {
        title: "Waiting for wallet approval",
        subtitle: "Complete the approval in your wallet app.",
      };
  }
}

function processingPhaseLabel(
  phase: CrossChainPayPhase | null,
  chain: CheckoutChainKey,
): { title: ReactNode | undefined; subtitle: string } {
  const chainName = chainLabel(chain);
  switch (phase) {
    case "approve-confirming":
      return {
        title: (
          <>
            Confirming approval
            <br />
            on {chainName}...
          </>
        ),
        subtitle: "This takes ~10 seconds.",
      };
    case "pay-confirming":
      return {
        title: (
          <>
            Submitting payment
            <br />
            on {chainName}...
          </>
        ),
        subtitle: "Please wait a moment.",
      };
    case "settling":
      return {
        title: (
          <>
            Settling on Solana
            <br />
            via Pulse relayer...
          </>
        ),
        subtitle: "Releasing USDC to the merchant on Solana.",
      };
    default:
      return { title: undefined, subtitle: "Please wait a moment." };
  }
}
