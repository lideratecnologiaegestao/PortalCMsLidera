// =====================================================================
// Domínio: EVENTOS & AUDIÊNCIAS PÚBLICAS (L6, com certificação)
// Origem (MySQL): eventos, evento_inscricoes
// Destino (PG):   db/108 — eventos, evento_inscricoes, evento_certificados
//
// Pontos de mapeamento:
//   * tipo: o legado tem um enum LARGO (sessao_plenaria, audiencia_publica,
//     reuniao_comissao, votacao, licitacao, agenda_vereador, ato_vereador,
//     data_comemorativa, prazo_esic, palestra, premiacao, mocao, titulo,
//     campanha, outro). O destino restringe a CHECK
//     (audiencia_publica|palestra|seminario|solenidade|outro). Mapeamos para o
//     conjunto permitido — o que não casa cai em 'outro'.
//   * data_hora (NOT NULL no destino): combineDateTime(data_evento, hora_inicio),
//     com fallback p/ created_at e, em último caso, agora — para não quebrar a
//     carga de eventos sem horário (o legado tem hora_inicio opcional).
//   * data_fim: combineDateTime(data_evento, hora_fim) quando há hora_fim.
//   * vagas: vagas_presenciais + vagas_online (limite total de inscrições;
//     NULL quando ambos ausentes = ilimitado).
//   * online_url: o legado não tem coluna própria de transmissão para eventos
//     genéricos; quando existir alguma (defensivo via has), aproveitamos.
//   * certificavel: derivado de certificate_template_id (se há template, o
//     evento emitia certificado).
//   * inscricoes_abertas: legado `inscricoes_ativas`.
//   * sessao_id: vínculo opcional à sessão do plenário (L2) — uuid SIMPLES, sem
//     FK no destino. idmap.uid('sessoes', sessao_id).
//   * slug: o legado não tem slug; geramos por slugify(titulo) garantindo
//     unicidade na carga (UNIQUE(tenant_id, slug) WHERE slug IS NOT NULL).
//
// INSCRIÇÕES (evento_inscricoes):
//   O modelo legado (EventoInscricao) liga a inscrição ao cidadão via
//   `cidadao_id` (FK users) e NÃO guarda nome/email inline. O destino, porém,
//   exige nome + email NOT NULL (inscrição pode ser sem login). Resolvemos
//   nome/email a partir da tabela users do legado. Como o esquema legado pode
//   variar entre instalações, INSPECIONAMOS as colunas em runtime
//   (mysqlColumns) e somos DEFENSIVOS (has(col)).
//   O destino tem UNIQUE(tenant_id, evento_id, lower(email)) -> dedupBy.
//
// CERTIFICADOS (evento_certificados):
//   O legado guarda o certificado embutido na própria inscrição
//   (certificado_codigo, certificado_emitido_em). Quando há código, emitimos uma
//   linha em evento_certificados PRESERVANDO o codigo (validação pública —
//   UNIQUE(tenant_id, codigo)). Um certificado por inscrição
//   (UNIQUE(tenant_id, inscricao_id)).
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import log from '../lib/logger.js';
import {
  s, toTs, toInt, toBool, combineDateTime, slugify, uniqueSlug, mapEnum,
} from '../lib/transform.js';

// enum largo do legado -> conjunto permitido pelo CHECK do destino (db/108).
// O que não casa cai no fallback 'outro' (via mapEnum).
const TIPO_EVENTO = {
  audiencia_publica: 'audiencia_publica',
  palestra: 'palestra',
  seminario: 'seminario',
  solenidade: 'solenidade',
  // tipos do legado sem correspondência direta -> melhor encaixe permitido.
  sessao_plenaria: 'solenidade',
  reuniao_comissao: 'audiencia_publica',
  premiacao: 'solenidade',
  titulo: 'solenidade',
  mocao: 'solenidade',
  // votacao, licitacao, agenda_vereador, ato_vereador, data_comemorativa,
  // prazo_esic, campanha, outro -> 'outro' (fallback do mapEnum).
};

// Deduplica linhas por uma chave composta (última vence). Necessário quando o
// destino tem UNIQUE em colunas != id (evento_inscricoes UNIQUE(evento,email)).
function dedupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) m.set(keyFn(r), r);
  return [...m.values()];
}

