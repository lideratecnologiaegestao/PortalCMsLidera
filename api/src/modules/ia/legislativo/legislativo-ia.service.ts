import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { TenantContext } from '../../../common/tenant/tenant.context';
import { AnthropicService } from '../anthropic.service';
import { EmbeddingsService } from '../embeddings.service';
import {
  corrigirLinksInternos,
  limparQuebrasResposta,
  tsqueryOr,
} from '../ia.prompts';
import {
  montarContextoLegislativo,
  rotuloFonte,
  sistemaChatLegislativo,
} from './legislativo.prompts';

/** Trecho legislativo recuperado (forma alinhada ao RAG da base). */
interface TrechoLegislativo {
  titulo: string;
  texto: string;
  url?: string;
  fonte?: string;
}

/** Resultado da busca semântica de legislação (público). */
export interface ResultadoBuscaLegislativa {
  titulo: string;
  url?: string;
  fonte: string;
  fonteRotulo: string;
  trecho: string;
}

/** Limiar de distância coseno (mesmo do RAG base — consistência). */
const LIMIAR_DISTANCIA = 0.6;

/**
 * IA LEGISLATIVA (Fase 5) — busca semântica e chat sobre a legislação do tenant.
 *
 * Reaproveita TODA a infraestrutura da camada de IA existente:
 *   - EmbeddingsService (mesmo provedor/modelo do tenant) p/ embeddar a pergunta;
 *   - ia_chunks (corpus vetorial) filtrado pelas fontes legislativas
 *     ('proposicao', 'lei', 'sessao_ata') que o LegislativoIndexadorService grava;
 *   - busca HÍBRIDA: vetorial (pgvector) + FTS lexical direto nas tabelas
 *     proposicoes/leis/sessoes — assim funciona mesmo sem embeddings (degrada p/ FTS);
 *   - AnthropicService (modelo configurado: opus/sonnet/haiku) para redigir a resposta.
 *
 * Tudo roda no TenantContext (RLS): a recuperação só enxerga legislação do
 * próprio tenant — sem vazamento entre câmaras. Respeita a flag iaChatHabilitada.
 * LGPD: conteúdo normativo público; a pergunta é limitada (anti-abuso de tokens/PII).
 */
@Injectable()
export class LegislativoIaService {
  private readonly log = new Logger(LegislativoIaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly anthropic: AnthropicService,
    private readonly embeddings: EmbeddingsService,
  ) {}

  // ================================================================ FLAG

  /** Flag de chat de IA do tenant (default false — ativação deliberada/DPIA). */
  private async chatHabilitado(): Promise<boolean> {
    const tid = TenantContext.tenantId();
    if (!tid) return false;
    const t = await this.prisma
      .platform()
      .tenant.findUnique({ where: { id: tid }, select: { iaChatHabilitada: true } });
    return t?.iaChatHabilitada ?? false;
  }

  /** Nome da câmara (tenant) para personalizar o system prompt. */
  private async nomeCamara(): Promise<string | undefined> {
    const tid = TenantContext.tenantId();
    if (!tid) return undefined;
    try {
      const t = await this.prisma
        .platform()
        .tenant.findUnique({ where: { id: tid }, select: { nome: true } });
      return t?.nome ? `Câmara Municipal de ${t.nome}` : undefined;
    } catch {
      return undefined;
    }
  }

  // ================================================================ BUSCA SEMÂNTICA (pública)

  /**
   * Busca semântica na legislação/proposições/atas do tenant, com citações.
   * Não invoca o modelo — apenas recupera e devolve os trechos (barato/rápido).
   */
  async busca(perguntaRaw: string): Promise<{
    pergunta: string;
    resultados: ResultadoBuscaLegislativa[];
  }> {
    const pergunta = (perguntaRaw ?? '').slice(0, 500); // anti-abuso de tokens/PII
    const trechos = await this.recuperar(pergunta);
    return {
      pergunta,
      resultados: trechos.map((t) => ({
        titulo: t.titulo,
        url: t.url,
        fonte: t.fonte ?? '',
        fonteRotulo: t.fonte ? rotuloFonte(t.fonte) : '',
        trecho: t.texto.slice(0, 300),
      })),
    };
  }

  // ================================================================ CHAT (público)

