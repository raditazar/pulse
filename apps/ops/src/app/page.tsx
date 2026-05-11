"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ── Pulse design tokens (from pulse-uiux SKILL.md) ── */
const C = {
  bg:            "#050506",
  bgSoft:        "#111113",
  surface:       "#1a1a1d",
  surfaceRaised: "#242428",
  text:          "#f4f2f8",
  muted:         "#a8a2b3",
  purple:        "#9945ff",
  green:         "#14f195",
  cyan:          "#03e1ff",
  border:        "rgba(255,255,255,0.10)",
  borderSoft:    "rgba(255,255,255,0.06)",
} as const;

const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* ─────────────────────────────────
   ATOMS
───────────────────────────────── */

function Eyebrow({
  children,
  color = C.purple,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[10px] font-semibold uppercase tracking-[0.18em]"
      style={{ border: `1px solid ${color}28`, background: `${color}10`, color }}
    >
      {children}
    </span>
  );
}

function BtnPrimary({
  href,
  children,
  onClick,
}: {
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    "group inline-flex items-center gap-2.5 rounded-full py-[9px] pl-[18px] pr-[9px] text-[13px] font-bold text-white transition-opacity duration-100 hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050506]";
  const style = {
    background: "linear-gradient(135deg, #9945FF 0%, #14F195 100%)",
    boxShadow: "0 4px 20px -8px rgba(153,69,255,0.55)",
  };
  const arrow = (
    <span
      className="grid h-7 w-7 place-items-center rounded-full bg-black/20 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-px"
      aria-hidden
    >
      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
        <path
          d="M2.5 11.5L11.5 2.5M11.5 2.5H5.5M11.5 2.5V8.5"
          stroke="white"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {children}
        {arrow}
      </button>
    );
  return (
    <Link href={href!} className={cls} style={style}>
      {children}
      {arrow}
    </Link>
  );
}

function BtnGhost({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-[42px] items-center rounded-full px-5 text-[13px] font-semibold transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945ff]"
      style={{
        border: `1px solid ${C.border}`,
        background: "rgba(255,255,255,0.03)",
        color: C.muted,
      }}
    >
      {children}
    </Link>
  );
}

