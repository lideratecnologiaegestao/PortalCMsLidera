-- =====================================================================
-- SEED — "Câmara Municipal de Exemplo" (tenant demo tipo='camara')
-- =====================================================================
-- Cria um tenant de DEMONSTRAÇÃO da plataforma Câmara, com dados fictícios
-- suficientes para validação visual ponta a ponta dos módulos legislativos:
-- Parlamentar (vereadores + mesa diretora + comissões), Sessões (com pauta),
-- Legislativo (1 projeto de lei + 1 lei) e Escola Legislativa (1 curso).
--
-- Pré-requisitos: as migrations 001–108 devem estar aplicadas. Em especial:
--   101_camara_tenant_tipo_funcionalidades.sql  (tenants.tipo / funcionalidades)
--   103_parlamentar.sql · 104_sessoes.sql · 105_legislativo.sql
--   106_escola_legislativa.sql
--
-- IDEMPOTÊNCIA: seguro para rodar N vezes. Usa um UUID FIXO para o tenant demo
-- e `ON CONFLICT DO NOTHING` / chaves naturais (slug, número) em todas as
-- inserções, de modo que reexecuções não duplicam linhas.
--
-- ISOLAMENTO (RLS): todas as tabelas de dados têm RLS por tenant_id. Roda em
-- MODO PLATAFORMA — habilita `app.is_platform=on` na transação (mesmo bypass do
-- provisioning do super_admin, previsto pela policy `tenant_isolation` em
-- db/001). NÃO desabilita RLS.
--
-- PORTABILIDADE: todo o script é um único bloco PL/pgSQL (DO $$ … $$;) — não
-- depende de variáveis do psql (\set / :'VAR'), então roda também por outros
-- runners (prisma db execute, GUIs, etc.). O bloco executa numa transação
-- implícita; em erro, faz rollback total.
--
-- SENHA DO ADMIN: o hash local usa scrypt no formato `salt:derivado`
-- (api/src/modules/auth/password.ts) e NÃO é computável em SQL puro. Por isso o
-- admin demo nasce com `senha_hash = NULL`. Para liberar o login local, use o
-- reset de senha do super_admin (gera provisória) ou autentique via gov.br.
-- =====================================================================

DO $seed$
DECLARE
  v_tenant   uuid := '11111111-1111-4111-8111-111111111111'; -- UUID fixo do tenant demo
  v_sessao   uuid;
  v_curso    uuid;
  v_modulo   uuid;
  v_prop     uuid;
  v_comissao uuid;
