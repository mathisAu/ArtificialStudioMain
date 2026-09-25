"use client";

import Link from "next/link";
import { useTransition, type ReactNode } from "react";

import { markNotificationReadById } from "@/lib/actions/notifications";

/**
 * Notificatie die zichzelf als gelezen markeert zodra je erop klikt.
 *
 * Zonder dit bleef de melding ongelezen: je kwam op de pagina uit, maar de
 * teller in de zijbalk bleef op hetzelfde getal staan tot je apart op "Gelezen"
 * drukte. De navigatie zelf wacht niet op de server-actie.
 */
export function NotificationLink({
  id,
  href,
  isRead,
  className,
  children,
}: {
  id: string;
  href: string;
  isRead: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        if (isRead) return;
        startTransition(() => {
          void markNotificationReadById(id);
        });
      }}
    >
      {children}
    </Link>
  );
}
