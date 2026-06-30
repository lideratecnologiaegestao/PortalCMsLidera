// =====================================================================
// Domínio: ESIC (LAI) + OUVIDORIA (13.460) -> MANIFESTAÇÕES (unificado)
// Origem (MySQL): esic_solicitacoes (+ esic_movimentacoes), ouvidoria_manifestacoes
//                 (+ ouvidoria_movimentacoes), manifestacao_anexos
// Destino (PG):   db/004 — manifestacoes, manifestacao_eventos (histórico),
//                 manifestacao_anexos
//
// REGRAS ESPECIAIS (ver PLANEJAMENTO seção 5 + skill manifestacoes-fsm-sla):
//   * PRESERVAR PROTOCOLO: a numeração (ESIC2026..., OUV2026..., etc.) NÃO pode
//     mudar — a consulta pública por protocolo precisa continuar resolvendo.
//     Copiamos `protocolo` 1:1. A unicidade no destino é (tenant_id, protocolo).
//   * BUG CONHECIDO DO LEGADO: OuvidoriaManifestacao::gerarProtocolo() ignorava
//     soft-deleted, podendo gerar protocolos colididos. Aqui, ao detectar
//     colisão de protocolo dentro do MESMO canal, desambiguamos sufixando
//     "-D{id}" (registra-se a correção em manifestacao_eventos/observacao).
//   * DOIS CANAIS NUM SÓ MODELO: o destino usa discriminador `canal`
//     ('esic' | 'ouvidoria') + `tipo` (acesso_informacao/denuncia/...).
//     esic_solicitacoes -> canal 'esic', tipo 'acesso_informacao'.
//     ouvidoria_manifestacoes -> canal 'ouvidoria', tipo mapeado do legado
//       (mas 'solicitacao_informacao' do legado, que é ESIC dentro da ouvidoria,
//        vira canal 'esic'/tipo 'acesso_informacao').
//   * STATUS -> FSM destino (manifestacao_status). Mapas distintos por canal.
//   * PRAZO (prazo_em é NOT NULL no destino): usamos data_limite_resposta (ESIC)
//     / prazo_resposta (ouvidoria); se nulo, calculamos a partir de criado_em +
//     prazo legal (ESIC 20 dias; ouvidoria 30 dias) — apenas para satisfazer a
//     constraint; o SLA real é regido pela aplicação dali em diante.
//   * PII / anonimato: manifestações anônimas mantêm solicitante_nome/email NULL.
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import { withTenant } from '../lib/target-pg.js';
import config from '../lib/config.js';
import log from '../lib/logger.js';
import {
  s, toTs, toDate, toBool, digits, jsonOf, mapEnum,
} from '../lib/transform.js';

// --- ESIC status -> FSM destino ---
const ESIC_STATUS = {
  pendente: 'registrada',
  em_analise: 'em_analise',
  aguardando_informacoes: 'aguardando_cidadao',
  informacoes_recebidas: 'em_tratamento',
  respondida: 'respondida',
  negada: 'indeferida',
  parcialmente_atendida: 'parcialmente_atendida',
  recurso: 'recurso_1a_instancia',
  finalizada: 'concluida',
  arquivada: 'arquivada',
  cancelada: 'arquivada',
};

// --- Ouvidoria status -> FSM destino ---
const OUV_STATUS = {
  nova: 'registrada',
  em_analise: 'em_analise',
  em_tramitacao: 'em_tratamento',
  aguardando_informacoes: 'aguardando_cidadao',
  respondida: 'respondida',
  finalizada: 'concluida',
  arquivada: 'arquivada',
};

// --- Ouvidoria tipo legado -> {canal, tipo destino} ---
const OUV_TIPO = {
  solicitacao_informacao: { canal: 'esic', tipo: 'acesso_informacao' },
  reclamacao: { canal: 'ouvidoria', tipo: 'reclamacao' },
  sugestao: { canal: 'ouvidoria', tipo: 'sugestao' },
  elogio: { canal: 'ouvidoria', tipo: 'elogio' },
  denuncia: { canal: 'ouvidoria', tipo: 'denuncia' },
  ouvidoria_geral: { canal: 'ouvidoria', tipo: 'solicitacao' },
};

