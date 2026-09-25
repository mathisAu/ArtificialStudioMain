"use client";

import { UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { inviteTeamMemberAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { Modal, SubmitButton } from "@/components/ui/modal";
import { USER_ROLE } from "@/lib/labels";
import type { UserRole } from "@/lib/types";
import { useActionForm } from "@/lib/use-action-form";

const ROLES: UserRole[] = ["admin", "projectmanager", "developer", "freelancer"];

const UITLEG: Record<string, string> = {
  admin: "Volledige toegang, inclusief instellingen en gebruikersbeheer.",
  projectmanager: "Beheert klanten, projecten en facturen.",
  developer: "Werkt aan projecten waaraan hij is gekoppeld.",
  freelancer: "Mag uitsluitend meekijken bij gekoppelde projecten.",
};

/** Teamlid uitnodigen (§3). */
export function InviteModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<UserRole>("developer");

  const { submit, pending, error } = useActionForm(inviteTeamMemberAction, (result) => {
    toast.success(result.success ?? "Uitnodiging verstuurd.");
    setOpen(false);
    router.refresh();
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserRoundPlus className="h-4 w-4" />
        Teamlid uitnodigen
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Teamlid uitnodigen"
        description="De uitgenodigde ontvangt een e-mail en kiest daarin zelf een wachtwoord."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              Annuleren
            </Button>
            <SubmitButton form="invite-form" pending={pending} pendingLabel="Versturen…">
              Uitnodiging versturen
            </SubmitButton>
          </>
        }
      >
        <form id="invite-form" action={submit} className="space-y-4">
          <FormError>{error}</FormError>

          <Field label="Naam" htmlFor="invite_name" required>
            <Input
              id="invite_name"
              name="full_name"
              required
              minLength={2}
              placeholder="Tim Jansen"
            />
          </Field>

          <Field label="E-mailadres" htmlFor="invite_email" required>
            <Input
              id="invite_email"
              name="email"
              type="email"
              required
              placeholder="tim@artificialstudio.nl"
            />
          </Field>

          <Field label="Rol" htmlFor="invite_role" hint={UITLEG[role]}>
            <Select
              id="invite_role"
              name="role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {USER_ROLE[value].label}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </Modal>
    </>
  );
}
