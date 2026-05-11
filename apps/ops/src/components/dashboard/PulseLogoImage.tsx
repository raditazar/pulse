export function PulseLogoImage({ size = 40 }: { size?: number }) {
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
