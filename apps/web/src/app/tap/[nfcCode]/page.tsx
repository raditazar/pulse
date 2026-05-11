"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ClientPageTransition } from "@/components/checkout/ClientPageTransition";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { LoadingScreen } from "@/components/checkout/screens";
import {
  AlertInfo,
  PrimaryButton,
  PulseLogoMark,
  ScreenSub,
  ScreenTitle,
  SecondaryButton,
} from "@/components/checkout/ui";
import { ApiError, fetchTapSession } from "@/lib/api";

export default function TapPage({
  params,
}: {
  params: Promise<{ nfcCode: string }>;
}) {
  const router = useRouter();
  const [nfcCode, setNfcCode] = useState("");
  const [state, setState] = useState<"loading" | "idle" | "error">("loading");
  const [message, setMessage] = useState("Checking cashier NFC...");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    params.then((resolved) => setNfcCode(resolved.nfcCode));
  }, [params]);

  useEffect(() => {
    if (!nfcCode) return;

    setState("loading");
    setMessage("Checking cashier NFC...");

    fetchTapSession(nfcCode)
      .then((session) => {
        router.replace(`/pay/${session.session.id}`);
      })
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : "Unable to load NFC payment.";
        const apiMessage = error instanceof ApiError ? error.message : reason;

        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 410) &&
          (apiMessage.includes("No active session") ||
            apiMessage.includes("Active session expired"))
        ) {
          setMessage(
            apiMessage.includes("expired")
              ? "The last payment session expired. Ask the cashier to create a new payment."
              : "No payment is open right now. Ask the cashier to create a payment first.",
          );
          setState("idle");
          return;
        }

        setMessage(reason);
        setState("error");
      });
  }, [attempt, nfcCode, router]);

  return (
    <CheckoutShell>
      <ClientPageTransition pageKey={state}>
        {state === "loading" && <LoadingScreen />}
        {state === "idle" && (
          <NfcState
            title="No Payment Open"
            message={message}
            nfcCode={nfcCode}
            onRetry={() => setAttempt((current) => current + 1)}
            onBack={() => router.push("/")}
          />
        )}
        {state === "error" && (
          <NfcState
            title="NFC Link Unavailable"
            message={message}
            nfcCode={nfcCode}
            onRetry={() => setAttempt((current) => current + 1)}
            onBack={() => router.push("/")}
          />
        )}
      </ClientPageTransition>
    </CheckoutShell>
  );
}

function NfcState({
  title,
  message,
  nfcCode,
  onRetry,
  onBack,
}: {
  title: string;
  message: string;
  nfcCode: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col py-3">
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <PulseLogoMark size={74} />
        <div>
          <ScreenTitle>{title}</ScreenTitle>
          <ScreenSub className="mt-2 max-w-[320px] px-3">{message}</ScreenSub>
        </div>
        <AlertInfo variant="muted">
          <span className="num break-all">NFC: {nfcCode}</span>
        </AlertInfo>
      </div>

      <div className="mt-4 flex w-full flex-col gap-2">
        <PrimaryButton onClick={onRetry}>Check Again</PrimaryButton>
        <SecondaryButton onClick={onBack}>Back</SecondaryButton>
      </div>
    </div>
  );
}