function LogoImage({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/pulse-logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/* ─────────────────────────────────
   PAYMENT TERMINAL (hero right)
───────────────────────────────── */

function PaymentTerminal() {
  const [phase, setPhase] = useState<"idle" | "tap" | "confirm">("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const cycle = () => {
      setPhase("tap");
      const t1 = setTimeout(() => setPhase("confirm"), 1200);
      const t2 = setTimeout(() => setPhase("idle"), 3400);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    };
    const cleanup = cycle();
    intervalRef.current = setInterval(() => {
      cleanup();
      cycle();
    }, 4800);
    return () => {
      cleanup();
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="relative flex flex-col items-center">
      {/* Terminal card */}
      <div
        className="w-full max-w-[300px]"
        style={{
          padding: "1.5px",
          borderRadius: 22,
          background: `linear-gradient(135deg, rgba(153,69,255,0.22) 0%, rgba(255,255,255,0.07) 60%)`,
          boxShadow:
            "0 0 0 1px rgba(153,69,255,0.1), 0 32px 64px -24px rgba(0,0,0,0.85)",
        }}
      >
        <div
          style={{
            background: C.bgSoft,
            borderRadius: "calc(22px - 1.5px)",
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LogoImage size={24} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Pulse Terminal</span>
            </div>
            <span
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: `${C.green}14`, color: C.green,
                borderRadius: 999, padding: "2px 8px",
                fontSize: 10, fontWeight: 600,
              }}
            >
              <span className="animate-pulse inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.green }} />
              Live
            </span>
          </div>

          {/* Amount */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginBottom: 4 }}>Active session</div>
            <div
              style={{
                fontFamily: "var(--font-mono)", fontSize: 44, fontWeight: 800,
                color: C.text, lineHeight: 1, letterSpacing: "-0.02em",
              }}
            >
              25<span style={{ fontSize: 28, color: C.muted }}>.00</span>
            </div>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, marginTop: 4 }}>USDC</div>
          </div>

          {/* NFC area */}
          <div
            style={{
              borderRadius: 14,
              padding: "20px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              background:
                phase === "tap"     ? `${C.purple}14` :
                phase === "confirm" ? `${C.green}10`  : C.surfaceRaised,
              border: `1px solid ${
                phase === "tap"     ? C.purple + "30" :
                phase === "confirm" ? C.green + "22"  : "rgba(255,255,255,0.07)"
              }`,
              transition: `all 500ms ${EASE}`,
            }}
          >
            {phase === "idle" && (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 5c5 4 5 10 0 14M9 8c3 2.4 3 5.6 0 8M13 11c1.5 1 1.5 1 0 2" />
                </svg>
                <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Waiting for tap...</span>
              </>
            )}
            {phase === "tap" && (
              <>
                <div
                  style={{
                    position: "relative", width: 40, height: 40,
                    display: "grid", placeItems: "center",
                    borderRadius: "50%", background: `${C.purple}20`, color: C.purple,
                  }}
                >
                  <div className="absolute inset-0 animate-ping rounded-full" style={{ background: `${C.purple}18` }} />
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 5c5 4 5 10 0 14M9 8c3 2.4 3 5.6 0 8M13 11c1.5 1 1.5 1 0 2" />
                  </svg>
                </div>
                <span style={{ fontSize: 11, color: C.purple, fontWeight: 600 }}>Tap detected</span>
              </>
            )}
            {phase === "confirm" && (
              <>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: `${C.green}18`, color: C.green,
                    display: "grid", placeItems: "center",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                </div>
                <span style={{ fontSize: 11, color: C.green, fontWeight: 700 }}>Payment confirmed</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: C.muted }}>
                  1.4s · Solana mainnet
                </span>
              </>
            )}
          </div>

          {/* Network bar */}
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: C.surfaceRaised, borderRadius: 10, padding: "8px 12px",
            }}
          >
            <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>Network</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: C.green, fontWeight: 600 }}>
              Solana · &lt;400ms
            </span>
          </div>
        </div>
      </div>

      {/* Floating receipt */}
      <div
        style={{
          position: "absolute", right: -16, top: -20,
          width: 120, borderRadius: 14, padding: 12,
          background: C.bgSoft,
          border: `1px solid ${C.border}`,
          boxShadow: "0 16px 40px -12px rgba(0,0,0,0.6)",
          opacity: phase === "confirm" ? 1 : 0,
          transform: `translateY(${phase === "confirm" ? 0 : 8}px) rotate(3deg)`,
          transition: `all 600ms ${EASE}`,
        }}
        aria-hidden
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>Digital Receipt</div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 800, color: C.green, margin: "6px 0 2px" }}>
          $25.00
        </div>
        <div style={{ fontSize: 8, color: C.muted }}>USDC · on-chain</div>
        <div style={{ height: 1, background: C.border, margin: "8px 0 6px" }} />
        <div style={{ fontSize: 8, fontWeight: 600, color: C.green }}>Settled</div>
      </div>

      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: "absolute", bottom: -24, left: "50%", transform: "translateX(-50%)",
          width: 240, height: 60, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 100%, rgba(153,69,255,0.18) 0%, transparent 70%)",
          filter: "blur(16px)",
        }}
      />
    </div>
  );
}

/* ─────────────────────────────────
   FEATURE DATA (typographic list)
───────────────────────────────── */

const FEATURES = [
  {
    n: "01",
    title: "Tap to pay. No app needed.",
    body: "An NFC sticker at your counter opens a checkout in the customer's browser. They review the amount, connect their Solana wallet, and approve. Nothing to install.",
    accent: C.purple,
  },
  {
    n: "02",
    title: "Settled in under 2 seconds.",
    body: "Funds land in your Solana wallet the moment the transaction confirms. No waiting period, no reconciliation, no intermediary holding your money.",
    accent: C.green,
  },
  {
    n: "03",
    title: "Your keys, your funds.",
    body: "Pulse never holds your money. Every transaction settles on-chain, directly to the wallet you control. Transparent, auditable, permanent.",
    accent: C.purple,
  },
  {
    n: "04",
    title: "Automatic revenue split.",
    body: "Set a split ratio once between merchant, location, and platform. Every payment divides itself in the same transaction. No spreadsheet, no manual calculation.",
    accent: C.cyan,
  },
];

const STEPS = [
  {
    n: "01",
    label: "Sign Up",
    title: "Create your account",
    body: "Sign up with email or a Solana wallet. Takes under 2 minutes.",
  },
  {
    n: "02",
    label: "Install",
    title: "Stick the NFC tag",
    body: "Tags arrive pre-configured. Stick it at your counter and it is active immediately.",
  },
  {
    n: "03",
    label: "Receive",
    title: "Create a session, get paid",
    body: "Set the amount in your dashboard. Customer taps, funds arrive.",
  },
];

