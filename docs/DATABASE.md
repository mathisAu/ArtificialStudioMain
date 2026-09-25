# Databasearchitectuur en rechtenmodel

Dit document beschrijft het schema en — belangrijker — wie wat mag. Het is de
plek om te controleren of de beveiliging klopt vóórdat er echte klantdata in gaat.

## Centrale structuur

```
companies (klant)
  └── contacts                  contactpersonen
  └── customer_users            koppeling account ↔ organisatie
  └── projects
        ├── project_members     wie werkt eraan
        ├── project_phases      tijdlijn
        ├── tasks ── subtasks
        ├── project_updates     berichten richting klant
        ├── feedback ──────────► tasks   (feedback wordt taak, relatie blijft)
        ├── customer_questions
        ├── customer_actions    acties die bij de klant liggen
        ├── notes               interne notities
        ├── files               documenten (Supabase Storage)
        ├── invoices
        └── activities          audit trail
notifications ─────────────────► outbound_messages   (e-mail / Slack)
project_templates ── project_template_items
app_settings                    integratie-instellingen (admin-only)
```

Alle primary keys zijn UUID's. Overal waar het logisch is staan `created_at`,
`updated_at` en `created_by`.

`company_id` en `project_id` zijn op meerdere tabellen gedenormaliseerd
opgeslagen. Dat is bewust: RLS-policies kunnen daardoor zonder joins bepalen of
iemand een rij mag zien, wat zowel sneller als beter te controleren is.

## Migraties

| Bestand | Inhoud |
| --- | --- |
| `20260101000001_enums.sql` | Extensies, het `app`-schema en alle enum types |
| `20260101000002_tables.sql` | Alle tabellen, indexen en constraints |
| `20260101000003_helpers.sql` | `SECURITY DEFINER`-functies die RLS gebruikt |
| `20260101000004_rls.sql` | Row Level Security policies |
| `20260101000005_functions.sql` | Triggers: logging, notificaties, voortgang, factuurnummers |
| `20260101000006_storage_and_views.sql` | Storage-bucket, storage-policies, statistiekviews |
| `20260101000007_realtime.sql` | Notificaties in de realtime-publicatie |
| `20260101000008_notification_links.sql` | Notificatielinks naar bestaande routes |
| `20260101000009_portal_links.sql` | Portaallinks en het vrijgeven van factuur-PDF's |
| `20260101000010_automation.sql` | Deadline-herinneringen (pg_cron), berichtenwachtrij, integratie-instellingen |

## Waarom een apart `app`-schema

RLS-policies mogen geen subquery uitvoeren op een tabel die zelf weer een policy
op diezelfde tabel triggert — dat geeft oneindige recursie. De helperfuncties in
het `app`-schema zijn daarom `SECURITY DEFINER`: ze lezen `users`,
`customer_users` en `project_members` buiten RLS om.

Ze zijn allemaal `STABLE` (resultaat wordt binnen één statement hergebruikt) en
hebben een vastgezet `search_path` tegen search-path hijacking.

| Functie | Betekenis |
| --- | --- |
| `app.current_user_role()` | Rol van de ingelogde gebruiker |
| `app.is_admin()` | Rol is `admin` |
| `app.is_manager()` | Rol is `admin` of `projectmanager` |
| `app.is_internal()` | Elke rol behalve `client` |
| `app.is_client()` | Rol is `client` |
| `app.current_company_id()` | Organisatie van een klantaccount |
| `app.can_view_project(id)` | Mag dit project gezien worden |
| `app.can_contribute_project(id)` | Mag er inhoudelijk gewerkt worden |
| `app.can_manage_project(id)` | Mag het project zelf beheerd worden |
| `app.can_view_company(id)` | Mag deze klant gezien worden |
| `app.can_view_user(id)` | Mag deze persoon gezien worden |

## Rechtenmatrix

`✓` = volledig · `~` = beperkt (zie voetnoot) · `–` = geen toegang

