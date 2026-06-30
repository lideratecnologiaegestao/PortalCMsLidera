// =====================================================================
// Domínio: LEGISLATIVO / TRAMITAÇÃO (L3)
// Origem (MySQL): projetos_lei (+ coautores JSON e pivot projeto_lei_coautor,
//                 + tramitacao JSON, + votacoes JSON e contadores),
//                 leis, comite_iniciativa_populars
// Destino (PG):   db/105 — proposicoes, proposicao_autores,
//                 proposicao_tramitacoes, proposicao_votacoes,
//                 proposicao_votos, proposicao_emendas, leis,
//                 iniciativa_popular_comites
//
// Pontos de mapeamento:
//   * projetos_lei -> proposicoes. tipo e status do legado têm enums amplos
//     (ver migrations align/expand): mapeados para os 7 tipos e 9 status do
//     destino. Tipos sem correspondente direto (indicacao/requerimento/mocao)
//     viram 'requerimento'/'mocao' quando possível, senão 'requerimento'.
//   * numero: legado pode ter `numero` (renomeado de numero_projeto) — string
//     numérica; destino é integer. Extraímos os dígitos.
//   * autor_principal_id: uuid SIMPLES (sem FK). autor_id legado -> uid('vereadores').
//   * AUTORES/COAUTORES -> proposicao_autores (FK p/ vereadores). Origem dupla:
//     pivot `projeto_lei_coautor` (preferida) + coluna JSON `coautores`.
//   * TRAMITAÇÃO -> proposicao_tramitacoes (append-only). Origem: coluna JSON
//     `tramitacao` (lista de eventos). Quando ausente, gera 1 tramitação inicial
//     (protocolada) a partir de data_protocolo.
//   * VOTAÇÃO -> proposicao_votacoes (+ votos nominais best-effort). O legado
//     guarda contadores (votos_favoraveis/contrarios/abstencoes/ausencias) e um
//     JSON `votacoes`. Criamos 1 votacao agregada por proposição quando há
//     contadores; votos NOMINAIS só quando o JSON traz lista por vereador.
//   * leis -> leis. exercicio(year)->ano, autoria->(texto), tipo PT-BR -> enum.
//   * comite_iniciativa_populars -> iniciativa_popular_comites.
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import log from '../lib/logger.js';
import {
  s, toDate, toTs, toInt, toBool, jsonOf, digits, mapEnum,
} from '../lib/transform.js';

const PROPOSICAO_TIPO = {
  projeto_lei: 'pl_ordinaria',
  projeto_lei_complementar: 'pl_complementar',
  projeto_resolucao: 'resolucao',
  projeto_decreto: 'decreto_legislativo',
  projeto_decreto_legislativo: 'decreto_legislativo',
  emenda: 'emenda',
  emenda_lom: 'emenda',
  indicacao: 'requerimento', // sem tipo próprio no destino -> requerimento
  mocao: 'mocao',
  requerimento: 'requerimento',
};

const PROPOSICAO_STATUS = {
  protocolado: 'protocolada',
  tramitando: 'em_comissao',
  em_tramitacao: 'em_comissao',
  distribuido: 'em_comissao',
  em_comissao: 'em_comissao',
  pronto_pauta: 'pauta',
  em_votacao: 'pauta',
  aprovado_1_turno: 'pauta',
  aprovado_2_turno: 'aprovada',
  aprovado: 'aprovada',
  rejeitado: 'rejeitada',
  arquivado: 'arquivada',
  retirado: 'arquivada',
  enviado_executivo: 'aprovada',
  sancionado: 'sancionada',
  vetado: 'vetada',
  veto_derrubado: 'promulgada',
  veto_mantido: 'arquivada',
  promulgado: 'promulgada',
  publicado: 'promulgada',
  em_consulta_publica: 'em_comissao',
  aguardando_audiencia: 'em_comissao',
};

// tipos PT-BR de `leis.tipo` -> enum do destino.
const LEI_TIPO = {
  'Lei Ordinária': 'lei_ordinaria',
  'Lei Complementar': 'lei_complementar',
  Resolução: 'resolucao',
  'Decreto Legislativo': 'decreto_legislativo',
  'Lei Orgânica': 'emenda_lei_organica',
  'Emenda à Lei Orgânica': 'emenda_lei_organica',
};

