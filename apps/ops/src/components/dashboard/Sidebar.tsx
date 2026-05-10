"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PulseLogo } from "@pulse/ui";
import {
  ActivityIcon,
  HomeIcon,
  NfcIcon,
  PlusCircleIcon,
  SettingsIcon,
} from "./icons";
import { MerchantWalletPanel } from "./MerchantWalletPanel";

const NAV = [
  { href: "/", label: "Overview", icon: HomeIcon },
  { href: "/create-payment", label: "Create Payment", icon: PlusCircleIcon },
  { href: "/nfc-stickers", label: "NFC Stickers", icon: NfcIcon },
  { href: "/transactions", label: "Transactions", icon: ActivityIcon },
  { href: "/settings", label: "Merchant Settings", icon: SettingsIcon },
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
        <PulseLogo size={26} />
        PULSE
      </div>

      {NAV.map((item) => {
        const Active = item.icon;
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`focus-ring flex items-center gap-2 rounded-[8px] px-3 py-2.5 text-[12px] font-semibold transition-colors ${
              isActive
                ? "bg-surface text-purple panel-shadow"
                : "text-muted hover:text-text"
            }`}
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
