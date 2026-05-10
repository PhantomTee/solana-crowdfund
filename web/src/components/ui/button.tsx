import React from "react";
import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center font-bold transition-all duration-150 " +
    "disabled:opacity-40 disabled:cursor-not-allowed " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 " +
    "active:translate-x-[2px] active:translate-y-[2px]";

  const variants: Record<string, string> = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] " +
      "shadow-[3px_3px_0_rgba(0,0,0,0.25)] hover:shadow-[4px_4px_0_rgba(0,0,0,0.3)]",
    secondary:
      "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] " +
      "hover:border-[var(--border-strong)] shadow-[3px_3px_0_var(--shadow-color)] hover:shadow-[4px_4px_0_var(--shadow-color)]",
    danger:
      "bg-rose-600 text-white hover:bg-rose-700 " +
      "shadow-[3px_3px_0_rgba(0,0,0,0.25)] hover:shadow-[4px_4px_0_rgba(0,0,0,0.3)]",
    ghost:
      "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-alt)]",
  };

  const sizes: Record<string, string> = {
    sm: "text-sm px-3 py-1.5 gap-1.5",
    md: "text-base px-4 py-2 gap-2",
    lg: "text-base px-6 py-3 gap-2",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-0.5 h-4 w-4 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
