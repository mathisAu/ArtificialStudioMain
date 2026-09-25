"use client";

import { Check, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setActionStatusAction } from "../../actions";
import { Button } from "@/components/ui/button";

/**
 * De klant vinkt een actie af (§28).
 *
 * De databasetrigger `guard_customer_action_client_update` staat alleen een
 * statuswijziging toe; alle andere velden zijn voor de klant geblokkeerd.
 */
export function ActionStatusButton({
  actionId,
  status,
  size = "sm",
}: {
  actionId: string;
  status: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const done = status === "done";

  async function toggle() {
    const next = done ? "open" : "done";
    const result = await setActionStatusAction(actionId, next);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(done ? "Weer op openstaand gezet." : "Bedankt, actie afgerond.");
    startTransition(() => router.refresh());
  }

  return (
    <Button
      variant={done ? "ghost" : "primary"}
      size={size}
      disabled={isPending}
      onClick={toggle}
    >
      {done ? (
        <>
          <Undo2 className="h-3.5 w-3.5" />
          Heropenen
        </>
      ) : (
        <>
          <Check className="h-3.5 w-3.5" />
          Markeer als afgerond
        </>
      )}
    </Button>
  );
}
