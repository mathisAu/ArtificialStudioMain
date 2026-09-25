import { Globe, Mail, Phone, Star, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { deleteContactAction } from "../actions";
import { CompanyFormModal } from "../company-form-modal";
import { ContactFormModal } from "./contact-form-modal";
import { InviteClientButton } from "./invite-client-button";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { ProjectList, type ProjectRow } from "@/components/domain/project-list";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DefinitionList, EmptyState, PageHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { isManager, requireInternal } from "@/lib/auth";
import { ACTIVE_PROJECT_STATUSES, COMPANY_STATUS } from "@/lib/labels";
import { createClient } from "@/lib/supabase/server";
import type { Activity, CompanyStats, CompanyStatus, UserSummary } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("name").eq("id", id).maybeSingle();
  return { title: data?.name ?? "Klant" };
}

const TABS = [
  "overzicht",
  "projecten",
  "contactpersonen",
] as const;
type Tab = (typeof TABS)[number];

export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireInternal();
  const { id } = await params;
  const { tab: rawTab } = await searchParams;

  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select(
      `*, account_manager:users!companies_account_manager_id_fkey(id, full_name, email, avatar_url, role)`,
    )
    .eq("id", id)
    .maybeSingle();

  // Geen rij betekent hier: bestaat niet óf geen toegang (RLS). Beide leiden
  // tot 404 — we lekken niet of een organisatie bestaat.
  if (!company) notFound();

  const [
    { data: projectRows },
    { data: contacts },
    { data: statsRow },
    { data: activities },
    { data: managerRows },
    { data: portalAccounts },
  ] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, code, name, status, progress, deadline, is_archived, project_manager:users!projects_project_manager_id_fkey(full_name, avatar_url)",
        )
        .eq("company_id", id)
        .order("deadline", { ascending: true, nullsFirst: false }),
      supabase
        .from("contacts")
        .select("*")
        .eq("company_id", id)
        .order("is_primary", { ascending: false })
        .order("full_name"),
      supabase.from("company_stats").select("*").eq("company_id", id).maybeSingle(),
      supabase
        .from("activities")
        .select("*, actor:users(full_name), project:projects(name)")
        .eq("company_id", id)
        .order("created_at", { ascending: false })
        .limit(15),
      supabase
        .from("users")
        .select("id, full_name, email, avatar_url, role")
        .in("role", ["admin", "projectmanager"])
        .eq("is_active", true)
        .order("full_name"),
      supabase
        .from("customer_users")
        .select("contact_id, user_id")
        .eq("company_id", id),
    ]);

  const projects: ProjectRow[] = (projectRows ?? []).map((p) => {
    const manager = Array.isArray(p.project_manager)
      ? p.project_manager[0]
      : p.project_manager;
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      status: p.status,
      progress: p.progress,
      deadline: p.deadline,
      managerName: (manager as { full_name?: string } | null)?.full_name ?? null,
      managerAvatar: (manager as { avatar_url?: string } | null)?.avatar_url ?? null,
    };
  });

  const activeProjects = projects.filter((p) =>
    ACTIVE_PROJECT_STATUSES.includes(p.status),
  );
  const completedProjects = projects.filter((p) => !ACTIVE_PROJECT_STATUSES.includes(p.status));

  const stats = statsRow as CompanyStats | null;
  const manager = Array.isArray(company.account_manager)
    ? company.account_manager[0]
    : company.account_manager;

  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "overzicht";

  const canManage = isManager(user.role);
  const contactList = contacts ?? [];

  // Welke contactpersonen hebben al een login voor het klantportaal?
  const withAccount = new Set(
    (portalAccounts ?? []).map((row) => row.contact_id).filter(Boolean) as string[],
  );

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Klanten", href: "/klanten" }, { label: company.name }]}
        title={company.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {company.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <a href={`mailto:${company.email}`} className="hover:text-foreground">
                  {company.email}
                </a>
              </span>
            ) : null}
            {company.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                {company.phone}
              </span>
            ) : null}
            {company.website ? (
              <span className="inline-flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="hover:text-foreground"
                >
                  {company.website.replace(/^https?:\/\//, "")}
                </a>
              </span>
            ) : null}
          </span>
        }
        action={
          <>
            <StatusBadge map={COMPANY_STATUS} value={company.status as CompanyStatus} />
            {canManage ? (
              <CompanyFormModal
                company={company}
                managers={(managerRows ?? []) as UserSummary[]}
                variant="edit"
              />
            ) : null}
          </>
        }
      />

      <Tabs
        basePath={`/klanten/${id}`}
        active={tab}
        tabs={[
          { value: "overzicht", label: "Overzicht" },
          { value: "projecten", label: "Projecten", count: projects.length },
          { value: "contactpersonen", label: "Contactpersonen", count: contactList.length },
        ]}
      />

      {tab === "overzicht" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Actieve projecten" value={stats?.active_projects ?? 0} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader title="Actieve projecten" />
                <ProjectList
                  projects={activeProjects}
                  emptyTitle="Geen actieve projecten"
                  emptyDescription="Alle projecten van deze klant zijn afgerond of nog niet gestart."
                />
              </Card>

              <Card>
                <CardHeader title="Gegevens" />
                <CardBody>
                  <DefinitionList
                    items={[
                      {
                        label: "Interne verantwoordelijke",
                        value:
                          (manager as { full_name?: string } | null)?.full_name ??
                          "Niet toegewezen",
                      },
                      { label: "Btw-nummer", value: company.vat_number ?? "—" },
                      {
                        label: "Adres",
                        value: company.address_line
                          ? `${company.address_line}, ${company.postal_code ?? ""} ${company.city ?? ""}`.trim()
                          : "—",
                      },
                      { label: "Land", value: company.country ?? "—" },
                    ]}
                  />
                  {company.notes ? (
                    <div className="mt-5 rounded-[var(--radius)] bg-surface-muted px-3.5 py-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Interne notitie
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[13px]">{company.notes}</p>
                    </div>
                  ) : null}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Recente activiteit" />
              <CardBody className="pt-4">
                <ActivityFeed
                  items={(activities ?? []) as Activity[]}
                  showProject
                  emptyDescription="Zodra er iets gebeurt bij deze klant verschijnt het hier."
                />
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "projecten" ? (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Actieve projecten" />
            <ProjectList projects={activeProjects} emptyTitle="Geen actieve projecten" />
          </Card>
          <Card>
            <CardHeader title="Afgeronde projecten" />
            <ProjectList projects={completedProjects} emptyTitle="Nog niets afgerond" />
          </Card>
        </div>
      ) : null}

      {tab === "contactpersonen" ? (
        <Card>
          <CardHeader
            title="Contactpersonen"
            description="Meerdere personen per organisatie zijn mogelijk."
            action={canManage ? <ContactFormModal companyId={id} /> : null}
          />
          {contactList.length === 0 ? (
            <EmptyState
              title="Nog geen contactpersonen"
              description="Voeg de personen toe met wie we bij deze klant samenwerken."
              icon={<Users className="h-5 w-5" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {contactList.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-medium">
                      {contact.full_name}
                      {contact.is_primary ? (
                        <Star
                          className="h-3.5 w-3.5 fill-current text-warning"
                          aria-label="Hoofdcontactpersoon"
                        />
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {contact.job_title ?? "—"}
                    </p>
                  </div>

                  <div className="min-w-0 text-[13px] text-muted-foreground">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="hover:text-foreground">
                        {contact.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="w-32 text-[13px] text-muted-foreground">
                    {contact.phone ?? "—"}
                  </div>

                  {canManage ? (
                    <InviteClientButton
                      contactId={contact.id}
                      companyId={id}
                      name={contact.full_name}
                      hasEmail={Boolean(contact.email)}
                      hasAccount={withAccount.has(contact.id)}
                    />
                  ) : null}

                  {canManage ? (
                    <form action={deleteContactAction}>
                      <input type="hidden" name="id" value={contact.id} />
                      <input type="hidden" name="company_id" value={id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`${contact.full_name} verwijderen`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </>
  );
}
