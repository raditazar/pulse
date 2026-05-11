"use client";

import { useState } from "react";
import { NfcTile } from "@/components/dashboard/NfcTile";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, PanelHeading } from "@/components/dashboard/primitives";
import { cashierNfc, type NfcTile as NfcTileT } from "@/lib/mock-data";

export default function NfcStickersPage() {
  const [chip, setChip] = useState<NfcTileT>(cashierNfc);
  const [notice, setNotice] = useState("Cashier NFC is ready for payment sessions.");

  const handleCopy = async () => {
    await navigator.clipboard?.writeText(chip.id);
    setNotice(`Cashier NFC ${chip.id} copied.`);
  };

  void setChip;

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
          <NfcTile tile={chip} onCopy={handleCopy} />
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
