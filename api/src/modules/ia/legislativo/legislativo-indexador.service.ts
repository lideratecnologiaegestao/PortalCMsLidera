import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant.context';
import { EmbeddingsService } from '../embeddings.service';
import { TenantIaConfigService } from '../tenant-ia-config.service';
import { chunkText } from '../ia-indexador.service';
import {
  rotuloLei,
  rotuloProposicao,
  ROTULO_STATUS_PROPOSICAO,
  ROTULO_TIPO_LEI,
  ROTULO_TIPO_PROPOSICAO,
  type FonteLegislativa,
} from './legislativo.prompts';

/** Contagem de chunks por fonte legislativa. */
export interface FonteContagemLegislativa {
  [fonte: string]: number;
}

export interface ResultadoReindexarLegislativo {
  ok: boolean;
  motivo?: string;
  total: number;
  porFonte: FonteContagemLegislativa;
}

export interface StatusIndexLegislativo {
  configurado: boolean;
  provider: string;
  modelo: string;
  total: number;
  porFonte: { fonte: string; chunks: number; ultimoCriado: Date | null }[];
}

/** Item normalizado para indexação (mesma forma do indexador base). */
interface ItemFonteLegislativa {
  fonte: FonteLegislativa;
  refId: string;
  titulo: string;
  url: string;
  textoCompleto: string;
}

// Mesmas constantes do indexador base (consistência de chunking/embeddings).
const BATCH_SIZE = 64;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

// Fontes legislativas gravadas em ia_chunks (não colidem com as do indexador base).
const FONTE_PROPOSICAO: FonteLegislativa = 'proposicao';
const FONTE_LEI: FonteLegislativa = 'lei';
const FONTE_SESSAO_ATA: FonteLegislativa = 'sessao_ata';

/**
 * INDEXADOR LEGISLATIVO (Fase 5 — IA Legislativa).
 *
 * Estende a Camada 4 (busca semântica) ao domínio do poder legislativo,
 * indexando no MESMO corpus vetorial `ia_chunks` do tenant:
 *   - proposições/projetos de lei (`proposicoes`) — apenas publicadas;
 *   - leis e normas sancionadas/promulgadas (`leis`) — apenas publicadas;
 *   - atas de sessão plenária (`sessoes.ata_conteudo`) — apenas publicadas.
 *
 * Segue fielmente o padrão de `IaIndexadorService`:
 *   - Carrega itens via `prisma.db.$queryRaw` (RLS ATIVO — isola o tenant).
 *   - Chunking idêntico (chunkText) + embeddings em lotes (EmbeddingsService).
 *   - UPSERT atômico (DELETE+INSERT) em ia_chunks com `fonte` própria.
 *   - Respeita o teto de chunks por tenant (tenant_ia_config.maxChunks).
 *   - Degrada 100% quando embeddings não estão configurados (FTS cobre).
 *
 * Os chunks gerados aqui são automaticamente recuperados pela busca vetorial
 * existente (ia.service.recuperarVetorial sobre ia_chunks) — sem alterar a base.
 *
 * LGPD: apenas conteúdo legislativo PÚBLICO (normas, projetos, atas). Sem PII de
 * cidadão. Conteúdo HTML/EditorJS é higienizado antes de ir ao modelo.
 */
@Injectable()
export class LegislativoIndexadorService {
  private readonly log = new Logger(LegislativoIndexadorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingsService,
    private readonly tenantIaConfig: TenantIaConfigService,
  ) {}

  // ================================================================ STATUS

  /**
   * Estado do corpus legislativo do tenant (apenas as fontes legislativas).
   * RLS isola via TenantContext.
   */
  async status(tenantId: string): Promise<StatusIndexLegislativo> {
    const run = async (): Promise<StatusIndexLegislativo> => {
      const rows = await this.prisma.db.$queryRaw<
        { fonte: string; chunks: bigint; ultima: Date | null }[]
      >`
        SELECT fonte,
               COUNT(*) AS chunks,
               MAX(criado_em) AS ultima
        FROM ia_chunks
        WHERE fonte IN ('proposicao', 'lei', 'sessao_ata')
        GROUP BY fonte
        ORDER BY fonte`;

      const total = rows.reduce((acc, r) => acc + Number(r.chunks), 0);
      const info = await this.embeddings.infoParaTenant(tenantId);

      return {
        configurado: info.configurado,
        provider: info.provider,
        modelo: info.modelo,
        total,
        porFonte: rows.map((r) => ({
          fonte: r.fonte,
          chunks: Number(r.chunks),
          ultimoCriado: r.ultima,
        })),
      };
    };

    if (TenantContext.tenantId() === tenantId) return run();
    return TenantContext.run({ tenantId }, run);
  }

