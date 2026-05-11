import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { MerchantProvider } from "@/components/dashboard/MerchantProvider";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <MerchantProvider>
        <DashboardShell>{children}</DashboardShell>
      </MerchantProvider>
    </div>
  );
}
