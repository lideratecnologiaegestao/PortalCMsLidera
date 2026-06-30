-- =====================================================================
-- 103 — L1 Parlamentar (Vereadores, Mesa Diretora, Comissões)
-- =====================================================================
-- Núcleo legislativo: composição da Casa. Vereadores (perfil público,
-- mandato, biografia), Mesa Diretora com vigência, comissões (permanentes/
-- temporárias/CPI) com cargos, documentos de comissão, e a produção
-- parlamentar (posts sociais e representações).
--
-- Todas as tabelas de dados nascem com tenant_id + RLS (skill multi-tenant-rls).
-- Origem Laravel: Vereador, VereadorPost(+Midia), VereadorRepresentacao,
-- Comissao, ComissaoCargo, ComissaoDocumento. Ver specs/parlamentar.md.
-- =====================================================================

-- ── Vereadores ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vereadores (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id           uuid        REFERENCES users(id) ON DELETE SET NULL, -- vínculo opcional p/ login do vereador
  nome              text        NOT NULL,                 -- nome civil
  nome_parlamentar  text        NOT NULL,                 -- nome de urna
  slug              citext,
  partido           text,                                 -- sigla partidária
  status            text        NOT NULL DEFAULT 'ativo', -- ativo | licenciado | afastado | inativo
  legislatura       text,                                 -- ex.: "2021-2024"
  mandato_inicio    date,
  mandato_fim       date,
  email             text,
  telefone          text,
  foto_url          text,
  biografia         text,                                 -- HTML/rich (EditorJS)
  redes             jsonb       NOT NULL DEFAULT '{}'::jsonb, -- { instagram, facebook, ... }
  ordem             integer     NOT NULL DEFAULT 0,
  ativo             boolean     NOT NULL DEFAULT true,
  criado_em         timestamptz NOT NULL DEFAULT now(),
  atualizado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vereadores_status_check
    CHECK (status IN ('ativo','licenciado','afastado','inativo'))
);
CREATE INDEX IF NOT EXISTS idx_vereadores_tenant ON vereadores (tenant_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_vereadores_status ON vereadores (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vereadores_slug ON vereadores (tenant_id, slug) WHERE slug IS NOT NULL;
SELECT app_enable_tenant_rls('vereadores');

-- ── Mesa Diretora (cargos com vigência) ──────────────────────────────────
-- Resolve a mesa vigente por data (cargo + janela inicio/fim).
CREATE TABLE IF NOT EXISTS vereador_mesa_cargos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  cargo         text        NOT NULL, -- presidente | vice_presidente | primeiro_secretario | segundo_secretario | corregedor | outro
  inicio        date        NOT NULL,
  fim           date,
  legislatura   text,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mesa_cargo_check
    CHECK (cargo IN ('presidente','vice_presidente','primeiro_secretario','segundo_secretario','corregedor','outro'))
);
CREATE INDEX IF NOT EXISTS idx_mesa_tenant ON vereador_mesa_cargos (tenant_id, cargo, inicio DESC);
CREATE INDEX IF NOT EXISTS idx_mesa_vereador ON vereador_mesa_cargos (tenant_id, vereador_id);
SELECT app_enable_tenant_rls('vereador_mesa_cargos');

-- ── Comissões ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comissoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome          text        NOT NULL,
  slug          citext,
  tipo          text        NOT NULL DEFAULT 'permanente', -- permanente | temporaria | cpi | especial
  descricao     text,
  legislatura   text,
  ativo         boolean     NOT NULL DEFAULT true,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comissoes_tipo_check
    CHECK (tipo IN ('permanente','temporaria','cpi','especial'))
);
CREATE INDEX IF NOT EXISTS idx_comissoes_tenant ON comissoes (tenant_id, ativo, ordem);
CREATE UNIQUE INDEX IF NOT EXISTS uq_comissoes_slug ON comissoes (tenant_id, slug) WHERE slug IS NOT NULL;
SELECT app_enable_tenant_rls('comissoes');

-- ── Cargos em comissão (composição com vigência) ─────────────────────────
CREATE TABLE IF NOT EXISTS comissao_cargos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comissao_id   uuid        NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  cargo         text        NOT NULL DEFAULT 'membro', -- presidente | vice_presidente | relator | membro
  inicio        date,
  fim           date,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comissao_cargo_check
    CHECK (cargo IN ('presidente','vice_presidente','relator','membro'))
);
CREATE INDEX IF NOT EXISTS idx_comissao_cargos ON comissao_cargos (tenant_id, comissao_id, ordem);
CREATE INDEX IF NOT EXISTS idx_comissao_cargos_ver ON comissao_cargos (tenant_id, vereador_id);
SELECT app_enable_tenant_rls('comissao_cargos');

-- ── Documentos de comissão ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comissao_documentos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  comissao_id   uuid        NOT NULL REFERENCES comissoes(id) ON DELETE CASCADE,
  titulo        text        NOT NULL,
  arquivo_url   text,
  storage_key   text,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comissao_docs ON comissao_documentos (tenant_id, comissao_id, ordem);
SELECT app_enable_tenant_rls('comissao_documentos');

-- ── Posts do vereador (produção/atividade) ───────────────────────────────
CREATE TABLE IF NOT EXISTS vereador_posts (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  titulo        text,
  conteudo      text,                                      -- HTML/rich
  publicado     boolean     NOT NULL DEFAULT true,
  publicado_em  timestamptz NOT NULL DEFAULT now(),
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vereador_posts ON vereador_posts (tenant_id, vereador_id, publicado_em DESC);
SELECT app_enable_tenant_rls('vereador_posts');

CREATE TABLE IF NOT EXISTS vereador_post_midias (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id       uuid        NOT NULL REFERENCES vereador_posts(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'foto',       -- foto | video
  url           text,
  storage_key   text,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vereador_post_midias ON vereador_post_midias (tenant_id, post_id, ordem);
SELECT app_enable_tenant_rls('vereador_post_midias');

-- ── Representações do vereador (encaminhamentos) ─────────────────────────
CREATE TABLE IF NOT EXISTS vereador_representacoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'sugestao',   -- sugestao | denuncia | oficio | requerimento | outro
  assunto       text        NOT NULL,
  descricao     text,
  status        text        NOT NULL DEFAULT 'aberta',     -- aberta | em_andamento | concluida | arquivada
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT representacao_status_check
    CHECK (status IN ('aberta','em_andamento','concluida','arquivada'))
);
CREATE INDEX IF NOT EXISTS idx_vereador_repr ON vereador_representacoes (tenant_id, vereador_id, criado_em DESC);
SELECT app_enable_tenant_rls('vereador_representacoes');
