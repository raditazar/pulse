import type { ReactNode } from "react";
import { SolanaStripeMark } from "./icons";

export function CheckoutShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-bg">
      <AppHeader />
      <div className="flex flex-1 items-stretch justify-center px-0 sm:items-start sm:px-6 sm:py-10">
        <section className="flex w-full flex-1 flex-col bg-surface sm:max-w-[460px] sm:flex-none sm:rounded-card sm:border sm:border-border sm:panel-shadow">
          <div className="flex flex-1 flex-col px-5 pb-7 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
            {children}
          </div>
        </section>
      </div>
      <AppFooter />
    </div>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-5 py-3 backdrop-blur sm:px-8">
      <div className="flex items-center gap-2 text-[14px] font-extrabold tracking-[0.06em] text-text">
        <span
          className="grid h-7 w-7 place-items-center rounded-[8px] text-[13px] font-extrabold text-white"
          style={{ background: "linear-gradient(135deg, #9945FF, #C77DFF)" }}
        >
          P
        </span>
        PULSE
      </div>
      <div className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
        <SolanaStripeMark size={8} />
        <span>Solana Mainnet</span>
      </div>
    </header>
  );
}

function AppFooter() {
  return (
    <footer className="border-t border-border bg-bg px-5 py-3 text-center text-[11px] text-muted sm:px-8">
      Payments run directly on Solana · Pulse never stores funds or seed phrases.
    </footer>
  );
}
