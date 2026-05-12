"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConnectWallet, useLogin, usePrivy } from "@privy-io/react-auth";
import {
  useCreateWallet as useCreateSolanaWallet,
  useWallets as useSolanaWallets,
} from "@privy-io/react-auth/solana";
import gsap from "gsap";
import { SegmentedToggle } from "@pulse/ui";
import { merchantPrivyAppId } from "@/components/dashboard/PrivyProvider";
import { PulseLogoImage } from "@/components/dashboard/PulseLogoImage";
import { createMerchant, getMerchantMe } from "@/lib/api";
import { getPreferredSolanaWallet } from "@/lib/solana-wallet";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function PhantomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 128 128" aria-hidden fill="none">
      <rect width="128" height="128" rx="30" fill="#AB9FF2" />
      <path
        d="M110.584 64.9142H99.142C99.142 41.8335 80.5724 23 57.7653 23C35.2765 23 17 41.4488 17 64.3085C17 86.8102 34.5794 105 56.7239 105H62.5494C83.1807 105 110.584 87.0938 110.584 64.9142Z"
        fill="white"
      />
      <ellipse cx="80.4622" cy="59.4762" rx="6.52463" ry="6.60235" fill="#AB9FF2" />
      <ellipse cx="55.4622" cy="59.4762" rx="6.52463" ry="6.60235" fill="#AB9FF2" />
    </svg>
  );
}

type Tab = "login" | "register";