  // ================================================================ REINDEXAR

  /**
   * (Re)constrói os chunks legislativos do tenant a partir de proposições, leis
   * e atas de sessão publicadas. Pode ser chamado pelo worker (QUEUE_IA) ou
   * direto pelo controller admin. Deve rodar dentro de um TenantContext.
   */
  async reindexar(tenantId: string): Promise<ResultadoReindexarLegislativo> {
    if (!(await this.embeddings.configuradoParaTenant(tenantId))) {
      return { ok: false, motivo: 'EMBEDDINGS_NAO_CONFIGURADO', total: 0, porFonte: {} };
    }

    const maxChunks = await this.tenantIaConfig.maxChunks(tenantId);

    const run = async (): Promise<ResultadoReindexarLegislativo> => {
      const porFonte: FonteContagemLegislativa = {};
      let totalGlobal = 0;
      let limiteAtingido = false;

      const fontes: Array<() => Promise<ItemFonteLegislativa[]>> = [
        () => this.carregarLeis(),
        () => this.carregarProposicoes(),
        () => this.carregarAtas(),
      ];

      for (const carregarFonte of fontes) {
        if (limiteAtingido) break;

        let itens: ItemFonteLegislativa[] = [];
        try {
          itens = await carregarFonte();
        } catch (e) {
          this.log.warn(`Falha ao carregar fonte legislativa do tenant ${tenantId}: ${String(e)}`);
          continue;
        }

        for (const item of itens) {
          if (limiteAtingido) break;
          try {
            const chunks = chunkText(item.textoCompleto, CHUNK_SIZE, CHUNK_OVERLAP);
            if (chunks.length === 0) continue;

            if (totalGlobal + chunks.length > maxChunks) {
              const permitidos = maxChunks - totalGlobal;
              this.log.warn(
                `Teto de ${maxChunks} chunks atingido no tenant ${tenantId} (legislativo). ` +
                  `Indexando apenas ${permitidos} chunks restantes.`,
              );
              chunks.splice(permitidos);
              limiteAtingido = true;
            }

            const vetores = await this.gerarEmbeddingsEmLotes(chunks);
            if (!vetores) continue;

            await this.upsertChunks(tenantId, item, chunks, vetores);

            const n = chunks.length;
            porFonte[item.fonte] = (porFonte[item.fonte] ?? 0) + n;
            totalGlobal += n;
          } catch (e) {
            this.log.warn(`Falha ao indexar ${item.fonte}/${item.refId}: ${String(e)}`);
          }
        }
      }

      this.log.log(
        `Reindexação legislativa tenant ${tenantId}: ${totalGlobal} chunks em ${Object.keys(porFonte).length} fontes.`,
      );

      return {
        ok: true,
        total: totalGlobal,
        porFonte,
        ...(limiteAtingido ? { motivo: `LIMITE_${maxChunks}_ATINGIDO` } : {}),
      };
    };

    if (TenantContext.tenantId() === tenantId) return run();
    return TenantContext.run({ tenantId }, run);
  }

  // ================================================================ INDEXAÇÃO INCREMENTAL
  //
  // MODO DE OPERAÇÃO ATUAL: BATCH. O corpus legislativo é (re)construído pelo
  // job JOB_IA_REINDEX_LEGISLATIVO (método reindexar) — disparado pelo admin e
  // agendável. Os métodos incrementais abaixo já existem e são testados, mas
  // ainda NÃO são chamados pelos services de domínio.
  // TODO(fase Docker): injetar este service em Legislativo/Sessões e chamar
  // indexarProposicao/indexarLei/indexarAta (fire-and-forget) ao publicar/
  // atualizar/despublicar, para a busca semântica refletir mudanças na hora.

  /**
   * Indexa UMA proposição publicada de forma incremental (após criar/atualizar).
   * Se a proposição não for elegível (despublicada/excluída), remove seus chunks.
   * No-op silencioso se embeddings não estiverem configurados (FTS cobre).
   */
  async indexarProposicao(tenantId: string, id: string): Promise<void> {
    await this.indexarUm(tenantId, FONTE_PROPOSICAO, id, () => this.carregarProposicaoUnica(id));
  }

