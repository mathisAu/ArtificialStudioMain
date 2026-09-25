-- =============================================================================
-- 0011 · WhatsApp via Chatlevel
-- =============================================================================
-- Vierde kanaal naast e-mail en Slack (zie 0010_automation.sql). Berichten
-- gaan naar het telefoonnummer van de gebruiker (public.users.phone). De
-- Chatlevel API-sleutel staat in de omgevingsvariabele CHATLEVEL_API_KEY, niet
-- in de database; het device-ID is geen geheim en staat daarom in
-- app_settings, net als de Slack-webhook-URL.

alter type public.outbound_channel add value if not exists 'whatsapp';

insert into public.app_settings (key, value, description) values
  ('whatsapp', '{"enabled": false, "device_id": null}'::jsonb,
   'WhatsApp via Chatlevel. De API-sleutel staat in CHATLEVEL_API_KEY, niet hier.')
on conflict (key) do nothing;

alter table public.users
  add column whatsapp_notifications jsonb not null
    default '{"enabled": false, "muted_types": []}'::jsonb;

comment on column public.users.whatsapp_notifications is
  'enabled: wil deze gebruiker WhatsApp-berichten? muted_types: notificatietypes die worden overgeslagen.';

create or replace function app.fan_out_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user        public.users;
  v_email_cfg   jsonb;
  v_slack_cfg   jsonb;
  v_whatsapp_cfg jsonb;
  v_project     public.projects;
  v_slack_events jsonb;
  v_link        text;
begin
  select * into v_user from public.users where id = new.user_id;
  if not found or not v_user.is_active then
    return new;
  end if;

  v_link := coalesce(new.link, '');

  -- --- E-mail -------------------------------------------------------------
  select value into v_email_cfg from public.app_settings where key = 'email';

  if coalesce((v_email_cfg ->> 'enabled')::boolean, false)
     and coalesce((v_user.email_notifications ->> 'enabled')::boolean, true)
     and not (
       coalesce(v_user.email_notifications -> 'muted_types', '[]'::jsonb)
         ? new.type::text
     )
  then
    insert into public.outbound_messages (
      channel, target, subject, body, payload, notification_id, project_id
    )
    values (
      'email',
      v_user.email,
      new.title,
      coalesce(new.body, new.title),
      jsonb_build_object('type', new.type, 'link', v_link, 'name', v_user.full_name),
      new.id,
      new.project_id
    );
  end if;

  -- --- WhatsApp (Chatlevel) -------------------------------------------------
  select value into v_whatsapp_cfg from public.app_settings where key = 'whatsapp';

  if coalesce((v_whatsapp_cfg ->> 'enabled')::boolean, false)
     and v_user.phone is not null and v_user.phone <> ''
     and coalesce((v_user.whatsapp_notifications ->> 'enabled')::boolean, false)
     and not (
       coalesce(v_user.whatsapp_notifications -> 'muted_types', '[]'::jsonb)
         ? new.type::text
     )
  then
    insert into public.outbound_messages (
      channel, target, subject, body, payload, notification_id, project_id
    )
    values (
      'whatsapp',
      v_user.phone,
      new.title,
      coalesce(new.body, new.title),
      jsonb_build_object('type', new.type, 'link', v_link, 'name', v_user.full_name),
      new.id,
      new.project_id
    );
  end if;

  -- --- Slack (§33) --------------------------------------------------------
  -- Slack krijgt één bericht per gebeurtenis, niet per ontvanger. We sturen
  -- alleen door voor interne notificaties, en alleen als het project een
  -- kanaal heeft waarvoor dit gebeurtenistype aan staat.
  if new.project_id is not null and v_user.role <> 'client' then
    select value into v_slack_cfg from public.app_settings where key = 'slack';

    if coalesce((v_slack_cfg ->> 'enabled')::boolean, false) then
      select * into v_project from public.projects where id = new.project_id;

      v_slack_events := coalesce(v_project.slack_config -> 'events', '[]'::jsonb);

      if v_project.slack_channel_id is not null
         and v_slack_events ? new.type::text
         -- Dubbele berichten voorkomen wanneer meerdere teamleden dezelfde
         -- notificatie krijgen.
         and not exists (
           select 1 from public.outbound_messages om
           where om.channel = 'slack'
             and om.project_id = new.project_id
             and om.payload ->> 'type' = new.type::text
             and om.payload ->> 'entity_id' = coalesce(new.entity_id::text, '')
             and om.created_at > now() - interval '1 minute'
         )
      then
        insert into public.outbound_messages (
          channel, target, subject, body, payload, notification_id, project_id
        )
        values (
          'slack',
          v_project.slack_channel_id,
          new.title,
          format('*%s*%s%s', new.title,
                 case when new.body is null then '' else E'\n' || new.body end,
                 E'\n_' || v_project.name || '_'),
          jsonb_build_object(
            'type', new.type,
            'entity_id', coalesce(new.entity_id::text, ''),
            'link', v_link,
            'project', v_project.name
          ),
          new.id,
          new.project_id
        );
      end if;
    end if;
  end if;

  return new;
end;
$$;
