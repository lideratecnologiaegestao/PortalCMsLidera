-- =====================================================================
-- 108 — L6 Eventos & Audiências Públicas (com certificação)
-- =====================================================================
-- Agenda de eventos institucionais e audiências públicas: cadastro,
-- inscrições do cidadão (com/sem login), controle de presença (check-in)
-- e certificado de participação com código verificável.
--
-- Todas as tabelas de dados nascem com tenant_id + RLS (skill multi-tenant-rls).
-- Origem Laravel: Evento, EventoInscricao, Assinante. Ver specs/eventos.md.
--
-- Vinculação opcional a uma sessão do plenário (L2) é coluna uuid SIMPLES,
-- SEM FK e SEM relation no Prisma, para manter os módulos independentes.
-- =====================================================================

-- ── Eventos / Audiências públicas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eventos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'audiencia_publica', -- audiencia_publica | palestra | seminario | solenidade | outro
  titulo        text        NOT NULL,
  slug          citext,
  descricao     text,                                  -- HTML/rich (EditorJS)
  data_hora     timestamptz NOT NULL,                  -- início do evento
  data_fim      timestamptz,                           -- término (opcional)
  local         text,                                  -- endereço/sala (presencial)
  online_url    text,                                  -- link de transmissão/sala virtual
  vagas         integer,                               -- limite de inscrições (NULL = ilimitado)
  capa_url      text,
  certificavel  boolean     NOT NULL DEFAULT false,    -- emite certificado de participação?
  inscricoes_abertas boolean NOT NULL DEFAULT true,    -- aceita novas inscrições?
  sessao_id     uuid,                                  -- vínculo opcional a sessão do plenário (L2) — SEM FK
  publicado     boolean     NOT NULL DEFAULT true,
  ativo         boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eventos_tipo_check
    CHECK (tipo IN ('audiencia_publica','palestra','seminario','solenidade','outro'))
);
CREATE INDEX IF NOT EXISTS idx_eventos_tenant ON eventos (tenant_id, ativo, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_tipo ON eventos (tenant_id, tipo, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_eventos_sessao ON eventos (tenant_id, sessao_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_eventos_slug ON eventos (tenant_id, slug) WHERE slug IS NOT NULL;
SELECT app_enable_tenant_rls('eventos');

-- ── Inscrições no evento ──────────────────────────────────────────────────
-- cidadao_id opcional: a inscrição pode ser feita sem login (nome/email).
CREATE TABLE IF NOT EXISTS evento_inscricoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id     uuid        NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cidadao_id    uuid        REFERENCES users(id) ON DELETE SET NULL, -- vínculo opcional ao login do cidadão
  nome          text        NOT NULL,
  email         text        NOT NULL,
  telefone      text,
  documento     text,                                  -- CPF (p/ certificado) — minimização LGPD
  status        text        NOT NULL DEFAULT 'confirmada', -- confirmada | lista_espera | cancelada
  presente      boolean     NOT NULL DEFAULT false,     -- check-in registrado?
  presente_em   timestamptz,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evento_inscricoes_status_check
    CHECK (status IN ('confirmada','lista_espera','cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_evento_inscricoes_evento ON evento_inscricoes (tenant_id, evento_id, status);
CREATE INDEX IF NOT EXISTS idx_evento_inscricoes_cidadao ON evento_inscricoes (tenant_id, cidadao_id, criado_em DESC);
-- Evita inscrição duplicada do mesmo e-mail no mesmo evento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_inscricoes_email ON evento_inscricoes (tenant_id, evento_id, lower(email));
SELECT app_enable_tenant_rls('evento_inscricoes');

-- ── Certificados de participação ──────────────────────────────────────────
-- codigo verificável publicamente (reaproveita GET /api/validar/:codigo do L4).
CREATE TABLE IF NOT EXISTS evento_certificados (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evento_id     uuid        NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  inscricao_id  uuid        NOT NULL REFERENCES evento_inscricoes(id) ON DELETE CASCADE,
  codigo        text        NOT NULL,                  -- código público de validação
  nome          text        NOT NULL,                  -- nome do participante (snapshot)
  pdf_url       text,                                  -- ref do PDF gerado (async)
  storage_key   text,
  emitido_em    timestamptz NOT NULL DEFAULT now(),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evento_certificados_evento ON evento_certificados (tenant_id, evento_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_certificados_codigo ON evento_certificados (tenant_id, codigo);
-- Um certificado por inscrição.
CREATE UNIQUE INDEX IF NOT EXISTS uq_evento_certificados_inscricao ON evento_certificados (tenant_id, inscricao_id);
SELECT app_enable_tenant_rls('evento_certificados');
