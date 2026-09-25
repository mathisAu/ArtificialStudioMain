"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/**
 * Teller met ongelezen notificaties in de sidebar (§32).
 *
 * Dit moet een client component zijn: de layout waarin de sidebar staat wordt
 * bij navigatie binnen hetzelfde segment niet opnieuw gerenderd, waardoor een
 * server-side teller zou blijven hangen op de waarde van de eerste
 * paginaweergave.
 *
 * De stand wordt op twee manieren actueel gehouden:
 *   1. Een realtime-abonnement op de eigen rijen in `notifications` — zo klopt
 *      de teller ook als een collega iets doet waardoor jij een melding krijgt.
 *   2. Een herberekening bij elke routewijziging, als vangnet wanneer de
 *      websocket even weg is.
 */
export function NotificationBadge({
  userId,
  initialCount,
}: {
  userId: string;
  initialCount: number;
}) {
  const pathname = usePathname();
  const [count, setCount] = useState(initialCount);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { count: unread } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    return unread ?? 0;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    void refresh().then((unread) => {
      if (!cancelled) setCount(unread);
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, refresh]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notificaties-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refresh().then(setCount);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  if (count <= 0) return null;

  return (
    <span
      className="bg-brand ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white"
      aria-label={`${count} ongelezen notificaties`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
