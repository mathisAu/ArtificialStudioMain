import type { ReactNode } from "react";

import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center">
          <Logo />
          <p className="mt-3 text-[13px] text-muted-foreground">
            Projecten &amp; klantportaal
          </p>
        </div>

        <div className="bg-surface border border-border rounded-[var(--radius)] p-6">
          {children}
        </div>

        <p className="mt-6 text-center text-xs text-subtle-foreground">
          Problemen met inloggen? Neem contact op met je contactpersoon.
        </p>
      </div>
    </div>
  );
}