/* ─────────────────────────────────
   PAGE
───────────────────────────────── */

export default function LandingPage() {
  const rootRef    = useRef<HTMLDivElement>(null);
  const navRef     = useRef<HTMLElement>(null);
  const heroLeftRef  = useRef<HTMLDivElement>(null);
  const heroRightRef = useRef<HTMLDivElement>(null);
  const featsRef   = useRef<HTMLDivElement>(null);
  const stepsRef   = useRef<HTMLDivElement>(null);
  const ctaRef     = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const ctx = gsap.context(() => {
      gsap.from(navRef.current, {
        opacity: 0, y: -12, duration: 0.5, ease: "power3.out", delay: 0.1,
      });
      gsap.from(heroLeftRef.current, {
        opacity: 0, x: -24, duration: 0.7, ease: EASE, delay: 0.25,
      });
      gsap.from(heroRightRef.current, {
        opacity: 0, x: 24, duration: 0.7, ease: EASE, delay: 0.4,
      });

      const featItems = featsRef.current?.querySelectorAll(".feat-row");
      if (featItems?.length) {
        gsap.from(featItems, {
          scrollTrigger: { trigger: featsRef.current, start: "top 78%" },
          opacity: 0, y: 18, duration: 0.55, stagger: 0.09, ease: EASE,
        });
      }

      const stepItems = stepsRef.current?.querySelectorAll(".step-item");
      if (stepItems?.length) {
        gsap.from(stepItems, {
          scrollTrigger: { trigger: stepsRef.current, start: "top 80%" },
          opacity: 0, x: -18, duration: 0.5, stagger: 0.11, ease: EASE,
        });
      }

      if (ctaRef.current) {
        gsap.from(ctaRef.current, {
          scrollTrigger: { trigger: ctaRef.current, start: "top 82%" },
          opacity: 0, y: 24, duration: 0.6, ease: EASE,
        });
      }
    }, rootRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    gsap.from(".menu-link", {
      opacity: 0, y: 18, duration: 0.38, stagger: 0.07, ease: EASE, delay: 0.05,
    });
  }, [menuOpen]);

  return (
    <div
      ref={rootRef}
      style={{
        background: C.bg,
        color: C.text,
        fontFamily: "var(--font-jakarta), sans-serif",
        overflowX: "hidden",
      }}
      className="min-h-[100dvh] antialiased selection:bg-[#9945ff]/20 selection:text-white"
    >
      {/* Grain overlay */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, zIndex: 60, pointerEvents: "none", opacity: 0.025,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          backgroundSize: "180px",
        }}
      />

      {/* ── NAV (floating island) ── */}
      <header ref={navRef} className="fixed left-0 right-0 top-5 z-40 flex justify-center px-4">
        <div
          className="flex w-full max-w-[900px] items-center justify-between rounded-full px-3 py-2 backdrop-blur-xl"
          style={{
            background: "rgba(5,5,6,0.82)",
            border: `1px solid ${C.border}`,
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945ff]"
          >
            <LogoImage size={28} />
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>
              Pulse
            </span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="Main navigation">
            {[
              { href: "#features", label: "Features" },
              { href: "#how", label: "How It Works" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[12px] font-semibold transition-colors duration-100 hover:text-white focus-visible:outline-none"
                style={{ color: C.muted }}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-[12px] font-semibold transition-colors duration-100 hover:text-white focus-visible:outline-none sm:inline-flex"
              style={{ color: C.muted }}
            >
              Sign In
            </Link>
            <BtnPrimary href="/login">Create Account</BtnPrimary>

            {/* Hamburger morph */}
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="ml-1 grid h-8 w-8 place-items-center rounded-full md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9945ff]"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <div className="relative h-3.5 w-[15px]">
                <span
                  className="absolute left-0 h-[1.5px] w-full rounded-full transition-transform duration-300"
                  style={{
                    top: menuOpen ? "50%" : "2px",
                    background: C.text,
                    transform: menuOpen ? "translateY(-50%) rotate(45deg)" : "none",
                    transitionTimingFunction: EASE,
                  }}
                />
                <span
                  className="absolute left-0 h-[1.5px] w-full rounded-full transition-transform duration-300"
                  style={{
                    bottom: menuOpen ? "50%" : "2px",
                    background: C.text,
                    transform: menuOpen ? "translateY(50%) rotate(-45deg)" : "none",
                    transitionTimingFunction: EASE,
                  }}
                />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile overlay menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 md:hidden"
          style={{ background: "rgba(5,5,6,0.97)", backdropFilter: "blur(24px)" }}
        >
          {[
            { href: "#features", label: "Features" },
            { href: "#how", label: "How It Works" },
            { href: "/login", label: "Sign In" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="menu-link text-[28px] font-extrabold tracking-tight transition-colors duration-100 hover:text-white focus-visible:outline-none"
              style={{ color: C.muted }}
            >
              {l.label}
            </a>
          ))}
          <div className="mt-4">
            <BtnPrimary href="/login" onClick={() => setMenuOpen(false)}>
              Create Account
            </BtnPrimary>
          </div>
        </div>
      )}

      {/* ── HERO (editorial split) ── */}
      <section className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 sm:px-8">
        {/* Ambient */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            style={{
              position: "absolute", top: "-8%", left: "50%", transform: "translateX(-50%)",
              width: 700, height: 500,
              background: "radial-gradient(ellipse at 50% 0%, rgba(153,69,255,0.15) 0%, transparent 65%)",
            }}
          />
          <div
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 400, height: 400,
              background: "radial-gradient(ellipse at 100% 100%, rgba(20,241,149,0.07) 0%, transparent 60%)",
            }}
          />
        </div>

        <div className="relative mx-auto grid w-full max-w-[960px] grid-cols-1 items-center justify-items-center gap-12 pb-16 pt-28 lg:grid-cols-[minmax(0,560px)_300px] lg:gap-16 lg:py-20">

          {/* LEFT — copy */}
          <div
            ref={heroLeftRef}
            className="flex w-full flex-col items-center gap-6 text-center lg:items-start lg:text-left"
            style={{ willChange: "transform" }}
          >
            <Eyebrow color={C.green}>
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: C.green, boxShadow: `0 0 5px ${C.green}`,
                  display: "inline-block",
                }}
              />
              Live on Solana · NFC · Non-Custodial
            </Eyebrow>

            <h1
              className="text-[44px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[56px] lg:text-[66px]"
              style={{ color: C.text }}
            >
              Accept crypto
              <br className="hidden lg:block" />
              payments{" "}
              <span style={{ color: C.purple }}>at your</span>
              <br className="hidden lg:block" />
              <span style={{ color: C.purple }}>counter.</span>
            </h1>

            <p
              className="max-w-[400px] text-[15px] leading-[1.8]"
              style={{ color: C.muted }}
            >
              Set an amount. Your customer taps an NFC sticker. Funds arrive
              in your Solana wallet in seconds, with no intermediary and no delay.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <BtnPrimary href="/login">Create Merchant Account</BtnPrimary>
              <BtnGhost href="/login">Sign In</BtnGhost>
            </div>

            <p className="text-[11px]" style={{ color: "rgba(168,162,179,0.55)" }}>
              Free to start · Non-custodial · Funds go directly to your wallet
            </p>
          </div>

          {/* RIGHT — live demo */}
          <div
            ref={heroRightRef}
            className="flex w-full justify-center"
            style={{ willChange: "transform" }}
          >
            <PaymentTerminal />
          </div>
        </div>
      </section>

      {/* ── FEATURES (typographic list, no card grid) ── */}
      <section
        id="features"
        className="px-4 py-24 sm:px-8"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        <div className="mx-auto max-w-[860px]">
          <div className="mb-14">
            <Eyebrow>Features</Eyebrow>
            <h2
              className="mt-5 text-[28px] font-extrabold tracking-[-0.02em] sm:text-[38px]"
              style={{ color: C.text }}
            >
              Everything your counter needs.
            </h2>
          </div>

          <div ref={featsRef}>
            {FEATURES.map((f, i) => (
              <div
                key={f.n}
                className="feat-row grid grid-cols-1 items-start gap-x-12 gap-y-3 py-8 sm:grid-cols-[88px_1fr]"
                style={{
                  borderTop: `1px solid ${i === 0 ? C.border : C.borderSoft}`,
                  borderBottom: i === FEATURES.length - 1 ? `1px solid ${C.borderSoft}` : "none",
                }}
              >
                <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-1 sm:pt-0.5">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11, fontWeight: 700, color: f.accent,
                    }}
                  >
                    {f.n}
                  </span>
                </div>
                <div>
                  <div className="text-[16px] font-bold" style={{ color: C.text }}>
                    {f.title}
                  </div>
                  <p
                    className="mt-2 text-[13px] leading-[1.8]"
                    style={{ color: C.muted, maxWidth: "54ch" }}
                  >
                    {f.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section
        id="how"
        className="px-4 py-24 sm:px-8"
        style={{
          background: C.bgSoft,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div className="mx-auto max-w-[780px]">
          <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow color={C.green}>How It Works</Eyebrow>
              <h2
                className="mt-5 text-[26px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]"
                style={{ color: C.text }}
              >
                Three steps.
                <br />
                That is it.
              </h2>
              <p
                className="mt-4 text-[13px] leading-relaxed"
                style={{ color: C.muted, maxWidth: "30ch" }}
              >
                From account to first payment, designed to run without
                technical friction.
              </p>
            </div>

            <div ref={stepsRef} className="flex flex-col">
              {STEPS.map((s, i) => (
                <div
                  key={s.n}
                  className="step-item grid grid-cols-[auto_1fr] gap-5 pb-10 last:pb-0"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div
                      style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "linear-gradient(135deg,#9945FF 0%,#14F195 100%)",
                        display: "grid", placeItems: "center",
                        fontSize: 12, fontWeight: 800, color: "white",
                        fontFamily: "var(--font-mono)",
                        boxShadow: "0 0 0 4px rgba(153,69,255,0.1)",
                        flexShrink: 0,
                      }}
                    >
                      {s.n}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        style={{
                          width: 1, flex: 1, minHeight: 28,
                          background:
                            "linear-gradient(to bottom, rgba(153,69,255,0.22) 0%, transparent 100%)",
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingTop: 10 }}>
                    <span
                      style={{
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.12em", textTransform: "uppercase",
                        color: C.purple,
                      }}
                    >
                      {s.label}
                    </span>
                    <div
                      className="mt-1 text-[16px] font-bold"
                      style={{ color: C.text }}
                    >
                      {s.title}
                    </div>
                    <p
                      className="mt-1.5 text-[13px] leading-[1.75]"
                      style={{ color: C.muted }}
                    >
                      {s.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-4 py-24 sm:px-8">
        <div className="mx-auto max-w-[580px]">
          <div ref={ctaRef}>
            <div
              style={{
                padding: "1.5px",
                borderRadius: 24,
                background:
                  "linear-gradient(135deg, rgba(153,69,255,0.28) 0%, rgba(255,255,255,0.07) 55%)",
                boxShadow: "0 0 0 1px rgba(153,69,255,0.08)",
              }}
            >
              <div
                style={{
                  background: C.bgSoft,
                  borderRadius: "calc(24px - 1.5px)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
                  position: "relative", overflow: "hidden",
                  padding: "60px 44px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", textAlign: "center", gap: 22,
                }}
              >
                {/* Internal orb */}
                <div
                  aria-hidden
                  style={{
                    position: "absolute", top: 0, left: "50%",
                    transform: "translateX(-50%)",
                    width: 320, height: 130, pointerEvents: "none",
                    background:
                      "radial-gradient(ellipse at 50% -10%, rgba(153,69,255,0.18) 0%, transparent 70%)",
                  }}
                />

                <Eyebrow>Ready to start?</Eyebrow>

                <h2
                  className="text-[24px] font-extrabold tracking-[-0.02em] sm:text-[32px]"
                  style={{ color: C.text }}
                >
                  Start accepting crypto today.
                </h2>

                <p
                  className="text-[13px] leading-[1.75]"
                  style={{ color: C.muted, maxWidth: "38ch" }}
                >
                  Sign up free, stick the NFC tag, and start accepting
                  payments directly to your wallet in minutes.
                </p>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <BtnPrimary href="/login">Create Merchant Account</BtnPrimary>
                  <BtnGhost href="/login">Sign In</BtnGhost>
                </div>

                <p style={{ fontSize: 11, color: "rgba(168,162,179,0.45)" }}>
                  Free · Non-custodial · Built on Solana
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer
        className="px-4 py-8 sm:px-8"
        style={{ borderTop: `1px solid ${C.border}` }}
      >
        <div className="mx-auto flex max-w-270 flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoImage size={22} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Pulse</span>
          </div>

          <p style={{ fontSize: 11, color: "rgba(168,162,179,0.45)" }}>
            &copy; {new Date().getFullYear()} Pulse · Built on Solana · Non-custodial
          </p>

          <div className="flex gap-5">
            {[
              { label: "Sign In", href: "/login" },
              { label: "Register", href: "/login" },
              { label: "Dashboard", href: "/dashboard" },
            ].map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-[11px] font-semibold transition-colors duration-100 hover:text-white focus-visible:outline-none"
                style={{ color: "rgba(168,162,179,0.45)" }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
