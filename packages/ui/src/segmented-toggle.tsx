import type { ReactNode } from "react";

type SegmentedToggleOption<T extends string> = {
  value: T;
  label?: ReactNode;
};

export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  options: readonly SegmentedToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  const segmentCount = Math.max(1, options.length);
  const buttonPadding = size === "sm" ? "0.375rem 0.75rem" : "0.5rem 0.75rem";
  const fontSize = size === "sm" ? "11px" : "12px";

  return (
    <div
      className={`focus-within:focus-ring ${className}`}
      style={{
        position: "relative",
        display: "inline-grid",
        gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))`,
        overflow: "hidden",
        borderRadius: "10px",
        border: "1px solid var(--color-border)",
        background: "var(--color-bg-soft)",
        padding: "0.25rem",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "0.25rem",
          left: "0.25rem",
          top: "0.25rem",
          width: `calc((100% - 0.5rem) / ${segmentCount})`,
          borderRadius: "8px",
          background: "linear-gradient(90deg, #9945FF, #B871FF)",
          boxShadow: "0 8px 18px -12px rgba(153,69,255,0.9)",
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform 300ms ease-out",
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className="focus-ring"
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: 0,
              borderRadius: "8px",
              background: "transparent",
              padding: buttonPadding,
              color: active ? "#fff" : "var(--color-muted)",
              fontSize,
              fontWeight: 700,
              textAlign: "center",
              transition: "color 300ms ease",
            }}
            aria-pressed={active}
          >
            {option.label ?? option.value}
          </button>
        );
      })}
    </div>
  );
}
