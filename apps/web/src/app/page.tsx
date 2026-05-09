"use client";

import { useState } from "react";
import { CheckoutShell } from "@/components/checkout/CheckoutShell";
import { DevStateSwitcher } from "@/components/checkout/DevStateSwitcher";
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

export default function CheckoutPage() {
  const [phase, setPhase] = useState<CheckoutPhase>("checkout");
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");

  const advance = () => {
    setPhase("wallet");
    setTimeout(() => setPhase("processing"), 1100);
    setTimeout(() => setPhase("success"), 2400);
  };

  return (
    <>
      <DevStateSwitcher current={phase} onChange={setPhase} />
      <CheckoutShell>
        {phase === "loading" && <LoadingScreen />}
        {phase === "checkout" && (
          <CheckoutScreen
            currency={currency}
            onCurrencyChange={setCurrency}
            onPay={advance}
            onBack={() => setPhase("loading")}
          />
        )}
        {phase === "wallet" && <WalletPendingScreen onBack={() => setPhase("checkout")} />}
        {phase === "processing" && <ProcessingScreen onBack={() => setPhase("checkout")} />}
        {phase === "success" && (
          <SuccessScreen currency={currency} onDone={() => setPhase("checkout")} />
        )}
        {phase === "error" && (
          <ErrorScreen onRetry={() => setPhase("checkout")} onBack={() => setPhase("checkout")} />
        )}
      </CheckoutShell>
    </>
  );
}