const COMITE_STATUS = {
  ativo: 'coletando',
  coletando: 'coletando',
  em_validacao: 'em_validacao',
  validado: 'aprovada',
  rejeitado: 'rejeitado',
  arquivado: 'rejeitado',
  convertido: 'convertida',
};

async function carregarProposicoes(ctx) {
  const { tenantId, idmap } = ctx;
  const cols = await mysqlColumns('projetos_lei');
  const has = (c) => cols.has(c);

  const proposicoes = [];
  const autores = [];
  const tramitacoes = [];
  const votacoes = [];
  const votos = [];
  let lidos = 0;

  for await (const pl of selectPaged('SELECT * FROM projetos_lei ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('proposicoes', pl.id);

    // número: legado pode ter `numero` (string) ou `numero_projeto`.
    const numRaw = has('numero') ? pl.numero : pl.numero_projeto;
    const numero = toInt(digits(numRaw), null);
    const ano = toInt(pl.ano, null);

    const protocolo =
      (has('protocolo_numero') && s(pl.protocolo_numero)) ||
      (numRaw != null ? String(numRaw) : null);

    const autorPrincipal = pl.autor_id != null ? idmap.uid('vereadores', pl.autor_id) : null;

    proposicoes.push({
      id,
      tipo: mapEnum(pl.tipo, PROPOSICAO_TIPO, 'pl_ordinaria', `projeto_lei(${pl.id})`),
      numero,
      ano,
      protocolo,
      ementa: s(pl.ementa) || s(pl.titulo) || 'Sem ementa',
      texto: s(pl.texto_integral),
      pdf_url: has('arquivo_original') ? s(pl.arquivo_original) : null,
      storage_key: null,
      status_atual: mapEnum(pl.status, PROPOSICAO_STATUS, 'protocolada', `projeto_lei.status(${pl.id})`),
      autor_principal_id: autorPrincipal,
      data_protocolo: toDate(pl.data_protocolo),
      publicada: true,
      criado_em: toTs(pl.created_at),
      atualizado_em: toTs(pl.updated_at),
    });

    // autor principal -> proposicao_autores (papel 'autor')
    if (pl.autor_id != null) {
      autores.push({
        id: idmap.uid('proposicao_autores_principal', pl.id),
        proposicao_id: id,
        vereador_id: idmap.uid('vereadores', pl.autor_id),
        papel: 'autor',
        ordem: 0,
        criado_em: toTs(pl.created_at),
      });
    }
    // relator (se houver coluna)
    if (has('relator_id') && pl.relator_id != null) {
      autores.push({
        id: idmap.uid('proposicao_autores_relator', pl.id),
        proposicao_id: id,
        vereador_id: idmap.uid('vereadores', pl.relator_id),
        papel: 'relator',
        ordem: 1,
        criado_em: toTs(pl.created_at),
      });
    }
    // coautores via JSON
    const coJson = jsonOf(pl.coautores, []) || [];
    if (Array.isArray(coJson)) {
      coJson.forEach((vid, i) => {
        autores.push({
          id: idmap.uid('proposicao_autores_co_json', `${pl.id}-${vid}`),
          proposicao_id: id,
          vereador_id: idmap.uid('vereadores', vid),
          papel: 'coautor',
          ordem: 10 + i,
          criado_em: toTs(pl.created_at),
        });
      });
    }

    // TRAMITAÇÃO via JSON (lista). Cada item: {data, fase/status, despacho}.
    const trJson = jsonOf(pl.tramitacao, []) || [];
    if (Array.isArray(trJson) && trJson.length) {
      trJson.forEach((ev, i) => {
        const fase = mapEnum(
          ev.status || ev.fase || ev.situacao,
          PROPOSICAO_STATUS,
          'protocolada',
          `tramitacao(${pl.id}[${i}])`,
        );
        tramitacoes.push({
          id: idmap.uid('proposicao_tramitacoes_json', `${pl.id}-${i}`),
          proposicao_id: id,
          fase,
          despacho: s(ev.despacho || ev.descricao || ev.observacao),
          comissao_id: null,
          relator_id: null,
          data: toTs(ev.data || ev.data_hora || ev.created_at) || toTs(pl.created_at),
          ator_id: null,
          criado_em: toTs(pl.created_at),
        });
      });
    } else {
      // tramitação inicial sintética (protocolada)
      tramitacoes.push({
        id: idmap.uid('proposicao_tramitacoes_inicial', pl.id),
        proposicao_id: id,
        fase: 'protocolada',
        despacho: 'Protocolada (migração do sistema anterior).',
        comissao_id: null,
        relator_id: null,
        data: toTs(pl.data_protocolo) || toTs(pl.created_at),
        ator_id: null,
        criado_em: toTs(pl.created_at),
      });
    }

    // VOTAÇÃO agregada a partir dos contadores (se houver algum > 0).
    const fav = toInt(pl.votos_favoraveis, 0) || 0;
    const con = toInt(pl.votos_contrarios, 0) || 0;
    const abs = toInt(pl.abstencoes, 0) || 0;
    const aus = has('ausencias') ? toInt(pl.ausencias, 0) || 0 : 0;
    if (fav + con + abs + aus > 0) {
      const votacaoId = idmap.uid('proposicao_votacoes_agg', pl.id);
      const resultado =
        s(pl.status) && ['aprovado', 'aprovado_2_turno', 'sancionado', 'promulgado', 'publicado'].includes(s(pl.status))
          ? 'aprovado'
          : s(pl.status) && ['rejeitado'].includes(s(pl.status))
            ? 'rejeitado'
            : fav > con
              ? 'aprovado'
              : 'pendente';
      votacoes.push({
        id: votacaoId,
        proposicao_id: id,
        sessao_id: null,
        turno: null,
        resultado,
        quorum: has('quorum_necessario') ? s(pl.quorum_necessario) : null,
        favoraveis: fav,
        contrarios: con,
        abstencoes: abs,
        ausentes: aus,
        data: toTs(pl.data_aprovacao) || toTs(pl.updated_at) || toTs(pl.created_at),
        criado_em: toTs(pl.created_at),
      });

      // votos NOMINAIS apenas se o JSON `votacoes` trouxer lista por vereador.
      const voJson = jsonOf(pl.votacoes, null);
      const lista = Array.isArray(voJson)
        ? voJson
        : voJson && Array.isArray(voJson.votos)
          ? voJson.votos
          : null;
      if (lista) {
        lista.forEach((vt) => {
          const verId = vt.vereador_id ?? vt.id ?? vt.vereador;
          if (verId == null) return;
          const voto = mapEnum(
            vt.voto,
            { favoravel: 'favoravel', sim: 'favoravel', contrario: 'contrario', nao: 'contrario', abstencao: 'abstencao', ausente: 'ausente' },
            'ausente',
            `voto(${pl.id})`,
          );
          votos.push({
            id: idmap.uid('proposicao_votos_json', `${pl.id}-${verId}`),
            votacao_id: votacaoId,
            vereador_id: idmap.uid('vereadores', verId),
            voto,
            criado_em: toTs(pl.created_at),
          });
        });
      }
    }
  }

  await upsertBatch(
    tenantId,
    'proposicoes',
    ['id', 'tipo', 'numero', 'ano', 'protocolo', 'ementa', 'texto', 'pdf_url', 'storage_key',
      'status_atual', 'autor_principal_id', 'data_protocolo', 'publicada', 'criado_em', 'atualizado_em'],
    proposicoes,
  );

  // coautores via pivot normalizada (preferida) — adiciona ao array de autores.
  if (await mysqlTableExists('projeto_lei_coautor')) {
    for await (const pc of selectPaged('SELECT * FROM projeto_lei_coautor ORDER BY id', [], 2000)) {
      autores.push({
        id: idmap.uid('proposicao_autores_pivot', pc.id),
        proposicao_id: idmap.uid('proposicoes', pc.projeto_lei_id),
        vereador_id: idmap.uid('vereadores', pc.vereador_id),
        papel: 'coautor',
        ordem: 5,
        criado_em: toTs(pc.created_at),
      });
    }
  }

  await upsertBatch(
    tenantId,
    'proposicao_autores',
    ['id', 'proposicao_id', 'vereador_id', 'papel', 'ordem', 'criado_em'],
    autores,
  );
  await upsertBatch(
    tenantId,
    'proposicao_tramitacoes',
    ['id', 'proposicao_id', 'fase', 'despacho', 'comissao_id', 'relator_id', 'data', 'ator_id', 'criado_em'],
    tramitacoes,
  );
  await upsertBatch(
    tenantId,
    'proposicao_votacoes',
    ['id', 'proposicao_id', 'sessao_id', 'turno', 'resultado', 'quorum',
      'favoraveis', 'contrarios', 'abstencoes', 'ausentes', 'data', 'criado_em'],
    votacoes,
  );
  await upsertBatch(
    tenantId,
    'proposicao_votos',
    ['id', 'votacao_id', 'vereador_id', 'voto', 'criado_em'],
    votos,
  );

  log.info(`  legislativo: proposicoes=${lidos} autores=${autores.length} tramitacoes=${tramitacoes.length} votacoes=${votacoes.length} votos=${votos.length}`);
  return lidos;
}

async function carregarLeis(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('leis'))) return 0;
  const leis = [];
  for await (const l of selectPaged('SELECT * FROM leis ORDER BY id', [], 1000)) {
    leis.push({
      id: idmap.uid('leis', l.id),
      numero: s(l.numero) || String(l.id),
      tipo: mapEnum(l.tipo, LEI_TIPO, 'lei_ordinaria', `lei(${l.id})`),
      ano: toInt(l.exercicio, null),
      ementa: s(l.ementa) || s(l.titulo) || s(l.descricao) || 'Sem ementa',
      texto: s(l.descricao),
      data_sancao: toDate(l.data),
      proposicao_id: null, // o legado não vincula lei->projeto explicitamente
      pdf_url: s(l.arquivo_pdf),
      storage_key: null,
      vigente: toBool(l.ativo, true),
      publicada: toBool(l.ativo, true),
      criado_em: toTs(l.created_at),
      atualizado_em: toTs(l.updated_at),
    });
  }
  await upsertBatch(
    tenantId,
    'leis',
    ['id', 'numero', 'tipo', 'ano', 'ementa', 'texto', 'data_sancao', 'proposicao_id',
      'pdf_url', 'storage_key', 'vigente', 'publicada', 'criado_em', 'atualizado_em'],
    leis,
  );
  log.info(`  legislativo: leis=${leis.length}`);
  return leis.length;
}

