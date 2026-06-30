import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  AtualizarLeiDto,
  AtualizarProposicaoDto,
  CriarLeiDto,
  CriarProposicaoDto,
  EmendaDto,
  RegistrarVotacaoDto,
  TramitarDto,
} from './legislativo.dto';

function dateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return d;
}

/** Status válidos da proposição (espelha o CHECK da migration 105). */
const STATUS_PROPOSICAO = [
  'protocolada', 'em_comissao', 'pauta', 'aprovada', 'rejeitada',
  'arquivada', 'sancionada', 'promulgada', 'vetada',
];

@Injectable()
export class LegislativoService {
  private readonly logger = new Logger(LegislativoService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================== Proposições (público)
  listarProposicoes(filtros: { tipo?: string; ano?: string; autor?: string; status?: string } = {}) {
    const ano = filtros.ano ? Number(filtros.ano) : undefined;
    return this.prisma.db.proposicao.findMany({
      where: {
        publicada: true,
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(ano && !Number.isNaN(ano) ? { ano } : {}),
        ...(filtros.autor ? { autorPrincipalId: filtros.autor } : {}),
        ...(filtros.status ? { statusAtual: filtros.status } : {}),
      },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }, { criadoEm: 'desc' }],
      select: {
        id: true, tipo: true, numero: true, ano: true, protocolo: true,
        ementa: true, statusAtual: true, autorPrincipalId: true, dataProtocolo: true,
      },
    });
  }

  /** Detalhe público: proposição + autores + tramitação + votações + emendas. */
  async buscarProposicao(id: string) {
    const p = await this.prisma.db.proposicao.findFirst({
      where: { id, publicada: true },
      include: {
        autores: {
          orderBy: { ordem: 'asc' },
          include: { vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true } } },
        },
        tramitacoes: { orderBy: { data: 'desc' } },
        votacoes: {
          orderBy: { data: 'desc' },
          include: {
            votos: {
              include: { vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true } } },
            },
          },
        },
        emendas: { orderBy: { numero: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    return p;
  }

  /** Votação nominal pública (todas as votações da proposição). */
  async votacaoProposicao(id: string) {
    const p = await this.prisma.db.proposicao.findFirst({ where: { id, publicada: true }, select: { id: true } });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    return this.prisma.db.proposicaoVotacao.findMany({
      where: { proposicaoId: id },
      orderBy: { data: 'desc' },
      include: {
        votos: {
          include: { vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true } } },
        },
      },
    });
  }

  // ============================================================ Leis (público)
  listarLeis(filtros: { tipo?: string; ano?: string; vigente?: string } = {}) {
    const ano = filtros.ano ? Number(filtros.ano) : undefined;
    return this.prisma.db.lei.findMany({
      where: {
        publicada: true,
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
        ...(ano && !Number.isNaN(ano) ? { ano } : {}),
        ...(filtros.vigente !== undefined ? { vigente: filtros.vigente !== 'false' } : {}),
      },
      orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
      select: {
        id: true, numero: true, tipo: true, ano: true, ementa: true,
        dataSancao: true, vigente: true, pdfUrl: true,
      },
    });
  }

  async buscarLei(id: string) {
    const l = await this.prisma.db.lei.findFirst({ where: { id, publicada: true } });
    if (!l) throw new NotFoundException('Lei não encontrada.');
    return l;
  }

  // ====================================================== Proposições (admin)
  async listarProposicoesAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.proposicao.findMany({
        orderBy: [{ ano: 'desc' }, { numero: 'desc' }, { criadoEm: 'desc' }],
        skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize,
      }),
      this.prisma.db.proposicao.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async buscarProposicaoAdmin(id: string) {
    const p = await this.prisma.db.proposicao.findUnique({
      where: { id },
      include: {
        autores: { orderBy: { ordem: 'asc' } },
        tramitacoes: { orderBy: { data: 'desc' } },
        votacoes: { orderBy: { data: 'desc' }, include: { votos: true } },
        emendas: { orderBy: { numero: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    return p;
  }

  async criarProposicao(dto: CriarProposicaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const status = dto.statusAtual || 'protocolada';
    if (!STATUS_PROPOSICAO.includes(status)) throw new BadRequestException('Status inválido.');
    const p = await this.prisma.db.proposicao.create({
      data: {
        tenantId, tipo: dto.tipo, numero: dto.numero ?? null, ano: dto.ano ?? null,
        protocolo: dto.protocolo, ementa: dto.ementa, texto: dto.texto,
        pdfUrl: dto.pdfUrl, storageKey: dto.storageKey, statusAtual: status,
        autorPrincipalId: dto.autorPrincipalId || null, dataProtocolo: dateOrNull(dto.dataProtocolo),
        publicada: dto.publicada ?? true,
        autores: dto.autores?.length
          ? {
              create: dto.autores.map((a, i) => ({
                tenantId, vereadorId: a.vereadorId, papel: a.papel || 'autor', ordem: a.ordem ?? i,
              })),
            }
          : undefined,
        tramitacoes: {
          create: { tenantId, fase: status, despacho: 'Protocolo da proposição.', atorId: atorId ?? null },
        },
      },
      include: { autores: true, tramitacoes: true },
    });
    await this.audit(tenantId, atorId, 'PROPOSICAO_CRIADA', 'proposicoes', p.id, { tipo: p.tipo, numero: p.numero, ano: p.ano });
    return p;
  }

  async atualizarProposicao(id: string, dto: AtualizarProposicaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscarProposicaoAdmin(id);
    const data: Record<string, unknown> = {};
    for (const c of ['tipo', 'numero', 'ano', 'protocolo', 'ementa', 'texto', 'pdfUrl', 'storageKey', 'autorPrincipalId', 'publicada'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.dataProtocolo !== undefined) data.dataProtocolo = dateOrNull(dto.dataProtocolo);
    // status_atual NÃO é alterado aqui — transição apenas via tramitar() (append-only).
    data.atualizadoEm = new Date();
    const p = await this.prisma.db.proposicao.update({ where: { id }, data: data as any });
    await this.audit(tenantId, atorId, 'PROPOSICAO_ATUALIZADA', 'proposicoes', id, { campos: Object.keys(data) });
    return p;
  }

  async excluirProposicao(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscarProposicaoAdmin(id);
    await this.prisma.db.proposicao.delete({ where: { id } });
    await this.audit(tenantId, atorId, 'PROPOSICAO_EXCLUIDA', 'proposicoes', id, {});
    return { excluido: true };
  }

  /**
   * Transição de fase (FSM) com histórico APPEND-ONLY: grava a tramitação e
   * atualiza status_atual da proposição. Transição inválida é rejeitada.
   */
  async tramitar(id: string, dto: TramitarDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    if (!STATUS_PROPOSICAO.includes(dto.fase)) throw new BadRequestException('Fase/transição inválida.');
    const p = await this.prisma.db.proposicao.findUnique({ where: { id }, select: { id: true, statusAtual: true } });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    if (p.statusAtual === dto.fase) throw new BadRequestException('Proposição já está nesta fase.');

    // Atômico com RLS (GUCs setados uma vez via prisma.tx).
    const tram = await this.prisma.tx(async (tx) => {
      const t = await tx.proposicaoTramitacao.create({
        data: {
          tenantId, proposicaoId: id, fase: dto.fase, despacho: dto.despacho,
          comissaoId: dto.comissaoId || null, relatorId: dto.relatorId || null,
          data: dto.data ? new Date(dto.data) : new Date(), atorId: atorId ?? null,
        },
      });
      await tx.proposicao.update({
        where: { id }, data: { statusAtual: dto.fase, atualizadoEm: new Date() },
      });
      return t;
    });
    await this.audit(tenantId, atorId, 'PROPOSICAO_TRAMITADA', 'proposicoes', id, { de: p.statusAtual, para: dto.fase });
    return tram;
  }

  // =========================================================== Votação (admin)
  /** Registra votação nominal: cria votação, grava votos e apura resultado. */
  async registrarVotacao(proposicaoId: string, dto: RegistrarVotacaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const p = await this.prisma.db.proposicao.findUnique({ where: { id: proposicaoId }, select: { id: true } });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    if (!dto.votos?.length) throw new BadRequestException('Informe ao menos um voto.');

    const validos = ['favoravel', 'contrario', 'abstencao', 'ausente'];
    let favoraveis = 0, contrarios = 0, abstencoes = 0, ausentes = 0;
    for (const v of dto.votos) {
      if (!validos.includes(v.voto)) throw new BadRequestException(`Voto inválido: ${v.voto}`);
      if (v.voto === 'favoravel') favoraveis++;
      else if (v.voto === 'contrario') contrarios++;
      else if (v.voto === 'abstencao') abstencoes++;
      else ausentes++;
    }
    const resultado = favoraveis > contrarios ? 'aprovado' : 'rejeitado';

    const votacao = await this.prisma.db.proposicaoVotacao.create({
      data: {
        tenantId, proposicaoId, sessaoId: dto.sessaoId || null, turno: dto.turno,
        resultado, quorum: dto.quorum, favoraveis, contrarios, abstencoes, ausentes,
        data: dto.data ? new Date(dto.data) : new Date(),
        votos: {
          create: dto.votos.map((v) => ({ tenantId, vereadorId: v.vereadorId, voto: v.voto })),
        },
      },
      include: { votos: true },
    });
    await this.audit(tenantId, atorId, 'VOTACAO_REGISTRADA', 'proposicao_votacoes', votacao.id, {
      proposicaoId, resultado, favoraveis, contrarios, abstencoes, ausentes,
    });
    return votacao;
  }

  // ============================================================ Emendas (admin)
  async addEmenda(proposicaoId: string, dto: EmendaDto) {
    const tenantId = TenantContext.tenantId()!;
    const p = await this.prisma.db.proposicao.findUnique({ where: { id: proposicaoId }, select: { id: true } });
    if (!p) throw new NotFoundException('Proposição não encontrada.');
    return this.prisma.db.proposicaoEmenda.create({
      data: {
        tenantId, proposicaoId, numero: dto.numero ?? null, tipo: dto.tipo || 'modificativa',
        texto: dto.texto, autorId: dto.autorId || null, status: dto.status || 'apresentada',
      },
    });
  }
  excluirEmenda(id: string) {
    return this.prisma.db.proposicaoEmenda.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // =============================================================== Leis (admin)
  async listarLeisAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.lei.findMany({
        orderBy: [{ ano: 'desc' }, { numero: 'desc' }],
        skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize,
      }),
      this.prisma.db.lei.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async criarLei(dto: CriarLeiDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const l = await this.prisma.db.lei.create({
      data: {
        tenantId, numero: dto.numero, tipo: dto.tipo || 'lei_ordinaria', ano: dto.ano ?? null,
        ementa: dto.ementa, texto: dto.texto, dataSancao: dateOrNull(dto.dataSancao),
        proposicaoId: dto.proposicaoId || null, pdfUrl: dto.pdfUrl, storageKey: dto.storageKey,
        vigente: dto.vigente ?? true, publicada: dto.publicada ?? true,
      },
    });
    await this.audit(tenantId, atorId, 'LEI_CRIADA', 'leis', l.id, { numero: l.numero, tipo: l.tipo, ano: l.ano });
    return l;
  }

  async atualizarLei(id: string, dto: AtualizarLeiDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const anterior = await this.prisma.db.lei.findUnique({ where: { id } });
    if (!anterior) throw new NotFoundException('Lei não encontrada.');
    const data: Record<string, unknown> = {};
    for (const c of ['numero', 'tipo', 'ano', 'ementa', 'texto', 'proposicaoId', 'pdfUrl', 'storageKey', 'vigente', 'publicada'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.dataSancao !== undefined) data.dataSancao = dateOrNull(dto.dataSancao);
    data.atualizadoEm = new Date();
    const l = await this.prisma.db.lei.update({ where: { id }, data: data as any });
    await this.audit(tenantId, atorId, 'LEI_ATUALIZADA', 'leis', id, { campos: Object.keys(data) });
    return l;
  }

  async excluirLei(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const l = await this.prisma.db.lei.findUnique({ where: { id } });
    if (!l) throw new NotFoundException('Lei não encontrada.');
    await this.prisma.db.lei.delete({ where: { id } });
    await this.audit(tenantId, atorId, 'LEI_EXCLUIDA', 'leis', id, { numero: l.numero });
    return { excluido: true };
  }

  // =========================================================== helpers
  private async audit(tenantId: string, atorId: string | undefined, acao: string, entidade: string, entidadeId: string, dados: any) {
    await this.prisma.db.auditLog.create({
      data: { tenantId, atorId: atorId ?? null, acao, entidade, entidadeId, dados },
    });
  }
}
