import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  AberturaRetificacaoDto,
  AnexoEditalDto,
  AtualizarEditalDto,
  AtualizarInscricaoDto,
  ComissaoMembroDto,
  CriarEditalDto,
  CriterioDto,
  FaseDto,
  InscreverDto,
  LancarNotaDto,
  TabelaSalarialDto,
  VagaDto,
} from './pss.dto';

/** Slug URL-safe (minúsculo, sem acento, hífens). Mesmo padrão de parlamentar. */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return d;
}

/** Status do edital que liberam visibilidade pública. */
const STATUS_PUBLICO = [
  'publicado',
  'inscricoes_abertas',
  'inscricoes_encerradas',
  'em_avaliacao',
  'homologado',
];

@Injectable()
export class PssService {
  private readonly logger = new Logger(PssService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================== Editais (público)
  listarPublicos() {
    return this.prisma.db.pssEdital.findMany({
      where: { ativo: true, status: { in: STATUS_PUBLICO } },
      orderBy: [{ ordem: 'asc' }, { criadoEm: 'desc' }],
      select: {
        id: true, numero: true, titulo: true, slug: true, status: true,
        inscricaoInicio: true, inscricaoFim: true, rankingPublicado: true,
        rankingPublicadoEm: true, criadoEm: true,
      },
    });
  }

  /** Detalhe público do edital: dados + vagas + fases (com critérios) + anexos. */
  async detalhePublico(idOrSlug: string) {
    const e = await this.prisma.db.pssEdital.findFirst({
      where: {
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
        ativo: true,
        status: { in: STATUS_PUBLICO },
      },
      include: {
        vagas: { orderBy: { ordem: 'asc' } },
        fases: {
          orderBy: { ordem: 'asc' },
          include: { criterios: { orderBy: { ordem: 'asc' } } },
        },
        anexos: {
          where: { inscricaoId: null },
          orderBy: { ordem: 'asc' },
        },
        aberturas: { orderBy: { versao: 'asc' } },
      },
    });
    if (!e) throw new NotFoundException('Edital não encontrado.');
    return e;
  }

  /**
   * Ranking público — somente quando publicado. Ordena pelo desempate
   * determinístico aplicado na publicação (classificacao já persistida).
   */
  async rankingPublico(idOrSlug: string) {
    const e = await this.resolverEdital(idOrSlug, true);
    if (!e.rankingPublicado) {
      throw new NotFoundException('Ranking ainda não publicado.');
    }
    const inscricoes = await this.prisma.db.pssInscricao.findMany({
      where: { editalId: e.id, status: 'deferida', classificacao: { not: null } },
      orderBy: { classificacao: 'asc' },
      select: {
        id: true, protocolo: true, nome: true, notaFinal: true,
        classificacao: true, vagaId: true,
      },
    });
    return {
      edital: { id: e.id, numero: e.numero, titulo: e.titulo, slug: e.slug },
      publicadoEm: e.rankingPublicadoEm,
      classificados: inscricoes,
    };
  }

  // ===================================================== Editais (admin)
  async listarAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.pssEdital.findMany({
        orderBy: [{ ordem: 'asc' }, { criadoEm: 'desc' }],
        skip: (opts.page - 1) * opts.pageSize,
        take: opts.pageSize,
      }),
      this.prisma.db.pssEdital.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async buscarEdital(id: string) {
    const e = await this.prisma.db.pssEdital.findUnique({
      where: { id },
      include: {
        vagas: { orderBy: { ordem: 'asc' } },
        fases: { orderBy: { ordem: 'asc' }, include: { criterios: { orderBy: { ordem: 'asc' } } } },
        anexos: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!e) throw new NotFoundException('Edital não encontrado.');
    return e;
  }

  async criarEdital(dto: CriarEditalDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const slug = await this.slugUnico(dto.slug ? slugify(dto.slug) : slugify(`${dto.numero}-${dto.titulo}`), tenantId);
    const e = await this.prisma.db.pssEdital.create({
      data: {
        tenantId, numero: dto.numero, titulo: dto.titulo, slug, objeto: dto.objeto,
        status: dto.status || 'rascunho',
        inscricaoInicio: dateOrNull(dto.inscricaoInicio),
        inscricaoFim: dateOrNull(dto.inscricaoFim),
        ordem: dto.ordem ?? 0, ativo: dto.ativo ?? true,
      },
    });
    await this.audit(tenantId, atorId, 'PSS_EDITAL_CRIADO', 'pss_editais', e.id, { numero: e.numero, slug });
    return e;
  }

  async atualizarEdital(id: string, dto: AtualizarEditalDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const anterior = await this.buscarEdital(id);
    const data: Record<string, unknown> = {};
    for (const c of ['numero', 'titulo', 'objeto', 'status', 'ordem', 'ativo'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.inscricaoInicio !== undefined) data.inscricaoInicio = dateOrNull(dto.inscricaoInicio);
    if (dto.inscricaoFim !== undefined) data.inscricaoFim = dateOrNull(dto.inscricaoFim);
    if (dto.slug) {
      const cand = slugify(dto.slug);
      if (cand !== (anterior.slug ?? '')) data.slug = await this.slugUnico(cand, tenantId, id);
    }
    data.atualizadoEm = new Date();
    const e = await this.prisma.db.pssEdital.update({ where: { id }, data: data as any });
    await this.audit(tenantId, atorId, 'PSS_EDITAL_ATUALIZADO', 'pss_editais', id, { campos: Object.keys(data) });
    return e;
  }

  async excluirEdital(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const e = await this.buscarEdital(id);
    await this.prisma.db.pssEdital.delete({ where: { id } });
    await this.audit(tenantId, atorId, 'PSS_EDITAL_EXCLUIDO', 'pss_editais', id, { numero: e.numero });
    return { excluido: true };
  }

  // ====================================================== Vagas (admin)
  async addVaga(editalId: string, dto: VagaDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssVaga.create({
      data: {
        tenantId, editalId, cargo: dto.cargo, escolaridade: dto.escolaridade,
        quantidade: dto.quantidade ?? 1, vagasCadastro: dto.vagasCadastro ?? 0,
        requisitos: dto.requisitos, cargaHoraria: dto.cargaHoraria,
        salario: dto.salario != null ? dto.salario : null, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirVaga(id: string) {
    return this.prisma.db.pssVaga.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ====================================================== Fases (admin)
  async addFase(editalId: string, dto: FaseDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssFase.create({
      data: {
        tenantId, editalId, nome: dto.nome, tipo: dto.tipo || 'titulos',
        peso: dto.peso ?? 1, eliminatoria: dto.eliminatoria ?? false,
        notaCorte: dto.notaCorte != null ? dto.notaCorte : null, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirFase(id: string) {
    return this.prisma.db.pssFase.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ==================================================== Critérios (admin)
  async addCriterio(faseId: string, dto: CriterioDto) {
    const tenantId = TenantContext.tenantId()!;
    const fase = await this.prisma.db.pssFase.findUnique({ where: { id: faseId }, select: { id: true } });
    if (!fase) throw new NotFoundException('Fase não encontrada.');
    return this.prisma.db.pssCriterio.create({
      data: {
        tenantId, faseId, descricao: dto.descricao, pontos: dto.pontos ?? 0,
        pontosMaximo: dto.pontosMaximo != null ? dto.pontosMaximo : null, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirCriterio(id: string) {
    return this.prisma.db.pssCriterio.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ====================================================== Anexos (admin)
  async addAnexoEdital(editalId: string, dto: AnexoEditalDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssAnexo.create({
      data: {
        tenantId, editalId, titulo: dto.titulo, tipo: dto.tipo || 'anexo',
        url: dto.url, storageKey: dto.storageKey, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirAnexo(id: string) {
    return this.prisma.db.pssAnexo.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ============================================= Inscrição (cidadão auth)
  /** Inscrição do cidadão autenticado. Valida janela e status do edital. */
  async inscrever(editalId: string, dto: InscreverDto, userId?: string) {
    if (!userId) throw new ForbiddenException('É necessário estar autenticado para se inscrever.');
    const tenantId = TenantContext.tenantId()!;
    const edital = await this.prisma.db.pssEdital.findFirst({
      where: { OR: [{ slug: editalId }, { id: editalId }], ativo: true },
    });
    if (!edital) throw new NotFoundException('Edital não encontrado.');
    if (edital.status !== 'inscricoes_abertas') {
      throw new BadRequestException('As inscrições deste edital não estão abertas.');
    }
    const agora = new Date();
    if (edital.inscricaoInicio && agora < edital.inscricaoInicio) {
      throw new BadRequestException('O período de inscrições ainda não começou.');
    }
    if (edital.inscricaoFim && agora > edital.inscricaoFim) {
      throw new BadRequestException('O período de inscrições foi encerrado.');
    }

    // Uma inscrição por cidadão por edital
    const existente = await this.prisma.db.pssInscricao.findFirst({
      where: { editalId: edital.id, userId },
      select: { id: true },
    });
    if (existente) throw new BadRequestException('Você já possui inscrição neste edital.');

    if (dto.vagaId) {
      const vaga = await this.prisma.db.pssVaga.findFirst({
        where: { id: dto.vagaId, editalId: edital.id }, select: { id: true },
      });
      if (!vaga) throw new BadRequestException('Vaga inválida para este edital.');
    }

    const protocolo = await this.gerarProtocolo(edital.numero);

    const inscricao = await this.prisma.db.pssInscricao.create({
      data: {
        tenantId, editalId: edital.id, vagaId: dto.vagaId || null, userId,
        protocolo, nome: dto.nome, cpf: dto.cpf, email: dto.email, telefone: dto.telefone,
        dados: (dto.dados as any) ?? {}, status: 'recebida',
        criterios: dto.criterios?.length
          ? {
              create: dto.criterios.map((c) => ({
                tenantId, criterioId: c.criterioId, quantidade: c.quantidade ?? 1, observacao: c.observacao,
              })),
            }
          : undefined,
        anexos: dto.anexos?.length
          ? {
              create: dto.anexos.map((a, i) => ({
                tenantId, titulo: a.titulo, tipo: 'documento_candidato',
                url: a.url, storageKey: a.storageKey, ordem: i,
              })),
            }
          : undefined,
      },
      include: { criterios: true, anexos: true },
    });

    await this.audit(tenantId, userId, 'PSS_INSCRICAO_CRIADA', 'pss_inscricoes', inscricao.id, {
      editalId: edital.id, protocolo,
    });
    return inscricao;
  }

  /** Inscrições do cidadão autenticado (todos os editais). */
  async minhasInscricoes(userId?: string) {
    if (!userId) throw new ForbiddenException('Autenticação necessária.');
    return this.prisma.db.pssInscricao.findMany({
      where: { userId },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true, protocolo: true, nome: true, status: true, motivo: true,
        notaFinal: true, classificacao: true, criadoEm: true,
        edital: { select: { id: true, numero: true, titulo: true, slug: true, status: true, rankingPublicado: true } },
      },
    });
  }

  // =========================================== Inscrições (admin/comissão)
  async listarInscricoes(editalId: string, status?: string) {
    await this.resolverEdital(editalId);
    return this.prisma.db.pssInscricao.findMany({
      where: { editalId, ...(status ? { status } : {}) },
      orderBy: { criadoEm: 'asc' },
      include: {
        criterios: { include: { criterio: { select: { id: true, descricao: true, pontos: true, pontosMaximo: true, faseId: true } } } },
        notas: true,
        anexos: { orderBy: { ordem: 'asc' } },
      },
    });
  }

  async atualizarInscricao(id: string, dto: AtualizarInscricaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const insc = await this.prisma.db.pssInscricao.findUnique({ where: { id }, select: { id: true, editalId: true } });
    if (!insc) throw new NotFoundException('Inscrição não encontrada.');
    const i = await this.prisma.db.pssInscricao.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.motivo !== undefined ? { motivo: dto.motivo } : {}),
        atualizadoEm: new Date(),
      },
    });
    await this.audit(tenantId, atorId, 'PSS_INSCRICAO_ATUALIZADA', 'pss_inscricoes', id, { status: dto.status });
    return i;
  }

  // ============================================ Notas (admin/comissão)
  /** Lançamento (upsert) de nota por fase para uma inscrição. */
  async lancarNota(dto: LancarNotaDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const insc = await this.prisma.db.pssInscricao.findUnique({
      where: { id: dto.inscricaoId }, select: { id: true, editalId: true },
    });
    if (!insc) throw new NotFoundException('Inscrição não encontrada.');
    const fase = await this.prisma.db.pssFase.findUnique({
      where: { id: dto.faseId }, select: { id: true, editalId: true },
    });
    if (!fase || fase.editalId !== insc.editalId) {
      throw new BadRequestException('Fase inválida para a inscrição informada.');
    }

    const existente = await this.prisma.db.pssNota.findFirst({
      where: { inscricaoId: dto.inscricaoId, faseId: dto.faseId }, select: { id: true },
    });
    const nota = existente
      ? await this.prisma.db.pssNota.update({
          where: { id: existente.id },
          data: { nota: dto.nota, observacao: dto.observacao, lancadoPor: atorId || null, atualizadoEm: new Date() },
        })
      : await this.prisma.db.pssNota.create({
          data: {
            tenantId, inscricaoId: dto.inscricaoId, faseId: dto.faseId,
            nota: dto.nota, observacao: dto.observacao, lancadoPor: atorId || null,
          },
        });

    await this.audit(tenantId, atorId, 'PSS_NOTA_LANCADA', 'pss_notas', nota.id, {
      inscricaoId: dto.inscricaoId, faseId: dto.faseId, nota: dto.nota,
    });
    return nota;
  }

  // ======================================== Ranking / publicação (admin)
  /**
   * Calcula nota final ponderada por fase e a classificação com desempate
   * DETERMINÍSTICO. Persiste notaFinal/classificacao nas inscrições deferidas.
   *
   * Nota final = Σ (nota_fase × peso_fase). Fases eliminatórias com nota
   * abaixo da nota_corte deferem a inscrição como NÃO classificada (excluída
   * do ranking, mas mantida na lista para auditoria).
   *
   * Desempate (ordem decrescente de relevância):
   *  1) maior nota final;
   *  2) maior nota na fase de maior peso (e seguintes);
   *  3) inscrição mais antiga (criadoEm asc);
   *  4) protocolo (asc) — chave final estável.
   */
  async calcularRanking(editalId: string, persistir: boolean, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const edital = await this.resolverEdital(editalId);

    const fases = await this.prisma.db.pssFase.findMany({
      where: { editalId: edital.id },
      orderBy: [{ peso: 'desc' }, { ordem: 'asc' }],
      select: { id: true, nome: true, peso: true, eliminatoria: true, notaCorte: true },
    });

    const inscricoes = await this.prisma.db.pssInscricao.findMany({
      where: { editalId: edital.id, status: 'deferida' },
      include: { notas: true },
    });

    const calculadas = inscricoes.map((insc) => {
      const notaPorFase = new Map<string, number>();
      for (const n of insc.notas) notaPorFase.set(n.faseId, Number(n.nota));

      let notaFinal = 0;
      let eliminado = false;
      for (const f of fases) {
        const nf = notaPorFase.get(f.id) ?? 0;
        if (f.eliminatoria && f.notaCorte != null && nf < Number(f.notaCorte)) {
          eliminado = true;
        }
        notaFinal += nf * Number(f.peso);
      }
      // vetor de notas na ordem das fases (peso desc) para desempate
      const vetorDesempate = fases.map((f) => notaPorFase.get(f.id) ?? 0);
      return {
        id: insc.id, protocolo: insc.protocolo, nome: insc.nome,
        criadoEm: insc.criadoEm, notaFinal: Number(notaFinal.toFixed(4)),
        vetorDesempate, eliminado,
      };
    });

    const classificaveis = calculadas
      .filter((c) => !c.eliminado)
      .sort((a, b) => {
        // 1) nota final desc
        if (b.notaFinal !== a.notaFinal) return b.notaFinal - a.notaFinal;
        // 2) notas por fase (peso desc) desc
        for (let i = 0; i < a.vetorDesempate.length; i++) {
          if (b.vetorDesempate[i] !== a.vetorDesempate[i]) return b.vetorDesempate[i] - a.vetorDesempate[i];
        }
        // 3) inscrição mais antiga
        const ta = a.criadoEm.getTime();
        const tb = b.criadoEm.getTime();
        if (ta !== tb) return ta - tb;
        // 4) protocolo asc — chave final estável e determinística
        return a.protocolo.localeCompare(b.protocolo);
      })
      .map((c, idx) => ({ ...c, classificacao: idx + 1 }));

    if (persistir) {
      // Atômico com RLS: limpa o ranking anterior e regrava classificação.
      await this.prisma.tx(async (tx) => {
        await tx.pssInscricao.updateMany({
          where: { editalId: edital.id, status: 'deferida' },
          data: { classificacao: null },
        });
        for (const c of classificaveis) {
          await tx.pssInscricao.update({
            where: { id: c.id },
            data: { notaFinal: c.notaFinal, classificacao: c.classificacao, atualizadoEm: new Date() },
          });
        }
      });
      await this.audit(tenantId, atorId, 'PSS_RANKING_CALCULADO', 'pss_editais', edital.id, {
        total: classificaveis.length,
      });
    }

    return {
      edital: { id: edital.id, numero: edital.numero, titulo: edital.titulo },
      classificados: classificaveis.map((c) => ({
        inscricaoId: c.id, protocolo: c.protocolo, nome: c.nome,
        notaFinal: c.notaFinal, classificacao: c.classificacao,
      })),
      eliminados: calculadas.filter((c) => c.eliminado).map((c) => ({
        inscricaoId: c.id, protocolo: c.protocolo, nome: c.nome,
      })),
    };
  }

  /** Publica o ranking: recalcula, persiste e torna público (imutável). */
  async publicarRanking(editalId: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const edital = await this.resolverEdital(editalId);
    await this.calcularRanking(edital.id, true, atorId);
    const e = await this.prisma.db.pssEdital.update({
      where: { id: edital.id },
      data: { rankingPublicado: true, rankingPublicadoEm: new Date(), status: 'homologado', atualizadoEm: new Date() },
    });
    await this.audit(tenantId, atorId, 'PSS_RANKING_PUBLICADO', 'pss_editais', edital.id, {});
    return e;
  }

  // ============================================ APLIC (admin/comissão)
  async addAbertura(editalId: string, dto: AberturaRetificacaoDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssAplicAberturaRetificacao.create({
      data: {
        tenantId, editalId, tipo: dto.tipo || 'abertura', versao: dto.versao ?? 1,
        dataAto: dateOrNull(dto.dataAto), descricao: dto.descricao, url: dto.url, storageKey: dto.storageKey,
      },
    });
  }
  excluirAbertura(id: string) {
    return this.prisma.db.pssAplicAberturaRetificacao.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  async addComissaoMembro(editalId: string, dto: ComissaoMembroDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssAplicComissaoMembro.create({
      data: {
        tenantId, editalId, userId: dto.userId || null, nome: dto.nome, cpf: dto.cpf,
        cargo: dto.cargo || 'membro', ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirComissaoMembro(id: string) {
    return this.prisma.db.pssAplicComissaoMembro.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  async addTabelaSalarial(editalId: string, dto: TabelaSalarialDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.resolverEdital(editalId);
    return this.prisma.db.pssAplicTabelaSalarial.create({
      data: {
        tenantId, editalId, vagaId: dto.vagaId || null, codigo: dto.codigo, cargo: dto.cargo,
        nivel: dto.nivel, classe: dto.classe, salarioBase: dto.salarioBase ?? 0,
        cargaHoraria: dto.cargaHoraria, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirTabelaSalarial(id: string) {
    return this.prisma.db.pssAplicTabelaSalarial.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  /** Pacote de exportação APLIC (leiaute TCE-MT) — dados agregados do certame. */
  async exportarAplic(editalId: string) {
    const edital = await this.prisma.db.pssEdital.findFirst({
      where: { OR: [{ slug: editalId }, { id: editalId }] },
      include: {
        vagas: { orderBy: { ordem: 'asc' } },
        aberturas: { orderBy: { versao: 'asc' } },
        comissaoMembros: { orderBy: { ordem: 'asc' } },
        situacoes: { orderBy: { dataSituacao: 'desc' } },
        tabelaSalarial: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!edital) throw new NotFoundException('Edital não encontrado.');
    return {
      leiaute: 'aplic-tce-mt',
      gerado_em: new Date().toISOString(),
      edital: {
        numero: edital.numero, titulo: edital.titulo, status: edital.status,
        inscricao_inicio: edital.inscricaoInicio, inscricao_fim: edital.inscricaoFim,
      },
      vagas: edital.vagas,
      aberturas_retificacoes: edital.aberturas,
      comissao: edital.comissaoMembros,
      situacoes: edital.situacoes,
      tabela_salarial: edital.tabelaSalarial,
    };
  }

  // =========================================================== helpers
  private async resolverEdital(idOrSlug: string, publico = false) {
    const e = await this.prisma.db.pssEdital.findFirst({
      where: {
        OR: [{ slug: idOrSlug }, { id: idOrSlug }],
        ...(publico ? { ativo: true, status: { in: STATUS_PUBLICO } } : {}),
      },
    });
    if (!e) throw new NotFoundException('Edital não encontrado.');
    return e;
  }

  /** Protocolo único e estável: PSS-<numero-sanitizado>-<seq6>. */
  private async gerarProtocolo(numeroEdital: string): Promise<string> {
    const base = `PSS-${slugify(numeroEdital).replace(/-/g, '').toUpperCase().slice(0, 12)}`;
    const { randomBytes } = await import('node:crypto');
    return `${base}-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private async audit(
    tenantId: string,
    atorId: string | undefined,
    acao: string,
    entidade: string,
    entidadeId: string,
    dados: any,
  ) {
    await this.prisma.db.auditLog.create({
      data: { tenantId, atorId: atorId ?? null, acao, entidade, entidadeId, dados },
    });
  }

  private async slugUnico(base: string, tenantId: string, excludeId?: string): Promise<string> {
    const db = this.prisma.platform();
    const existe = await db.pssEdital.findFirst({
      where: { tenantId, slug: base, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existe) return base;
    const { randomBytes } = await import('node:crypto');
    return `${base}-${randomBytes(2).toString('hex')}`;
  }
}
