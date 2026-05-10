"use client";

import { useState } from "react";
import { NfcTile } from "@/components/dashboard/NfcTile";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ConfirmDialog, FieldLabel, Panel, PanelHeading } from "@/components/dashboard/primitives";
import { nfcTiles, type NfcTile as NfcTileT } from "@/lib/mock-data";

export default function NfcStickersPage() {
  const [tiles, setTiles] = useState<NfcTileT[]>(nfcTiles);
  const [notice, setNotice] = useState("Ready to program stickers.");
  const [programOpen, setProgramOpen] = useState(false);
  const [stickerName, setStickerName] = useState(`Table ${nfcTiles.length + 1}`);

  const handleAddSticker = () => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const cleanName = stickerName.trim() || `Table ${tiles.length + 1}`;
    const nextTile: NfcTileT = {
      id,
      name: `${cleanName} (NFC #${id})`,
      merchant: "Kopi Kita",
      status: "inactive",
      lastTap: "New sticker",
      lastTapTone: "muted",
    };
    setTiles((current) => [...current, nextTile]);
    setNotice(`Sticker ${id} is ready to assign.`);
    setStickerName(`Table ${tiles.length + 2}`);
    setProgramOpen(false);
  };

  const handleToggle = (id: string) => {
    setTiles((current) =>
      current.map((tile) =>
        tile.id === id
          ? {
              ...tile,
              status: tile.status === "active" ? "inactive" : "active",
              lastTap: tile.status === "active" ? "Disabled" : "Active session",
              lastTapTone: tile.status === "active" ? "muted" : "success",
            }
          : tile,
      ),
    );
    setNotice(`Sticker ${id} updated.`);
  };

  const handleCopy = async (id: string) => {
    await navigator.clipboard?.writeText(id);
    setNotice(`Sticker ${id} copied.`);
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="NFC Stickers"
        subtitle="Manage and assign NFC stickers to merchants or tables."
      />

      <Panel>
        <PanelHeading
          title="Sticker List"
          sub={`${tiles.filter((t) => t.status === "active").length} active · ${tiles.length} total`}
        />
        <div className="mb-3 rounded-control border border-border bg-bg-soft px-3 py-2 text-[12px] font-semibold text-muted">
          {notice}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((t) => (
            <NfcTile
              key={t.id}
              tile={t}
              onToggle={() => handleToggle(t.id)}
              onCopy={() => handleCopy(t.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setProgramOpen(true)}
            className="focus-ring flex min-h-[88px] items-center justify-center gap-1.5 rounded-card border-[1.5px] border-dashed border-purple bg-lavender px-3 py-2.5 text-[13px] font-bold text-purple"
          >
            + Add / Program Sticker
          </button>
        </div>
      </Panel>

      <ConfirmDialog
        open={programOpen}
        title="Program a new NFC sticker"
        description="Name the sticker before it is added to this merchant workspace."
        confirmLabel="Program Sticker"
        onCancel={() => setProgramOpen(false)}
        onConfirm={handleAddSticker}
      >
        <FieldLabel>NFC name</FieldLabel>
        <input
          value={stickerName}
          onChange={(event) => setStickerName(event.target.value)}
          className="w-full rounded-control border border-border bg-bg-soft px-3.5 py-3 text-[13px] font-semibold text-text outline-none focus:border-purple"
          placeholder="Table 5"
          aria-label="NFC sticker name"
        />
      </ConfirmDialog>
    </div>
  );
}
