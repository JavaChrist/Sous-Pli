import { cn } from "@/lib/cn";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/** Même forme que les entrées du menu : coins arrondis, texte petit, fond vert si actif. */
export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
    variant === "primary" && "bg-pine text-white hover:bg-pine-deep",
    variant === "secondary" && "text-ink hover:bg-white",
    variant === "ghost" && "text-pine hover:bg-white",
    variant === "danger" && "bg-burgundy text-white hover:bg-danger",
    className,
  );
}

export function Button({
  className,
  variant = "primary",
  busy = false,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; busy?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      aria-busy={busy}
      className={buttonClass(variant, className)}
    >
      {busy ? "Patientez..." : children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
