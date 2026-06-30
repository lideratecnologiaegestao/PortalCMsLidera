// =====================================================================
// Domínio: TRANSPARÊNCIA ATIVA (LC 131/2009 + LRF) e dados abertos
// Origem (MySQL): receitas, despesas, contratos, licitacoes, folha_pagamentos,
//                 verbas_indenizatorias
// Destino (PG):   db/007 — transp_receitas, transp_despesas, transp_contratos,
//                 transp_licitacoes, transp_folha (+ transp_sync_log)
//
// DIFERENÇA-CHAVE vs. demais módulos:
//   As tabelas transp_* NÃO usam `id` como alvo de conflito — usam CHAVE NATURAL
//   (UNIQUE por tenant + período + identificador), que é o contrato de
//   idempotência do db/007. Por isso aqui o ON CONFLICT é na chave natural e
//   NÃO geramos uuid determinístico (a PK é gerada pelo default do banco).
//
// LGPD (transp_folha): publica nome/cargo/remuneração (jurisprudência STF),
//   SEM CPF e SEM endereço. O ETL não copia documento pessoal do servidor.
//
// VERBAS INDENIZATÓRIAS (parlamentares): não há tabela própria no destino;
//   mapeamos cada verba como uma DESPESA (transp_despesas) com empenho sintético
//   "VERBA-{ano}-{mes}-{vereador}", credor = nome do vereador.
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { withTenant } from '../lib/target-pg.js';
import config from '../lib/config.js';
import log from '../lib/logger.js';
import {
  s, toDate, toInt, toNum, digits,
} from '../lib/transform.js';

const FONTE = 'migracao-laravel';

// UPSERT por CHAVE NATURAL (não por id). columns NÃO inclui id (default no banco).
async function upsertNatural(tenantId, table, columns, rows, conflictCols) {
  if (config.etl.dryRun) {
    log.debug(`[dry-run] ${table}: ${rows.length} (natural upsert simulado)`);
    return rows.length;
  }
  if (rows.length === 0) return 0;
  const all = ['tenant_id', ...columns];
  const updateCols = columns.filter((c) => !conflictCols.includes(c));
  let total = 0;
  const batch = config.etl.batchSize;
  await withTenant(tenantId, async (client) => {
    for (let i = 0; i < rows.length; i += batch) {
      const slice = rows.slice(i, i + batch);
      const params = [];
      const tuples = slice.map((row) => {
        const ph = all.map((col) => {
          params.push(col === 'tenant_id' ? tenantId : row[col] ?? null);
          return `$${params.length}`;
        });
        return `(${ph.join(',')})`;
      });
      const setClause = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
      const sql =
        `INSERT INTO ${table} (${all.join(',')}) VALUES ${tuples.join(',')} ` +
        `ON CONFLICT (${conflictCols.join(',')}) DO UPDATE SET ${setClause}`;
      const res = await client.query(sql, params);
      total += res.rowCount || 0;
    }
  });
  log.info(`  ${table}: ${total}`);
  return total;
}

async function logSync(tenantId, dataset, registros) {
  if (config.etl.dryRun) return;
  await withTenant(tenantId, async (client) => {
    await client.query(
      `INSERT INTO transp_sync_log (tenant_id, dataset, origem, registros, status)
       VALUES ($1, $2, $3, $4, 'ok')`,
      [tenantId, dataset, FONTE, registros],
    );
  });
}

async function carregarReceitas(ctx) {
  const { tenantId } = ctx;
  if (!(await mysqlTableExists('receitas'))) return 0;
  const rows = [];
  for await (const r of selectPaged('SELECT * FROM receitas ORDER BY id', [], 2000)) {
    const exercicio = toInt(r.ano_referencia, null) || new Date().getFullYear();
    const dataLanc = toDate(r.data_arrecadacao) || toDate(r.data_previsao) || `${exercicio}-01-01`;
    rows.push({
      exercicio,
      codigo: s(r.codigo) || `REC-${r.id}`,
      descricao: s(r.descricao),
      categoria: s(r.categoria),
      fonte: s(r.fonte_recurso) || s(r.origem),
      valor_previsto: toNum(r.valor_previsto, 0) || 0,
      valor_arrecadado: toNum(r.valor_arrecadado, 0) || 0,
      data_lancamento: dataLanc,
      fonte_origem: FONTE,
    });
  }
  const n = await upsertNatural(
    tenantId,
    'transp_receitas',
    ['exercicio', 'codigo', 'descricao', 'categoria', 'fonte', 'valor_previsto', 'valor_arrecadado', 'data_lancamento', 'fonte_origem'],
    rows,
    ['tenant_id', 'exercicio', 'codigo', 'data_lancamento'],
  );
  await logSync(tenantId, 'receitas', n);
  return n;
}

