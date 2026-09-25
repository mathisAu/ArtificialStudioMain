-- =============================================================================
-- Rol van info@artificialstudio.io bijwerken naar admin
-- =============================================================================
update public.users
set role = 'admin'
where lower(email) = lower('info@artificialstudio.io');
