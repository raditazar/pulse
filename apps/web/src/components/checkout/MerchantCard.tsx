import { merchant } from "@/lib/mock-checkout";
import { VerifiedBadge } from "./ui";

export function MerchantCard() {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-4 text-center">
      <div className="flex justify-center">
        <VerifiedBadge />
      </div>
      <div className="mx-auto mt-3 grid h-11 w-11 place-items-center rounded-control bg-lavender text-xl">
        {merchant.emoji}
      </div>
      <div className="mt-2 text-[15px] font-bold text-text">{merchant.name}</div>
      <div className="mt-0.5 text-[12px] text-muted">{merchant.address}</div>
    </div>
  );
}