async function carregarDespesas(ctx) {
  const { tenantId } = ctx;
  let rows = [];
  if (await mysqlTableExists('despesas')) {
    for await (const d of selectPaged('SELECT * FROM despesas ORDER BY id', [], 2000)) {
      const exercicio = toInt(d.ano_referencia, null) || new Date().getFullYear();
      rows.push({
        exercicio,
        empenho: s(d.numero_empenho) || `DESP-${d.id}`,
        orgao: null,
        unidade: null,
        funcao: s(d.funcao),
        elemento: s(d.elemento_despesa),
        modalidade: s(d.modalidade_licitacao),
        credor_nome: s(d.favorecido),
        credor_doc: digits(d.cnpj_cpf_favorecido),
        fase: null,
        valor_empenhado: toNum(d.valor_empenhado, 0) || 0,
        valor_liquidado: toNum(d.valor_liquidado, 0) || 0,
        valor_pago: toNum(d.valor_pago, 0) || 0,
        data_empenho: toDate(d.data_empenho),
        fonte_origem: FONTE,
      });
    }
  }

  // Verbas indenizatórias dos vereadores -> despesas sintéticas.
  if (await mysqlTableExists('verbas_indenizatorias')) {
    const vereadorNomes = await mapaVereadorNome();
    for await (const v of selectPaged('SELECT * FROM verbas_indenizatorias ORDER BY id', [], 2000)) {
      const exercicio = toInt(v.ano_referencia, null) || new Date().getFullYear();
      const mes = toInt(v.mes_referencia, 0) || 0;
      rows.push({
        exercicio,
        empenho: `VERBA-${exercicio}-${String(mes).padStart(2, '0')}-V${v.vereador_id}`,
        orgao: 'Câmara Municipal',
        unidade: 'Verba Indenizatória',
        funcao: 'Legislativa',
        elemento: 'Verba Indenizatória',
        modalidade: null,
        credor_nome: vereadorNomes.get(Number(v.vereador_id)) || `Vereador #${v.vereador_id}`,
        credor_doc: null,
        fase: 'pagamento',
        valor_empenhado: toNum(v.valor, 0) || 0,
        valor_liquidado: toNum(v.valor, 0) || 0,
        valor_pago: toNum(v.valor, 0) || 0,
        data_empenho: toDate(v.data_pagamento),
        fonte_origem: FONTE,
      });
    }
  }

  if (rows.length === 0) return 0;
  const n = await upsertNatural(
    tenantId,
    'transp_despesas',
    ['exercicio', 'empenho', 'orgao', 'unidade', 'funcao', 'elemento', 'modalidade',
      'credor_nome', 'credor_doc', 'fase', 'valor_empenhado', 'valor_liquidado', 'valor_pago',
      'data_empenho', 'fonte_origem'],
    rows,
    ['tenant_id', 'exercicio', 'empenho'],
  );
  await logSync(tenantId, 'despesas', n);
  return n;
}

async function mapaVereadorNome() {
  const m = new Map();
  if (await mysqlTableExists('vereadores')) {
    const rows = await selectAll('SELECT id, nome, nome_parlamentar FROM vereadores');
    for (const r of rows) m.set(Number(r.id), r.nome_parlamentar || r.nome);
  }
  return m;
}

async function carregarLicitacoes(ctx) {
  const { tenantId } = ctx;
  if (!(await mysqlTableExists('licitacoes'))) return 0;
  const rows = [];
  for await (const l of selectPaged('SELECT * FROM licitacoes ORDER BY id', [], 2000)) {
    const exercicio = toInt(l.ano_referencia, null) || new Date().getFullYear();
    rows.push({
      exercicio,
      numero: s(l.numero_processo) || s(l.numero_edital) || `LIC-${l.id}`,
      modalidade: s(l.modalidade),
      objeto: s(l.objeto),
      valor_estimado: toNum(l.valor_estimado, null),
      situacao: s(l.status),
      data_abertura: toDate(l.data_abertura) || toDate(l.data_hora_abertura),
      edital_url: s(l.arquivo_edital),
      fonte_origem: FONTE,
    });
  }
  const n = await upsertNatural(
    tenantId,
    'transp_licitacoes',
    ['exercicio', 'numero', 'modalidade', 'objeto', 'valor_estimado', 'situacao', 'data_abertura', 'edital_url', 'fonte_origem'],
    rows,
    ['tenant_id', 'exercicio', 'numero'],
  );
  await logSync(tenantId, 'licitacoes', n);
  return n;
}

