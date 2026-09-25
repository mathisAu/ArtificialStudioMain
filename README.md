# Artificial Studio · Project Management + Klantportaal

Interne projectmanagementomgeving en een beveiligd klantportaal in één applicatie.
Gebouwd op Next.js 16 (App Router) en Supabase.

De functionele basis is het document
_"Bouw een compleet Project Management Systeem + Klantportaal"_. In de code wordt
verwezen naar de paragraafnummers daaruit (§4 = dashboard, §36 = beveiliging, enzovoort).

---

## Stand van zaken

| Fase | Inhoud | Status |
| --- | --- | --- |
| 1 | Database, authenticatie, rollen en rechten, klanten, projecten, projectstatus, taken, dashboard | **Gebouwd** |
| 2 | Feedback, vragen, projectupdates, klantacties, documenten, interne notities, activity log, notificaties | **Gebouwd** |
| 3 | Facturen, en het klantportaal volledig: feedback indienen, vragen stellen, acties uitvoeren, documenten, facturen | **Gebouwd** |
| 4 | Projecttemplates beheren, deadline-notificaties, Slack, e-mailnotificaties, boekhoudexport | **Gebouwd** |

Nog niet gebouwd: global search (§38) en een directe API-koppeling met een
boekhoudpakket of payment provider. Voor dat laatste heb je een account en
API-sleutels nodig; de velden en de CSV-export staan wel klaar.

---

## Aan de slag

### 1. Vereisten

- Node.js 20.9 of nieuwer (het project is getest op Node 24)
- Een Supabase-project, of Docker Desktop voor een lokale Supabase

### 2. Installeren

```bash
npm install
```

### 3. Omgevingsvariabelen

```bash
cp .env.local.example .env.local
```

Vul de waarden uit **Supabase → Project Settings → API**:

| Variabele | Waar te vinden |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (voorheen `anon`) |
| `SUPABASE_SECRET_KEY` | Secret key (voorheen `service_role`) — **nooit** in de browser |

### 4. Database opzetten

**Lokaal** (vereist een draaiende Docker Desktop):

```bash
npm run db:start
```

```bash
npm run db:reset
```

**Op een bestaand Supabase-project:**

```bash
npx supabase link --project-ref <jouw-project-ref>
```

```bash
npm run db:push
```

`db:reset` draait alle migraties opnieuw én laadt `supabase/seed.sql`
(het standaard projecttemplate uit §34).

### 5. Demo-data (alleen lokaal)

```bash
node scripts/seed-local.mjs
```

Maakt vier testaccounts (admin, projectmanager, developer, klant), één klant en
één project met taken aan. Wachtwoord voor alle accounts: `TestWachtwoord123`.
Het script weigert te draaien tegen een niet-lokale Supabase.

### 6. Eerste admin aanmaken (productie)

Er is bewust **geen** openbare registratie: accounts ontstaan alleen via een
uitnodiging. De allereerste admin maak je daarom handmatig aan.

1. Supabase-dashboard → **Authentication → Users → Add user**.
2. Vul e-mailadres en wachtwoord in, zet *Auto Confirm User* aan.
3. Ga naar **Table editor → users** en zet `role` van deze gebruiker op `admin`.

De trigger `on_auth_user_created` maakt het profiel automatisch aan; alleen de
rol moet je één keer met de hand goedzetten.

### 7. Starten

```bash
npm run dev
```

---

## Beveiliging testen

Er zijn twee testsuites. Beide draaien tegen de lokale database en laten hem
schoon achter.

**Row Level Security** — een klant die bij een andere klant probeert te komen, een
developer die facturen opvraagt, een freelancer die iets wil wijzigen, een
developer die zichzelf admin maakt, een klant die een interne reactie plaatst of
de deadline van een actie verzet:

```bash
npm run test:rls
```

**Storage** — met echte gebruikerssessies, precies zoals de browser het doet:
uploaden in de map van een andere klant, een intern bestand downloaden als klant,
de map van een andere organisatie uitlezen:

```bash
npm run test:storage
```

**Toegang tot endpoints** — logt in als developer en als klant en controleert dat
zij niet bij de factuurexport, de integratie-instellingen of het wachtrij-endpoint
komen. Vereist een draaiende `npm run dev`:

```bash
npm run test:access -- http://localhost:3000
```

**Uitgaande berichten** — of notificaties correct in de wachtrij landen, en of ze
daadwerkelijk verstuurd worden (met een lokale nep-Slack als ontvanger):

```bash
npm run test:outbox
```

```bash
npm run test:delivery -- http://localhost:3000
```

Bij een fout stoppen de SQL-tests met `FOUT ·` en de regel die niet klopt; de
Node-tests sluiten af met een exitcode ongelijk aan nul.

---

## Structuur

```
src/
  app/
    (auth)/          inloggen, wachtwoord vergeten, wachtwoord resetten
    (intern)/        interne omgeving: dashboard, projecten, klanten, mijn taken,
                     feedback, vragen, documenten, facturen, notificaties
    (portaal)/       klantportaal: dashboard, projecten, feedback, vragen,
                     acties, documenten, facturen, notificaties, account
    auth/callback/   afhandeling van uitnodigings- en herstelmails
    api/             factuurexport (CSV) en het legen van de berichtenwachtrij
  components/
    ui/              knoppen, kaarten, tabellen, modals, badges
    domain/          projectlijst, tijdlijn, taakregel, activiteitenfeed,
                     reactiethread, documentenlijst, notificaties
    layout/          sidebar-schil en navigatie
  lib/
    actions/         gedeelde server actions (reacties, bestanden)
    auth.ts          sessie, rollen, requireInternal / requireClient
    labels.ts        Nederlandse labels bij alle database-enums
    queries/         serverqueries per module
    outbox.ts        versturen van e-mail en Slack uit de wachtrij
    storage.ts       padconventie voor de documentenbucket
    supabase/        clients voor server, browser en admin
  proxy.ts           sessie verversen + optimistische toegangscheck

supabase/
  migrations/        het volledige schema, in volgorde
  seed.sql           standaard projecttemplate
  tests/             RLS- en storage-testsuites
```

