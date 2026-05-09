import { NfcTile } from "@/components/dashboard/NfcTile";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, PanelHeading } from "@/components/dashboard/primitives";
import { nfcTiles } from "@/lib/mock-data";

export default function NfcStickersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="NFC Stickers"
        subtitle="Manage and assign NFC stickers to merchants or tables."
      />

      <Panel>
        <PanelHeading
          title="Sticker List"
          sub={`${nfcTiles.filter((t) => t.status === "active").length} active · ${nfcTiles.length} total`}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {nfcTiles.map((t) => (
            <NfcTile key={t.id} tile={t} />
          ))}
          <button
            type="button"
            className="focus-ring flex min-h-[88px] items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-purple bg-lavender px-3 py-2.5 text-[13px] font-bold text-purple"
          >
            + Add / Program Sticker
          </button>
        </div>
      </Panel>
    </div>
  );
}
