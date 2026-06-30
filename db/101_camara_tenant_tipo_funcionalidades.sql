-- =====================================================================
-- 101 — Tipo de entidade por tenant + feature flags (plataforma Câmara)
-- =====================================================================
-- A plataforma nasceu como portal de PREFEITURA (poder executivo) e está
-- sendo forkada para servir CÂMARAS (poder legislativo). Para que a mesma
-- base de código sirva os dois tipos de entidade — e prepare o terreno
-- para um futuro monorepo único — cada tenant declara seu `tipo` e um mapa
-- de `funcionalidades` (feature flags) que liga/desliga módulos no menu,
-- no admin e nas rotas.
--
--   tipo = 'camara'      → poder legislativo (padrão nesta plataforma)
--   tipo = 'prefeitura'  → poder executivo (compatibilidade com a origem)
--
-- Convenção de flags em `funcionalidades` (jsonb). Ausente = usar default
-- por tipo (resolvido na aplicação). Exemplos:
--   { "chamados": false,            -- zeladoria georreferenciada (executivo)
--     "parlamentar": true,          -- vereadores / mesa diretora / comissões
--     "sessoes": true,              -- sessões plenárias / TV Câmara
--     "legislativo": true,          -- projetos de lei / tramitação / leis
--     "escola_legislativa": true,   -- cursos / provas / certificados
--     "pss": true }                 -- processo seletivo simplificado
--
-- Sem RLS aqui: `tenants` é a tabela-registro da plataforma (sem tenant_id).
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'camara';

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS funcionalidades jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Restringe o domínio de `tipo`. Idempotente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_tipo_check'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_tipo_check CHECK (tipo IN ('prefeitura', 'camara'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tenants_tipo ON tenants (tipo);

COMMENT ON COLUMN tenants.tipo IS 'Tipo de entidade: camara (legislativo) | prefeitura (executivo).';
COMMENT ON COLUMN tenants.funcionalidades IS 'Feature flags por tenant (jsonb). Ausente = default por tipo, resolvido na aplicação.';
