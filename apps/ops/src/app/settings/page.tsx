"use client";

import { useState } from "react";
import { MerchantReceivingWalletField } from "@/components/dashboard/MerchantWalletField";
import { MerchantWalletPanel } from "@/components/dashboard/MerchantWalletPanel";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  CtaButton,
  FieldLabel,
  Panel,
  PanelHeading,
  SelectDropdown,
} from "@/components/dashboard/primitives";
import { merchant } from "@/lib/mock-data";

const timezones = [
  "Asia/Jakarta (GMT+7)",
  "Asia/Makassar (GMT+8)",
  "Asia/Jayapura (GMT+9)",
  "Asia/Singapore (GMT+8)",
  "Asia/Kuala_Lumpur (GMT+8)",
  "Asia/Bangkok (GMT+7)",
  "Asia/Ho_Chi_Minh (GMT+7)",
  "Asia/Manila (GMT+8)",
  "Asia/Tokyo (GMT+9)",
  "Asia/Seoul (GMT+9)",
  "Asia/Dubai (GMT+4)",
  "Europe/London (GMT+0/+1)",
  "Europe/Paris (GMT+1/+2)",
  "America/New_York (GMT-5/-4)",
  "America/Los_Angeles (GMT-8/-7)",
  "Australia/Sydney (GMT+10/+11)",
  "UTC",
];

export default function SettingsPage() {
  const [merchantName, setMerchantName] = useState(merchant.name);
  const [location, setLocation] = useState(merchant.location);
  const [timezone, setTimezone] = useState(merchant.timezone);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("No unsaved changes.");

  const handleSave = () => {
    setSaveStatus(`Saved ${merchantName} settings for ${timezone}.`);
  };

  const handleProfilePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfilePhoto(URL.createObjectURL(file));
    setSaveStatus("Unsaved changes.");
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Merchant Settings"
        subtitle="Manage merchant information and the receiving wallet."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel>
          <PanelHeading title="Merchant Profile" sub="This information is shown to customers during checkout." />

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Profile Photo</FieldLabel>
              <div className="flex flex-wrap items-center gap-3 rounded-[10px] border border-border bg-bg px-3 py-3">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-[12px] bg-lavender text-[24px]">
                  {profilePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePhoto}
                      alt={`${merchantName} profile`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 28 28"
                      fill="none"
                      aria-hidden="true"
                      className="text-purple"
                    >
                      <circle cx="14" cy="9.5" r="4.5" fill="currentColor" opacity="0.9" />
                      <path
                        d="M5.5 24c.9-4.3 4-7 8.5-7s7.6 2.7 8.5 7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  )}
                </div>
                <label className="focus-ring inline-flex cursor-pointer items-center justify-center rounded-[10px] border border-border bg-surface px-3 py-2 text-[12px] font-bold text-text hover:text-purple">
                  Upload Profile Photo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoChange}
                    className="sr-only"
                  />
                </label>
                {profilePhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfilePhoto(null);
                      setSaveStatus("Unsaved changes.");
                    }}
                    className="focus-ring rounded-[8px] px-2 py-1.5 text-[11px] font-semibold text-muted hover:text-text"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Merchant Name</FieldLabel>
              <input
                value={merchantName}
                onChange={(event) => {
                  setMerchantName(event.target.value);
                  setSaveStatus("Unsaved changes.");
                }}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[12px] font-semibold text-text outline-none focus:border-purple"
                aria-label="Merchant name"
              />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Receiving Wallet (Solana)</FieldLabel>
              <MerchantReceivingWalletField fallback={merchant.wallet} />
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Location</FieldLabel>
              <input
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setSaveStatus("Unsaved changes.");
                }}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[12px] font-semibold text-text outline-none focus:border-purple"
                aria-label="Merchant location"
              />
            </div>

            <div>
              <FieldLabel>Time Zone</FieldLabel>
              <SelectDropdown
                value={timezone}
                onChange={(nextTimezone) => {
                  setTimezone(nextTimezone);
                  setSaveStatus("Unsaved changes.");
                }}
                ariaLabel="Merchant time zone"
                options={timezones.map((item) => ({ value: item, label: item }))}
              />
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] font-semibold text-muted">{saveStatus}</div>
            <CtaButton className="sm:max-w-[220px]" onClick={handleSave}>
              Save Changes
            </CtaButton>
          </div>
        </Panel>

        <div className="flex h-full flex-col gap-5">
          <Panel className="bg-bg-soft">
            <PanelHeading title="Wallet Access" sub="Email login and external Solana wallets are supported." />
            <MerchantWalletPanel />
          </Panel>

          <Panel className="flex-1 bg-bg-soft">
            <PanelHeading title="Security Tips" sub="Pulse never holds merchant funds." />
            <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
              <li>• Make sure the receiving wallet is owned by the merchant entity.</li>
              <li>• Keep the time zone aligned with the outlet location for accurate reports.</li>
              <li>• Every change is recorded in the on-chain audit log.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
