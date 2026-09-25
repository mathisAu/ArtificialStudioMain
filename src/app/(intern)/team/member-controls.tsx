"use client";

import { Power, PowerOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { setUserActiveAction, setUserRoleAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { USER_ROLE } from "@/lib/labels";
import type { UserRole } from "@/lib/types";
import { useSyncedState } from "@/lib/use-action-form";

const ROLES: UserRole[] = ["admin", "projectmanager", "developer", "freelancer"];

/** Rol wijzigen vanuit het teamoverzicht (§2). */
export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: UserRole;
  disabled: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useSyncedState(role);
  const [isPending, startTransition] = useTransition();

  async function onChange(next: UserRole) {
    const previous = current;
    setCurrent(next);

    const result = await setUserRoleAction(userId, next);
    if (result?.error) {
      setCurrent(previous);
      toast.error(result.error);
      return;
    }

    toast.success(`Rol gewijzigd naar ${USER_ROLE[next].label.toLowerCase()}.`);
    startTransition(() => router.refresh());
  }

  return (
    <Select
      aria-label="Rol"
      value={current}
      disabled={disabled || isPending}
      onChange={(event) => onChange(event.target.value as UserRole)}
      className="w-auto min-w-[150px]"
    >
      {ROLES.map((value) => (
        <option key={value} value={value}>
          {USER_ROLE[value].label}
        </option>
      ))}
    </Select>
  );
}

/** Account activeren of deactiveren (§3). */
export function ActiveToggle({
  userId,
  isActive,
  name,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  name: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [current, setCurrent] = useSyncedState(isActive);
  const [isPending, startTransition] = useTransition();

  async function toggle() {
    const next = !current;

    if (
      !next &&
      !window.confirm(
        `${name} deactiveren? Dit account kan daarna niet meer inloggen. De gegevens blijven bewaard.`,
      )
    ) {
      return;
    }

    setCurrent(next);

    const result = await setUserActiveAction(userId, next);
    if (result?.error) {
      setCurrent(!next);
      toast.error(result.error);
      return;
    }

    toast.success(result.success ?? "Bijgewerkt.");
    startTransition(() => router.refresh());
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={disabled || isPending}
      title={current ? "Account deactiveren" : "Account activeren"}
    >
      {current ? (
        <>
          <PowerOff className="h-3.5 w-3.5" />
          Deactiveren
        </>
      ) : (
        <>
          <Power className="h-3.5 w-3.5" />
          Activeren
        </>
      )}
    </Button>
  );
}