BEGIN
  -- Modo plataforma: permite inserir cross-tenant em tabelas com RLS nesta
  -- transação (SET LOCAL — revertido no fim do bloco/transação).
  PERFORM set_config('app.is_platform', 'on', true);

  -- ── 1) Tenant demo (tipo='camara' + feature flags) ─────────────────────
  -- Habilita os módulos legislativos e DESABILITA chamados (zeladoria exec.).
  INSERT INTO tenants (
    id, slug, nome, uf, municipio_ibge, subdominio, plano, ativo, tipo, funcionalidades
  ) VALUES (
    v_tenant,
    'camarademo',
    'Câmara Municipal de Exemplo',
    'MT',
    '5100000',
    'camarademo',
    'padrao',
    true,
    'camara',
    jsonb_build_object(
      'chamados',           false,  -- zeladoria georreferenciada (executivo) — oculto
      'parlamentar',        true,   -- vereadores / mesa diretora / comissões
      'sessoes',            true,   -- sessões plenárias / TV Câmara
      'legislativo',        true,   -- projetos de lei / tramitação / leis
      'escola_legislativa', true,   -- cursos / provas / certificados (chave da migration 101)
      'escola',             true,   -- alias usado pela navegação (Escola Legislativa)
      'pss',                true,   -- processo seletivo simplificado
      'eventos',            true    -- eventos / audiências públicas
    )
  )
  ON CONFLICT (id) DO UPDATE
    SET nome            = EXCLUDED.nome,
        tipo            = EXCLUDED.tipo,
        funcionalidades = EXCLUDED.funcionalidades,
        ativo           = EXCLUDED.ativo,
        atualizado_em   = now();

  -- ── 2) Tema mínimo (portal público renderiza com identidade) ───────────
  INSERT INTO tenant_themes (tenant_id, tokens, wcag_ok)
  VALUES (
    v_tenant,
    jsonb_build_object(
      'colors', jsonb_build_object(
        'primary',     '#0B3B66', 'primaryFg',   '#FFFFFF',
        'secondary',   '#C8A24B', 'secondaryFg', '#1B1B1B',
        'accent',      '#168821',
        'bg',          '#FFFFFF', 'fg',          '#1B1B1B',
        'muted',       '#F0F0F0', 'border',      '#CCCCCC',
        'success',     '#168821', 'warning',     '#FFCD07', 'danger', '#E52207'
      ),
      'fonts',  jsonb_build_object('sans', 'Rawline, system-ui, sans-serif', 'heading', 'Rawline, sans-serif'),
      'radius', jsonb_build_object('base', '0.5rem'),
      'logo',   jsonb_build_object('url', '/brasao-placeholder.svg', 'alt', 'Brasão da Câmara Municipal de Exemplo'),
      'favicon','/favicon.ico',
      'iconSet','lucide'
    ),
    true
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- ── 3) Admin da Câmara (admin_prefeitura = administrador do tenant) ────
  -- senha_hash NULL: login via gov.br ou reset pelo super_admin (ver cabeçalho).
  INSERT INTO users (tenant_id, nome, email, role, ativo)
  VALUES (
    v_tenant,
    'Administrador da Câmara (Demo)',
    'admin@camarademo.demo',
    'admin_prefeitura',
    true
  )
  ON CONFLICT (tenant_id, email) DO NOTHING;

  -- ── 4) Vereadores fictícios ────────────────────────────────────────────
  -- Idempotência por (tenant_id, slug) — índice único parcial uq_vereadores_slug.
  INSERT INTO vereadores
    (tenant_id, nome, nome_parlamentar, slug, partido, status, legislatura, mandato_inicio, mandato_fim, ordem)
  VALUES
    (v_tenant, 'Ana Beatriz Soares',  'Ana Soares',      'ana-soares',      'PSD', 'ativo', '2025-2028', DATE '2025-01-01', DATE '2028-12-31', 1),
    (v_tenant, 'Carlos Eduardo Lima', 'Carlos Lima',     'carlos-lima',     'MDB', 'ativo', '2025-2028', DATE '2025-01-01', DATE '2028-12-31', 2),
    (v_tenant, 'Mariana Oliveira',    'Mariana Oliveira','mariana-oliveira','PT',  'ativo', '2025-2028', DATE '2025-01-01', DATE '2028-12-31', 3),
    (v_tenant, 'João Pedro Almeida',  'João Almeida',    'joao-almeida',    'PL',  'ativo', '2025-2028', DATE '2025-01-01', DATE '2028-12-31', 4),
    (v_tenant, 'Fernanda Costa',      'Fernanda Costa',  'fernanda-costa',  'PSB', 'ativo', '2025-2028', DATE '2025-01-01', DATE '2028-12-31', 5)
  ON CONFLICT (tenant_id, slug) WHERE slug IS NOT NULL DO NOTHING;

  -- ── 5) Mesa Diretora (cargos com vigência) ─────────────────────────────
  -- Presidente, Vice e 1º Secretário. Guard por NOT EXISTS para idempotência.
  INSERT INTO vereador_mesa_cargos (tenant_id, vereador_id, cargo, inicio, fim, legislatura, ordem)
  SELECT v_tenant, v.id, m.cargo, DATE '2025-01-01', DATE '2026-12-31', '2025-2028', m.ordem
  FROM (VALUES
    ('ana-soares',      'presidente',          1),
    ('carlos-lima',     'vice_presidente',     2),
    ('mariana-oliveira','primeiro_secretario', 3)
  ) AS m(slug, cargo, ordem)
  JOIN vereadores v ON v.tenant_id = v_tenant AND v.slug = m.slug
  WHERE NOT EXISTS (
    SELECT 1 FROM vereador_mesa_cargos mc
    WHERE mc.tenant_id = v_tenant AND mc.vereador_id = v.id
      AND mc.cargo = m.cargo AND mc.inicio = DATE '2025-01-01'
  );

  -- ── 6) Comissões (2 permanentes) + composição de uma delas ─────────────
  INSERT INTO comissoes (tenant_id, nome, slug, tipo, descricao, legislatura, ordem)
  VALUES
    (v_tenant, 'Comissão de Constituição, Justiça e Redação', 'ccjr', 'permanente',
      'Examina a constitucionalidade, legalidade e técnica legislativa das proposições.', '2025-2028', 1),
    (v_tenant, 'Comissão de Finanças e Orçamento', 'financas-orcamento', 'permanente',
      'Analisa matérias de natureza financeira e orçamentária.', '2025-2028', 2)
  ON CONFLICT (tenant_id, slug) WHERE slug IS NOT NULL DO NOTHING;

  SELECT id INTO v_comissao FROM comissoes WHERE tenant_id = v_tenant AND slug = 'ccjr';

  INSERT INTO comissao_cargos (tenant_id, comissao_id, vereador_id, cargo, inicio, ordem)
  SELECT v_tenant, v_comissao, v.id, x.cargo, DATE '2025-02-01', x.ordem
  FROM (VALUES
    ('carlos-lima',      'presidente', 1),
    ('mariana-oliveira', 'relator',    2),
    ('fernanda-costa',   'membro',     3)
  ) AS x(vereador_slug, cargo, ordem)
  JOIN vereadores v ON v.tenant_id = v_tenant AND v.slug = x.vereador_slug
  WHERE v_comissao IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM comissao_cargos cc
      WHERE cc.tenant_id = v_tenant AND cc.comissao_id = v_comissao AND cc.vereador_id = v.id
    );

  -- ── 7) Sessão plenária com pauta ───────────────────────────────────────
  INSERT INTO tipos_sessao (tenant_id, nome, descricao, ordem)
  SELECT v_tenant, 'Ordinária', 'Sessão ordinária semanal do plenário.', 1
  WHERE NOT EXISTS (
    SELECT 1 FROM tipos_sessao t WHERE t.tenant_id = v_tenant AND t.nome = 'Ordinária'
  );

  INSERT INTO sessoes (tenant_id, tipo_sessao_id, titulo, data_hora, local, status)
  SELECT v_tenant, ts.id,
         '1ª Sessão Ordinária de 2026',
         TIMESTAMPTZ '2026-02-10 14:00:00-04',
         'Plenário Vereador Exemplo',
         'agendada'
  FROM tipos_sessao ts
  WHERE ts.tenant_id = v_tenant AND ts.nome = 'Ordinária'
    AND NOT EXISTS (
      SELECT 1 FROM sessoes s
      WHERE s.tenant_id = v_tenant AND s.titulo = '1ª Sessão Ordinária de 2026'
    );

  SELECT id INTO v_sessao FROM sessoes
  WHERE tenant_id = v_tenant AND titulo = '1ª Sessão Ordinária de 2026';

  INSERT INTO sessao_pauta_itens (tenant_id, sessao_id, ordem, titulo, descricao)
  SELECT v_tenant, v_sessao, p.ordem, p.titulo, p.descricao
  FROM (VALUES
    (1, 'Expediente', 'Leitura e aprovação da ata da sessão anterior.'),
    (2, 'Ordem do Dia — PL 001/2026', 'Discussão e votação do Projeto de Lei nº 001/2026.'),
    (3, 'Comunicações dos Vereadores', 'Uso da palavra pelos parlamentares inscritos.')
  ) AS p(ordem, titulo, descricao)
  WHERE v_sessao IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM sessao_pauta_itens spi
      WHERE spi.tenant_id = v_tenant AND spi.sessao_id = v_sessao AND spi.ordem = p.ordem
    );

  -- ── 8) Legislativo: 1 Projeto de Lei + 1 Lei ───────────────────────────
  INSERT INTO proposicoes
    (tenant_id, tipo, numero, ano, protocolo, ementa, status_atual, autor_principal_id, data_protocolo, publicada)
  SELECT v_tenant, 'pl_ordinaria', 1, 2026, 'PL-2026-0001',
    'Institui a Semana Municipal de Educação Cidadã no âmbito do Município.',
    'em_comissao',
    (SELECT id FROM vereadores WHERE tenant_id = v_tenant AND slug = 'ana-soares'),
    DATE '2026-02-03', true
  WHERE NOT EXISTS (
    SELECT 1 FROM proposicoes p
    WHERE p.tenant_id = v_tenant AND p.tipo = 'pl_ordinaria' AND p.ano = 2026 AND p.numero = 1
  );

  SELECT id INTO v_prop FROM proposicoes
  WHERE tenant_id = v_tenant AND tipo = 'pl_ordinaria' AND ano = 2026 AND numero = 1;

  INSERT INTO proposicao_autores (tenant_id, proposicao_id, vereador_id, papel, ordem)
  SELECT v_tenant, v_prop, v.id, 'autor', 0
  FROM vereadores v
  WHERE v.tenant_id = v_tenant AND v.slug = 'ana-soares' AND v_prop IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM proposicao_autores pa
      WHERE pa.tenant_id = v_tenant AND pa.proposicao_id = v_prop AND pa.vereador_id = v.id
    );

  INSERT INTO proposicao_tramitacoes (tenant_id, proposicao_id, fase, despacho)
  SELECT v_tenant, v_prop, 'em_comissao',
    'Distribuída à Comissão de Constituição, Justiça e Redação para parecer.'
  WHERE v_prop IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM proposicao_tramitacoes pt
      WHERE pt.tenant_id = v_tenant AND pt.proposicao_id = v_prop AND pt.fase = 'em_comissao'
    );

  INSERT INTO leis (tenant_id, numero, tipo, ano, ementa, data_sancao, vigente, publicada)
  SELECT v_tenant, '1.250', 'lei_ordinaria', 2025,
    'Dispõe sobre a Política Municipal de Acesso à Informação e dá outras providências.',
    DATE '2025-11-20', true, true
  WHERE NOT EXISTS (
    SELECT 1 FROM leis l
    WHERE l.tenant_id = v_tenant AND l.numero = '1.250' AND l.ano = 2025
  );

  -- ── 9) Escola Legislativa: 1 curso publicado (com módulo + aula) ───────
  INSERT INTO cursos
    (tenant_id, titulo, slug, resumo, descricao, carga_horaria, certificacao, nota_minima, status, publicado, ordem)
  VALUES (
    v_tenant,
    'Introdução ao Processo Legislativo Municipal',
    'introducao-processo-legislativo',
    'Entenda como uma ideia vira lei no município: da proposição à sanção.',
    '<p>Curso introdutório sobre o funcionamento do Poder Legislativo municipal, '
      || 'a tramitação de proposições e o papel do cidadão na participação popular.</p>',
    8, true, 70, 'publicado', true, 1
  )
  ON CONFLICT (tenant_id, slug) WHERE slug IS NOT NULL DO NOTHING;

  SELECT id INTO v_curso FROM cursos
  WHERE tenant_id = v_tenant AND slug = 'introducao-processo-legislativo';

  INSERT INTO curso_modulos (tenant_id, curso_id, titulo, descricao, ordem)
  SELECT v_tenant, v_curso, 'Fundamentos', 'Conceitos básicos do processo legislativo.', 1
  WHERE v_curso IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM curso_modulos cm
      WHERE cm.tenant_id = v_tenant AND cm.curso_id = v_curso AND cm.titulo = 'Fundamentos'
    );

  SELECT id INTO v_modulo FROM curso_modulos
  WHERE tenant_id = v_tenant AND curso_id = v_curso AND titulo = 'Fundamentos';

  INSERT INTO curso_aulas (tenant_id, modulo_id, curso_id, titulo, conteudo, duracao_min, ordem)
  SELECT v_tenant, v_modulo, v_curso,
    'O que é uma proposição?',
    jsonb_build_object(
      'blocks', jsonb_build_array(
        jsonb_build_object('type','paragraph','data',
          jsonb_build_object('text','Uma proposição é toda matéria submetida à apreciação da Câmara.'))
      )
    ),
    15, 1
  WHERE v_modulo IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM curso_aulas ca
      WHERE ca.tenant_id = v_tenant AND ca.modulo_id = v_modulo AND ca.titulo = 'O que é uma proposição?'
    );

  RAISE NOTICE 'Seed "Câmara Municipal de Exemplo" aplicado (tenant %).', v_tenant;
END
$seed$;

-- =====================================================================
-- Verificação rápida (opcional). Rode separadamente em modo plataforma:
--   SET app.is_platform = 'on';
--   SELECT
--     (SELECT count(*) FROM vereadores           WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS vereadores,
--     (SELECT count(*) FROM vereador_mesa_cargos WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS mesa,
--     (SELECT count(*) FROM comissoes            WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS comissoes,
--     (SELECT count(*) FROM sessoes              WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS sessoes,
--     (SELECT count(*) FROM sessao_pauta_itens   WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS pauta,
--     (SELECT count(*) FROM proposicoes          WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS proposicoes,
--     (SELECT count(*) FROM leis                 WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS leis,
--     (SELECT count(*) FROM cursos               WHERE tenant_id = '11111111-1111-4111-8111-111111111111') AS cursos;
-- =====================================================================