  /**
   * Chat do assistente legislativo: responde com base na legislação recuperada,
   * cita número/ano da norma e explica tramitação. Respeita iaChatHabilitada.
   */
  async chat(perguntaRaw: string): Promise<{
    resposta: string;
    fontes: { titulo: string; url?: string; fonte: string }[];
    confianca: number;
  }> {
    if (!(await this.chatHabilitado())) {
      throw new ForbiddenException('Assistente legislativo de IA não habilitado nesta câmara.');
    }
    const pergunta = (perguntaRaw ?? '').slice(0, 500);

    const [trechos, nome] = await Promise.all([this.recuperar(pergunta), this.nomeCamara()]);
    const confianca = trechos.length > 0 ? 0.8 : 0.2;

    const contexto =
      trechos.length > 0
        ? `LEGISLAÇÃO E PROPOSIÇÕES DA BASE OFICIAL (cite pelo número entre colchetes):\n${montarContextoLegislativo(
            trechos,
          )}\n\n`
        : 'LEGISLAÇÃO E PROPOSIÇÕES DA BASE OFICIAL: (nenhum item correspondente encontrado)\n\n';

    const user = `${contexto}PERGUNTA: ${pergunta}`;
    const resposta = await this.anthropic.completar({
      system: sistemaChatLegislativo(nome),
      user,
      maxTokens: 800,
      cacheSystem: true,
    });

    await this.auditar('IA_LEGISLATIVO_CHAT', 'leis', null, { fontes: trechos.length });

    return {
      resposta: corrigirLinksInternos(limparQuebrasResposta(resposta)),
      fontes: trechos.map((t) => ({ titulo: t.titulo, url: t.url, fonte: t.fonte ?? '' })),
      confianca,
    };
  }

  // ================================================================ RECUPERAÇÃO (RAG)

  /**
   * Recuperação híbrida sobre o domínio legislativo do tenant (RLS isola):
   *   - vetorial: ia_chunks filtrado pelas fontes legislativas (se embeddings on);
   *   - lexical (FTS): direto em leis, proposicoes e atas de sessão.
   * Mescla (lexical primeiro, semântico em seguida), dedup por url+título, top 8.
   */
  private async recuperar(perguntaRaw: string): Promise<TrechoLegislativo[]> {
    const q = perguntaRaw.trim().slice(0, 200);

    const vecP: Promise<number[] | null> = this.embeddings.configurado
      ? this.embeddings
          .embed([q])
          .then((v) => v?.[0] ?? null)
          .catch(() => null)
      : Promise.resolve(null);

    const [vetorial, fts] = await Promise.all([
      this.recuperarVetorial(vecP),
      this.recuperarFts(q),
    ]);

    return this.mesclar(fts, vetorial, 8);
  }

  /**
   * Busca vetorial em ia_chunks restrita às fontes legislativas. Limiar coseno
   * (< 0.6) descarta ruído. Literal vetorial é só números (sem injeção). RLS
   * isola via TenantContext. Degrada p/ [] sem chave/corpus.
   */
  private async recuperarVetorial(vecP: Promise<number[] | null>): Promise<TrechoLegislativo[]> {
    try {
      const vec = await vecP;
      if (!vec) return [];
      const vlit = `[${vec.join(',')}]`;
      return await this.prisma.db.$queryRawUnsafe<TrechoLegislativo[]>(
        `SELECT titulo, url, left(trecho, 600) AS texto, fonte
         FROM ia_chunks
         WHERE fonte IN ('proposicao', 'lei', 'sessao_ata')
           AND (embedding <=> '${vlit}'::vector) < ${LIMIAR_DISTANCIA}
         ORDER BY embedding <=> '${vlit}'::vector
         LIMIT 6`,
      );
    } catch {
      return [];
    }
  }

  /** FTS lexical em paralelo: leis + proposições + atas. Cada fonte degrada sozinha. */
  private async recuperarFts(q: string): Promise<TrechoLegislativo[]> {
    const expr = tsqueryOr(q);
    if (!expr) return [];
    const [leis, proposicoes, atas] = await Promise.all([
      this.ftsLeis(expr),
      this.ftsProposicoes(expr),
      this.ftsAtas(expr),
    ]);
    return [...leis, ...proposicoes, ...atas];
  }

