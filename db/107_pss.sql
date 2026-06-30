-- =====================================================================
-- 107 — L5 PSS (Processo Seletivo Simplificado)
-- =====================================================================
-- Gestão de processos seletivos simplificados da câmara: editais, vagas,
-- fases, critérios, inscrição do cidadão, anexos, notas e ranking, com
-- integração ao APLIC (TCE-MT). Origem Laravel: 14 models Pss*.
--
-- Todas as tabelas de dados nascem com tenant_id + RLS (skill multi-tenant-rls).
-- Índices sempre começam por tenant_id. Ver specs/pss.md.
-- =====================================================================

-- ── Editais ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pss_editais (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero             text        NOT NULL,                  -- ex.: "001/2026"
  titulo             text        NOT NULL,
  slug               citext,
  objeto             text,                                  -- HTML/rich (descrição do certame)
  status             text        NOT NULL DEFAULT 'rascunho', -- rascunho | publicado | inscricoes_abertas | inscricoes_encerradas | em_avaliacao | homologado | cancelado
  inscricao_inicio   timestamptz,
  inscricao_fim      timestamptz,
  ranking_publicado  boolean     NOT NULL DEFAULT false,
  ranking_publicado_em timestamptz,
  ativo              boolean     NOT NULL DEFAULT true,
  ordem              integer     NOT NULL DEFAULT 0,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pss_editais_status_check
    CHECK (status IN ('rascunho','publicado','inscricoes_abertas','inscricoes_encerradas','em_avaliacao','homologado','cancelado'))
);
CREATE INDEX IF NOT EXISTS idx_pss_editais_tenant ON pss_editais (tenant_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_pss_editais_status ON pss_editais (tenant_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pss_editais_slug ON pss_editais (tenant_id, slug) WHERE slug IS NOT NULL;
SELECT app_enable_tenant_rls('pss_editais');

-- ── Vagas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pss_vagas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  cargo         text        NOT NULL,
  escolaridade  text,                                       -- requisito de escolaridade
  quantidade    integer     NOT NULL DEFAULT 1,
  vagas_cadastro integer    NOT NULL DEFAULT 0,             -- cadastro de reserva
  requisitos    text,                                       -- HTML/rich
  carga_horaria text,
  salario       numeric(14,2),
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_vagas_tenant ON pss_vagas (tenant_id, edital_id, ordem);
SELECT app_enable_tenant_rls('pss_vagas');

-- ── Fases (etapas ordenadas do certame) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS pss_fases (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  nome          text        NOT NULL,                       -- ex.: "Prova de Títulos"
  tipo          text        NOT NULL DEFAULT 'titulos',     -- inscricao | prova_objetiva | prova_pratica | entrevista | titulos | experiencia
  peso          numeric(8,4) NOT NULL DEFAULT 1,            -- peso da fase na nota final
  eliminatoria  boolean     NOT NULL DEFAULT false,
  nota_corte    numeric(8,2),                               -- nota mínima (se eliminatória)
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pss_fases_tipo_check
    CHECK (tipo IN ('inscricao','prova_objetiva','prova_pratica','entrevista','titulos','experiencia'))
);
CREATE INDEX IF NOT EXISTS idx_pss_fases_tenant ON pss_fases (tenant_id, edital_id, ordem);
SELECT app_enable_tenant_rls('pss_fases');

-- ── Critérios (pontuação configurável por fase) ──────────────────────────
CREATE TABLE IF NOT EXISTS pss_criterios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fase_id       uuid        NOT NULL REFERENCES pss_fases(id) ON DELETE CASCADE,
  descricao     text        NOT NULL,                       -- ex.: "Pós-graduação na área"
  pontos        numeric(8,2) NOT NULL DEFAULT 0,            -- pontos por ocorrência
  pontos_maximo numeric(8,2),                               -- teto de pontos para o critério
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_criterios_tenant ON pss_criterios (tenant_id, fase_id, ordem);
SELECT app_enable_tenant_rls('pss_criterios');

-- ── Inscrições (cidadão autenticado) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS pss_inscricoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  vaga_id       uuid        REFERENCES pss_vagas(id) ON DELETE SET NULL,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL, -- cidadão autenticado
  protocolo     text        NOT NULL,                       -- número de protocolo da inscrição
  nome          text        NOT NULL,
  cpf           text,                                       -- LGPD: acesso restrito à comissão
  email         text,
  telefone      text,
  dados         jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- demais campos do formulário
  status        text        NOT NULL DEFAULT 'recebida',    -- recebida | deferida | indeferida | cancelada
  motivo        text,                                       -- justificativa de (in)deferimento
  nota_final    numeric(10,4),                              -- calculada na publicação do ranking
  classificacao integer,                                    -- posição no ranking publicado
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pss_inscricoes_status_check
    CHECK (status IN ('recebida','deferida','indeferida','cancelada'))
);
CREATE INDEX IF NOT EXISTS idx_pss_inscricoes_tenant ON pss_inscricoes (tenant_id, edital_id, status);
CREATE INDEX IF NOT EXISTS idx_pss_inscricoes_user ON pss_inscricoes (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_pss_inscricoes_rank ON pss_inscricoes (tenant_id, edital_id, classificacao);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pss_inscricoes_protocolo ON pss_inscricoes (tenant_id, protocolo);
SELECT app_enable_tenant_rls('pss_inscricoes');

-- ── Critérios declarados na inscrição (títulos/experiência informados) ────
CREATE TABLE IF NOT EXISTS pss_inscricao_criterios (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inscricao_id  uuid        NOT NULL REFERENCES pss_inscricoes(id) ON DELETE CASCADE,
  criterio_id   uuid        NOT NULL REFERENCES pss_criterios(id) ON DELETE CASCADE,
  quantidade    integer     NOT NULL DEFAULT 1,             -- quantas ocorrências o candidato declarou
  observacao    text,
  validado      boolean     NOT NULL DEFAULT false,         -- conferido pela comissão
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_insc_criterios_tenant ON pss_inscricao_criterios (tenant_id, inscricao_id);
CREATE INDEX IF NOT EXISTS idx_pss_insc_criterios_crit ON pss_inscricao_criterios (tenant_id, criterio_id);
SELECT app_enable_tenant_rls('pss_inscricao_criterios');

-- ── Notas (lançamento por fase / inscrição pela comissão) ────────────────
CREATE TABLE IF NOT EXISTS pss_notas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inscricao_id  uuid        NOT NULL REFERENCES pss_inscricoes(id) ON DELETE CASCADE,
  fase_id       uuid        NOT NULL REFERENCES pss_fases(id) ON DELETE CASCADE,
  nota          numeric(8,2) NOT NULL DEFAULT 0,
  observacao    text,
  lancado_por   uuid        REFERENCES users(id) ON DELETE SET NULL, -- membro da comissão
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_notas_tenant ON pss_notas (tenant_id, inscricao_id, fase_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pss_notas_insc_fase ON pss_notas (tenant_id, inscricao_id, fase_id);
SELECT app_enable_tenant_rls('pss_notas');

-- ── Anexos (documentos do edital ou da inscrição) ────────────────────────
-- edital_id e inscricao_id mutuamente exclusivos conforme o contexto do anexo.
CREATE TABLE IF NOT EXISTS pss_anexos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        REFERENCES pss_editais(id) ON DELETE CASCADE,
  inscricao_id  uuid        REFERENCES pss_inscricoes(id) ON DELETE CASCADE,
  titulo        text        NOT NULL,
  tipo          text        NOT NULL DEFAULT 'documento',   -- edital | anexo | retificacao | documento_candidato
  url           text,
  storage_key   text,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_anexos_edital ON pss_anexos (tenant_id, edital_id, ordem);
CREATE INDEX IF NOT EXISTS idx_pss_anexos_inscricao ON pss_anexos (tenant_id, inscricao_id, ordem);
SELECT app_enable_tenant_rls('pss_anexos');

-- ── APLIC: aberturas e retificações (versionadas) ────────────────────────
CREATE TABLE IF NOT EXISTS pss_aplic_abertura_retificacao (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  tipo          text        NOT NULL DEFAULT 'abertura',    -- abertura | retificacao
  versao        integer     NOT NULL DEFAULT 1,
  data_ato      date,
  descricao     text,
  url           text,                                       -- ato publicado
  storage_key   text,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pss_aplic_abert_tipo_check
    CHECK (tipo IN ('abertura','retificacao'))
);
CREATE INDEX IF NOT EXISTS idx_pss_aplic_abert_tenant ON pss_aplic_abertura_retificacao (tenant_id, edital_id, versao);
SELECT app_enable_tenant_rls('pss_aplic_abertura_retificacao');

-- ── APLIC: membros da comissão do certame ────────────────────────────────
CREATE TABLE IF NOT EXISTS pss_aplic_comissao_membro (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  nome          text        NOT NULL,
  cpf           text,
  cargo         text        NOT NULL DEFAULT 'membro',      -- presidente | membro | suplente | secretario
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pss_aplic_comissao_cargo_check
    CHECK (cargo IN ('presidente','membro','suplente','secretario'))
);
CREATE INDEX IF NOT EXISTS idx_pss_aplic_comissao_tenant ON pss_aplic_comissao_membro (tenant_id, edital_id, ordem);
SELECT app_enable_tenant_rls('pss_aplic_comissao_membro');

-- ── APLIC: situação do certame (domínio TCE-MT) ──────────────────────────
CREATE TABLE IF NOT EXISTS pss_aplic_situacao (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  codigo        text        NOT NULL,                       -- código de situação no leiaute APLIC
  descricao     text,
  data_situacao date,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_aplic_situacao_tenant ON pss_aplic_situacao (tenant_id, edital_id, data_situacao DESC);
SELECT app_enable_tenant_rls('pss_aplic_situacao');

-- ── APLIC: tabela salarial vinculada à vaga (leiaute TCE-MT) ─────────────
CREATE TABLE IF NOT EXISTS pss_aplic_tabela_salarial (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  edital_id     uuid        NOT NULL REFERENCES pss_editais(id) ON DELETE CASCADE,
  vaga_id       uuid        REFERENCES pss_vagas(id) ON DELETE CASCADE,
  codigo        text,                                       -- código da tabela/cargo no APLIC
  cargo         text        NOT NULL,
  nivel         text,
  classe        text,
  salario_base  numeric(14,2) NOT NULL DEFAULT 0,
  carga_horaria text,
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pss_aplic_tab_sal_tenant ON pss_aplic_tabela_salarial (tenant_id, edital_id, ordem);
SELECT app_enable_tenant_rls('pss_aplic_tabela_salarial');