async function carregarComites(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('comite_iniciativa_populars'))) return 0;
  const cols = await mysqlColumns('comite_iniciativa_populars');
  const has = (c) => cols.has(c);
  const comites = [];
  for await (const c of selectPaged('SELECT * FROM comite_iniciativa_populars ORDER BY id', [], 1000)) {
    comites.push({
      id: idmap.uid('iniciativa_popular_comites', c.id),
      titulo: (has('ementa') && s(c.ementa)) || s(c.nome) || `Comitê ${c.id}`,
      descricao: (has('descricao') && s(c.descricao)) || (has('objetivo') && s(c.objetivo)) || s(c.observacoes),
      responsavel: s(c.nome),
      contato: s(c.email) || s(c.telefone),
      meta_apoios: toInt(c.minimo_assinaturas, 0) || 0,
      apoios_validos: toInt(c.numero_assinaturas, 0) || 0,
      status: mapEnum(c.status, COMITE_STATUS, 'coletando', `comite(${c.id})`),
      proposicao_id: null,
      criado_em: toTs(c.created_at),
      atualizado_em: toTs(c.updated_at),
    });
  }
  await upsertBatch(
    tenantId,
    'iniciativa_popular_comites',
    ['id', 'titulo', 'descricao', 'responsavel', 'contato', 'meta_apoios', 'apoios_validos',
      'status', 'proposicao_id', 'criado_em', 'atualizado_em'],
    comites,
  );
  log.info(`  legislativo: comites_iniciativa_popular=${comites.length}`);
  return comites.length;
}

export async function migrarLegislativo(ctx) {
  let prop = 0;
  if (await mysqlTableExists('projetos_lei')) {
    prop = await carregarProposicoes(ctx);
  } else {
    log.warn('Tabela origem `projetos_lei` ausente — pulando proposições.');
  }
  await carregarLeis(ctx);
  await carregarComites(ctx);
  return { lidos: prop, gravados: prop };
}

export default migrarLegislativo;
