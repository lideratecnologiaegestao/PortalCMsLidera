-- =====================================================================
-- 104 — L2 Sessões Plenárias (Pauta, Ata, Presença, TV Câmara)
-- =====================================================================
-- Gestão e publicação das sessões do plenário: agenda, tipo de sessão,
-- pauta (itens ordenados), ata (EditorJS/HTML + PDF), registro de
-- presença/ausência de vereadores e TV Câmara (transmissão ao vivo e
-- acervo de gravações).
--
-- Todas as tabelas de dados nascem com tenant_id + RLS (skill multi-tenant-rls).
-- Origem Laravel: Sessao, TipoSessao, Evento, EventoInscricao.
-- Ver specs/sessoes-plenarias.md.
--
-- INDEPENDÊNCIA DE MÓDULOS: proposicao_id (pauta) é uuid SIMPLES, sem FK e
-- sem relation no Prisma — referência ao módulo Legislativo/Tramitação que
-- permanece independente.
-- =====================================================================

-- ── Tipos de sessão (ordinária, extraordinária, solene, audiência) ────────
CREATE TABLE IF NOT EXISTS tipos_sessao (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome          text        NOT NULL,                 -- ex.: "Ordinária", "Solene"
  descricao     text,
  ordem         integer     NOT NULL DEFAULT 0,
  ativo         boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tipos_sessao_tenant ON tipos_sessao (tenant_id, ativo, ordem);
SELECT app_enable_tenant_rls('tipos_sessao');

-- ── Sessões plenárias ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessoes (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo_sessao_id    uuid        REFERENCES tipos_sessao(id) ON DELETE SET NULL,
  titulo            text        NOT NULL,
  data_hora         timestamptz NOT NULL,
  local             text,
  status            text        NOT NULL DEFAULT 'agendada', -- agendada | em_andamento | encerrada | cancelada
  quorum            integer,                                 -- nº de presentes / mínimo regimental
  video_ao_vivo_url text,                                    -- URL/embed do stream ao vivo
  ata_conteudo      text,                                    -- HTML/rich (EditorJS)
  ata_publicada_em  timestamptz,                             -- NULL = ata não publicada
  evento_id         uuid,                                    -- vínculo opcional com módulo Eventos (L6) — uuid simples, sem FK
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessoes_status_check
    CHECK (status IN ('agendada','em_andamento','encerrada','cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_sessoes_tenant ON sessoes (tenant_id, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_sessoes_status ON sessoes (tenant_id, status, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_sessoes_tipo ON sessoes (tenant_id, tipo_sessao_id);
SELECT app_enable_tenant_rls('sessoes');

-- ── Itens de pauta (ordenados; vínculo opcional a proposição) ─────────────
CREATE TABLE IF NOT EXISTS sessao_pauta_itens (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessao_id     uuid        NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  proposicao_id uuid,                                     -- matéria/projeto de lei vinculado — uuid simples, SEM FK
  ordem         integer     NOT NULL DEFAULT 0,
  titulo        text        NOT NULL,
  descricao     text,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessao_pauta ON sessao_pauta_itens (tenant_id, sessao_id, ordem);
SELECT app_enable_tenant_rls('sessao_pauta_itens');

-- ── Presença/ausência de vereadores ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessao_presencas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessao_id     uuid        NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  situacao      text        NOT NULL DEFAULT 'presente', -- presente | ausente | justificado
  observacao    text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sessao_presenca_situacao_check
    CHECK (situacao IN ('presente','ausente','justificado')),
  CONSTRAINT uq_sessao_presenca UNIQUE (sessao_id, vereador_id)
);
CREATE INDEX IF NOT EXISTS idx_sessao_presencas ON sessao_presencas (tenant_id, sessao_id);
CREATE INDEX IF NOT EXISTS idx_sessao_presencas_ver ON sessao_presencas (tenant_id, vereador_id, situacao);
SELECT app_enable_tenant_rls('sessao_presencas');

-- ── Gravações (acervo TV Câmara) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessao_gravacoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sessao_id     uuid        NOT NULL REFERENCES sessoes(id) ON DELETE CASCADE,
  titulo        text        NOT NULL,
  video_url     text,                                     -- URL/embed (YouTube, etc.)
  storage_key   text,                                     -- mídia própria (storage da base)
  duracao       integer,                                  -- segundos
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessao_gravacoes ON sessao_gravacoes (tenant_id, sessao_id, ordem);
SELECT app_enable_tenant_rls('sessao_gravacoes');