---

## Beveiliging

Autorisatie zit in de **database**, niet in de frontend (§36).

- Elke tabel heeft Row Level Security aan staan; `anon` heeft nergens rechten.
- Een klantaccount kan uitsluitend rijen ophalen met de eigen `company_id`.
  Dat geldt ook bij een directe REST-aanroep met een eigen access token.
- Interne notities (`notes`) hebben bewust geen enkele policy voor de rol `client`.
- Interne taken en niet-vrijgegeven projectupdates zijn onzichtbaar voor klanten
  via de vlag `visible_to_client`.
- Developers en freelancers zien alleen projecten waaraan ze gekoppeld zijn;
  freelancers hebben uitsluitend leesrechten.
- Facturen zijn niet zichtbaar voor developers en freelancers.
- Bestanden in Storage zijn afgeschermd op basis van dezelfde regels als de
  `files`-tabel; de bucket `documents` is privé.
- Een gebruiker kan het eigen profiel bijwerken, maar de trigger
  `guard_user_role_change` blokkeert het wijzigen van de eigen rol.

Zie `docs/DATABASE.md` voor het volledige rechtenmodel.

---

## Huisstijl

Het merkteken staat als inline SVG in `src/components/layout/logo.tsx` — zo
blijft het scherp op elk formaat en gebruikt het verloop dezelfde variabelen als
de rest van de interface. Wil je het originele bestand gebruiken, zet het dan in
`public/logo.svg` en vervang de inhoud van `LogoMark` door een `<Image>`.

De drie kleuren uit het logo staan als `--brand-1`, `--brand-2` en `--brand-3` in
`globals.css` en vormen samen `--gradient-brand`. Het verloop zit op de primaire
knop, de voortgangsbalk, de notificatieteller en het woordmerk. Voor tekst en
randen wordt het middelste punt als effen `--accent` gebruikt: een verloop is
daar niet leesbaar.

---

## Weergave

Linksonder in de sidebar staat een keuze tussen **Licht**, **Donker** en
**Systeem**. De voorkeur gaat in een cookie, zodat de server het juiste thema al
in de HTML meestuurt — je ziet dus geen flits van het verkeerde thema bij het
laden.

Alle kleuren staan als CSS-variabelen in `src/app/globals.css`. De donkere
waarden staan daar bewust twee keer: één keer voor wie het systeem volgt en één
keer voor wie donker expliciet kiest. CSS kent geen manier om één set variabelen
aan twee losse selectors te hangen, dus pas ze altijd samen aan.

---

## Gebruikers en klanten uitnodigen

Onder **Team** nodigt een admin collega's uit; de ontvanger krijgt een e-mail en
kiest daarin zelf een wachtwoord. Rollen aanpassen en accounts deactiveren kan
daar ook — een admin kan zichzelf niet degraderen of uitschakelen, zodat je nooit
buitengesloten raakt.

Klanten nodig je uit vanaf de klantpagina, bij de contactpersonen. De organisatie
komt uit het contactpersoon-record zelf en niet uit het formulier, zodat een
account nooit bij de verkeerde klant kan belanden.

> Supabase verstuurt deze mails. Zonder eigen SMTP-provider geldt een strenge
> limiet op het aantal berichten; richt voor productie een mailprovider in bij
> **Authentication → Emails** in het Supabase-dashboard.

---

## Automatisering

**Dagelijkse herinneringen** (§32) draaien via `pg_cron`, elke werkdag om 07:00 UTC:
deadlines die naderen of verstreken zijn, facturen die vervallen, en het op
`verlopen` zetten van openstaande facturen waarvan de vervaldatum voorbij is.
Handmatig draaien kan ook:

```bash
docker exec supabase_db_artificial-studio-pm psql -U postgres -d postgres -c "select * from app.run_daily_reminders();"
```

**Uitgaande berichten** (§26, §33) komen in `outbound_messages` terecht en worden
verstuurd door een POST op `/api/uitgaand` met het geheim uit `OUTBOX_SECRET`.
Roep dat endpoint elke paar minuten aan met een scheduler:

```bash
curl -X POST https://jouw-domein.nl/api/uitgaand -H "Authorization: Bearer $OUTBOX_SECRET"
```

Beide kanalen zijn inert tot ze zijn ingesteld: zonder Slack-webhook of zonder
`RESEND_API_KEY` wordt een bericht als *overgeslagen* gemarkeerd in plaats van
eindeloos opnieuw geprobeerd.

---

## Handige commando's

```bash
npm run typecheck
```

```bash
npm run db:types
```

Het tweede commando genereert TypeScript-types uit de gekoppelde database. Tot
die tijd staan de domeintypes handmatig in `src/lib/types.ts`.
#   p r o j e c t - a r t i f i c i a l  
 #   p r o j e c t - a r t i f i c i a l  
 #   g i t - r e p o - a r t i f i c i a l - s t u d i o -  
 