| Onderdeel | Admin | Projectmanager | Developer | Freelancer | Klant |
| --- | :-: | :-: | :-: | :-: | :-: |
| Klanten bekijken | ✓ | ✓ | ~¹ | ~¹ | ~² |
| Klanten beheren | ✓ | ✓ | – | – | – |
| Projecten bekijken | ✓ | ✓ | ~³ | ~³ | ~² |
| Projecten aanmaken | ✓ | ✓ | – | – | – |
| Project beheren (status, team) | ✓ | ~⁴ | – | – | – |
| Taken bekijken | ✓ | ✓ | ~³ | ~³ | ~⁵ |
| Taken aanmaken/wijzigen | ✓ | ~⁴ | ~³ | – | – |
| Projectupdates publiceren | ✓ | ~⁴ | – | – | – |
| Feedback bekijken | ✓ | ✓ | ~³ | ~³ | ~² |
| Feedback indienen | ✓ | ~⁴ | ~³ | – | ~² |
| Feedback behandelen | ✓ | ~⁴ | ~³ | – | – |
| Interne notities | ✓ | ~⁴ | ~³ | – | **–** |
| Interne reacties | ✓ | ✓ | ✓ | ✓ | **–** |
| Documenten | ✓ | ~⁴ | ~³ | lezen | ~⁶ |
| Facturen | ✓ | ✓ | **–** | **–** | ~⁷ |
| Klantacties aanmaken | ✓ | ~⁴ | – | – | – |
| Klantactie afvinken | ✓ | ~⁴ | – | – | ~⁸ |
| Gebruikersrollen wijzigen | ✓ | – | – | – | – |
| Teamleden uitnodigen | ✓ | – | – | – | – |
| Klanten uitnodigen | ✓ | ✓ | – | – | – |
| Accounts deactiveren | ✓ | – | – | – | – |
| Projecttemplates beheren | ✓ | – | – | – | – |
| Integratie-instellingen | ✓ | – | – | – | – |
| Slack per project instellen | ✓ | ~⁴ | – | – | – |
| Eigen e-mailvoorkeuren | ✓ | ✓ | ✓ | ✓ | ✓ |

1. Alleen organisaties waarvan zij aan minstens één project gekoppeld zijn.
2. Uitsluitend de eigen organisatie (`company_id`).
3. Uitsluitend projecten waaraan de gebruiker expliciet gekoppeld is.
4. Uitsluitend projecten waarvan de gebruiker projectmanager of teamlid is.
5. Alleen taken met `visible_to_client = true`.
6. Alleen documenten met `visible_to_client = true`; uploaden mag optioneel.
7. Alleen eigen facturen, en nooit een factuur met status `draft`.
8. Alleen de status; de trigger `guard_customer_action_client_update` blokkeert
   elke andere kolom.

## Automatisering in de database

Deze dingen gebeuren zonder dat de applicatie ze hoeft aan te roepen:

- **Profiel aanmaken** — `on_auth_user_created` maakt een rij in `public.users`
  op basis van de metadata van de uitnodiging, en koppelt klantaccounts meteen
  aan hun organisatie.
- **Activity log** — projecten, taken, feedback, vragen, klantacties, updates,
  documenten, reacties en facturen loggen zichzelf in `activities` (§19).
- **Notificaties** — nieuwe feedback, nieuwe vraag, statuswijziging, toegewezen
  taak, nieuwe klantactie, nieuwe update, nieuwe factuur en @mentions vullen
  `notifications` (§32). Wie de handeling zelf uitvoert krijgt geen melding.
  De tabel zit in de realtime-publicatie, zodat de teller in de sidebar meteen
  meebeweegt — ook wanneer een collega iets doet.
- **Voortgang** — `projects.progress` wordt herberekend uit het aandeel
  afgeronde taken, tenzij `progress_is_manual` aan staat.
- **Factuurnummers** — `F-JJJJ-0001`, automatisch bij het opslaan.
- **Factuur-PDF's** — een PDF bij een conceptfactuur blijft intern en komt
  automatisch vrij voor de klant zodra de factuur wordt verstuurd; gaat de
  factuur terug naar concept, dan wordt de PDF weer afgeschermd.