  /** Indexa UMA lei publicada de forma incremental. */
  async indexarLei(tenantId: string, id: string): Promise<void> {
    await this.indexarUm(tenantId, FONTE_LEI, id, () => this.carregarLeiUnica(id));
  }

  /** Indexa a ata de UMA sessão publicada de forma incremental. */
  async indexarAta(tenantId: string, sessaoId: string): Promise<void> {
    await this.indexarUm(tenantId, FONTE_SESSAO_ATA, sessaoId, () => this.carregarAtaUnica(sessaoId));
  }

  /** Núcleo da indexação incremental: carrega 1 item, ou limpa chunks se inelegível. */
  private async indexarUm(
    tenantId: string,
    fonte: FonteLegislativa,
    refId: string,
    carregar: () => Promise<ItemFonteLegislativa | null>,
  ): Promise<void> {
    if (!(await this.embeddings.configuradoParaTenant(tenantId))) return;

    const run = async () => {
      const item = await carregar();
      if (!item) {
        await this.prisma.db.$executeRaw`
          DELETE FROM ia_chunks
          WHERE fonte = ${fonte} AND ref_id = ${refId}`;
        return;
      }
      const chunks = chunkText(item.textoCompleto, CHUNK_SIZE, CHUNK_OVERLAP);
      if (chunks.length === 0) return;
      const vetores = await this.gerarEmbeddingsEmLotes(chunks);
      if (!vetores) return;
      await this.upsertChunks(tenantId, item, chunks, vetores);
      this.log.log(`Indexação incremental ${fonte}/${refId}: ${chunks.length} chunks.`);
    };

    if (TenantContext.tenantId() === tenantId) {
      await run();
    } else {
      await TenantContext.run({ tenantId }, run);
    }
  }

  // ================================================================ UPSERT

  /**
   * DELETE+INSERT atômico em ia_chunks para (tenant, fonte, refId).
   * O literal vetorial é gerado internamente (números puros — sem injeção); os
   * demais campos são parametrizados. Idêntico ao padrão do indexador base.
   */
  private async upsertChunks(
    tenantId: string,
    item: ItemFonteLegislativa,
    chunks: string[],
    vetores: number[][],
  ): Promise<void> {
    await this.prisma.db.$executeRaw`
      DELETE FROM ia_chunks
      WHERE tenant_id = ${tenantId}::uuid
        AND fonte = ${item.fonte}
        AND ref_id = ${item.refId}`;

    for (let i = 0; i < chunks.length; i++) {
      const trecho = chunks[i];
      const vec = vetores[i];
      if (!vec || vec.length === 0) continue;

      const vlit = `[${vec.join(',')}]`;
      const modelo = this.embeddings.modelo;

      await this.prisma.db.$executeRawUnsafe(
        `INSERT INTO ia_chunks
           (tenant_id, fonte, ref_id, chunk_idx, titulo, url, trecho, modelo, embedding)
         VALUES
           ($1::uuid, $2, $3, $4, $5, $6, $7, $8, '${vlit}'::vector)
         ON CONFLICT (tenant_id, fonte, ref_id, chunk_idx) DO UPDATE
           SET titulo = EXCLUDED.titulo,
               url    = EXCLUDED.url,
               trecho = EXCLUDED.trecho,
               modelo = EXCLUDED.modelo,
               embedding = EXCLUDED.embedding,
               criado_em = now()`,
        tenantId,
        item.fonte,
        item.refId,
        i,
        item.titulo.slice(0, 500),
        item.url.slice(0, 1000),
        trecho.slice(0, 2000),
        modelo,
      );
    }
  }

  // ================================================================ EMBEDDINGS EM LOTES

