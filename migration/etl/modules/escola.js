// =====================================================================
// Domínio: ESCOLA LEGISLATIVA (L4)
// Origem (MySQL): cursos, curso_modulos, curso_aulas, curso_inscricoes,
//                 curso_aula_conclusoes, curso_provas, curso_questoes,
//                 curso_opcoes, curso_tentativas_prova,
//                 curso_tentativa_prova_questoes, curso_certificados,
//                 curso_aula_duvidas, curso_aula_respostas, curso_feedbacks,
//                 curso_restricoes, certificate_templates/photos/elements/texts/types
// Destino (PG):   db/106 — cursos, curso_modulos, curso_aulas,
//                 curso_aula_conclusoes, curso_provas, curso_questoes,
//                 curso_opcoes, curso_tentativas_prova, curso_tentativa_questoes,
//                 curso_inscricoes, curso_certificados, certificate_types,
//                 certificate_templates, certificate_elements, certificate_texts,
//                 certificate_photos, curso_aula_duvidas, curso_aula_respostas,
//                 curso_feedbacks, curso_restricoes
//
// REGRA CRÍTICA — CÓDIGOS DE CERTIFICADO:
//   curso_certificados.codigo é o código de validação pública. PRESERVAMOS 1:1
//   (a URL /validar/{codigo} precisa continuar resolvendo). O destino tem
//   UNIQUE(codigo) global — então copiamos exatamente.
//
// REESTRUTURAÇÕES de modelo (legado -> destino):
//   * Conclusão/tentativa/certificado: o legado referencia `curso_inscricao_id`;
//     o destino exige (user_id, curso_id) (e inscricao_id opcional). Pré-carregamos
//     um MAPA inscricao_id -> {user_id, curso_id} para resolver.
//   * Aula: legado liga a `curso_modulo_id`; o destino exige modulo_id E curso_id.
//     Resolvemos curso_id via mapa modulo->curso.
//   * conteudo: legado guarda longText (HTML/markdown); destino é jsonb (EditorJS).
//     Encapsulamos em um bloco simples {type:'raw', html:...} para não perder.
//   * Prova: legado tem `curso_prova` por curso (1:1) sem modulo; destino aceita
//     modulo_id NULL (prova final).
//   * Questão tipo: multipla_escolha/verdadeiro_falso -> 'objetiva'.
//   * Tentativa.aprovado(bool) -> status 'aprovado'/'reprovado'; nota preservada.
//   * Tipo de curso (presencial/ead/hibrido) não tem coluna no destino -> ignorado
//     (poderia ir p/ um campo futuro); status: ativo->'publicado', senão 'rascunho'.
//   * Certificate templates do legado guardam layout em JSON único (coluna `json`);
//     o destino é normalizado (elements/texts/photos). Migramos o cabeçalho do
//     template + preservamos o JSON bruto num certificate_texts (placeholder),
//     deixando a re-modelagem visual para a aplicação.
// =====================================================================
import {
  mysqlTableExists, mysqlColumns, selectPaged, selectAll,
} from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import log from '../lib/logger.js';
import {
  s, toTs, toDate, toInt, toNum, toBool, slugify, mapEnum, uniqueSlug,
} from '../lib/transform.js';

const CURSO_STATUS = (ativo) => (toBool(ativo, true) ? 'publicado' : 'rascunho');

const QUESTAO_TIPO = {
  multipla_escolha: 'objetiva',
  verdadeiro_falso: 'objetiva',
  dissertativa: 'dissertativa',
};

// HTML/markdown legado -> bloco EditorJS mínimo (não perde conteúdo).
function htmlToEditorJs(html) {
  const text = s(html);
  if (!text) return {};
  return {
    time: Date.now(),
    blocks: [{ type: 'raw', data: { html: text } }],
    version: '2.0.0-migrado',
  };
}

// Pré-carrega inscricao_id (legado) -> {userLegacy, cursoLegacy}.
async function mapaInscricoes() {
  const m = new Map();
  if (!(await mysqlTableExists('curso_inscricoes'))) return m;
  const rows = await selectAll('SELECT id, user_id, curso_id FROM curso_inscricoes');
  for (const r of rows) m.set(Number(r.id), { user: Number(r.user_id), curso: Number(r.curso_id) });
  return m;
}

