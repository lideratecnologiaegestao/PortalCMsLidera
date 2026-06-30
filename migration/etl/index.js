#!/usr/bin/env node
// =====================================================================
// Runner do ETL MySQL (Laravel old) -> PostgreSQL (plataforma nova).
//
// Uso:
//   node index.js                      # roda todas as fases na ordem segura
//   node index.js --dry-run            # lê/transforma, NÃO escreve
//   node index.js --only=parlamentar   # roda só um domínio (vírgula p/ vários)
//   node index.js --skip=transparencia # pula um domínio
//   node index.js --reconcile-only     # só reconcilia contagens (não migra)
//
// ORDEM DE CARGA (por dependência de FK):
//   1. usuarios       (users — base de FK de quase tudo)
//   2. parlamentar    (vereadores -> comissões, posts, representações, mesa)
//   3. sessoes        (depende de vereadores p/ presença; pauta referencia
//                      proposições por uuid SIMPLES, sem FK)
//   4. legislativo    (proposições/leis/comitês; autores referenciam vereadores)
//   5. transparencia  (independente; chave natural)
//   6. manifestacoes  (ESIC + ouvidoria; cidadao/responsavel -> users)
//   7. escola         (cursos/certificados; inscrições/tentativas -> users)
//
// IDEMPOTÊNCIA: todo upsert usa uuid determinístico (ou chave natural em
// transp_*), então re-rodar atualiza em vez de duplicar.
// =====================================================================
import config from './lib/config.js';
import log from './lib/logger.js';
import { connectMysql, closeMysql } from './lib/source-mysql.js';
import { connectPg, closePg, countTenant } from './lib/target-pg.js';
import { resolveTenant } from './lib/tenant.js';
import { makeIdMapper } from './lib/idmap.js';

import { migrarUsuarios } from './modules/usuarios.js';
import { migrarParlamentar } from './modules/parlamentar.js';
import { migrarSessoes } from './modules/sessoes.js';
import { migrarLegislativo } from './modules/legislativo.js';
import { migrarTransparencia } from './modules/transparencia.js';
import { migrarManifestacoes } from './modules/manifestacoes.js';
import { migrarEscola } from './modules/escola.js';
import { migrarEventos } from './modules/eventos.js';

// Ordem canônica das fases.
const FASES = [
  { nome: 'usuarios', fn: migrarUsuarios },
  { nome: 'parlamentar', fn: migrarParlamentar },
  { nome: 'sessoes', fn: migrarSessoes },
  { nome: 'legislativo', fn: migrarLegislativo },
  { nome: 'transparencia', fn: migrarTransparencia },
  { nome: 'manifestacoes', fn: migrarManifestacoes },
  { nome: 'escola', fn: migrarEscola },
  { nome: 'eventos', fn: migrarEventos },
];

function parseArgs(argv) {
  const args = { only: null, skip: [], dryRun: false, reconcileOnly: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--reconcile-only') args.reconcileOnly = true;
    else if (a.startsWith('--only=')) args.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a.startsWith('--skip=')) args.skip = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else log.warn(`Argumento ignorado: ${a}`);
  }
  return args;
}

// Reconciliação: compara nº de linhas origem (estimado) vs. destino.
async function reconciliar(tenantId) {
  log.info('--- Reconciliação de contagens (destino) ---');
  const checks = [
    ['vereadores'], ['vereador_mesa_cargos'], ['comissoes'], ['comissao_cargos'],
    ['vereador_posts'], ['vereador_representacoes'],
    ['tipos_sessao'], ['sessoes'], ['sessao_presencas'], ['sessao_pauta_itens'],
    ['proposicoes'], ['proposicao_autores'], ['proposicao_tramitacoes'],
    ['proposicao_votacoes'], ['proposicao_votos'], ['leis'], ['iniciativa_popular_comites'],
    ['transp_receitas'], ['transp_despesas'], ['transp_licitacoes'], ['transp_contratos'], ['transp_folha'],
    ['manifestacoes'], ['manifestacoes', "WHERE canal = 'esic'"], ['manifestacoes', "WHERE canal = 'ouvidoria'"],
    ['manifestacao_anexos'],
    ['cursos'], ['curso_modulos'], ['curso_aulas'], ['curso_inscricoes'],
    ['curso_certificados'], ['curso_provas'], ['curso_questoes'],
  ];
  for (const [table, where = ''] of checks) {
    try {
      const n = await countTenant(tenantId, table, where);
      log.info(`  ${table}${where ? ' ' + where : ''}: ${n}`);
    } catch (e) {
      log.warn(`  ${table}: ERRO ao contar (${e.message})`);
    }
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.dryRun) config.etl.dryRun = true;

  log.info('==============================================');
  log.info(' ETL Câmara — MySQL (Laravel) -> PostgreSQL');
  log.info(`   dry-run: ${config.etl.dryRun} | password: ${config.etl.passwordStrategy}`);
  log.info('==============================================');

  await connectMysql();
  await connectPg();

  const tenantId = await resolveTenant();
  const idmap = makeIdMapper(tenantId);
  const ctx = { tenantId, idmap };

  if (args.reconcileOnly) {
    await reconciliar(tenantId);
    return;
  }

  const ativos = FASES.filter((f) => {
    if (args.only) return args.only.includes(f.nome);
    if (args.skip.includes(f.nome)) return false;
    return true;
  });

  const resumo = [];
  for (const fase of ativos) {
    log.info(`\n>>> Fase: ${fase.nome}`);
    const t0 = Date.now();
    try {
      const r = await fase.fn(ctx);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      resumo.push({ fase: fase.nome, ...r, segundos: dt });
      log.info(`<<< ${fase.nome}: lidos=${r.lidos ?? '?'} gravados=${r.gravados ?? '?'} (${dt}s)`);
    } catch (e) {
      log.error(`FALHA na fase ${fase.nome}:`, e.message);
      log.debug(e.stack);
      throw e; // aborta — ordem de FK importa; melhor corrigir e re-rodar (idempotente).
    }
  }

  log.info('\n=== Resumo ===');
  for (const r of resumo) log.info(`  ${r.fase}: lidos=${r.lidos} gravados=${r.gravados} (${r.segundos}s)`);

  if (!config.etl.dryRun) {
    await reconciliar(tenantId);
  }
}

main()
  .then(async () => {
    await closeMysql();
    await closePg();
    log.info('ETL concluído.');
    process.exit(0);
  })
  .catch(async (e) => {
    log.error('ETL abortado:', e.message);
    await closeMysql().catch(() => {});
    await closePg().catch(() => {});
    process.exit(1);
  });