// Soma dias corridos a uma data ISO (fallback de prazo p/ NOT NULL).
function addDays(tsIso, days) {
  const base = tsIso ? new Date(tsIso) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

// Detector de colisão de protocolo: registra protocolos já vistos por canal.
function makeProtocoloDedup() {
  const seen = new Set();
  return (canal, protocolo, legacyId) => {
    const key = `${canal}:${protocolo}`;
    if (!seen.has(key)) {
      seen.add(key);
      return { protocolo, colidiu: false };
    }
    const fixed = `${protocolo}-D${legacyId}`;
    seen.add(`${canal}:${fixed}`);
    return { protocolo: fixed, colidiu: true };
  };
}

async function carregarEsic(ctx, dedup) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('esic_solicitacoes'))) return 0;
  const cols = await mysqlColumns('esic_solicitacoes');
  const has = (c) => cols.has(c);

  const manifs = [];
  const eventos = [];
  const anexos = []; // ESIC guarda anexos em colunas JSON (não em manifestacao_anexos)
  let lidos = 0;

  for await (const e of selectPaged('SELECT * FROM esic_solicitacoes ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('manifestacoes_esic', e.id);
    const criado = toTs(e.created_at) || toTs(e.data_solicitacao);

    const { protocolo, colidiu } = dedup('esic', s(e.protocolo) || `ESIC-${e.id}`, e.id);
    const status = mapEnum(e.status, ESIC_STATUS, 'registrada', `esic(${e.id})`);
    const anonima = false; // ESIC do legado sempre identificado

    let prazo = toTs(e.data_limite_resposta);
    if (!prazo) prazo = addDays(criado, 20); // LAI: 20 dias

    manifs.push({
      id,
      protocolo,
      canal: 'esic',
      tipo: 'acesso_informacao',
      status,
      anonima,
      cidadao_id: has('user_id') && e.user_id != null ? idmap.uid('users', e.user_id) : null,
      solicitante_nome: s(e.nome_solicitante),
      solicitante_email: s(e.email_solicitante),
      assunto: s(e.assunto) || 'Solicitação de informação',
      descricao: s(e.descricao) || '',
      secretaria_id: null,
      responsavel_id: has('responsavel_id') && e.responsavel_id != null ? idmap.uid('users', e.responsavel_id) : null,
      prazo_em: prazo,
      prorrogado: has('prazo_prorrogacao_dias') ? (parseInt(e.prazo_prorrogacao_dias, 10) || 0) > 0 : false,
      prorrogacao_justificativa: has('justificativa_prorrogacao') ? s(e.justificativa_prorrogacao) : null,
      sla_pausado_em: status === 'aguardando_cidadao' ? (toTs(e.updated_at) || criado) : null,
      resposta: s(e.resposta),
      respondido_em: has('data_resposta') ? toTs(e.data_resposta) : (status === 'respondida' ? toTs(e.updated_at) : null),
      classificacao_sigilo: null,
      criado_em: criado,
      atualizado_em: toTs(e.updated_at),
    });

    // evento inicial (registrada) + evento de correção se houve colisão.
    eventos.push({
      manifestacao_id: id,
      de_status: null,
      para_status: 'registrada',
      evento: 'registrada',
      ator_id: null,
      observacao: colidiu ? `Protocolo desambiguado na migração (colisão legado). Original preservado em assunto.` : 'Importada do sistema anterior (ESIC).',
      criado_em: criado,
    });

    // anexos do ESIC vêm em colunas JSON (anexos_solicitacao / anexos_resposta).
    for (const [campo, origem] of [['anexos_solicitacao', 'cidadao'], ['anexos_resposta', 'orgao']]) {
      if (!has(campo)) continue;
      const lista = jsonOf(e[campo], []) || [];
      if (!Array.isArray(lista)) continue;
      lista.forEach((ax, idx) => {
        // item pode ser string (path) ou objeto {path/nome/mime/tamanho}.
        const path = typeof ax === 'string' ? ax : s(ax.path || ax.caminho || ax.url || ax.arquivo);
        if (!path) return;
        anexos.push({
          id: idmap.uid('manifestacao_anexos_esic', `${e.id}-${campo}-${idx}`),
          manifestacao_id: id,
          origem,
          nome_arquivo: (typeof ax === 'object' && s(ax.nome || ax.nome_original)) || path.split('/').pop() || 'anexo',
          storage_key: path,
          mime: typeof ax === 'object' ? s(ax.mime || ax.tipo_mime) : null,
          tamanho_bytes: typeof ax === 'object' && ax.tamanho != null ? Number(ax.tamanho) : null,
          criado_em: criado,
        });
      });
    }
  }

  await upsertBatch(
    tenantId,
    'manifestacoes',
    ['id', 'protocolo', 'canal', 'tipo', 'status', 'anonima', 'cidadao_id', 'solicitante_nome',
      'solicitante_email', 'assunto', 'descricao', 'secretaria_id', 'responsavel_id', 'prazo_em',
      'prorrogado', 'prorrogacao_justificativa', 'sla_pausado_em', 'resposta', 'respondido_em',
      'classificacao_sigilo', 'criado_em', 'atualizado_em'],
    manifs,
  );
  // manifestacao_eventos: PK é bigint identity (sem id determinístico). Inserimos
  // direto (não idempotente por linha — só re-rode eventos em base limpa, ou
  // trate como append). Para evitar duplicação em re-runs, limpamos os eventos
  // 'importada' destas manifestações antes de reinserir.
  await reinserirEventos(tenantId, manifs.map((m) => m.id), eventos);
  if (anexos.length) {
    await upsertBatch(
      tenantId,
      'manifestacao_anexos',
      ['id', 'manifestacao_id', 'origem', 'nome_arquivo', 'storage_key', 'mime', 'tamanho_bytes', 'criado_em'],
      anexos,
    );
  }
  log.info(`  manifestacoes(esic): ${lidos} (anexos_json=${anexos.length})`);
  return lidos;
}

