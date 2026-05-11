"use client";

import { useState, type ReactNode } from "react";
import { PulseLogo } from "@pulse/ui";
import { CloseIcon, MenuIcon } from "./icons";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);

  const openDrawer = () => {
    setDrawerClosing(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (drawerClosing) return;
    setDrawerClosing(true);
    window.setTimeout(() => {
      setDrawerOpen(false);
      setDrawerClosing(false);
    }, 220);
  };

  return (
    <div className="flex min-h-dvh w-full">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[252px] shrink-0 border-r border-border lg:flex">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 text-[14px] font-extrabold tracking-[0.06em] text-text">
            <PulseLogo size={26} />
            PULSE
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={openDrawer}
            className="focus-ring grid h-9 w-9 place-items-center rounded-[8px] border border-border bg-surface text-text transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0"
          >
            <MenuIcon size={18} />
          </button>
        </header>

        <main className="page-rise-in min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className={`${drawerClosing ? "drawer-backdrop-out" : "drawer-backdrop-in"} absolute inset-0 bg-text/30 backdrop-blur-sm`}
            onClick={closeDrawer}
            aria-hidden
          />
          <div className={`${drawerClosing ? "drawer-sheet-out" : "drawer-sheet-in"} absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col border-r border-border bg-bg`}>
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeDrawer}
                className="focus-ring grid h-8 w-8 place-items-center rounded-[8px] text-muted transition-transform duration-200 hover:rotate-90 hover:text-text"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar variant="drawer" onNavigate={closeDrawer} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
