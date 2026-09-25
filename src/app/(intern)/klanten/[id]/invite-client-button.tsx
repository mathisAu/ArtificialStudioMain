"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { inviteClientAction } from "../../team/actions";
import { SubmitButton } from "@/components/ui/modal";
import { useActionForm } from "@/lib/use-action-form";

/**
 * Contactpersoon uitnodigen voor het klantportaal (§3).
 *
 * De organisatie komt uit het contactpersoon-record zelf, niet uit dit
 * formulier — zo kan er geen account bij de verkeerde klant belanden.
 */
export function InviteClientButton({
  contactId,
  companyId,
  name,
  hasEmail,
  hasAccount,
}: {
  contactId: string;
  companyId: string;
  name: string;
  hasEmail: boolean;
  hasAccount: boolean;
}) {
  const router = useRouter();

  const { submit, pending, error } = useActionForm(inviteClientAction, (result) => {
    toast.success(result.success ?? "Uitnodiging verstuurd.");
    router.refresh();
  });

  if (hasAccount) {
    return (
      <span className="text-xs text-success" title="Heeft toegang tot het klantportaal">
        Heeft toegang
      </span>
    );
  }

  if (!hasEmail) {
    return (
      <span className="text-xs text-subtle-foreground" title="Vul eerst een e-mailadres in">
        Geen e-mailadres
      </span>
    );
  }

  return (
    <form
      action={submit}
      onSubmit={(event) => {
        if (!window.confirm(`${name} uitnodigen voor het klantportaal?`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="company_id" value={companyId} />

      <SubmitButton
        variant="secondary"
        size="sm"
        pending={pending}
        pendingLabel="Versturen…"
      >
        <Send className="h-3.5 w-3.5" />
        Uitnodigen
      </SubmitButton>

      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </form>
  );
}