  private async ftsLeis(expr: string): Promise<TrechoLegislativo[]> {
    try {
      return await this.prisma.db.$queryRaw<TrechoLegislativo[]>`
        SELECT
          coalesce(
            initcap(replace(tipo,'_',' ')) || ' nº ' || numero ||
            coalesce('/' || ano::text, ''),
            'Norma'
          ) AS titulo,
          left(coalesce(ementa,'') || ' ' || coalesce(texto,''), 600) AS texto,
          coalesce(pdf_url, '/legislativo/leis/' || id::text) AS url,
          'lei' AS fonte
        FROM leis
        WHERE publicada = true
          AND to_tsvector('portuguese',
                numero || ' ' || coalesce(ementa,'') || ' ' || coalesce(texto,'')
              ) @@ to_tsquery('portuguese', ${expr})
        ORDER BY ts_rank(
          to_tsvector('portuguese',
            numero || ' ' || coalesce(ementa,'') || ' ' || coalesce(texto,'')
          ),
          to_tsquery('portuguese', ${expr})
        ) DESC
        LIMIT 3`;
    } catch {
      return [];
    }
  }

  private async ftsProposicoes(expr: string): Promise<TrechoLegislativo[]> {
    try {
      return await this.prisma.db.$queryRaw<TrechoLegislativo[]>`
        SELECT
          initcap(replace(tipo,'_',' ')) ||
            coalesce(' nº ' || numero::text || '/' || ano::text, '') AS titulo,
          left(
            coalesce(ementa,'') || ' ' || coalesce(texto,'') ||
            ' (status: ' || status_atual || ')',
            600
          ) AS texto,
          coalesce(pdf_url, '/legislativo/proposicoes/' || id::text) AS url,
          'proposicao' AS fonte
        FROM proposicoes
        WHERE publicada = true
          AND to_tsvector('portuguese',
                coalesce(ementa,'') || ' ' || coalesce(texto,'')
              ) @@ to_tsquery('portuguese', ${expr})
        ORDER BY ts_rank(
          to_tsvector('portuguese',
            coalesce(ementa,'') || ' ' || coalesce(texto,'')
          ),
          to_tsquery('portuguese', ${expr})
        ) DESC
        LIMIT 3`;
    } catch {
      return [];
    }
  }

  private async ftsAtas(expr: string): Promise<TrechoLegislativo[]> {
    try {
      const rows = await this.prisma.db.$queryRaw<TrechoLegislativo[]>`
        SELECT
          'Ata da sessão: ' || titulo AS titulo,
          ts_headline('portuguese',
            ata_conteudo,
            to_tsquery('portuguese', ${expr}),
            'MaxFragments=3, MaxWords=55, MinWords=18, FragmentDelimiter= … ') AS texto,
          '/sessoes/' || id::text AS url,
          'sessao_ata' AS fonte
        FROM sessoes
        WHERE ata_publicada_em IS NOT NULL
          AND ata_conteudo IS NOT NULL
          AND ata_conteudo <> ''
          AND to_tsvector('portuguese', titulo || ' ' || ata_conteudo)
              @@ to_tsquery('portuguese', ${expr})
        ORDER BY ts_rank(
          to_tsvector('portuguese', titulo || ' ' || ata_conteudo),
          to_tsquery('portuguese', ${expr})
        ) DESC
        LIMIT 2`;
      return rows.map((r) => ({ ...r, texto: (r.texto ?? '').replace(/<\/?b>/g, '') }));
    } catch {
      return [];
    }
  }

  /**
   * Mescla lexical (prioridade) + semântico no padrão 2:1, dedup por url+título,
   * limita ao top N. Igual ao mesclarTrechos do RAG base.
   */
  private mesclar(
    lexical: TrechoLegislativo[],
    semantico: TrechoLegislativo[],
    limite: number,
  ): TrechoLegislativo[] {
    const out: TrechoLegislativo[] = [];
    const vistos = new Set<string>();
    const chave = (t: TrechoLegislativo) => `${t.url ?? ''}|${t.titulo ?? ''}`;
    const push = (t: TrechoLegislativo) => {
      const k = chave(t);
      if (vistos.has(k) || out.length >= limite) return;
      vistos.add(k);
      out.push(t);
    };
    let i = 0;
    let j = 0;
    while ((i < lexical.length || j < semantico.length) && out.length < limite) {
      if (i < lexical.length) push(lexical[i++]);
      if (i < lexical.length) push(lexical[i++]);
      if (j < semantico.length) push(semantico[j++]);
    }
    return out;
  }

  // ================================================================ AUDITORIA

  private async auditar(
    acao: string,
    entidade: string,
    entidadeId: string | null,
    dados: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        tenantId: TenantContext.tenantId() ?? null,
        atorId: TenantContext.get().userId ?? null,
        acao,
        entidade,
        entidadeId,
        dados: dados as object,
      },
    });
  }
}