// Pré-carrega modulo_id (legado) -> curso_id (legado).
async function mapaModuloCurso() {
  const m = new Map();
  if (!(await mysqlTableExists('curso_modulos'))) return m;
  const rows = await selectAll('SELECT id, curso_id FROM curso_modulos');
  for (const r of rows) m.set(Number(r.id), Number(r.curso_id));
  return m;
}

// Pré-carrega prova_id (legado) -> curso_id (legado).
async function mapaProvaCurso() {
  const m = new Map();
  if (!(await mysqlTableExists('curso_provas'))) return m;
  const rows = await selectAll('SELECT id, curso_id FROM curso_provas');
  for (const r of rows) m.set(Number(r.id), Number(r.curso_id));
  return m;
}

// Pré-carrega aula_id (legado) -> curso_id (via modulo).
async function mapaAulaCurso(moduloCurso) {
  const m = new Map();
  if (!(await mysqlTableExists('curso_aulas'))) return m;
  const rows = await selectAll('SELECT id, curso_modulo_id FROM curso_aulas');
  for (const r of rows) m.set(Number(r.id), moduloCurso.get(Number(r.curso_modulo_id)) ?? null);
  return m;
}

export async function migrarEscola(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('cursos'))) {
    log.warn('Tabela origem `cursos` ausente — pulando escola legislativa.');
    return { lidos: 0, gravados: 0 };
  }

  const moduloCurso = await mapaModuloCurso();
  const provaCurso = await mapaProvaCurso();
  const inscMap = await mapaInscricoes();
  const aulaCurso = await mapaAulaCurso(moduloCurso);

  // -- cursos --
  const cursos = [];
  const seenSlug = new Set();
  let nCursos = 0;
  for await (const c of selectPaged('SELECT * FROM cursos ORDER BY id', [], 1000)) {
    nCursos++;
    cursos.push({
      id: idmap.uid('cursos', c.id),
      titulo: s(c.titulo) || `Curso ${c.id}`,
      slug: uniqueSlug(slugify(c.slug || c.titulo), c.id, seenSlug),
      resumo: null,
      descricao: s(c.descricao) || s(c.ementa),
      capa_url: null,
      capa_storage_key: null,
      carga_horaria: toInt(c.carga_horaria_horas, null),
      inicio_em: toDate(c.data_inicio),
      fim_em: toDate(c.data_fim),
      certificacao: toBool(c.certificado_automatico, true),
      nota_minima: 70,
      template_id: null,
      status: CURSO_STATUS(c.ativo),
      publicado: toBool(c.ativo, false),
      ordem: 0,
      criado_em: toTs(c.created_at),
      atualizado_em: toTs(c.updated_at),
    });
  }
  await upsertBatch(tenantId, 'cursos',
    ['id', 'titulo', 'slug', 'resumo', 'descricao', 'capa_url', 'capa_storage_key', 'carga_horaria',
      'inicio_em', 'fim_em', 'certificacao', 'nota_minima', 'template_id', 'status', 'publicado',
      'ordem', 'criado_em', 'atualizado_em'],
    cursos);

  // -- módulos --
  const modulos = [];
  if (await mysqlTableExists('curso_modulos')) {
    for await (const m of selectPaged('SELECT * FROM curso_modulos ORDER BY id', [], 2000)) {
      modulos.push({
        id: idmap.uid('curso_modulos', m.id),
        curso_id: idmap.uid('cursos', m.curso_id),
        titulo: s(m.titulo) || `Módulo ${m.id}`,
        descricao: null,
        ordem: toInt(m.ordem, 0),
        criado_em: toTs(m.created_at),
        atualizado_em: toTs(m.updated_at),
      });
    }
    await upsertBatch(tenantId, 'curso_modulos',
      ['id', 'curso_id', 'titulo', 'descricao', 'ordem', 'criado_em', 'atualizado_em'], modulos);
  }

  // -- aulas --
  const aulas = [];
  if (await mysqlTableExists('curso_aulas')) {
    for await (const a of selectPaged('SELECT * FROM curso_aulas ORDER BY id', [], 2000)) {
      const cursoLegacy = moduloCurso.get(Number(a.curso_modulo_id));
      aulas.push({
        id: idmap.uid('curso_aulas', a.id),
        modulo_id: idmap.uid('curso_modulos', a.curso_modulo_id),
        curso_id: cursoLegacy != null ? idmap.uid('cursos', cursoLegacy) : null,
        titulo: s(a.titulo) || `Aula ${a.id}`,
        conteudo: htmlToEditorJs(a.conteudo),
        video_url: s(a.url_externa),
        storage_key: s(a.arquivo_path),
        duracao_min: toInt(a.duracao_min, null),
        ordem: toInt(a.ordem, 0),
        criado_em: toTs(a.created_at),
        atualizado_em: toTs(a.updated_at),
      });
    }
    // descarta aulas órfãs (curso_id NULL — modulo inexistente).
    const validAulas = aulas.filter((x) => x.curso_id != null);
    await upsertBatch(tenantId, 'curso_aulas',
      ['id', 'modulo_id', 'curso_id', 'titulo', 'conteudo', 'video_url', 'storage_key', 'duracao_min',
        'ordem', 'criado_em', 'atualizado_em'], validAulas);
  }

  // -- inscrições --
  const inscricoes = [];
  if (await mysqlTableExists('curso_inscricoes')) {
    for await (const i of selectPaged('SELECT * FROM curso_inscricoes ORDER BY id', [], 2000)) {
      const statusMap = { cursando: 'ativa', concluido: 'concluida', reprovado: 'ativa', cancelado: 'cancelada' };
      inscricoes.push({
        id: idmap.uid('curso_inscricoes', i.id),
        curso_id: idmap.uid('cursos', i.curso_id),
        user_id: idmap.uid('users', i.user_id),
        status: mapEnum(i.status, statusMap, 'ativa', `inscricao(${i.id})`),
        progresso: toInt(i.progresso, 0) || 0,
        aprovado: s(i.status) === 'concluido',
        inscrito_em: toTs(i.created_at),
        concluido_em: toTs(i.data_conclusao),
      });
    }
    await upsertBatch(tenantId, 'curso_inscricoes',
      ['id', 'curso_id', 'user_id', 'status', 'progresso', 'aprovado', 'inscrito_em', 'concluido_em'],
      inscricoes, { conflictTarget: 'id' });
  }

  // -- conclusões de aula (legado liga a inscrição) --
  if (await mysqlTableExists('curso_aula_conclusoes')) {
    const conclusoes = [];
    for await (const cc of selectPaged('SELECT * FROM curso_aula_conclusoes ORDER BY id', [], 4000)) {
      const insc = inscMap.get(Number(cc.curso_inscricao_id));
      if (!insc) continue;
      const cursoLegacy = aulaCurso.get(Number(cc.curso_aula_id)) ?? insc.curso;
      conclusoes.push({
        id: idmap.uid('curso_aula_conclusoes', cc.id),
        aula_id: idmap.uid('curso_aulas', cc.curso_aula_id),
        curso_id: idmap.uid('cursos', cursoLegacy),
        user_id: idmap.uid('users', insc.user),
        concluido_em: toTs(cc.concluida_em),
      });
    }
    await upsertBatch(tenantId, 'curso_aula_conclusoes',
      ['id', 'aula_id', 'curso_id', 'user_id', 'concluido_em'], conclusoes);
  }

  // -- provas --
  if (await mysqlTableExists('curso_provas')) {
    const provas = [];
    for await (const p of selectPaged('SELECT * FROM curso_provas ORDER BY id', [], 2000)) {
      provas.push({
        id: idmap.uid('curso_provas', p.id),
        curso_id: idmap.uid('cursos', p.curso_id),
        modulo_id: null, // legado: prova por curso (final)
        titulo: s(p.titulo) || 'Prova Final',
        descricao: null,
        nota_minima: toNum(p.nota_minima, 70) || 70,
        tempo_limite_min: toInt(p.tempo_limite_min, null),
        max_tentativas: toInt(p.max_tentativas, 1) || 1,
        embaralhar: false,
        ativa: toBool(p.ativo, true),
        ordem: 0,
        criado_em: toTs(p.created_at),
        atualizado_em: toTs(p.updated_at),
      });
    }
    await upsertBatch(tenantId, 'curso_provas',
      ['id', 'curso_id', 'modulo_id', 'titulo', 'descricao', 'nota_minima', 'tempo_limite_min',
        'max_tentativas', 'embaralhar', 'ativa', 'ordem', 'criado_em', 'atualizado_em'], provas);
  }

  // -- questões --
  if (await mysqlTableExists('curso_questoes')) {
    const questoes = [];
    for await (const q of selectPaged('SELECT * FROM curso_questoes ORDER BY id', [], 4000)) {
      questoes.push({
        id: idmap.uid('curso_questoes', q.id),
        prova_id: idmap.uid('curso_provas', q.curso_prova_id),
        enunciado: s(q.enunciado) || '',
        tipo: mapEnum(q.tipo, QUESTAO_TIPO, 'objetiva', `questao(${q.id})`),
        peso: toNum(q.peso, 1) || 1,
        ordem: 0,
        criado_em: toTs(q.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_questoes',
      ['id', 'prova_id', 'enunciado', 'tipo', 'peso', 'ordem', 'criado_em'], questoes);
  }

  // -- opções --
  if (await mysqlTableExists('curso_opcoes')) {
    const opcoes = [];
    for await (const o of selectPaged('SELECT * FROM curso_opcoes ORDER BY id', [], 4000)) {
      opcoes.push({
        id: idmap.uid('curso_opcoes', o.id),
        questao_id: idmap.uid('curso_questoes', o.curso_questao_id),
        texto: s(o.texto_opcao) || '',
        correta: toBool(o.correta, false),
        ordem: 0,
        criado_em: toTs(o.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_opcoes',
      ['id', 'questao_id', 'texto', 'correta', 'ordem', 'criado_em'], opcoes);
  }

  // -- tentativas de prova --
  if (await mysqlTableExists('curso_tentativas_prova')) {
    const tentativas = [];
    for await (const t of selectPaged('SELECT * FROM curso_tentativas_prova ORDER BY id', [], 2000)) {
      const insc = inscMap.get(Number(t.curso_inscricao_id));
      const cursoLegacy = provaCurso.get(Number(t.curso_prova_id)) ?? insc?.curso;
      tentativas.push({
        id: idmap.uid('curso_tentativas_prova', t.id),
        prova_id: idmap.uid('curso_provas', t.curso_prova_id),
        curso_id: cursoLegacy != null ? idmap.uid('cursos', cursoLegacy) : null,
        user_id: idmap.uid('users', t.user_id),
        numero: 1,
        status: toBool(t.aprovado, false) ? 'aprovado' : (t.finalizada_em ? 'reprovado' : 'em_andamento'),
        nota: toNum(t.nota, null),
        nota_objetiva: toNum(t.nota, null),
        iniciada_em: toTs(t.iniciada_em) || toTs(t.created_at),
        heartbeat_em: null,
        finalizada_em: toTs(t.finalizada_em),
        corrigida_em: null,
        corrigida_por: null,
        criado_em: toTs(t.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_tentativas_prova',
      ['id', 'prova_id', 'curso_id', 'user_id', 'numero', 'status', 'nota', 'nota_objetiva',
        'iniciada_em', 'heartbeat_em', 'finalizada_em', 'corrigida_em', 'corrigida_por', 'criado_em'],
      tentativas.filter((x) => x.curso_id != null));
  }

  // -- respostas por questão na tentativa --
  if (await mysqlTableExists('curso_tentativa_prova_questoes')) {
    const tq = [];
    for await (const r of selectPaged('SELECT * FROM curso_tentativa_prova_questoes ORDER BY id', [], 4000)) {
      tq.push({
        id: idmap.uid('curso_tentativa_questoes', r.id),
        tentativa_id: idmap.uid('curso_tentativas_prova', r.curso_tentativa_prova_id),
        questao_id: idmap.uid('curso_questoes', r.curso_questao_id),
        opcao_id: null, // legado guarda resposta em JSON; sem id de opção direto
        resposta_texto: r.resposta_json ? JSON.stringify(r.resposta_json) : null,
        correta: r.correta == null ? null : toBool(r.correta),
        nota: null,
        feedback: null,
        criado_em: toTs(r.iniciada_em) || toTs(r.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_tentativa_questoes',
      ['id', 'tentativa_id', 'questao_id', 'opcao_id', 'resposta_texto', 'correta', 'nota', 'feedback', 'criado_em'],
      tq, { conflictTarget: 'id' });
  }

  // -- certificados (PRESERVA codigo!) --
  if (await mysqlTableExists('curso_certificados')) {
    const cols = await mysqlColumns('curso_certificados');
    const has = (c) => cols.has(c);
    const certs = [];
    // nomes de aluno e título do curso para snapshot
    const userNome = await mapaUserNome();
    const cursoTitulo = new Map(cursos.map((c) => [c.id, c.titulo]));
    for await (const cert of selectPaged('SELECT * FROM curso_certificados ORDER BY id', [], 2000)) {
      const insc = inscMap.get(Number(cert.curso_inscricao_id));
      if (!insc) continue;
      const cursoId = idmap.uid('cursos', insc.curso);
      const userId = idmap.uid('users', insc.user);
      certs.push({
        id: idmap.uid('curso_certificados', cert.id),
        curso_id: cursoId,
        user_id: userId,
        inscricao_id: idmap.uid('curso_inscricoes', cert.curso_inscricao_id),
        template_id: null,
        codigo: s(cert.codigo) || `CERT-${cert.id}`, // PRESERVADO (validação pública)
        nome_aluno: userNome.get(insc.user) || 'Aluno',
        titulo_curso: cursoTitulo.get(cursoId) || 'Curso',
        carga_horaria: null,
        pdf_url: s(cert.pdf_path),
        pdf_storage_key: null,
        qr_url: null,
        emitido_em: toTs(cert.emitido_em) || toTs(cert.created_at),
        criado_em: toTs(cert.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_certificados',
      ['id', 'curso_id', 'user_id', 'inscricao_id', 'template_id', 'codigo', 'nome_aluno', 'titulo_curso',
        'carga_horaria', 'pdf_url', 'pdf_storage_key', 'qr_url', 'emitido_em', 'criado_em'],
      certs, { conflictTarget: 'id' });
    log.info(`  escola: certificados=${certs.length} (codigos preservados)`);
  }

  // -- dúvidas --
  if (await mysqlTableExists('curso_aula_duvidas')) {
    const duvidas = [];
    for await (const d of selectPaged('SELECT * FROM curso_aula_duvidas ORDER BY id', [], 2000)) {
      const cursoLegacy = aulaCurso.get(Number(d.curso_aula_id));
      duvidas.push({
        id: idmap.uid('curso_aula_duvidas', d.id),
        aula_id: idmap.uid('curso_aulas', d.curso_aula_id),
        curso_id: cursoLegacy != null ? idmap.uid('cursos', cursoLegacy) : null,
        user_id: idmap.uid('users', d.user_id),
        titulo: s(d.titulo),
        mensagem: s(d.mensagem) || '',
        resolvida: s(d.status) === 'fechada' || s(d.status) === 'respondida',
        criado_em: toTs(d.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_aula_duvidas',
      ['id', 'aula_id', 'curso_id', 'user_id', 'titulo', 'mensagem', 'resolvida', 'criado_em'],
      duvidas.filter((x) => x.curso_id != null));
  }

  // -- respostas do fórum --
  if (await mysqlTableExists('curso_aula_respostas')) {
    const respostas = [];
    for await (const r of selectPaged('SELECT * FROM curso_aula_respostas ORDER BY id', [], 2000)) {
      if (r.user_id == null) continue; // destino exige user_id NOT NULL
      respostas.push({
        id: idmap.uid('curso_aula_respostas', r.id),
        duvida_id: idmap.uid('curso_aula_duvidas', r.curso_aula_duvida_id),
        user_id: idmap.uid('users', r.user_id),
        mensagem: s(r.mensagem) || '',
        do_professor: false,
        criado_em: toTs(r.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_aula_respostas',
      ['id', 'duvida_id', 'user_id', 'mensagem', 'do_professor', 'criado_em'], respostas);
  }

  // -- feedbacks --
  if (await mysqlTableExists('curso_feedbacks')) {
    const fbs = [];
    for await (const f of selectPaged('SELECT * FROM curso_feedbacks ORDER BY id', [], 2000)) {
      const nota = toInt(f.nota, 5) || 5;
      fbs.push({
        id: idmap.uid('curso_feedbacks', f.id),
        curso_id: idmap.uid('cursos', f.curso_id),
        user_id: idmap.uid('users', f.user_id),
        nota: Math.max(1, Math.min(5, nota)),
        comentario: s(f.comentario),
        criado_em: toTs(f.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_feedbacks',
      ['id', 'curso_id', 'user_id', 'nota', 'comentario', 'criado_em'], fbs, { conflictTarget: 'id' });
  }

  // -- restrições de curso (CPF/matrícula -> tipo 'aprovacao' com valor) --
  if (await mysqlTableExists('curso_restricoes')) {
    const restr = [];
    for await (const r of selectPaged('SELECT * FROM curso_restricoes ORDER BY id', [], 2000)) {
      const valor = s(r.cpf) || s(r.matricula);
      if (!valor) continue;
      restr.push({
        id: idmap.uid('curso_restricoes', r.id),
        curso_id: idmap.uid('cursos', r.curso_id),
        tipo: 'aprovacao', // lista de elegíveis (CPF/matrícula)
        valor,
        config: { origem: r.cpf ? 'cpf' : 'matricula' },
        criado_em: toTs(r.created_at),
      });
    }
    await upsertBatch(tenantId, 'curso_restricoes',
      ['id', 'curso_id', 'tipo', 'valor', 'config', 'criado_em'], restr);
  }

  // -- templates de certificado (cabeçalho + JSON bruto preservado) --
  await migrarCertificateTemplates(ctx);

  log.info(`  escola: cursos=${nCursos} modulos=${modulos.length} inscricoes=${inscricoes.length}`);
  return { lidos: nCursos, gravados: nCursos };
}

async function mapaUserNome() {
  const m = new Map();
  if (await mysqlTableExists('users')) {
    const rows = await selectAll('SELECT id, name FROM users');
    for (const r of rows) m.set(Number(r.id), r.name);
  }
  return m;
}

async function migrarCertificateTemplates(ctx) {
  const { tenantId, idmap } = ctx;

  // tipos (certificate_types) — legado pode não ter a tabela.
  if (await mysqlTableExists('certificate_types')) {
    const types = [];
    for await (const t of selectPaged('SELECT * FROM certificate_types ORDER BY id', [], 1000)) {
      types.push({
        id: idmap.uid('certificate_types', t.id),
        nome: s(t.name) || s(t.nome) || `Tipo ${t.id}`,
        descricao: s(t.description) || s(t.descricao),
        ativo: true,
        ordem: 0,
        criado_em: toTs(t.created_at),
      });
    }
    await upsertBatch(tenantId, 'certificate_types',
      ['id', 'nome', 'descricao', 'ativo', 'ordem', 'criado_em'], types);
  }

  if (!(await mysqlTableExists('certificate_templates'))) return;
  const templates = [];
  const texts = [];
  for await (const t of selectPaged('SELECT * FROM certificate_templates ORDER BY id', [], 1000)) {
    const id = idmap.uid('certificate_templates', t.id);
    templates.push({
      id,
      type_id: null,
      nome: s(t.title) || `Template ${t.id}`,
      fundo_url: s(t.preview_path),
      fundo_storage_key: null,
      largura: 842,
      altura: 595,
      orientacao: 'paisagem',
      padrao: toBool(t.is_default, false),
      ativo: true,
      criado_em: toTs(t.created_at),
      atualizado_em: toTs(t.updated_at),
    });
    // preserva o layout JSON bruto do legado num certificate_texts (placeholder),
    // para a aplicação re-modelar visualmente sem perda de dados.
    if (s(t.json)) {
      texts.push({
        id: idmap.uid('certificate_texts_legado', t.id),
        template_id: id,
        conteudo: `__LAYOUT_LEGADO__ ${s(t.json)}`,
        pos_x: 0,
        pos_y: 0,
        largura: null,
        fonte: 'Helvetica',
        tamanho: 16,
        cor: '#000000',
        alinhamento: 'center',
        negrito: false,
        ordem: 0,
        criado_em: toTs(t.created_at),
      });
    }
  }
  await upsertBatch(tenantId, 'certificate_templates',
    ['id', 'type_id', 'nome', 'fundo_url', 'fundo_storage_key', 'largura', 'altura', 'orientacao',
      'padrao', 'ativo', 'criado_em', 'atualizado_em'], templates);
  await upsertBatch(tenantId, 'certificate_texts',
    ['id', 'template_id', 'conteudo', 'pos_x', 'pos_y', 'largura', 'fonte', 'tamanho', 'cor',
      'alinhamento', 'negrito', 'ordem', 'criado_em'], texts);
  log.info(`  escola: certificate_templates=${templates.length}`);
}

export default migrarEscola;
