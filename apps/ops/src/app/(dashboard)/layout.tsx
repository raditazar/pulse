import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-text">
      <DashboardShell>{children}</DashboardShell>
    </div>
  );
}