async function carregarOuvidoria(ctx, dedup) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('ouvidoria_manifestacoes'))) return 0;
  const cols = await mysqlColumns('ouvidoria_manifestacoes');
  const has = (c) => cols.has(c);

  const manifs = [];
  const eventos = [];
  let lidos = 0;

  // ignora soft-deleted? Mantemos TODOS (inclusive deleted_at != null) para
  // preservar histórico de protocolos, mas marcamos como 'arquivada' se deletado.
  for await (const o of selectPaged('SELECT * FROM ouvidoria_manifestacoes ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('manifestacoes_ouv', o.id);
    const criado = toTs(o.created_at);
    const deletado = has('deleted_at') && o.deleted_at != null;

    const ct = mapEnum(o.tipo, OUV_TIPO, { canal: 'ouvidoria', tipo: 'solicitacao' }, `ouv(${o.id})`);
    const canal = ct.canal;
    const tipoDest = ct.tipo;

    const { protocolo, colidiu } = dedup(canal, s(o.protocolo) || `OUV-${o.id}`, o.id);

    let status = mapEnum(o.status, OUV_STATUS, 'registrada', `ouv.status(${o.id})`);
    if (deletado) status = 'arquivada';

    const anonima = has('manifestacao_anonima') ? toBool(o.manifestacao_anonima, false) : false;

    let prazo = toDate(o.prazo_prorrogado) ? toTs(o.prazo_prorrogado) : toTs(o.prazo_resposta);
    if (!prazo) prazo = addDays(criado, canal === 'esic' ? 20 : 30);

    manifs.push({
      id,
      protocolo,
      canal,
      tipo: tipoDest,
      status,
      anonima,
      cidadao_id: has('esic_usuario_id') && o.esic_usuario_id != null
        ? idmap.uid('users', o.esic_usuario_id) // melhor esforço (pode não existir como user)
        : null,
      // anônima => não preserva PII do manifestante
      solicitante_nome: anonima ? null : s(o.nome_manifestante),
      solicitante_email: anonima ? null : s(o.email_manifestante),
      assunto: s(o.assunto) || 'Manifestação',
      descricao: s(o.descricao) || '',
      secretaria_id: null,
      responsavel_id: has('ouvidor_responsavel_id') && o.ouvidor_responsavel_id != null
        ? idmap.uid('users', o.ouvidor_responsavel_id)
        : null,
      prazo_em: prazo,
      prorrogado: has('prazo_prorrogado') ? o.prazo_prorrogado != null : false,
      prorrogacao_justificativa: has('justificativa_prorrogacao') ? s(o.justificativa_prorrogacao) : null,
      sla_pausado_em: status === 'aguardando_cidadao' ? (toTs(o.updated_at) || criado) : null,
      resposta: s(o.resposta),
      respondido_em: has('respondida_em') ? toTs(o.respondida_em) : null,
      classificacao_sigilo: has('informacao_sigilosa') && toBool(o.informacao_sigilosa, false) ? 'reservada' : null,
      criado_em: criado,
      atualizado_em: toTs(o.updated_at),
    });

    eventos.push({
      manifestacao_id: id,
      de_status: null,
      para_status: 'registrada',
      evento: 'registrada',
      ator_id: null,
      observacao: [
        'Importada do sistema anterior (Ouvidoria).',
        colidiu ? 'Protocolo desambiguado (colisão legado).' : null,
        deletado ? 'Registro estava soft-deleted no legado — arquivado.' : null,
      ].filter(Boolean).join(' '),
      criado_em: criado,
    });
  }

  await upsertBatch(
    tenantId,
    'manifestacoes',
    ['id', 'protocolo', 'canal', 'tipo', 'status', 'anonima', 'cidadao_id', 'solicitante_nome',
      'solicitante_email', 'assunto', 'descricao', 'secretaria_id', 'responsavel_id', 'prazo_em',
      'prorrogado', 'prorrogacao_justificativa', 'sla_pausado_em', 'resposta', 'respondido_em',
      'classificacao_sigilo', 'criado_em', 'atualizado_em'],
    manifs,
  );
  await reinserirEventos(tenantId, manifs.map((m) => m.id), eventos);
  log.info(`  manifestacoes(ouvidoria): ${lidos}`);
  return lidos;
}

