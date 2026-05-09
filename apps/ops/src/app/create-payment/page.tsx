"use client";

import { useState } from "react";
import { ChevronDown } from "@/components/dashboard/icons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  CtaButton,
  CurrencyToggle,
  FieldLabel,
  Panel,
  PanelHeading,
} from "@/components/dashboard/primitives";
import { createPaymentDefaults, type DisplayCurrency } from "@/lib/mock-data";

export default function CreatePaymentPage() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const d = createPaymentDefaults;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Create Payment"
        subtitle="Enter an amount and create a payment session for a customer or table."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading title="Payment Details" sub="The created session can be tapped through the selected NFC sticker." />

          <div className="flex flex-col gap-3.5">
            <CurrencyToggle currency={currency} onChange={setCurrency} />

            <div>
              <FieldLabel>Amount</FieldLabel>
              <div className="rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[22px] font-extrabold text-text">
                {d.amount[currency]}
              </div>
            </div>

            <div>
              <FieldLabel>Description (Optional)</FieldLabel>
              <div className="rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text">
                {d.description}
              </div>
            </div>

            <div>
              <FieldLabel>Select NFC Sticker</FieldLabel>
              <div className="flex items-center justify-between rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text">
                <span>{d.selectedSticker}</span>
                <ChevronDown size={12} />
              </div>
            </div>

            <CtaButton className="mt-2">Create Payment Session</CtaButton>
          </div>
        </Panel>

        <Panel className="bg-bg-soft">
          <PanelHeading title="Notes" sub="A few important details about payment sessions." />
          <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
            <li>ⓘ Sessions remain active for 15 minutes after creation.</li>
            <li>ⓘ Stickers with an active session cannot be assigned again.</li>
            <li>ⓘ Payments are signed directly in the customer wallet.</li>
            <li>ⓘ On-chain settlement usually completes in 1–2 seconds.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