- **Verlopen facturen** — status `open` wordt `overdue` zodra de vervaldatum
  gepasseerd is.
- **`completed_at` / `resolved_at`** — worden gezet en weer leeggemaakt bij een
  statuswissel.
- **Uitgaande berichten** — elke notificatie komt langs `fan_out_notification`.
  Die zet er een e-mail bij (per ontvanger, mits die het type niet gedempt heeft)
  en/of een Slack-bericht (één per gebeurtenis, niet één per teamlid). Staat een
  kanaal uit, dan wordt er niets in de wachtrij gezet.
- **Dagelijkse herinneringen** — `app.run_daily_reminders()` draait via `pg_cron`
  op werkdagen om 07:00 UTC: naderende en verstreken deadlines op taken,
  projecten en klantacties, facturen die bijna vervallen, en het op `overdue`
  zetten van openstaande facturen. Per ontvanger en per item wordt maximaal één
  herinnering van elk type gestuurd, zodat niemand dagelijks dezelfde melding
  krijgt.

## Bestandsopslag

Bucket `documents`, privé, maximaal 50 MB per bestand.
Padconventie: `{company_id}/{project_id|algemeen}/{uuid}-{bestandsnaam}`.

Lezen mag als je de bijbehorende rij in `public.files` mag zien — daarmee gelden
in Storage automatisch precies dezelfde regels als in de applicatie. Uploaden
wordt gecontroleerd op de eerste map in het pad, omdat er op dat moment nog geen
`files`-rij bestaat.

## Geheimen

`app_settings` bevat de Slack-webhook en de afzendergegevens voor e-mail. De
tabel is uitsluitend leesbaar voor admins — bewust een aparte tabel en niet een
kolom op `projects`, want die is zichtbaar voor iedereen die het project mag
inzien. De API-sleutel van de mailprovider staat helemaal niet in de database,
maar in de omgevingsvariabelen.

## Testen

Het rechtenmodel is geen papieren belofte. Vijf suites controleren het
daadwerkelijk: `rls_test.sql`, `outbox_test.sql`, `storage_test.mjs`,
`access_test.mjs` en `outbox_delivery_test.mjs`. Samen dekken zij onder meer:

- een klant die een project, factuur, document of feedback van een andere
  organisatie probeert op te halen — ook rechtstreeks op id;
- een klant die geen enkele rij uit `notes` terugkrijgt;
- een klant die de interne reacties en niet-vrijgegeven projectupdates niet ziet;
- een klant die een interne reactie probeert te plaatsen, of een reactie namens
  iemand anders;
- een klant die wél een actie mag afvinken maar niet de deadline ervan mag
  verzetten;
- een developer die geen facturen ziet en niet buiten de eigen projecten kan
  werken;
- een freelancer die niets kan aanmaken;
- een developer die zichzelf tot admin probeert te promoveren (faalt met 42501);
- een developer die een collega wil promoveren of deactiveren (raakt nul rijen);
- een developer die zelf een account probeert aan te maken;
- een klant die een factuur wil aanmaken, op betaald zetten of verwijderen;
- een klant die een projectupdate wil publiceren of een interne update wil
  vrijgeven;
- het vrijgeven en weer afschermen van factuur-PDF's;
- uploaden in de map van een andere klant, en het downloaden van een intern
  bestand door een klant;
- een developer of klant die de factuurexport of de integratie-instellingen
  probeert op te halen;
- het wachtrij-endpoint dat een ingelogde admin zónder het juiste geheim weigert;
- Slack dat één bericht per gebeurtenis krijgt in plaats van één per teamlid;
- een gedempt notificatietype dat geen e-mail oplevert;
- uitgeschakelde integraties die niets in de wachtrij zetten.

Draai beide na elke wijziging aan het schema of aan een policy. De commando's
staan in de README.
