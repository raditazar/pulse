import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost";
  }
>;

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium transition-colors";
  const styles =
    variant === "ghost"
      ? "border border-current/20 bg-transparent text-inherit hover:bg-black/5"
      : "bg-cyan-400 text-slate-950 hover:bg-cyan-300";

  return (
    <button className={`${base} ${styles} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

