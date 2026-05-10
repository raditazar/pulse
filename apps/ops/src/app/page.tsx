"use client";

import { useState } from "react";
import { FooterCard } from "@/components/dashboard/FooterCard";
import { BoltSolidIcon, PulseSignalIcon, PulseStickerIcon } from "@/components/dashboard/icons";
import { DatePill, PageHeader } from "@/components/dashboard/PageHeader";
import { CurrencyToggle, Panel, PanelHeading } from "@/components/dashboard/primitives";
import { StatCard } from "@/components/dashboard/StatCard";
import { TxTable } from "@/components/dashboard/TxTable";
import { VolumeChart } from "@/components/dashboard/VolumeChart";
import { greeting, networkStatus, statsByCurrency, transactions, type DisplayCurrency } from "@/lib/mock-data";

const reportingDates = ["May 11, 2025", "May 10, 2025", "May 9, 2025"];

export default function OverviewPage() {
  const [currency, setCurrency] = useState<DisplayCurrency>("USD");
  const [date, setDate] = useState(greeting.date);
  const stats = statsByCurrency[currency];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title={`Good morning, ${greeting.name} 👋`}
        subtitle="Here is today's payment summary."
        trailing={
          <div className="flex flex-wrap items-center gap-2">
            <CurrencyToggle currency={currency} onChange={setCurrency} />
            <DatePill>
              <select
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="appearance-none bg-transparent font-semibold text-text outline-none"
                aria-label="Select reporting date"
              >
                {reportingDates.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </DatePill>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading
            title="Volume (Last 14 Days)"
            sub={`Total successful payments in ${currency}.`}
          />
          <VolumeChart currency={currency} />
        </Panel>

        <div className="flex flex-col gap-3">
          <FooterCard
            label="Status Network"
            value={networkStatus.network}
            hint={networkStatus.status}
            icon={<PulseSignalIcon size={20} />}
            tone="mint"
          />
          <FooterCard
            label="Average Confirmation"
            value={networkStatus.avgConfirmation}
            hint={networkStatus.speedLabel}
            hintTone="muted"
            icon={<BoltSolidIcon size={17} />}
            tone="pulse"
          />
          <FooterCard
            label="Active Stickers"
            value="3 / 4"
            hint="1 awaiting assignment"
            hintTone="muted"
            icon={<PulseStickerIcon size={18} />}
            tone="violet"
          />
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <PanelHeading title="Latest Transactions" sub="Last 5 payments today." />
          <DatePill>
            <select
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="appearance-none bg-transparent font-semibold text-text outline-none"
              aria-label="Select transactions date"
            >
              {reportingDates.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </DatePill>
        </div>
        <TxTable rows={transactions} currency={currency} />
      </Panel>
    </div>
  );
}
