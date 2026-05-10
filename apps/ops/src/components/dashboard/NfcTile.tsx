import { NfcIcon } from "./icons";
import { ChipVariant } from "./primitives";
import type { NfcTile as NfcTileT } from "@/lib/mock-data";

const dotColor: Record<NfcTileT["lastTapTone"], string> = {
  success: "var(--color-success)",
  warn: "var(--color-warn)",
  muted: "var(--color-muted)",
};

const lastColor: Record<NfcTileT["lastTapTone"], string> = {
  success: "var(--color-muted)",
  warn: "var(--color-warn)",
  muted: "var(--color-muted)",
};

export function NfcTile({
  tile,
  onToggle,
  onCopy,
}: {
  tile: NfcTileT;
  onToggle?: () => void;
  onCopy?: () => void;
}) {
  return <InteractiveNfcTile tile={tile} onToggle={onToggle} onCopy={onCopy} />;
}

export function InteractiveNfcTile({
  tile,
  onToggle,
  onCopy,
}: {
  tile: NfcTileT;
  onToggle?: () => void;
  onCopy?: () => void;
}) {
  const inactive = tile.status === "inactive";
  return (
    <div className="flex items-start gap-3 rounded-[12px] border border-border bg-surface p-2.5">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px]"
        style={{
          background: inactive ? "var(--color-bg)" : "var(--color-lavender)",
          color: inactive ? "var(--color-muted)" : "var(--color-purple)",
        }}
      >
        <NfcIcon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-[12px] font-bold text-text">{tile.name}</div>
            <div className="mt-0.5 text-[10px] text-muted">Merchant: {tile.merchant}</div>
          </div>
          {inactive ? (
            <ChipVariant variant="muted">Inactive</ChipVariant>
          ) : (
            <ChipVariant variant="success">Active</ChipVariant>
          )}
        </div>
        <div
          className="mt-1.5 flex items-center gap-1.5 text-[9px]"
          style={{ color: lastColor[tile.lastTapTone] }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dotColor[tile.lastTapTone] }}
          />
          {tile.lastTap}
        </div>
        {(onToggle || onCopy) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="focus-ring rounded-[7px] border border-border bg-bg-soft px-2 py-1 text-[9px] font-bold text-text hover:text-purple"
              >
                {inactive ? "Activate" : "Disable"}
              </button>
            )}
            {onCopy && (
              <button
                type="button"
                onClick={onCopy}
                className="focus-ring rounded-[7px] border border-border bg-bg-soft px-2 py-1 text-[9px] font-bold text-muted hover:text-text"
              >
                Copy ID
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
