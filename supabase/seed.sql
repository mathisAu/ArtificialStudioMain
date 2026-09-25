-- =============================================================================
-- Seed · basisdata die elk systeem nodig heeft
-- =============================================================================
-- Dit is geen demo-data. Het gaat uitsluitend om het standaard projecttemplate
-- uit §34 van het functioneel ontwerp. Klanten, projecten en gebruikers maak je
-- via de applicatie aan.

insert into public.project_templates (id, name, description, project_type)
values (
  '11111111-1111-4111-8111-111111111111',
  'Software / Automatiseringsproject',
  'Standaardfases voor een software- of automatiseringstraject, van intake tot afronding.',
  'automation'
)
on conflict (id) do nothing;

insert into public.project_template_items (template_id, kind, title, position, offset_days, priority)
values
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Intake',                    1,  0,  'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Benodigdheden verzamelen',  2,  3,  'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Technische scope',          3,  7,  'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Ontwikkeling',              4,  14, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Interne test',              5,  28, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Klanttest',                 6,  35, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Feedback verwerken',        7,  42, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Laatste controle',          8,  49, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Oplevering',                9,  53, 'high'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Documentatie',             10,  56, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'phase', 'Afronding',                11,  60, 'normal'),

  ('11111111-1111-4111-8111-111111111111', 'task',  'Intakegesprek inplannen',          1,  2, 'high'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Doelstelling en scope vastleggen', 2,  5, 'high'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Benodigde toegangen opvragen',     3,  7, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Technisch ontwerp opstellen',      4, 10, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Ontwikkeling uitvoeren',           5, 28, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Interne test uitvoeren',           6, 32, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Testomgeving klaarzetten voor klant', 7, 35, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Feedback van klant verwerken',     8, 45, 'normal'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Laatste controle uitvoeren',       9, 50, 'high'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Opleveren en overdragen',         10, 53, 'urgent'),
  ('11111111-1111-4111-8111-111111111111', 'task',  'Documentatie opleveren',          11, 56, 'normal')
on conflict do nothing;
