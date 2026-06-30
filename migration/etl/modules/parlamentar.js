// =====================================================================
// Domínio: PARLAMENTAR (L1)
// Origem (MySQL): vereadores, comissoes, comissao_cargos, comissao_documentos,
//                 vereador_posts, vereador_post_midias, vereador_representacoes
// Destino (PG):   db/103 — vereadores, vereador_mesa_cargos, comissoes,
//                 comissao_cargos, comissao_documentos, vereador_posts,
//                 vereador_post_midias, vereador_representacoes
//
// Pontos de mapeamento não-triviais:
//   * MESA DIRETORA: no legado é um conjunto de booleans + pares de datas
//     NA PRÓPRIA linha do vereador (presidente, presidente_inicio/fim, ...).
//     No destino vira a tabela `vereador_mesa_cargos` (1 linha por cargo). Aqui
//     "explodimos" cada flag verdadeira em uma linha de cargo com vigência.
//   * legislatura: legado é INTEGER (ano); destino é TEXT (ex.: "2021-2024").
//     Preservamos como string.
//   * foto: legado guarda path OU media_id (coluna foto_tipo). Preservamos a
//     referência em foto_url; storage_key fica NULL (re-hospedagem via API).
//   * redes_sociais (json) -> redes (jsonb).
//   * posts: legado tem coluna `tipo` (texto/foto/video) + midia_path/video_url;
//     o destino separa post (texto) de mídias (vereador_post_midias). Geramos
//     1 mídia quando houver midia_path/video_url.
// =====================================================================
import { mysqlTableExists, mysqlColumns, selectPaged } from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import log from '../lib/logger.js';
import {
  s, toDate, toTs, toBool, toInt, jsonOf, slugify, mapEnum, uniqueSlug,
} from '../lib/transform.js';

const VEREADOR_STATUS = {
  ativo: 'ativo',
  inativo: 'inativo',
  licenciado: 'licenciado',
  afastado: 'afastado',
};

const COMISSAO_TIPO = {
  permanente: 'permanente',
  temporaria: 'temporaria',
  cpi: 'cpi',
  especial: 'especial',
};

const COMISSAO_CARGO = {
  presidente: 'presidente',
  vice_presidente: 'vice_presidente',
  relator: 'relator',
  membro: 'membro',
};

const POST_MIDIA_TIPO = { foto: 'foto', video: 'video' };

const REPR_STATUS_TRUE = 'em_andamento'; // legado: status boolean (true = vigente)
const REPR_STATUS_FALSE = 'arquivada';

// Mesa: cada flag legada -> {cargo destino, colunas de início/fim no legado}.
const MESA_FLAGS = [
  { flag: 'presidente', cargo: 'presidente', ini: 'presidente_inicio', fim: 'presidente_fim' },
  { flag: 'vice_presidente', cargo: 'vice_presidente', ini: 'vice_inicio', fim: 'vice_fim' },
  {
    flag: 'primeiro_secretario',
    cargo: 'primeiro_secretario',
    ini: 'primeiro_secretario_inicio',
    fim: 'primeiro_secretario_fim',
  },
  {
    flag: 'segundo_secretario',
    cargo: 'segundo_secretario',
    ini: 'segundo_secretario_inicio',
    fim: 'segundo_secretario_fim',
  },
];

