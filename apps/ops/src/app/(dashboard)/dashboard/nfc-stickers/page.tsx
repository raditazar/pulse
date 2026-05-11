"use client";

import { useCallback, useEffect, useState } from "react";
import { NfcTile, type DashboardNfcTile } from "@/components/dashboard/NfcTile";
import { useMerchant } from "@/components/dashboard/MerchantProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { CtaButton, Panel, PanelHeading, ReadonlyInput } from "@/components/dashboard/primitives";
import { createTerminal, getMerchantTerminals, type MerchantTerminal } from "@/lib/api";
import { mapTerminal } from "@/lib/dashboard-data";

export default function NfcStickersPage() {
  const { merchant } = useMerchant();
  const [chips, setChips] = useState<DashboardNfcTile[]>([]);
  const [terminals, setTerminals] = useState<MerchantTerminal[]>([]);
  const [notice, setNotice] = useState("Loading cashier NFC...");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const merchantRef = merchant?.id;

  const loadTerminals = useCallback(() => {
    if (!merchant || !merchantRef) return;

    let cancelled = false;
    setError(null);
    setNotice("Loading cashier NFC...");

    getMerchantTerminals(merchantRef)
      .then((nextTerminals) => {
        if (cancelled) return;
        setTerminals(nextTerminals);
        setChips(nextTerminals.map((terminal) => mapTerminal(terminal, merchant)));
        setNotice(
          nextTerminals.length > 0
            ? "Cashier NFC is synced with backend terminals."
            : "No cashier NFC yet. Create a payment session to generate the default terminal.",
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load cashier NFC");
        setNotice("Could not load cashier NFC.");
      });

    return () => {
      cancelled = true;
    };
  }, [merchant, merchantRef]);

  useEffect(() => {
    return loadTerminals();
  }, [loadTerminals]);

  const handleCopy = async (terminal: MerchantTerminal) => {
    await navigator.clipboard?.writeText(terminal.tapUrl);
    setNotice(`Tap URL for ${terminal.nfcCode} copied.`);
  };

  const handleAddNfc = async () => {
    if (!merchant) {
      setError("Merchant account not found. Please log in again.");
      return;
    }

    setIsAdding(true);
    setError(null);
    try {
      const terminal = await createTerminal({
        merchantId: merchant.id,
        label: "Cashier Counter",
        nfcCode: `cashier-${merchant.id}`,
      });
      setTerminals([terminal]);
      setChips([mapTerminal(terminal, merchant)]);
      setNotice("Permanent NFC link created. Write this link to the NFC chip once.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create cashier NFC");
      setNotice("Could not create cashier NFC.");
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Cashier NFC"
        subtitle="One merchant account uses one NFC chip at the cashier."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading
            title="Assigned Cashier Chip"
            sub="Every new payment session is linked to this single NFC chip."
          />
          <div className="mb-3 rounded-control border border-border bg-bg-soft px-3 py-2 text-[12px] font-semibold text-muted">
            {notice}
          </div>
          {error && (
            <div className="mb-3 rounded-control border border-border bg-bg-soft px-3 py-2 text-[12px] font-semibold text-muted">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {chips.length > 0 ? (
              chips.map((chip, index) => (
                <div key={chip.id} className="flex flex-col gap-2">
                  <NfcTile
                    tile={chip}
                    onCopy={() => handleCopy(terminals[index])}
                  />
                  <ReadonlyInput
                    mono
                    contentClassName="break-all leading-relaxed"
                    trailing={
                      <button
                        type="button"
                        onClick={() => handleCopy(terminals[index])}
                        className="focus-ring rounded-[7px] border border-border bg-surface px-2 py-1 text-[10px] font-bold text-purple"
                      >
                        Copy Link
                      </button>
                    }
                  >
                    {terminals[index]?.tapUrl ?? chip.id}
                  </ReadonlyInput>
                  <p className="text-[11px] leading-relaxed text-muted">
                    Write this permanent link to the NFC chip. New payment sessions will update the
                    destination behind this link, so the chip does not need to be rewritten.
                  </p>
                </div>
              ))
            ) : (
              <div className="flex flex-col gap-3 rounded-[12px] border border-border bg-surface p-4">
                <div>
                  <div className="text-[13px] font-bold text-text">No NFC link yet</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">
                    Add an NFC link first, then write the generated permanent link to the chip.
                  </p>
                </div>
                <CtaButton className="sm:max-w-[180px]" onClick={handleAddNfc} disabled={isAdding}>
                  {isAdding ? "Adding..." : "Add NFC"}
                </CtaButton>
              </div>
            )}
          </div>
        </Panel>

        <Panel className="bg-bg-soft">
          <PanelHeading title="Cashier Flow" sub="Designed for a simple counter checkout." />
          <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
            <li>ⓘ Cashier creates a payment amount in the dashboard.</li>
            <li>ⓘ Customer taps the cashier NFC chip.</li>
            <li>ⓘ The chip opens the latest active payment session.</li>
            <li>ⓘ Chip replacement is handled outside the cashier flow.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