  private async gerarEmbeddingsEmLotes(chunks: string[]): Promise<number[][] | null> {
    const todos: number[][] = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const lote = chunks.slice(i, i + BATCH_SIZE);
      const vecs = await this.embeddings.embed(lote);
      if (!vecs) return null;
      todos.push(...vecs);
    }
    return todos;
  }

  // ================================================================ CARREGADORES (lote)

  /**
   * Leis publicadas. Inclui número/ano/tipo no texto e a última tramitação da
   * proposição de origem não é necessária aqui (lei já é norma vigente).
   */
  private async carregarLeis(): Promise<ItemFonteLegislativa[]> {
    const rows = await this.prisma.db.$queryRaw<
      {
        id: string;
        numero: string;
        tipo: string;
        ano: number | null;
        ementa: string;
        texto: string | null;
        data_sancao: Date | null;
        vigente: boolean;
        pdf_url: string | null;
      }[]
    >`
      SELECT id::text, numero, tipo, ano, ementa, texto, data_sancao, vigente, pdf_url
      FROM leis
      WHERE publicada = true`;

    return rows.map((r) => this.montarLei(r));
  }

  /** Proposições publicadas, com a fase atual e o histórico de tramitação. */
  private async carregarProposicoes(): Promise<ItemFonteLegislativa[]> {
    const rows = await this.prisma.db.$queryRaw<
      {
        id: string;
        tipo: string;
        numero: number | null;
        ano: number | null;
        ementa: string;
        texto: string | null;
        status_atual: string;
        data_protocolo: Date | null;
        pdf_url: string | null;
        tramitacao: string | null;
        autores: string | null;
      }[]
    >`
      SELECT p.id::text, p.tipo, p.numero, p.ano, p.ementa, p.texto,
             p.status_atual, p.data_protocolo, p.pdf_url,
             (SELECT string_agg(
                concat_ws(' — ', to_char(t.data, 'DD/MM/YYYY'), t.fase, t.despacho),
                ' | ' ORDER BY t.data)
              FROM proposicao_tramitacoes t WHERE t.proposicao_id = p.id) AS tramitacao,
             (SELECT string_agg(coalesce(v.nome_parlamentar, v.nome), ', ' ORDER BY pa.ordem)
              FROM proposicao_autores pa
              JOIN vereadores v ON v.id = pa.vereador_id
              WHERE pa.proposicao_id = p.id AND pa.papel IN ('autor','coautor')) AS autores
      FROM proposicoes p
      WHERE p.publicada = true`;

    return rows.map((r) => this.montarProposicao(r));
  }

  /** Atas de sessão publicadas (ata_publicada_em não nulo e conteúdo presente). */
  private async carregarAtas(): Promise<ItemFonteLegislativa[]> {
    const rows = await this.prisma.db.$queryRaw<
      { id: string; titulo: string; data_hora: Date; ata_conteudo: string }[]
    >`
      SELECT id::text, titulo, data_hora, ata_conteudo
      FROM sessoes
      WHERE ata_publicada_em IS NOT NULL
        AND ata_conteudo IS NOT NULL
        AND ata_conteudo <> ''`;

    return rows.map((r) => this.montarAta(r));
  }

  // ================================================================ CARREGADORES (item único)

  private async carregarProposicaoUnica(id: string): Promise<ItemFonteLegislativa | null> {
    const rows = await this.prisma.db.$queryRaw<
      {
        id: string;
        tipo: string;
        numero: number | null;
        ano: number | null;
        ementa: string;
        texto: string | null;
        status_atual: string;
        data_protocolo: Date | null;
        pdf_url: string | null;
        tramitacao: string | null;
        autores: string | null;
      }[]
    >`
      SELECT p.id::text, p.tipo, p.numero, p.ano, p.ementa, p.texto,
             p.status_atual, p.data_protocolo, p.pdf_url,
             (SELECT string_agg(
                concat_ws(' — ', to_char(t.data, 'DD/MM/YYYY'), t.fase, t.despacho),
                ' | ' ORDER BY t.data)
              FROM proposicao_tramitacoes t WHERE t.proposicao_id = p.id) AS tramitacao,
             (SELECT string_agg(coalesce(v.nome_parlamentar, v.nome), ', ' ORDER BY pa.ordem)
              FROM proposicao_autores pa
              JOIN vereadores v ON v.id = pa.vereador_id
              WHERE pa.proposicao_id = p.id AND pa.papel IN ('autor','coautor')) AS autores
      FROM proposicoes p
      WHERE p.id = ${id}::uuid AND p.publicada = true`;
    return rows.length ? this.montarProposicao(rows[0]) : null;
  }

  private async carregarLeiUnica(id: string): Promise<ItemFonteLegislativa | null> {
    const rows = await this.prisma.db.$queryRaw<
      {
        id: string;
        numero: string;
        tipo: string;
        ano: number | null;
        ementa: string;
        texto: string | null;
        data_sancao: Date | null;
        vigente: boolean;
        pdf_url: string | null;
      }[]
    >`
      SELECT id::text, numero, tipo, ano, ementa, texto, data_sancao, vigente, pdf_url
      FROM leis
      WHERE id = ${id}::uuid AND publicada = true`;
    return rows.length ? this.montarLei(rows[0]) : null;
  }

  private async carregarAtaUnica(sessaoId: string): Promise<ItemFonteLegislativa | null> {
    const rows = await this.prisma.db.$queryRaw<
      { id: string; titulo: string; data_hora: Date; ata_conteudo: string }[]
    >`
      SELECT id::text, titulo, data_hora, ata_conteudo
      FROM sessoes
      WHERE id = ${sessaoId}::uuid
        AND ata_publicada_em IS NOT NULL
        AND ata_conteudo IS NOT NULL
        AND ata_conteudo <> ''`;
    return rows.length ? this.montarAta(rows[0]) : null;
  }

  // ================================================================ MONTAGEM DE TEXTO

  private montarLei(r: {
    id: string;
    numero: string;
    tipo: string;
    ano: number | null;
    ementa: string;
    texto: string | null;
    data_sancao: Date | null;
    vigente: boolean;
    pdf_url: string | null;
  }): ItemFonteLegislativa {
    const titulo = rotuloLei(r);
    return {
      fonte: FONTE_LEI,
      refId: r.id,
      titulo,
      url: r.pdf_url ?? `/legislativo/leis/${r.id}`,
      textoCompleto: [
        titulo,
        `Tipo: ${ROTULO_TIPO_LEI[r.tipo] ?? r.tipo}`,
        r.data_sancao ? `Data de sanção: ${formatarData(r.data_sancao)}` : '',
        `Situação: ${r.vigente ? 'vigente' : 'revogada/não vigente'}`,
        `Ementa: ${limparHtml(r.ementa)}`,
        limparHtml(r.texto),
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private montarProposicao(r: {
    id: string;
    tipo: string;
    numero: number | null;
    ano: number | null;
    ementa: string;
    texto: string | null;
    status_atual: string;
    data_protocolo: Date | null;
    pdf_url: string | null;
    tramitacao: string | null;
    autores: string | null;
  }): ItemFonteLegislativa {
    const titulo = rotuloProposicao(r);
    const status = ROTULO_STATUS_PROPOSICAO[r.status_atual] ?? r.status_atual;
    return {
      fonte: FONTE_PROPOSICAO,
      refId: r.id,
      titulo,
      url: r.pdf_url ?? `/legislativo/proposicoes/${r.id}`,
      textoCompleto: [
        titulo,
        `Tipo: ${ROTULO_TIPO_PROPOSICAO[r.tipo] ?? r.tipo}`,
        r.autores ? `Autoria: ${r.autores}` : '',
        r.data_protocolo ? `Protocolada em: ${formatarData(r.data_protocolo)}` : '',
        `Status atual da tramitação: ${status}`,
        `Ementa: ${limparHtml(r.ementa)}`,
        limparHtml(r.texto),
        r.tramitacao ? `Histórico de tramitação: ${limparHtml(r.tramitacao)}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  }

  private montarAta(r: {
    id: string;
    titulo: string;
    data_hora: Date;
    ata_conteudo: string;
  }): ItemFonteLegislativa {
    const titulo = `Ata da sessão: ${r.titulo} (${formatarData(r.data_hora)})`;
    return {
      fonte: FONTE_SESSAO_ATA,
      refId: r.id,
      titulo,
      url: `/sessoes/${r.id}`,
      textoCompleto: [titulo, limparHtml(r.ata_conteudo)].filter(Boolean).join('\n\n'),
    };
  }
}

// ================================================================ UTILITÁRIOS

/** Remove tags HTML e normaliza espaços (conteúdo rico EditorJS/HTML). */
function limparHtml(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Formata uma data como DD/MM/AAAA (pt-BR), tolerante a Date/string. */
function formatarData(d: Date | string | null | undefined): string {
  if (!d) return '';
  const data = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(data.getTime())) return '';
  const dia = String(data.getUTCDate()).padStart(2, '0');
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}