async function carregarContratos(ctx) {
  const { tenantId } = ctx;
  if (!(await mysqlTableExists('contratos'))) return 0;
  const rows = [];
  const seen = new Set();
  for await (const c of selectPaged('SELECT * FROM contratos ORDER BY id', [], 2000)) {
    let numero = s(c.numero) || `CONTR-${c.id}`;
    // chave natural é (tenant, numero); desambigua duplicado preservando rastro.
    if (seen.has(numero)) numero = `${numero}-${c.id}`;
    seen.add(numero);
    rows.push({
      exercicio: toInt(c.ano_referencia, null),
      numero,
      fornecedor_nome: s(c.contratado),
      fornecedor_doc: digits(c.cnpj_cpf_contratado),
      objeto: s(c.objeto),
      valor: toNum(c.valor_atual, null) ?? toNum(c.valor_inicial, null),
      vigencia_inicio: toDate(c.data_inicio) || toDate(c.data_assinatura),
      vigencia_fim: toDate(c.data_fim_atual) || toDate(c.data_fim),
      fonte_origem: FONTE,
    });
  }
  const n = await upsertNatural(
    tenantId,
    'transp_contratos',
    ['exercicio', 'numero', 'fornecedor_nome', 'fornecedor_doc', 'objeto', 'valor', 'vigencia_inicio', 'vigencia_fim', 'fonte_origem'],
    rows,
    ['tenant_id', 'numero'],
  );
  await logSync(tenantId, 'contratos', n);
  return n;
}

async function carregarFolha(ctx) {
  const { tenantId } = ctx;
  if (!(await mysqlTableExists('folha_pagamentos'))) return 0;
  const rows = [];
  let i = 0;
  for await (const f of selectPaged('SELECT * FROM folha_pagamentos ORDER BY id', [], 2000)) {
    i++;
    const exercicio = toInt(f.ano_referencia, null) || new Date().getFullYear();
    const mes = toInt(f.mes_referencia, 1) || 1;
    // matrícula: legado não tem; usamos pseudônimo estável (sem CPF — LGPD).
    const matricula = s(f.matricula) || `SRV-${f.id}`;
    const bruta =
      (toNum(f.remuneracao_basica, 0) || 0) +
      (toNum(f.vantagens_pessoais, 0) || 0) +
      (toNum(f.gratificacoes, 0) || 0) +
      (toNum(f.adicionais, 0) || 0);
    const descontos =
      (toNum(f.descontos_obrigatorios, 0) || 0) + (toNum(f.outros_descontos, 0) || 0);
    rows.push({
      exercicio,
      mes,
      matricula,
      nome_servidor: s(f.nome_servidor),
      cargo: s(f.cargo) || s(f.funcao_cargo),
      vinculo: s(f.vinculo) || s(f.regime_juridico),
      orgao: s(f.lotacao),
      remuneracao_bruta: bruta,
      descontos,
      remuneracao_liquida: toNum(f.remuneracao_liquida, 0) || (bruta - descontos),
      fonte_origem: FONTE,
    });
  }
  const n = await upsertNatural(
    tenantId,
    'transp_folha',
    ['exercicio', 'mes', 'matricula', 'nome_servidor', 'cargo', 'vinculo', 'orgao',
      'remuneracao_bruta', 'descontos', 'remuneracao_liquida', 'fonte_origem'],
    rows,
    ['tenant_id', 'exercicio', 'mes', 'matricula'],
  );
  await logSync(tenantId, 'folha', n);
  return n;
}

export async function migrarTransparencia(ctx) {
  const r = await carregarReceitas(ctx);
  const d = await carregarDespesas(ctx);
  const l = await carregarLicitacoes(ctx);
  const c = await carregarContratos(ctx);
  const f = await carregarFolha(ctx);
  log.info(`  transparencia: receitas=${r} despesas=${d} licitacoes=${l} contratos=${c} folha=${f}`);
  return { lidos: r + d + l + c + f, gravados: r + d + l + c + f };
}

export default migrarTransparencia;
