import { Globe, Mail, Phone, Receipt, Star, Trash2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteContactAction } from "../actions";
import { InvoiceFormModal } from "../../facturen/invoice-form-modal";
import { CompanyFormModal } from "../company-form-modal";
import { ContactFormModal } from "./contact-form-modal";
import { InviteClientButton } from "./invite-client-button";
import { ActivityFeed } from "@/components/domain/activity-feed";
import { DocumentList, type DocumentRow } from "@/components/domain/document-list";
import { DocumentUploadModal } from "@/components/domain/document-upload-modal";
import { ProjectList, type ProjectRow } from "@/components/domain/project-list";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DefinitionList, EmptyState, PageHeader } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { isManager, requireInternal } from "@/lib/auth";
import {
  ACTIVE_PROJECT_STATUSES,
  COMPANY_STATUS,
  FEEDBACK_STATUS,
  INVOICE_STATUS,
  PRIORITY,
  QUESTION_STATUS,
} from "@/lib/labels";
import { getCompanyOptions, getProjectOptions } from "@/lib/queries/lookups";
import { createClient } from "@/lib/supabase/server";
import type {
  Activity,
  CompanyStats,
  CompanyStatus,
  InvoiceStatus,
  UserSummary,
} from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils";

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
  "feedback",
  "vragen",
  "documenten",
  "facturen",
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
          { value: "feedback", label: "Feedback", count: stats?.open_feedback ?? 0 },
          { value: "vragen", label: "Vragen", count: stats?.open_questions ?? 0 },
          { value: "documenten", label: "Documenten" },
          ...(canManage
            ? [{ value: "facturen", label: "Facturen", count: stats?.open_invoices ?? 0 }]
            : []),
          { value: "contactpersonen", label: "Contactpersonen", count: contactList.length },
        ]}
      />

      {tab === "overzicht" ? (
        <div className="space-y-6">
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Actieve projecten" value={stats?.active_projects ?? 0} />
            <StatCard
              label="Openstaande feedback"
              value={stats?.open_feedback ?? 0}
              tone={stats?.open_feedback ? "warning" : "neutral"}
            />
            <StatCard
              label="Openstaande vragen"
              value={stats?.open_questions ?? 0}
              tone={stats?.open_questions ? "warning" : "neutral"}
            />
            <StatCard
              label="Openstaande facturen"
              value={stats?.open_invoices ?? 0}
              tone={stats?.open_invoices ? "warning" : "neutral"}
            />
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

      {tab === "feedback" ? <CompanyFeedbackTab companyId={id} /> : null}

      {tab === "vragen" ? <CompanyQuestionsTab companyId={id} /> : null}

      {tab === "documenten" ? (
        <CompanyDocumentsTab companyId={id} companyName={company.name} />
      ) : null}

      {tab === "facturen" && canManage ? (
        <CompanyInvoicesTab companyId={id} />
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

// -----------------------------------------------------------------------------
// Feedback van deze klant (§6)
// -----------------------------------------------------------------------------
async function CompanyFeedbackTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("feedback")
    .select("id, title, priority, status, created_at, project:projects(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader
        title="Feedback"
        description="Alle feedback van deze klant, over alle projecten heen."
      />
      {(items ?? []).length === 0 ? (
        <EmptyState
          title="Nog geen feedback"
          description="Zodra deze klant feedback indient, verschijnt die hier."
        />
      ) : (
        <ul className="divide-y divide-border">
          {(items ?? []).map((item) => {
            const project = Array.isArray(item.project) ? item.project[0] : item.project;
            return (
              <li key={item.id}>
                <Link
                  href={`/feedback/${item.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(project as { name?: string } | null)?.name ?? "—"} ·{" "}
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <StatusBadge map={PRIORITY} value={item.priority} />
                  <StatusBadge map={FEEDBACK_STATUS} value={item.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Vragen van deze klant (§6)
// -----------------------------------------------------------------------------
async function CompanyQuestionsTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("customer_questions")
    .select("id, subject, status, created_at, project:projects(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  return (
    <Card>
      <CardHeader title="Vragen" description="Alle vragen van deze klant." />
      {(items ?? []).length === 0 ? (
        <EmptyState
          title="Nog geen vragen"
          description="Zodra deze klant een vraag stelt, verschijnt die hier."
        />
      ) : (
        <ul className="divide-y divide-border">
          {(items ?? []).map((item) => {
            const project = Array.isArray(item.project) ? item.project[0] : item.project;
            return (
              <li key={item.id}>
                <Link
                  href={`/vragen/${item.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {(project as { name?: string } | null)?.name ?? "—"} ·{" "}
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <StatusBadge map={QUESTION_STATUS} value={item.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Documenten van deze klant (§6, §17)
// -----------------------------------------------------------------------------
async function CompanyDocumentsTab({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const supabase = await createClient();

  const { data: fileRows } = await supabase
    .from("files")
    .select("*, uploader:users!files_uploaded_by_fkey(full_name), project:projects(name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const documents: DocumentRow[] = (fileRows ?? []).map((row) => {
    const uploader = Array.isArray(row.uploader) ? row.uploader[0] : row.uploader;
    const project = Array.isArray(row.project) ? row.project[0] : row.project;
    return {
      ...(row as unknown as DocumentRow),
      uploaderName: (uploader as { full_name?: string } | null)?.full_name ?? null,
      projectName: (project as { name?: string } | null)?.name ?? null,
    };
  });

  return (
    <Card>
      <CardHeader
        title="Documenten"
        description="Alle documenten die aan deze klant gekoppeld zijn."
        action={
          <DocumentUploadModal
            companies={[{ id: companyId, name: companyName, status: "active" }]}
            defaultCompanyId={companyId}
            label="Toevoegen"
          />
        }
      />
      <DocumentList documents={documents} canDelete showProject />
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Facturen van deze klant (§20)
// -----------------------------------------------------------------------------
async function CompanyInvoicesTab({ companyId }: { companyId: string }) {
  const supabase = await createClient();

  const [{ data: invoices }, companies, projects] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, total_amount, status, project:projects(name)")
      .eq("company_id", companyId)
      .order("invoice_date", { ascending: false }),
    getCompanyOptions(),
    getProjectOptions(),
  ]);

  const rows = invoices ?? [];
  const outstanding = rows
    .filter((i) => i.status === "open" || i.status === "overdue")
    .reduce((total, row) => total + Number(row.total_amount ?? 0), 0);

  return (
    <Card>
      <CardHeader
        title="Facturen"
        description={
          outstanding > 0
            ? `${formatCurrency(outstanding)} staat nog open.`
            : "Alle facturen van deze klant."
        }
        action={
          <InvoiceFormModal
            companies={companies}
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              company_id: p.company_id,
            }))}
            defaultCompanyId={companyId}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="Nog geen facturen"
          description="Zodra er gefactureerd wordt, verschijnen de facturen hier."
          icon={<Receipt className="h-5 w-5" />}
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((invoice) => {
            const project = Array.isArray(invoice.project)
              ? invoice.project[0]
              : invoice.project;
            return (
              <li key={invoice.id}>
                <Link
                  href={`/facturen/${invoice.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium tabular-nums">
                      {invoice.invoice_number}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {(project as { name?: string } | null)?.name ?? "Geen project"} ·{" "}
                      {formatDate(invoice.invoice_date)}
                    </p>
                  </div>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(Number(invoice.total_amount))}
                  </span>
                  <StatusBadge
                    map={INVOICE_STATUS}
                    value={invoice.status as InvoiceStatus}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
