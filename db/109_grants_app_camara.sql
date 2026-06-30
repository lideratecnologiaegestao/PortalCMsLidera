-- =====================================================================
-- 109 — Grants do role de aplicação (portal_app) sobre TODAS as tabelas
-- =====================================================================
-- O app conecta como `portal_app` (NOSUPERUSER NOBYPASSRLS) para que o RLS
-- seja efetivamente aplicado (superusuário burla RLS). As migrations base
-- (017+) concedem privilégios por tabela ao portal_app, MAS as migrations do
-- domínio legislativo (103–108: vereadores, comissões, sessões, proposições,
-- leis, cursos/certificados, PSS, eventos) NÃO concedem — então sem esta
-- migration o app (portal_app) tomaria "permission denied" nessas tabelas.
--
-- Esta migration roda por ÚLTIMO e faz um grant abrangente (schema-wide) +
-- DEFAULT PRIVILEGES para tabelas/sequences futuras. Idempotente e seguro
-- (GRANT é aditivo; só executa se o role existir — em dev sem o role, é no-op).
--
-- IMPORTANTE: os roles portal_app/portal_ro são criados FORA das migrations
-- (provisioning do banco), com NOSUPERUSER NOBYPASSRLS. Ver docs de instalação
-- e o runbook de deploy da câmara.
-- =====================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO portal_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO portal_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO portal_app';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO portal_app';
    -- Tabelas/sequences criadas depois (por novas migrations rodadas pelo superusuário)
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO portal_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO portal_app';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'portal_ro') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA public TO portal_ro';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO portal_ro';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO portal_ro';
  END IF;
END$$;
