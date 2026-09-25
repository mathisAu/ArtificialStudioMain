import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  // Het merkverloop uit het logo; bij hover iets gedempt zodat de knop niet
  // gaat "flitsen" maar wel reageert.
  primary:
    "bg-brand text-white border border-transparent shadow-xs hover:opacity-90",
  secondary:
    "bg-surface text-foreground border border-border-strong hover:bg-surface-muted",
  ghost:
    "bg-transparent text-muted-foreground border border-transparent hover:bg-surface-muted hover:text-foreground",
  subtle: "bg-surface-muted text-foreground border border-transparent hover:bg-neutral-soft",
  danger: "bg-danger text-white border border-transparent hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

const BASE =
  "inline-flex items-center rounded-[var(--radius)] font-medium transition-colors " +
  "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap select-none";

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

interface ButtonProps extends ComponentProps<"button"> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonLinkProps) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