// manifestacao_eventos tem PK bigint identity. Para idempotência, removemos os
// eventos de IMPORTAÇÃO destas manifestações e reinserimos.
async function reinserirEventos(tenantId, manifIds, eventos) {
  if (config.etl.dryRun || eventos.length === 0) return;
  await withTenant(tenantId, async (client) => {
    // apaga eventos 'registrada' de importação destas manifestações (evita dup).
    for (let i = 0; i < manifIds.length; i += 500) {
      const slice = manifIds.slice(i, i + 500);
      const ph = slice.map((_, j) => `$${j + 1}`).join(',');
      await client.query(
        `DELETE FROM manifestacao_eventos
         WHERE manifestacao_id IN (${ph}) AND evento = 'registrada'`,
        slice,
      );
    }
    for (let i = 0; i < eventos.length; i += 500) {
      const slice = eventos.slice(i, i + 500);
      const params = [];
      const tuples = slice.map((ev) => {
        const cols = [tenantId, ev.manifestacao_id, ev.de_status, ev.para_status, ev.evento, ev.ator_id, ev.observacao, ev.criado_em];
        const ph = cols.map((v) => {
          params.push(v);
          return `$${params.length}`;
        });
        return `(${ph.join(',')})`;
      });
      await client.query(
        `INSERT INTO manifestacao_eventos
          (tenant_id, manifestacao_id, de_status, para_status, evento, ator_id, observacao, criado_em)
         VALUES ${tuples.join(',')}`,
        params,
      );
    }
  });
}

async function carregarAnexos(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('manifestacao_anexos'))) return 0;
  const cols = await mysqlColumns('manifestacao_anexos');
  const has = (c) => cols.has(c);
  const anexos = [];

  for await (const a of selectPaged('SELECT * FROM manifestacao_anexos ORDER BY id', [], 2000)) {
    // No legado, manifestacao_anexos.manifestacao_id é FK -> ouvidoria_manifestacoes
    // (ESIC tem anexos próprios em colunas JSON da esic_solicitacoes, tratadas à
    // parte). Algumas instalações podem ter colunas extras p/ esic — checamos.
    let manifestacaoId = null;
    if (has('esic_solicitacao_id') && a.esic_solicitacao_id != null) {
      manifestacaoId = idmap.uid('manifestacoes_esic', a.esic_solicitacao_id);
    } else if (has('ouvidoria_manifestacao_id') && a.ouvidoria_manifestacao_id != null) {
      manifestacaoId = idmap.uid('manifestacoes_ouv', a.ouvidoria_manifestacao_id);
    } else if (has('manifestacao_id') && a.manifestacao_id != null) {
      manifestacaoId = idmap.uid('manifestacoes_ouv', a.manifestacao_id); // FK p/ ouvidoria
    }
    if (!manifestacaoId) continue;

    // colunas reais do legado: caminho_arquivo, tipo_mime, tamanho_bytes,
    // nome_original; fallbacks p/ variações de outras instalações.
    const storageKey =
      s(a.caminho_arquivo) || s(a.caminho) || s(a.path) || s(a.arquivo_path) || s(a.arquivo);
    const tamanho = a.tamanho_bytes ?? a.tamanho ?? null;
    anexos.push({
      id: idmap.uid('manifestacao_anexos', a.id),
      manifestacao_id: manifestacaoId,
      origem: (has('uploaded_by') && a.uploaded_by != null) ? 'orgao' : 'cidadao',
      nome_arquivo: s(a.nome_original) || s(a.nome_arquivo) || s(a.nome) || 'anexo',
      storage_key: storageKey || `LEGADO_PENDENTE/${a.id}`, // NOT NULL no destino
      mime: s(a.tipo_mime) || s(a.mime_type) || s(a.mime),
      tamanho_bytes: tamanho != null ? Number(tamanho) : null,
      criado_em: toTs(a.created_at),
    });
  }
  await upsertBatch(
    tenantId,
    'manifestacao_anexos',
    ['id', 'manifestacao_id', 'origem', 'nome_arquivo', 'storage_key', 'mime', 'tamanho_bytes', 'criado_em'],
    anexos,
  );
  log.info(`  manifestacoes: anexos=${anexos.length}`);
  return anexos.length;
}

export async function migrarManifestacoes(ctx) {
  const dedup = makeProtocoloDedup();
  const esic = await carregarEsic(ctx, dedup);
  const ouv = await carregarOuvidoria(ctx, dedup);
  await carregarAnexos(ctx);
  return { lidos: esic + ouv, gravados: esic + ouv };
}

export default migrarManifestacoes;