// Pré-carrega id (legado) -> {name, email} a partir de users, para preencher
// nome/email NOT NULL das inscrições (o legado liga só por cidadao_id).
async function mapaUsers() {
  const m = new Map();
  if (!(await mysqlTableExists('users'))) return m;
  const cols = await mysqlColumns('users');
  const has = (c) => cols.has(c);
  const sel = ['id'];
  if (has('name')) sel.push('name');
  if (has('email')) sel.push('email');
  const rows = await selectAll(`SELECT ${sel.join(', ')} FROM users`);
  for (const r of rows) m.set(Number(r.id), { name: r.name ?? null, email: r.email ?? null });
  return m;
}

async function carregarEventos(ctx) {
  const { tenantId, idmap } = ctx;
  const cols = await mysqlColumns('eventos');
  const has = (c) => cols.has(c);

  const eventos = [];
  const seenSlug = new Set();
  let lidos = 0;

  for await (const ev of selectPaged('SELECT * FROM eventos ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('eventos', ev.id);
    const titulo = s(ev.titulo) || `Evento ${ev.id}`;

    // vagas = presenciais + online (NULL quando ambos ausentes = ilimitado).
    const vp = has('vagas_presenciais') ? toInt(ev.vagas_presenciais, null) : null;
    const vo = has('vagas_online') ? toInt(ev.vagas_online, null) : null;
    const vagas = vp === null && vo === null ? null : (vp || 0) + (vo || 0);

    // online_url: defensivo — o legado de eventos genéricos não tem coluna fixa.
    const onlineUrl =
      (has('link_online') && s(ev.link_online)) ||
      (has('link_transmissao') && s(ev.link_transmissao)) ||
      (has('url_online') && s(ev.url_online)) ||
      null;

    eventos.push({
      id,
      tipo: mapEnum(ev.tipo, TIPO_EVENTO, 'outro', `evento(${ev.id})`),
      titulo,
      slug: uniqueSlug(slugify(titulo), ev.id, seenSlug),
      descricao: s(ev.descricao) || s(ev.observacoes),
      // data_hora é NOT NULL no destino: fallback p/ created_at e, por fim, agora.
      data_hora:
        combineDateTime(ev.data_evento, ev.hora_inicio) ||
        toTs(ev.created_at) ||
        new Date().toISOString(),
      data_fim: has('hora_fim') && s(ev.hora_fim)
        ? combineDateTime(ev.data_evento, ev.hora_fim)
        : null,
      local: s(ev.local),
      online_url: onlineUrl,
      vagas,
      capa_url: null,
      certificavel: has('certificate_template_id') && ev.certificate_template_id != null,
      inscricoes_abertas: has('inscricoes_ativas')
        ? toBool(ev.inscricoes_ativas, false)
        : false,
      // vínculo opcional à sessão (uuid SIMPLES, sem FK).
      sessao_id: has('sessao_id') && ev.sessao_id != null
        ? idmap.uid('sessoes', ev.sessao_id)
        : null,
      publicado: has('ativo') ? toBool(ev.ativo, true) : true,
      ativo: has('ativo') ? toBool(ev.ativo, true) : true,
      criado_em: toTs(ev.created_at),
      atualizado_em: toTs(ev.updated_at),
    });
  }

  await upsertBatch(
    tenantId,
    'eventos',
    ['id', 'tipo', 'titulo', 'slug', 'descricao', 'data_hora', 'data_fim', 'local',
      'online_url', 'vagas', 'capa_url', 'certificavel', 'inscricoes_abertas', 'sessao_id',
      'publicado', 'ativo', 'criado_em', 'atualizado_em'],
    eventos,
  );
  return lidos;
}

async function carregarInscricoes(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('evento_inscricoes'))) return { inscricoes: 0, certificados: 0 };

  const cols = await mysqlColumns('evento_inscricoes');
  const has = (c) => cols.has(c);
  const users = await mapaUsers();

  const inscricoes = [];
  const certificados = [];
  const codigosVistos = new Set();

  for await (const ins of selectPaged('SELECT * FROM evento_inscricoes ORDER BY id', [], 2000)) {
    const id = idmap.uid('evento_inscricoes', ins.id);
    const eventoId = idmap.uid('eventos', ins.evento_id);

    // nome/email: o legado liga por cidadao_id (sem nome/email inline). Resolve
    // via users; defensivo p/ instalações que tenham as colunas inline.
    const cidadaoLegacy = has('cidadao_id') ? ins.cidadao_id
      : (has('user_id') ? ins.user_id : null);
    const u = cidadaoLegacy != null ? users.get(Number(cidadaoLegacy)) : null;

    const nome =
      (has('nome') && s(ins.nome)) ||
      (u && s(u.name)) ||
      `Participante ${ins.id}`;
    const email =
      (has('email') && s(ins.email)) ||
      (u && s(u.email)) ||
      `inscricao-${ins.id}@migrado.local`;

    // status: legado não tem coluna `status` própria (modelo EventoInscricao);
    // defensivo — se existir, mapeia; senão 'confirmada'.
    const STATUS = {
      confirmada: 'confirmada', confirmado: 'confirmada',
      lista_espera: 'lista_espera', espera: 'lista_espera',
      cancelada: 'cancelada', cancelado: 'cancelada',
    };
    const status = has('status')
      ? mapEnum(ins.status, STATUS, 'confirmada', `inscricao(${ins.id})`)
      : 'confirmada';

    const presente = has('presente') ? toBool(ins.presente, false) : false;
    const presenteEm = has('presenca_marcada_em') ? toTs(ins.presenca_marcada_em)
      : (has('presente_em') ? toTs(ins.presente_em) : null);

    inscricoes.push({
      id,
      evento_id: eventoId,
      cidadao_id: cidadaoLegacy != null ? idmap.uid('users', cidadaoLegacy) : null,
      nome,
      email,
      telefone: has('telefone') ? s(ins.telefone) : null,
      documento: has('documento') ? s(ins.documento)
        : (has('cpf') ? s(ins.cpf) : null),
      status,
      presente,
      presente_em: presenteEm,
      criado_em: toTs(ins.created_at),
      atualizado_em: toTs(ins.updated_at),
    });

    // certificado embutido na inscrição (legado): PRESERVA o codigo (validação
    // pública, UNIQUE(tenant_id, codigo)). Um por inscrição.
    const codigo = has('certificado_codigo') ? s(ins.certificado_codigo) : null;
    if (codigo) {
      let cod = codigo;
      if (codigosVistos.has(cod)) cod = `${cod}-${ins.id}`;
      codigosVistos.add(cod);
      certificados.push({
        id: idmap.uid('evento_certificados', ins.id),
        evento_id: eventoId,
        inscricao_id: id,
        codigo: cod,
        nome,
        pdf_url: has('certificado_pdf_path') ? s(ins.certificado_pdf_path) : null,
        storage_key: null,
        emitido_em: has('certificado_emitido_em')
          ? toTs(ins.certificado_emitido_em) || toTs(ins.created_at)
          : toTs(ins.created_at),
        criado_em: toTs(ins.created_at),
      });
    }
  }

  // UNIQUE(tenant_id, evento_id, lower(email)) -> última inscrição vence.
  const unicas = dedupBy(inscricoes, (i) => `${i.evento_id}|${String(i.email).toLowerCase()}`);
  const idsValidos = new Set(unicas.map((i) => i.id));
  // só emite certificado p/ inscrição efetivamente carregada (FK NOT NULL).
  const certsValidos = certificados.filter((c) => idsValidos.has(c.inscricao_id));

  await upsertBatch(
    tenantId,
    'evento_inscricoes',
    ['id', 'evento_id', 'cidadao_id', 'nome', 'email', 'telefone', 'documento',
      'status', 'presente', 'presente_em', 'criado_em', 'atualizado_em'],
    unicas,
  );
  await upsertBatch(
    tenantId,
    'evento_certificados',
    ['id', 'evento_id', 'inscricao_id', 'codigo', 'nome', 'pdf_url', 'storage_key',
      'emitido_em', 'criado_em'],
    certsValidos,
    { conflictTarget: 'id' },
  );

  return { inscricoes: unicas.length, certificados: certsValidos.length };
}

export async function migrarEventos(ctx) {
  if (!(await mysqlTableExists('eventos'))) {
    log.warn('Tabela origem `eventos` ausente — pulando eventos.');
    return { lidos: 0, gravados: 0 };
  }
  const ev = await carregarEventos(ctx);
  const { inscricoes, certificados } = await carregarInscricoes(ctx);
  log.info(`  eventos: eventos=${ev} inscricoes=${inscricoes} certificados=${certificados} (codigos preservados)`);
  return { lidos: ev, gravados: ev };
}

export default migrarEventos;