async function migrarVereadores(ctx) {
  const { tenantId, idmap } = ctx;
  const cols = await mysqlColumns('vereadores');
  const has = (c) => cols.has(c);
  const seenSlug = new Set();

  const vereadores = [];
  const mesaCargos = [];
  let lidos = 0;

  for await (const v of selectPaged('SELECT * FROM vereadores ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('vereadores', v.id);
    const nome = s(v.nome) || 'Vereador';
    const nomeParlamentar = s(v.nome_parlamentar) || nome;
    const slug = uniqueSlug(slugify(nomeParlamentar), v.id, seenSlug);

    vereadores.push({
      id,
      user_id: null, // vínculo de login resolvido depois (não há FK direta no legado)
      nome,
      nome_parlamentar: nomeParlamentar,
      slug,
      partido: s(v.partido),
      status: mapEnum(v.status, VEREADOR_STATUS, 'ativo', `vereador(${v.id})`),
      legislatura: v.legislatura != null ? String(v.legislatura) : null,
      mandato_inicio: has('inicio_mandato') ? toDate(v.inicio_mandato) : null,
      mandato_fim: has('fim_mandato') ? toDate(v.fim_mandato) : null,
      email: s(v.email),
      telefone: s(v.telefone),
      foto_url: s(v.foto), // path OU media_id legado; re-hospedagem posterior
      biografia: s(v.biografia),
      redes: jsonOf(v.redes_sociais, {}) || {},
      ordem: 0,
      ativo: s(v.status) !== 'inativo',
      criado_em: toTs(v.created_at),
      atualizado_em: toTs(v.updated_at),
    });

    // Explode mesa diretora (booleans -> linhas de cargo com vigência).
    for (const m of MESA_FLAGS) {
      if (has(m.flag) && toBool(v[m.flag], false)) {
        mesaCargos.push({
          id: idmap.uid(`vereador_mesa:${m.cargo}`, v.id),
          vereador_id: id,
          cargo: m.cargo,
          inicio: (has(m.ini) && toDate(v[m.ini])) || toDate(v.inicio_mandato) || '2021-01-01',
          fim: has(m.fim) ? toDate(v[m.fim]) : null,
          legislatura: v.legislatura != null ? String(v.legislatura) : null,
          ordem: 0,
          criado_em: toTs(v.created_at),
        });
      }
    }
  }

  await upsertBatch(
    tenantId,
    'vereadores',
    ['id', 'user_id', 'nome', 'nome_parlamentar', 'slug', 'partido', 'status', 'legislatura',
      'mandato_inicio', 'mandato_fim', 'email', 'telefone', 'foto_url', 'biografia', 'redes',
      'ordem', 'ativo', 'criado_em', 'atualizado_em'],
    vereadores,
  );
  await upsertBatch(
    tenantId,
    'vereador_mesa_cargos',
    ['id', 'vereador_id', 'cargo', 'inicio', 'fim', 'legislatura', 'ordem', 'criado_em'],
    mesaCargos,
  );
  return lidos;
}

async function migrarComissoes(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('comissoes'))) return 0;
  const seenSlug = new Set();
  const comissoes = [];
  let lidos = 0;

  for await (const c of selectPaged('SELECT * FROM comissoes ORDER BY id', [], 1000)) {
    lidos++;
    comissoes.push({
      id: idmap.uid('comissoes', c.id),
      nome: s(c.nome) || 'Comissão',
      slug: uniqueSlug(slugify(c.slug || c.nome), c.id, seenSlug),
      // legado não tem `tipo` de comissão; assume 'permanente'.
      tipo: 'permanente',
      descricao: s(c.descricao),
      legislatura: null,
      ativo: s(c.status) !== 'inativo',
      ordem: 0,
      criado_em: toTs(c.created_at),
      atualizado_em: toTs(c.updated_at),
    });
  }
  await upsertBatch(
    tenantId,
    'comissoes',
    ['id', 'nome', 'slug', 'tipo', 'descricao', 'legislatura', 'ativo', 'ordem', 'criado_em', 'atualizado_em'],
    comissoes,
  );

  // Cargos em comissão
  if (await mysqlTableExists('comissao_cargos')) {
    const cargos = [];
    for await (const cc of selectPaged('SELECT * FROM comissao_cargos ORDER BY id', [], 1000)) {
      cargos.push({
        id: idmap.uid('comissao_cargos', cc.id),
        comissao_id: idmap.uid('comissoes', cc.comissao_id),
        vereador_id: idmap.uid('vereadores', cc.vereador_id),
        cargo: mapEnum(cc.cargo, COMISSAO_CARGO, 'membro', `comissao_cargo(${cc.id})`),
        inicio: toDate(cc.data_inicio),
        fim: toDate(cc.data_fim),
        ordem: 0,
        criado_em: toTs(cc.created_at),
      });
    }
    await upsertBatch(
      tenantId,
      'comissao_cargos',
      ['id', 'comissao_id', 'vereador_id', 'cargo', 'inicio', 'fim', 'ordem', 'criado_em'],
      cargos,
    );
  }

  // Documentos da comissão
  if (await mysqlTableExists('comissao_documentos')) {
    const docs = [];
    for await (const d of selectPaged('SELECT * FROM comissao_documentos ORDER BY id', [], 1000)) {
      docs.push({
        id: idmap.uid('comissao_documentos', d.id),
        comissao_id: idmap.uid('comissoes', d.comissao_id),
        titulo: s(d.titulo) || 'Documento',
        arquivo_url: s(d.arquivo_path),
        storage_key: null,
        ordem: 0,
        criado_em: toTs(d.created_at),
      });
    }
    await upsertBatch(
      tenantId,
      'comissao_documentos',
      ['id', 'comissao_id', 'titulo', 'arquivo_url', 'storage_key', 'ordem', 'criado_em'],
      docs,
    );
  }
  return lidos;
}

