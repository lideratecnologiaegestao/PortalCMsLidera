// =====================================================================
// Domínio: SESSÕES PLENÁRIAS (L2)
// Origem (MySQL): tipo_sessaos, sessoes, sessao_vereador (presença),
//                 sessao_projeto_lei (pauta)
// Destino (PG):   db/104 — tipos_sessao, sessoes, sessao_pauta_itens,
//                 sessao_presencas, sessao_gravacoes
//
// Pontos de mapeamento:
//   * data_hora: o legado separa `data_sessao` (date) + `hora_inicio` (time).
//     Combinamos em timestamptz (combineDateTime).
//   * tipo: legado tem enum `tipo` (ordinaria/extraordinaria/solene/especial) E
//     opcionalmente `tipo_sessao_id` -> tipo_sessaos. Preferimos o FK; se nulo,
//     resolvemos/criamos um tipo a partir do enum textual.
//   * presença: PREFERIMOS a pivot normalizada `sessao_vereador`
//     (presente + justificativa) sobre a coluna JSON `presencas` (array de IDs),
//     que é o legado antigo. Mapeamos presente=true -> 'presente',
//     presente=false + justificativa -> 'justificado', senão 'ausente'.
//   * pauta: `sessao_projeto_lei` (ordem_pauta) -> sessao_pauta_itens, com
//     proposicao_id = uuid determinístico do projeto de lei (uuid SIMPLES, sem
//     FK no destino — módulos independentes; ver db/104).
//   * gravações/vídeo: o legado tem link_transmissao/arquivo_video. A sessão
//     destino guarda video_ao_vivo_url; arquivos de vídeo viram sessao_gravacoes.
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import log from '../lib/logger.js';
import {
  s, toTs, toInt, toBool, combineDateTime, jsonOf, mapEnum,
} from '../lib/transform.js';

// enum textual legado -> nome de tipo de sessão (quando não há tipo_sessao_id).
const TIPO_NOME = {
  ordinaria: 'Ordinária',
  extraordinaria: 'Extraordinária',
  solene: 'Solene',
  especial: 'Especial',
};

const SESSAO_STATUS = {
  agendada: 'agendada',
  em_andamento: 'em_andamento',
  finalizada: 'encerrada', // legado 'finalizada' -> destino 'encerrada'
  encerrada: 'encerrada',
  cancelada: 'cancelada',
};

// uuid determinístico de um tipo "sintético" do enum textual.
function tipoFromEnum(idmap, enumVal) {
  const key = s(enumVal) || 'ordinaria';
  return idmap.uid('tipos_sessao_enum', key);
}

// Deduplica linhas por uma chave composta (última vence). Necessário quando o
// destino tem UNIQUE em colunas != id (ex.: sessao_presencas UNIQUE(sessao,vereador)).
function dedupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) m.set(keyFn(r), r);
  return [...m.values()];
}

async function carregarTiposSessao(ctx) {
  const { tenantId, idmap } = ctx;
  const tipos = [];
  const vistos = new Set();

  if (await mysqlTableExists('tipo_sessaos')) {
    for await (const t of selectPaged('SELECT * FROM tipo_sessaos ORDER BY id', [], 1000)) {
      const id = idmap.uid('tipos_sessao', t.id);
      vistos.add(id);
      tipos.push({
        id,
        nome: s(t.nome) || 'Sessão',
        descricao: s(t.descricao),
        ordem: toInt(t.ordem, 0),
        ativo: toBool(t.ativo, true),
        criado_em: toTs(t.created_at),
        atualizado_em: toTs(t.updated_at),
      });
    }
  }

  // tipos sintéticos para cada valor do enum textual de `sessoes.tipo`
  for (const [key, nome] of Object.entries(TIPO_NOME)) {
    const id = idmap.uid('tipos_sessao_enum', key);
    if (vistos.has(id)) continue;
    tipos.push({
      id, nome, descricao: null, ordem: 0, ativo: true, criado_em: null, atualizado_em: null,
    });
  }

  await upsertBatch(
    tenantId,
    'tipos_sessao',
    ['id', 'nome', 'descricao', 'ordem', 'ativo', 'criado_em', 'atualizado_em'],
    tipos,
  );
  return tipos.length;
}

