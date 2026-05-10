export { PulseLogo } from "@pulse/ui";


export function ChevronLeft({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function ChevronRight({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 14, strokeWidth = 3 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function CrossIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="11" width="16" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function CopyIcon({ size = 9 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

export function WalletGlyph({ size = 60 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="16" y="6" width="32" height="52" rx="6" />
      <path d="M16 14h32M16 50h32" />
      <circle cx="32" cy="54" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function SolanaTokenGlyph({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 397 311" fill="none" aria-hidden>
      <defs>
        <linearGradient id="sol-glyph-grad" x1="0" x2="397" y1="0" y2="311">
          <stop offset="0" stopColor="#00FFA3" />
          <stop offset="1" stopColor="#DC1FFF" />
        </linearGradient>
      </defs>
      <path d="M64 207 L333 207 L333 270 L64 270 Z" fill="url(#sol-glyph-grad)" transform="skewX(-18) translate(35,0)" />
      <path d="M64 105 L333 105 L333 168 L64 168 Z" fill="url(#sol-glyph-grad)" transform="skewX(18) translate(-35,0)" />
      <path d="M64 4 L333 4 L333 67 L64 67 Z" fill="url(#sol-glyph-grad)" transform="skewX(-18) translate(35,0)" />
    </svg>
  );
}

export function SolanaStripeMark({ size = 14 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #9945FF, #14F195)",
      }}
    />
  );
}
