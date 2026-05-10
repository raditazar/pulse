import { merchant } from "@/lib/mock-checkout";
import { CheckIcon } from "./icons";

export function MerchantCard() {
  return (
    <div className="px-4 pb-11 pt-2 text-center text-white sm:pb-12">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-[18px] bg-white/18 text-2xl shadow-[0_12px_24px_-16px_rgba(15,23,42,0.55)] ring-1 ring-white/22 backdrop-blur">
        {merchant.emoji}
      </div>
      <div className="mt-3 inline-flex items-center justify-center gap-1.5 text-[18px] font-extrabold leading-tight">
        <span>{merchant.name}</span>
        <span
          aria-label="Verified merchant"
          className="grid h-5 w-5 place-items-center rounded-full bg-white text-purple"
          style={{
            boxShadow: "0 8px 18px -10px rgba(255,255,255,0.9)",
          }}
        >
          <CheckIcon size={12} strokeWidth={3.4} />
        </span>
      </div>
      <div className="mt-1 text-[12px] font-medium text-white/72">{merchant.address}</div>
    </div>
  );
}
