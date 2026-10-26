"use client";

import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-pine text-white hover:bg-pine-deep",
        variant === "secondary" && "border border-line bg-card text-ink hover:border-pine",
        variant === "ghost" && "text-pine hover:bg-white/70",
        variant === "danger" && "bg-burgundy text-white hover:bg-danger",
        className,
      )}
    >
      {busy ? "Patientez..." : children}
    </button>
  );
}
