"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  HomeIcon,
  NfcIcon,
  PlusCircleIcon,
  SettingsIcon,
} from "./icons";
import { MerchantWalletPanel } from "./MerchantWalletPanel";
import { PulseLogoImage } from "./PulseLogoImage";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: HomeIcon },
  { href: "/dashboard/create-payment", label: "Create Payment", icon: PlusCircleIcon },
  { href: "/dashboard/nfc-stickers", label: "Cashier NFC", icon: NfcIcon },
  { href: "/dashboard/transactions", label: "Transactions", icon: ActivityIcon },
  { href: "/dashboard/settings", label: "Merchant Settings", icon: SettingsIcon },
];

export function Sidebar({
  variant = "rail",
  onNavigate,
}: {
  variant?: "rail" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const showLabel = variant === "drawer" || true;
  void showLabel;

  return (
    <nav
      className={
        variant === "drawer"
          ? "flex h-full w-full flex-col gap-1 bg-bg p-3"
          : "flex h-full w-full flex-col gap-1 bg-bg p-4"
      }
    >
      <div className="mb-4 flex items-center gap-2 px-2 text-[14px] font-extrabold tracking-[0.06em] text-text">
        <PulseLogoImage size={26} />
        PULSE
      </div>

      {NAV.map((item, index) => {
        const Active = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`nav-item-in focus-ring flex items-center gap-2 rounded-[8px] px-3 py-2.5 text-[12px] font-semibold transition duration-200 hover:translate-x-0.5 ${
              isActive
                ? "bg-surface text-purple panel-shadow"
                : "text-muted hover:text-text"
            }`}
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <Active size={14} />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-auto" />
      <MerchantWalletPanel compact />
    </nav>
  );
}
