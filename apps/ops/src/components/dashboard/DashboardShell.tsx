"use client";

import { useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "./icons";
import { Sidebar } from "./Sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-dvh w-full">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[220px] shrink-0 border-r border-border lg:flex">
        <Sidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 text-[14px] font-extrabold tracking-[0.06em] text-text">
            <span
              className="grid h-6 w-6 place-items-center rounded-md text-[12px] font-extrabold text-white"
              style={{ background: "linear-gradient(135deg, #9945FF, #C77DFF)" }}
            >
              P
            </span>
            PULSE
          </div>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="focus-ring grid h-9 w-9 place-items-center rounded-[8px] border border-border bg-surface text-text"
          >
            <MenuIcon size={18} />
          </button>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">{children}</main>
      </div>

      {/* mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-text/30 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 flex w-[260px] max-w-[80vw] flex-col border-r border-border bg-bg">
            <div className="flex items-center justify-end px-2 pt-2">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="focus-ring grid h-8 w-8 place-items-center rounded-[8px] text-muted hover:text-text"
              >
                <CloseIcon size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar variant="drawer" onNavigate={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
