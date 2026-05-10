"use client";

import { useState } from "react";
import { ChevronDown } from "@/components/dashboard/icons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  ConfirmDialog,
  CtaButton,
  CurrencyToggle,
  FieldLabel,
  Panel,
  PanelHeading,
} from "@/components/dashboard/primitives";
import { createPaymentDefaults, nfcTiles, type DisplayCurrency } from "@/lib/mock-data";

export default function CreatePaymentPage() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [amounts, setAmounts] = useState(createPaymentDefaults.amount);
  const [description, setDescription] = useState(createPaymentDefaults.description);
  const [selectedSticker, setSelectedSticker] = useState(createPaymentDefaults.selectedSticker);
  const [createdSession, setCreatedSession] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const d = createPaymentDefaults;

  const handleCreateSession = () => {
    const sessionId = `pulse-${Date.now().toString(36)}`;
    setCreatedSession(sessionId);
    setConfirmOpen(false);
  };

  const handleCopySession = async () => {
    if (!createdSession) return;
    await navigator.clipboard?.writeText(`${window.location.origin}/pay/${createdSession}`);
  };

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
              <input
                value={amounts[currency]}
                onChange={(event) =>
                  setAmounts((current) => ({ ...current, [currency]: event.target.value }))
                }
                className="w-full rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[22px] font-extrabold text-text outline-none focus:border-purple"
                aria-label={`Payment amount in ${currency}`}
              />
            </div>

            <div>
              <FieldLabel>Description (Optional)</FieldLabel>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text outline-none focus:border-purple"
                aria-label="Payment description"
              />
            </div>

            <div>
              <FieldLabel>Select NFC Sticker</FieldLabel>
              <label className="flex items-center justify-between rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text focus-within:border-purple">
                <select
                  value={selectedSticker}
                  onChange={(event) => setSelectedSticker(event.target.value)}
                  className="min-w-0 flex-1 appearance-none bg-transparent outline-none"
                  aria-label="Select NFC sticker"
                >
                  {nfcTiles.map((tile) => (
                    <option key={tile.id} value={tile.name}>
                      {tile.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </label>
            </div>

            <CtaButton className="mt-2" onClick={() => setConfirmOpen(true)}>
              Create Payment Session
            </CtaButton>

            {createdSession && (
              <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px] text-muted">
                <div className="font-bold text-text">Session ready</div>
                <div className="mt-1 num break-all text-[11px]">
                  /pay/{createdSession} · {amounts[currency]} · {description || d.description} ·{" "}
                  {selectedSticker}
                </div>
                <button
                  type="button"
                  onClick={handleCopySession}
                  className="focus-ring mt-2 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-purple"
                >
                  Copy Session Link
                </button>
              </div>
            )}
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

      <ConfirmDialog
        open={confirmOpen}
        title="Create this payment session?"
        description="The selected NFC sticker will open this payment session for the customer."
        confirmLabel="Create Session"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handleCreateSession}
      >
        <div className="rounded-control border border-border bg-bg-soft p-3 text-[12px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted">Amount</span>
            <span className="num font-extrabold text-text">{amounts[currency]}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted">Sticker</span>
            <span className="truncate font-bold text-text">{selectedSticker}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-muted">Description</span>
            <span className="truncate font-bold text-text">{description || d.description}</span>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
