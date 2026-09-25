-- =============================================================================
-- 0007 · Realtime voor notificaties (§32)
-- =============================================================================
-- De teller in de sidebar moet kloppen zonder dat de pagina herladen wordt,
-- ook wanneer een collega iets doet waardoor jij een melding krijgt.
--
-- Realtime respecteert Row Level Security: een abonnee ontvangt uitsluitend
-- wijzigingen op rijen die hij ook via een gewone SELECT zou mogen zien. Voor
-- notifications betekent dat: alleen de eigen meldingen.

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then
    null;
end;
$$;

-- Bij een UPDATE stuurt Postgres standaard alleen de gewijzigde kolommen mee.
-- Met REPLICA IDENTITY FULL komt de volledige rij mee, zodat de client kan zien
-- om welke gebruiker het gaat en of de melding gelezen is.
alter table public.notifications replica identity full;
