import { ChevronDown, CopyIcon } from "@/components/dashboard/icons";
import { PageHeader } from "@/components/dashboard/PageHeader";
import {
  CtaButton,
  FieldLabel,
  Panel,
  PanelHeading,
  ReadonlyInput,
} from "@/components/dashboard/primitives";
import { merchant } from "@/lib/mock-data";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Merchant Settings"
        subtitle="Manage merchant information and the receiving wallet."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeading title="Merchant Profile" sub="This information is shown to customers during checkout." />

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldLabel>Merchant Name</FieldLabel>
              <ReadonlyInput>{merchant.name}</ReadonlyInput>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Receiving Wallet (Solana)</FieldLabel>
              <ReadonlyInput
                mono
                trailing={
                  <span className="text-muted">
                    <CopyIcon size={12} />
                  </span>
                }
              >
                {merchant.wallet}
              </ReadonlyInput>
            </div>

            <div className="sm:col-span-2">
              <FieldLabel>Location</FieldLabel>
              <ReadonlyInput>{merchant.location}</ReadonlyInput>
            </div>

            <div>
              <FieldLabel>Time Zone</FieldLabel>
              <ReadonlyInput
                trailing={
                  <span className="text-muted">
                    <ChevronDown size={12} />
                  </span>
                }
              >
                {merchant.timezone}
              </ReadonlyInput>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <CtaButton className="sm:max-w-[220px]">Save Changes</CtaButton>
          </div>
        </Panel>

        <Panel className="bg-bg-soft">
          <PanelHeading title="Security Tips" sub="Pulse never holds merchant funds." />
          <ul className="flex flex-col gap-2 text-[12px] leading-relaxed text-muted">
            <li>• Make sure the receiving wallet is owned by the merchant entity.</li>
            <li>• Keep the time zone aligned with the outlet location for accurate reports.</li>
            <li>• Every change is recorded in the on-chain audit log.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
