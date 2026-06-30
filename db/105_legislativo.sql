-- =====================================================================
-- 105 — L3 Legislativo (Proposições, Tramitação, Votação, Leis)
-- =====================================================================
-- Ciclo legislativo: proposições (projetos de lei e demais) com tramitação
-- por fases (histórico append-only/imutável), votação nominal vinculada a
-- sessão (L2), emendas, coautoria, leis sancionadas/promulgadas e comitês de
-- iniciativa popular.
--
-- Todas as tabelas de dados nascem com tenant_id + RLS (skill multi-tenant-rls).
-- Referências a OUTROS módulos novos (autor_principal_id→vereador via
-- proposicao_autores, sessao_id→sessao L2) são uuid SIMPLES sem FK, para manter
-- os módulos independentes. proposicao_autores e proposicao_votos referenciam
-- vereadores (módulo L1 já existente) por FK.
-- Origem Laravel: ProjetoLei, Lei, ComiteIniciativaPopular. Ver
-- specs/legislativo-tramitacao.md.
-- =====================================================================

-- ── Proposições ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposicoes (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tipo               text        NOT NULL DEFAULT 'pl_ordinaria', -- pl_ordinaria | pl_complementar | resolucao | decreto_legislativo | requerimento | mocao | emenda
  numero             integer,
  ano                integer,
  protocolo          text,                                  -- nº de protocolo (string livre)
  ementa             text        NOT NULL,
  texto              text,                                  -- HTML/rich (EditorJS)
  pdf_url            text,
  storage_key        text,
  status_atual       text        NOT NULL DEFAULT 'protocolada', -- protocolada | em_comissao | pauta | aprovada | rejeitada | arquivada | sancionada | promulgada | vetada
  autor_principal_id uuid,                                  -- vereador (L1) SEM FK p/ independência
  data_protocolo     date,
  publicada          boolean     NOT NULL DEFAULT true,
  criado_em          timestamptz NOT NULL DEFAULT now(),
  atualizado_em      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposicoes_tipo_check
    CHECK (tipo IN ('pl_ordinaria','pl_complementar','resolucao','decreto_legislativo','requerimento','mocao','emenda')),
  CONSTRAINT proposicoes_status_check
    CHECK (status_atual IN ('protocolada','em_comissao','pauta','aprovada','rejeitada','arquivada','sancionada','promulgada','vetada'))
);
CREATE INDEX IF NOT EXISTS idx_proposicoes_tenant ON proposicoes (tenant_id, ano DESC, numero DESC);
CREATE INDEX IF NOT EXISTS idx_proposicoes_tipo ON proposicoes (tenant_id, tipo);
CREATE INDEX IF NOT EXISTS idx_proposicoes_status ON proposicoes (tenant_id, status_atual);
CREATE INDEX IF NOT EXISTS idx_proposicoes_autor ON proposicoes (tenant_id, autor_principal_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposicoes_numero
  ON proposicoes (tenant_id, tipo, ano, numero) WHERE numero IS NOT NULL AND ano IS NOT NULL;
SELECT app_enable_tenant_rls('proposicoes');

-- ── Autores / coautores / relatores da proposição ────────────────────────
-- Referencia vereadores (L1, já existente) por FK.
CREATE TABLE IF NOT EXISTS proposicao_autores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposicao_id uuid        NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  papel         text        NOT NULL DEFAULT 'autor', -- autor | coautor | relator
  ordem         integer     NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposicao_autores_papel_check
    CHECK (papel IN ('autor','coautor','relator'))
);
CREATE INDEX IF NOT EXISTS idx_proposicao_autores ON proposicao_autores (tenant_id, proposicao_id, ordem);
CREATE INDEX IF NOT EXISTS idx_proposicao_autores_ver ON proposicao_autores (tenant_id, vereador_id);
SELECT app_enable_tenant_rls('proposicao_autores');

-- ── Tramitações (histórico append-only/imutável) ─────────────────────────
-- comissao_id e relator_id são uuid SIMPLES (sem FK) — comissao/relator podem
-- pertencer a outro escopo; mantém o histórico imutável e desacoplado.
CREATE TABLE IF NOT EXISTS proposicao_tramitacoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposicao_id uuid        NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  fase          text        NOT NULL, -- corresponde a status_atual da proposição na transição
  despacho      text,
  comissao_id   uuid,                 -- comissao (L1) SEM FK
  relator_id    uuid,                 -- vereador (L1) SEM FK
  data          timestamptz NOT NULL DEFAULT now(),
  ator_id       uuid,                 -- usuário que registrou (sem FK)
  criado_em     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposicao_tramitacoes ON proposicao_tramitacoes (tenant_id, proposicao_id, data DESC);
SELECT app_enable_tenant_rls('proposicao_tramitacoes');