export default function MerchantAuthPage() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const { wallets, ready: walletsReady } = useSolanaWallets();
  const wallet = getPreferredSolanaWallet(wallets);
  const pageTransitionRef = useRef<HTMLDivElement>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const authPanelRef = useRef<HTMLDivElement>(null);
  const tabDirectionRef = useRef(1);
  const authModeRef = useRef<Tab>("login");
  const [tab, setTab] = useState<Tab>("login");
  const [merchantName, setMerchantName] = useState("");
  const [businessType, setBusinessType] = useState("Retail");
  const [email, setEmail] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [registerStep, setRegisterStep] = useState<"info" | "auth">("info");
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function resolveMerchantAccess() {
      if (!ready || !authenticated || !walletsReady) return;

      if (!wallet?.address) {
        setAuthStatusMessage("Preparing your Solana wallet...");
        return;
      }

      try {
        if (authModeRef.current === "register") {
          if (registerStep !== "auth") return;

          setAuthStatusMessage("Creating your merchant account...");
          await createMerchant({
            privyUserId: user!.id,
            authority: wallet.address,
            email: email.trim() || undefined,
            businessType: businessType || undefined,
            primaryBeneficiary: wallet.address,
            splitBasisPoints: 1000,
            name: merchantName.trim() || "Pulse Merchant",
            metadataUri: `pulse://merchant/${wallet.address}`,
            splitBeneficiaries: [],
          });
          if (!cancelled) router.replace("/dashboard");
          return;
        }

        setAuthStatusMessage("Checking your merchant account...");
        const merchant = await getMerchantMe({
          privyUserId: user?.id,
          wallet: wallet.address,
        });
        if (cancelled) return;

        if (merchant) {
          router.replace("/dashboard");
        } else {
          setAuthStatusMessage(
            "No merchant account is registered for this wallet yet. Use Register to create one."
          );
        }
      } catch (error) {
        if (cancelled) return;
        setAuthStatusMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify your merchant account."
        );
      }
    }

    resolveMerchantAccess();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, walletsReady, wallet?.address, user?.id, merchantName, email, businessType, registerStep, router]);

  useLayoutEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      gsap.set(pageTransitionRef.current, { autoAlpha: 0, display: "none" });
      gsap.set(pageContentRef.current, { autoAlpha: 1, y: 0 });
      return;
    }

    const revealLogin = () => {
      gsap.set(pageTransitionRef.current, { autoAlpha: 0, display: "none" });
      gsap.set(pageContentRef.current, { autoAlpha: 1, y: 0 });
    };

    const fallback = window.setTimeout(revealLogin, 1400);

    const ctx = gsap.context(() => {
      gsap.set(pageContentRef.current, { autoAlpha: 0, y: 10 });
      gsap.set(pageTransitionRef.current, {
        autoAlpha: 1,
        display: "block",
        scale: 1,
        filter: "blur(0px) contrast(1.35)",
      });
      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          onComplete: revealLogin,
        })
        .to(pageTransitionRef.current, {
          autoAlpha: 0,
          scale: 1.04,
          filter: "blur(10px) contrast(1)",
          duration: 0.9,
        })
        .to(
          pageContentRef.current,
          {
            autoAlpha: 1,
            y: 0,
            duration: 0.42,
          },
          "-=0.42"
        );
    });

    return () => {
      window.clearTimeout(fallback);
      ctx.revert();
      revealLogin();
    };
  }, []);

  useLayoutEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      if (cardRef.current) {
        cardRef.current.style.height = "";
        cardRef.current.style.overflow = "";
      }
      return;
    }

    if (cardRef.current && cardRef.current.style.height) {
      const card = cardRef.current;
      const startHeight = card.offsetHeight;
      card.style.height = "auto";
      const targetHeight = card.offsetHeight;
      card.style.height = `${startHeight}px`;
      card.offsetHeight;

      gsap.to(cardRef.current, {
        height: targetHeight,
        duration: 0.42,
        ease: "power3.out",
        onComplete: () => {
          if (!cardRef.current) return;
          cardRef.current.style.height = "";
          cardRef.current.style.overflow = "";
        },
      });
    }

    if (authPanelRef.current) {
      gsap.fromTo(
        authPanelRef.current,
        {
          autoAlpha: 0,
          x: tabDirectionRef.current * 14,
          filter: "blur(3px)",
        },
        {
          autoAlpha: 1,
          x: 0,
          filter: "blur(0px)",
          duration: 0.34,
          ease: "power3.out",
        }
      );
    }
  }, [tab, registerStep]);

  const { login } = useLogin();
  const { connectWallet } = useConnectWallet();
  const { createWallet: createSolanaWallet } = useCreateSolanaWallet();

  const switchTab = (nextTab: Tab) => {
    if (nextTab === tab) return;
    prepareCardResize();
    tabDirectionRef.current = nextTab === "register" ? 1 : -1;
    authModeRef.current = nextTab;
    setAuthStatusMessage(null);
    setTab(nextTab);
    setRegisterStep("info");
  };

  const prepareCardResize = () => {
    if (!cardRef.current) return;
    gsap.killTweensOf(cardRef.current);
    cardRef.current.style.height = `${cardRef.current.offsetHeight}px`;
    cardRef.current.style.overflow = "hidden";
  };

  const ensureSolanaWalletForAuthenticatedUser = async () => {
    if (!authenticated || wallet?.address) return;

    setAuthStatusMessage("Creating your Solana wallet...");
    try {
      await createSolanaWallet();
      setAuthStatusMessage("Preparing your Solana wallet...");
    } catch (error) {
      setAuthStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to create your Solana wallet."
      );
    }
  };

  const handleLoginEmail = async () => {
    authModeRef.current = tab;
    setAuthStatusMessage(null);
    if (authenticated) {
      await ensureSolanaWalletForAuthenticatedUser();
      return;
    }
    login({ loginMethods: ["email"], walletChainType: "solana-only" });
  };

  const handleLoginGoogle = async () => {
    authModeRef.current = tab;
    setAuthStatusMessage(null);
    if (authenticated) {
      await ensureSolanaWalletForAuthenticatedUser();
      return;
    }
    login({ loginMethods: ["google"], walletChainType: "solana-only" });
  };

  const handleLoginWallet = () => {
    authModeRef.current = tab;
    setAuthStatusMessage(null);
    if (authenticated) {
      connectWallet({ walletChainType: "solana-only" });
      return;
    }
    login({ loginMethods: ["wallet"], walletChainType: "solana-only" });
  };

  const handleRegisterNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName.trim()) return;
    prepareCardResize();
    tabDirectionRef.current = 1;
    authModeRef.current = "register";
    setAuthStatusMessage(null);
    setRegisterStep("auth");
  };

  if (!merchantPrivyAppId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg px-4">
        <div className="w-full max-w-[400px] rounded-[20px] border border-border bg-surface p-6 text-center shadow-[0_24px_60px_-34px_rgba(15,23,42,0.18)]">
          <div className="mb-3 flex justify-center">
            <PulseLogoImage size={36} />
          </div>
          <div className="text-[13px] font-semibold text-text">Setup Required</div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">
            Set <span className="font-bold text-text">NEXT_PUBLIC_PRIVY_MERCHANT_APP_ID</span> in{" "}
            <span className="font-mono text-[11px]">.env.local</span> to enable merchant auth.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="shimmer h-5 w-20 rounded-pill" />
      </div>
    );
  }

  const businessTypes = ["Retail", "F&B / Restaurant", "Services", "Market / Bazaar", "Online Store", "Other"];

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div
        ref={pageTransitionRef}
        className="pointer-events-none fixed inset-0 z-50 bg-[#050506]"
        style={{
          opacity: 0,
          visibility: "hidden",
          backgroundImage:
            "radial-gradient(circle at 18% 24%, rgba(255,255,255,0.26) 0 1px, transparent 1.5px), radial-gradient(circle at 72% 18%, rgba(255,255,255,0.2) 0 1px, transparent 1.5px), radial-gradient(circle at 36% 76%, rgba(255,255,255,0.18) 0 1px, transparent 1.5px), radial-gradient(circle at 84% 68%, rgba(255,255,255,0.24) 0 1px, transparent 1.5px)",
          backgroundSize: "18px 18px, 23px 23px, 29px 29px, 35px 35px",
        }}
        aria-hidden="true"
      />

      <div ref={pageContentRef} className="w-full max-w-[420px]">
        {/* Branding */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center">
            <PulseLogoImage size={56} />
          </div>
          <div>
            <div className="text-[22px] font-extrabold tracking-tight text-text">Pulse Ops</div>
            <div className="mt-1 text-[12px] text-muted">
              {tab === "login" ? "Sign in to your merchant account." : "Create your merchant account."}
            </div>
          </div>
        </div>

        {/* Card */}
        <div
          ref={cardRef}
          className="card-rise-in rounded-[20px] border border-border bg-surface p-6 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.14)]"
        >
          {/* Tab switcher */}
          <div className="mb-6">
            <SegmentedToggle<Tab>
              options={[
                { value: "login", label: "Login" },
                { value: "register", label: "Register" },
              ]}
              value={tab}
              onChange={switchTab}
              className="w-full"
            />
          </div>

          <div ref={authPanelRef}>
            {/* LOGIN TAB */}
            {tab === "login" && (
              <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleLoginEmail}
                className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m2 7 10 7 10-7" />
                </svg>
                Sign in with Email
              </button>

              <button
                type="button"
                onClick={handleLoginGoogle}
                className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
              >
                <GoogleIcon />
                Sign in with Google
              </button>

              <div className="relative my-1 flex items-center gap-3">
                <div className="flex-1 border-t border-border" />
                <span className="text-[11px] font-semibold text-dim">or</span>
                <div className="flex-1 border-t border-border" />
              </div>

              <button
                type="button"
                onClick={handleLoginWallet}
                className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
              >
                <PhantomIcon />
                Connect Solana Wallet
              </button>

              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchTab("register")}
                  className="font-bold text-purple hover:underline"
                >
                  Register now
                </button>
              </p>
              </div>
            )}

            {/* REGISTER TAB */}
            {tab === "register" && (
              <div>
              {registerStep === "info" ? (
                <form onSubmit={handleRegisterNext} className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-muted">
                      Merchant Name <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      placeholder="e.g. Corner Market"
                      required
                      className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[13px] font-semibold text-text outline-none placeholder:font-normal placeholder:text-dim focus:border-purple"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-muted">
                      Business Type
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {businessTypes.map((bt) => (
                        <button
                          key={bt}
                          type="button"
                          onClick={() => setBusinessType(bt)}
                          className={`focus-ring rounded-pill border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                            businessType === bt
                              ? "border-purple/30 bg-lavender text-purple"
                              : "border-border bg-bg text-muted hover:text-text"
                          }`}
                        >
                          {bt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-muted">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@business.com"
                      className="w-full rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[13px] font-semibold text-text outline-none placeholder:font-normal placeholder:text-dim focus:border-purple"
                    />
                  </div>

                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={agreedToTerms}
                      onClick={() => setAgreedToTerms((v) => !v)}
                      className={`focus-ring mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-all ${
                        agreedToTerms
                          ? "border-purple bg-purple text-white"
                          : "border-border bg-bg"
                      }`}
                    >
                      {agreedToTerms && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
                          <path d="M2 5.5l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span className="text-[11px] leading-relaxed text-muted">
                      I agree to Pulse&apos;s{" "}
                      <span className="font-semibold text-text">Terms & Conditions</span> and{" "}
                      <span className="font-semibold text-text">Privacy Policy</span>.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={!merchantName.trim() || !agreedToTerms}
                    className="focus-ring mt-1 flex w-full items-center justify-center rounded-[10px] px-4 py-3 text-[13px] font-bold text-white transition-opacity hover:opacity-95 active:opacity-90 disabled:opacity-40"
                    style={{
                      background: "linear-gradient(90deg, #9945FF, #B871FF)",
                      boxShadow: "0 6px 18px -8px rgba(153,69,255,0.5)",
                    }}
                  >
                    Continue - Connect Wallet
                  </button>

                  <p className="text-center text-[11px] text-muted">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => switchTab("login")}
                      className="font-bold text-purple hover:underline"
                    >
                      Sign in
                    </button>
                  </p>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="mb-1 rounded-[10px] border border-border bg-bg px-3 py-2.5">
                    <div className="text-[10px] font-semibold text-muted">Merchant Name</div>
                    <div className="mt-0.5 text-[13px] font-bold text-text">{merchantName}</div>
                    <div className="mt-0.5 text-[11px] text-muted">{businessType}</div>
                  </div>

                  <p className="text-[12px] leading-relaxed text-muted">
                    Finish registration by connecting your email or Solana wallet.
                  </p>

                  <button
                    type="button"
                    onClick={handleLoginEmail}
                    className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m2 7 10 7 10-7" />
                    </svg>
                    Register with Email
                  </button>

                  <button
                    type="button"
                    onClick={handleLoginGoogle}
                    className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
                  >
                    <GoogleIcon />
                    Register with Google
                  </button>

                  <div className="relative my-1 flex items-center gap-3">
                    <div className="flex-1 border-t border-border" />
                    <span className="text-[11px] font-semibold text-dim">or</span>
                    <div className="flex-1 border-t border-border" />
                  </div>

                  <button
                    type="button"
                    onClick={handleLoginWallet}
                    className="focus-ring flex w-full items-center gap-3 rounded-[10px] border border-border bg-bg px-4 py-3 text-[13px] font-semibold text-text transition-all hover:border-purple/40 hover:bg-surface"
                  >
                    <PhantomIcon />
                    Connect Solana Wallet
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      prepareCardResize();
                      tabDirectionRef.current = -1;
                      setRegisterStep("info");
                    }}
                    className="focus-ring rounded-[8px] py-1.5 text-[11px] font-semibold text-muted hover:text-text"
                  >
                    Back
                  </button>
                </div>
              )}
              </div>
            )}
          </div>

          {authStatusMessage && (
            <div className="mt-4 rounded-[10px] border border-border bg-bg px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-muted">
              {authStatusMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-dim">
          Pulse Ops — Settlement command center &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
