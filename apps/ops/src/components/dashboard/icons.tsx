type IconProps = { size?: number; className?: string };

const stroke = (props: IconProps & { strokeWidth?: number }) => ({
  width: props.size ?? 18,
  height: props.size ?? 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: props.strokeWidth ?? 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: props.className,
  "aria-hidden": true,
});

export function HomeIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
export function PlusCircleIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}
export function NfcIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M5 5c5 4 5 10 0 14M9 8c3 2.4 3 5.6 0 8M13 11c1.5 1 1.5 1 0 2" />
    </svg>
  );
}
export function ActivityIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M3 12h4l3-9 4 18 3-9h4" />
    </svg>
  );
}
export function SettingsIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
export function LogoutIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M15 8l-4 4 4 4M11 12h10M21 4v16a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-4M10 8V4a2 2 0 0 1 2-2h7" />
    </svg>
  );
}
export function ChevronDown(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
export function MenuIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
export function CloseIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p, strokeWidth: 2 })}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
export function CopyIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
export function SearchIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
export function CheckIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p, strokeWidth: 2.4 })}>
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}
export function BoltSolidIcon(p: IconProps) {
  return (
    <svg
      width={p.size ?? 14}
      height={p.size ?? 14}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={p.className}
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}
export function ShieldIcon(p: IconProps) {
  return (
    <svg {...stroke({ ...p })}>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    </svg>
  );
}