-- ── Votações (uma votação por turno/sessão de uma proposição) ────────────
-- sessao_id é uuid SIMPLES (sem FK) — sessao pertence ao módulo L2.
CREATE TABLE IF NOT EXISTS proposicao_votacoes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposicao_id uuid        NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  sessao_id     uuid,                 -- sessao (L2) SEM FK
  turno         text,                 -- primeiro | segundo | unico (livre)
  resultado     text        NOT NULL DEFAULT 'pendente', -- aprovado | rejeitado | pendente
  quorum        text,                 -- maioria_simples | maioria_absoluta | dois_tercos (livre)
  favoraveis    integer     NOT NULL DEFAULT 0,
  contrarios    integer     NOT NULL DEFAULT 0,
  abstencoes    integer     NOT NULL DEFAULT 0,
  ausentes      integer     NOT NULL DEFAULT 0,
  data          timestamptz NOT NULL DEFAULT now(),
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposicao_votacoes_resultado_check
    CHECK (resultado IN ('aprovado','rejeitado','pendente'))
);
CREATE INDEX IF NOT EXISTS idx_proposicao_votacoes ON proposicao_votacoes (tenant_id, proposicao_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_proposicao_votacoes_sessao ON proposicao_votacoes (tenant_id, sessao_id);
SELECT app_enable_tenant_rls('proposicao_votacoes');

-- ── Votos nominais (voto por vereador numa votação) ──────────────────────
CREATE TABLE IF NOT EXISTS proposicao_votos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  votacao_id    uuid        NOT NULL REFERENCES proposicao_votacoes(id) ON DELETE CASCADE,
  vereador_id   uuid        NOT NULL REFERENCES vereadores(id) ON DELETE CASCADE,
  voto          text        NOT NULL DEFAULT 'ausente', -- favoravel | contrario | abstencao | ausente
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposicao_votos_voto_check
    CHECK (voto IN ('favoravel','contrario','abstencao','ausente'))
);
CREATE INDEX IF NOT EXISTS idx_proposicao_votos ON proposicao_votos (tenant_id, votacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_proposicao_votos ON proposicao_votos (tenant_id, votacao_id, vereador_id);
SELECT app_enable_tenant_rls('proposicao_votos');

-- ── Emendas ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS proposicao_emendas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  proposicao_id uuid        NOT NULL REFERENCES proposicoes(id) ON DELETE CASCADE,
  numero        integer,
  tipo          text        NOT NULL DEFAULT 'modificativa', -- aditiva | supressiva | modificativa | substitutiva | aglutinativa
  texto         text,
  autor_id      uuid,                 -- vereador (L1) SEM FK
  status        text        NOT NULL DEFAULT 'apresentada', -- apresentada | aprovada | rejeitada | retirada
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT proposicao_emendas_tipo_check
    CHECK (tipo IN ('aditiva','supressiva','modificativa','substitutiva','aglutinativa')),
  CONSTRAINT proposicao_emendas_status_check
    CHECK (status IN ('apresentada','aprovada','rejeitada','retirada'))
);
CREATE INDEX IF NOT EXISTS idx_proposicao_emendas ON proposicao_emendas (tenant_id, proposicao_id, numero);
SELECT app_enable_tenant_rls('proposicao_emendas');

-- ── Leis (normas sancionadas/promulgadas) ────────────────────────────────
-- proposicao_id é uuid SIMPLES (sem FK) — vínculo opcional à proposição de origem.
CREATE TABLE IF NOT EXISTS leis (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  numero        text        NOT NULL,
  tipo          text        NOT NULL DEFAULT 'lei_ordinaria', -- lei_ordinaria | lei_complementar | resolucao | decreto_legislativo | emenda_lei_organica
  ano           integer,
  ementa        text        NOT NULL,
  texto         text,                                  -- compilação/HTML
  data_sancao   date,
  proposicao_id uuid,                                  -- proposição de origem SEM FK
  pdf_url       text,
  storage_key   text,
  vigente       boolean     NOT NULL DEFAULT true,
  publicada     boolean     NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT leis_tipo_check
    CHECK (tipo IN ('lei_ordinaria','lei_complementar','resolucao','decreto_legislativo','emenda_lei_organica'))
);
CREATE INDEX IF NOT EXISTS idx_leis_tenant ON leis (tenant_id, ano DESC, numero DESC);
CREATE INDEX IF NOT EXISTS idx_leis_tipo ON leis (tenant_id, tipo, vigente);
CREATE INDEX IF NOT EXISTS idx_leis_proposicao ON leis (tenant_id, proposicao_id);
SELECT app_enable_tenant_rls('leis');

-- ── Comitês de iniciativa popular ────────────────────────────────────────
-- proposicao_id é uuid SIMPLES (sem FK) — conversão opcional em proposição.
CREATE TABLE IF NOT EXISTS iniciativa_popular_comites (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo          text        NOT NULL,
  descricao       text,
  responsavel     text,                                -- nome do representante do comitê
  contato         text,
  meta_apoios     integer     NOT NULL DEFAULT 0,      -- nº mínimo de assinaturas exigido
  apoios_validos  integer     NOT NULL DEFAULT 0,
  status          text        NOT NULL DEFAULT 'coletando', -- coletando | em_validacao | aprovada | rejeitada | convertida
  proposicao_id   uuid,                                -- proposição gerada SEM FK
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT iniciativa_popular_status_check
    CHECK (status IN ('coletando','em_validacao','aprovada','rejeitada','convertida'))
);
CREATE INDEX IF NOT EXISTS idx_iniciativa_popular ON iniciativa_popular_comites (tenant_id, status, criado_em DESC);
SELECT app_enable_tenant_rls('iniciativa_popular_comites');