async function migrarPosts(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('vereador_posts'))) return 0;
  const posts = [];
  const midias = [];
  let lidos = 0;

  for await (const p of selectPaged('SELECT * FROM vereador_posts ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('vereador_posts', p.id);
    posts.push({
      id,
      vereador_id: idmap.uid('vereadores', p.vereador_id),
      titulo: s(p.titulo) || null,
      conteudo: s(p.conteudo),
      publicado: true,
      publicado_em: toTs(p.publicado_em) || toTs(p.created_at),
      criado_em: toTs(p.created_at),
    });
    // 1 mídia derivada quando o post legado é foto/video.
    const tipoLegado = s(p.tipo);
    const midiaPath = s(p.midia_path);
    const videoUrl = s(p.video_url);
    if (midiaPath || videoUrl) {
      midias.push({
        id: idmap.uid('vereador_post_midias', p.id),
        post_id: id,
        tipo: mapEnum(
          videoUrl ? 'video' : tipoLegado === 'video' ? 'video' : 'foto',
          POST_MIDIA_TIPO,
          'foto',
          `post_midia(${p.id})`,
        ),
        url: videoUrl || midiaPath,
        storage_key: null,
        ordem: 0,
        criado_em: toTs(p.created_at),
      });
    }
  }
  await upsertBatch(
    tenantId,
    'vereador_posts',
    ['id', 'vereador_id', 'titulo', 'conteudo', 'publicado', 'publicado_em', 'criado_em'],
    posts,
  );
  await upsertBatch(
    tenantId,
    'vereador_post_midias',
    ['id', 'post_id', 'tipo', 'url', 'storage_key', 'ordem', 'criado_em'],
    midias,
  );
  return lidos;
}

async function migrarRepresentacoes(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('vereador_representacoes'))) return 0;
  const reprs = [];
  let lidos = 0;

  for await (const r of selectPaged('SELECT * FROM vereador_representacoes ORDER BY id', [], 1000)) {
    lidos++;
    // Legado: assunto = entidade representada; status boolean (true=vigente).
    const assunto = s(r.entidade) || 'Representação';
    const cargo = s(r.cargo);
    const descricao = [cargo && `Cargo: ${cargo}`, r.ato_nomeacao && `Ato: ${s(r.ato_nomeacao)}`]
      .filter(Boolean)
      .join(' | ') || null;
    reprs.push({
      id: idmap.uid('vereador_representacoes', r.id),
      vereador_id: idmap.uid('vereadores', r.vereador_id),
      tipo: 'outro', // legado não tipifica (sugestao/denuncia/...)
      assunto,
      descricao,
      status: toBool(r.status, true) ? REPR_STATUS_TRUE : REPR_STATUS_FALSE,
      criado_em: toTs(r.created_at) || toTs(r.data_inicio),
      atualizado_em: toTs(r.updated_at),
    });
  }
  await upsertBatch(
    tenantId,
    'vereador_representacoes',
    ['id', 'vereador_id', 'tipo', 'assunto', 'descricao', 'status', 'criado_em', 'atualizado_em'],
    reprs,
  );
  return lidos;
}

export async function migrarParlamentar(ctx) {
  if (!(await mysqlTableExists('vereadores'))) {
    log.warn('Tabela origem `vereadores` ausente — pulando parlamentar.');
    return { lidos: 0, gravados: 0 };
  }
  const v = await migrarVereadores(ctx);
  const c = await migrarComissoes(ctx);
  const p = await migrarPosts(ctx);
  const r = await migrarRepresentacoes(ctx);
  log.info(`  parlamentar: vereadores=${v} comissoes=${c} posts=${p} representacoes=${r}`);
  return { lidos: v, gravados: v };
}

export default migrarParlamentar;