async function carregarSessoes(ctx) {
  const { tenantId, idmap } = ctx;
  const cols = await mysqlColumns('sessoes');
  const has = (c) => cols.has(c);

  const sessoes = [];
  const gravacoes = [];
  let lidos = 0;

  for await (const ses of selectPaged('SELECT * FROM sessoes ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('sessoes', ses.id);

    let tipoSessaoId = null;
    if (has('tipo_sessao_id') && ses.tipo_sessao_id != null) {
      tipoSessaoId = idmap.uid('tipos_sessao', ses.tipo_sessao_id);
    } else {
      tipoSessaoId = tipoFromEnum(idmap, ses.tipo);
    }

    const titulo = s(ses.numero_sessao) ? `Sessão ${s(ses.numero_sessao)}` : `Sessão ${ses.id}`;

    const videoAoVivo =
      (has('transmissao_online') && toBool(ses.transmissao_online, false) && s(ses.link_transmissao)) ||
      (has('link_transmissao') ? s(ses.link_transmissao) : null);

    sessoes.push({
      id,
      tipo_sessao_id: tipoSessaoId,
      titulo,
      // data_hora é NOT NULL no destino (db/104): fallback p/ created_at e, em
      // último caso, agora — para não quebrar a carga de sessões sem data.
      data_hora:
        combineDateTime(ses.data_sessao, ses.hora_inicio) ||
        toTs(ses.created_at) ||
        new Date().toISOString(),
      local: s(ses.local),
      status: mapEnum(ses.status, SESSAO_STATUS, 'agendada', `sessao(${ses.id})`),
      quorum: null,
      video_ao_vivo_url: videoAoVivo || null,
      ata_conteudo: s(ses.ata),
      ata_publicada_em: s(ses.ata)
        ? toTs(ses.updated_at) || combineDateTime(ses.data_sessao, ses.hora_inicio)
        : null,
      evento_id: null,
      criado_em: toTs(ses.created_at),
      atualizado_em: toTs(ses.updated_at),
    });

    const videoArq = has('arquivo_video') ? s(ses.arquivo_video) : null;
    if (videoArq) {
      gravacoes.push({
        id: idmap.uid('sessao_gravacoes', ses.id),
        sessao_id: id,
        titulo: `Gravação — ${titulo}`,
        video_url: videoArq,
        storage_key: null,
        duracao: null,
        ordem: 0,
        criado_em: toTs(ses.created_at),
      });
    }
  }

  await upsertBatch(
    tenantId,
    'sessoes',
    ['id', 'tipo_sessao_id', 'titulo', 'data_hora', 'local', 'status', 'quorum',
      'video_ao_vivo_url', 'ata_conteudo', 'ata_publicada_em', 'evento_id', 'criado_em', 'atualizado_em'],
    sessoes,
  );
  await upsertBatch(
    tenantId,
    'sessao_gravacoes',
    ['id', 'sessao_id', 'titulo', 'video_url', 'storage_key', 'duracao', 'ordem', 'criado_em'],
    gravacoes,
  );
  return lidos;
}

async function carregarPresencas(ctx) {
  const { tenantId, idmap } = ctx;
  if (await mysqlTableExists('sessao_vereador')) {
    const presencas = [];
    for await (const p of selectPaged('SELECT * FROM sessao_vereador ORDER BY id', [], 2000)) {
      const presente = toBool(p.presente, true);
      const justif = s(p.justificativa_ausencia);
      const situacao = presente ? 'presente' : justif ? 'justificado' : 'ausente';
      presencas.push({
        id: idmap.uid('sessao_presencas', p.id),
        sessao_id: idmap.uid('sessoes', p.sessao_id),
        vereador_id: idmap.uid('vereadores', p.vereador_id),
        situacao,
        observacao: justif || s(p.observacoes),
        criado_em: toTs(p.created_at),
      });
    }
    const unicas = dedupBy(presencas, (p) => `${p.sessao_id}|${p.vereador_id}`);
    await upsertBatch(
      tenantId,
      'sessao_presencas',
      ['id', 'sessao_id', 'vereador_id', 'situacao', 'observacao', 'criado_em'],
      unicas,
    );
    return unicas.length;
  }

  // Fallback: coluna JSON `presencas` (array de IDs presentes).
  const cols = await mysqlColumns('sessoes');
  if (!cols.has('presencas')) return 0;
  const presencas = [];
  const sessoes = await selectAll('SELECT id, presencas, created_at FROM sessoes');
  for (const ses of sessoes) {
    const ids = jsonOf(ses.presencas, []) || [];
    if (!Array.isArray(ids)) continue;
    for (const verLegacy of ids) {
      presencas.push({
        id: idmap.uid('sessao_presencas_json', `${ses.id}-${verLegacy}`),
        sessao_id: idmap.uid('sessoes', ses.id),
        vereador_id: idmap.uid('vereadores', verLegacy),
        situacao: 'presente',
        observacao: null,
        criado_em: toTs(ses.created_at),
      });
    }
  }
  const unicas = dedupBy(presencas, (p) => `${p.sessao_id}|${p.vereador_id}`);
  await upsertBatch(
    tenantId,
    'sessao_presencas',
    ['id', 'sessao_id', 'vereador_id', 'situacao', 'observacao', 'criado_em'],
    unicas,
  );
  return unicas.length;
}

async function carregarPauta(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('sessao_projeto_lei'))) return 0;
  const itens = [];
  for await (const it of selectPaged('SELECT * FROM sessao_projeto_lei ORDER BY id', [], 2000)) {
    itens.push({
      id: idmap.uid('sessao_pauta_itens', it.id),
      sessao_id: idmap.uid('sessoes', it.sessao_id),
      // proposicao_id é uuid SIMPLES no destino (sem FK): mesma fórmula usada
      // no módulo Legislativo p/ os projetos de lei.
      proposicao_id: idmap.uid('proposicoes', it.projeto_lei_id),
      ordem: toInt(it.ordem_pauta, 0),
      titulo: s(it.observacoes) || `Item de pauta ${it.id}`,
      descricao: s(it.resultado_votacao) ? `Resultado: ${s(it.resultado_votacao)}` : null,
      criado_em: toTs(it.created_at),
    });
  }
  await upsertBatch(
    tenantId,
    'sessao_pauta_itens',
    ['id', 'sessao_id', 'proposicao_id', 'ordem', 'titulo', 'descricao', 'criado_em'],
    itens,
  );
  return itens.length;
}

export async function migrarSessoes(ctx) {
  if (!(await mysqlTableExists('sessoes'))) {
    log.warn('Tabela origem `sessoes` ausente — pulando sessões.');
    return { lidos: 0, gravados: 0 };
  }
  const t = await carregarTiposSessao(ctx);
  const ses = await carregarSessoes(ctx);
  const pr = await carregarPresencas(ctx);
  const pa = await carregarPauta(ctx);
  log.info(`  sessoes: tipos=${t} sessoes=${ses} presencas=${pr} pauta=${pa}`);
  return { lidos: ses, gravados: ses };
}

export default migrarSessoes;
