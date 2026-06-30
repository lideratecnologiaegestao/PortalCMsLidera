import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  AtualizarPautaItemDto,
  AtualizarSessaoDto,
  AtualizarTipoSessaoDto,
  CriarSessaoDto,
  CriarTipoSessaoDto,
  GravacaoDto,
  PautaItemDto,
  PublicarAtaDto,
  RegistrarPresencasDto,
} from './sessoes.dto';

function dateOrThrow(v: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return d;
}
function dateOrNull(v?: string): Date | null {
  if (!v) return null;
  return dateOrThrow(v);
}

@Injectable()
export class SessoesService {
  private readonly logger = new Logger(SessoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================ Público
  /** Lista/calendário de sessões com filtros (tipo, período, status). */
  listarPublico(filtros: { tipo?: string; status?: string; de?: string; ate?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (filtros.tipo) where.tipoSessaoId = filtros.tipo;
    if (filtros.status) where.status = filtros.status;
    const dataHora: Record<string, Date> = {};
    if (filtros.de) dataHora.gte = dateOrThrow(filtros.de);
    if (filtros.ate) dataHora.lte = dateOrThrow(filtros.ate);
    if (Object.keys(dataHora).length) where.dataHora = dataHora;

    return this.prisma.db.sessao.findMany({
      where,
      orderBy: { dataHora: 'desc' },
      select: {
        id: true, titulo: true, dataHora: true, local: true, status: true,
        quorum: true, videoAoVivoUrl: true, ataPublicadaEm: true,
        tipoSessao: { select: { id: true, nome: true } },
      },
    });
  }

  /** Detalhe público: pauta, presenças, gravações e ata (só se publicada). */
  async buscarPublico(id: string) {
    const s = await this.prisma.db.sessao.findUnique({
      where: { id },
      include: {
        tipoSessao: { select: { id: true, nome: true } },
        pautaItens: { orderBy: { ordem: 'asc' } },
        presencas: {
          orderBy: { criadoEm: 'asc' },
          include: { vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true, fotoUrl: true } } },
        },
        gravacoes: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!s) throw new NotFoundException('Sessão não encontrada.');
    // Ata só é pública após publicação explícita (critério de aceite).
    const ataConteudo = s.ataPublicadaEm ? s.ataConteudo : null;
    return { ...s, ataConteudo };
  }

  /** TV Câmara: { aoVivo, proxima, ultima, acervo }. Espelha o app antigo. */
  async tvCamara() {
    const agora = new Date();
    const [aoVivo, proxima, ultima, acervoSessoes] = await Promise.all([
      this.prisma.db.sessao.findFirst({
        where: { status: 'em_andamento' },
        orderBy: { dataHora: 'desc' },
        select: { id: true, titulo: true, dataHora: true, videoAoVivoUrl: true, status: true },
      }),
      this.prisma.db.sessao.findFirst({
        where: { status: 'agendada', dataHora: { gte: agora } },
        orderBy: { dataHora: 'asc' },
        select: { id: true, titulo: true, dataHora: true, local: true, status: true },
      }),
      this.prisma.db.sessao.findFirst({
        where: { status: 'encerrada' },
        orderBy: { dataHora: 'desc' },
        select: { id: true, titulo: true, dataHora: true, status: true },
      }),
      this.prisma.db.sessao.findMany({
        where: { gravacoes: { some: {} } },
        orderBy: { dataHora: 'desc' },
        take: 24,
        select: {
          id: true, titulo: true, dataHora: true,
          gravacoes: { orderBy: { ordem: 'asc' } },
        },
      }),
    ]);
    return { aoVivo, proxima, ultima, acervo: acervoSessoes };
  }

  // ===================================================== Tipos (admin)
  listarTipos() {
    return this.prisma.db.tipoSessao.findMany({ orderBy: [{ ordem: 'asc' }, { nome: 'asc' }] });
  }
  criarTipo(dto: CriarTipoSessaoDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.tipoSessao.create({
      data: { tenantId, nome: dto.nome, descricao: dto.descricao, ordem: dto.ordem ?? 0, ativo: dto.ativo ?? true },
    });
  }
  atualizarTipo(id: string, dto: AtualizarTipoSessaoDto) {
    const data: Record<string, unknown> = {};
    for (const c of ['nome', 'descricao', 'ordem', 'ativo'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    data.atualizadoEm = new Date();
    return this.prisma.db.tipoSessao.update({ where: { id }, data: data as any });
  }
  excluirTipo(id: string) {
    return this.prisma.db.tipoSessao.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ==================================================== Sessões (admin)
  async listarAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.sessao.findMany({
        orderBy: { dataHora: 'desc' },
        skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize,
        include: { tipoSessao: { select: { id: true, nome: true } } },
      }),
      this.prisma.db.sessao.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async buscar(id: string) {
    const s = await this.prisma.db.sessao.findUnique({
      where: { id },
      include: {
        tipoSessao: { select: { id: true, nome: true } },
        pautaItens: { orderBy: { ordem: 'asc' } },
        presencas: { include: { vereador: { select: { id: true, nomeParlamentar: true } } } },
        gravacoes: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!s) throw new NotFoundException('Sessão não encontrada.');
    return s;
  }

  async criar(dto: CriarSessaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const s = await this.prisma.db.sessao.create({
      data: {
        tenantId, titulo: dto.titulo, dataHora: dateOrThrow(dto.dataHora),
        tipoSessaoId: dto.tipoSessaoId || null, local: dto.local,
        status: dto.status || 'agendada', quorum: dto.quorum,
        videoAoVivoUrl: dto.videoAoVivoUrl, ataConteudo: dto.ataConteudo,
        eventoId: dto.eventoId || null,
      },
    });
    await this.audit(tenantId, atorId, 'SESSAO_CRIADA', 'sessoes', s.id, { titulo: s.titulo });
    return s;
  }

  async atualizar(id: string, dto: AtualizarSessaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscar(id);
    const data: Record<string, unknown> = {};
    for (const c of ['titulo', 'local', 'status', 'quorum', 'videoAoVivoUrl', 'ataConteudo'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.tipoSessaoId !== undefined) data.tipoSessaoId = dto.tipoSessaoId || null;
    if (dto.eventoId !== undefined) data.eventoId = dto.eventoId || null;
    if (dto.dataHora !== undefined) data.dataHora = dateOrThrow(dto.dataHora);
    data.atualizadoEm = new Date();
    const s = await this.prisma.db.sessao.update({ where: { id }, data: data as any });
    await this.audit(tenantId, atorId, 'SESSAO_ATUALIZADA', 'sessoes', id, { campos: Object.keys(data) });
    return s;
  }

  async excluir(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const s = await this.buscar(id);
    await this.prisma.db.sessao.delete({ where: { id } });
    await this.audit(tenantId, atorId, 'SESSAO_EXCLUIDA', 'sessoes', id, { titulo: s.titulo });
    return { excluido: true };
  }

  // ============================================================ Pauta
  async addPautaItem(sessaoId: string, dto: PautaItemDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.sessaoPautaItem.create({
      data: {
        tenantId, sessaoId, titulo: dto.titulo, descricao: dto.descricao,
        proposicaoId: dto.proposicaoId || null, ordem: dto.ordem ?? 0,
      },
    });
  }
  atualizarPautaItem(id: string, dto: AtualizarPautaItemDto) {
    const data: Record<string, unknown> = {};
    for (const c of ['titulo', 'descricao', 'ordem'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.proposicaoId !== undefined) data.proposicaoId = dto.proposicaoId || null;
    return this.prisma.db.sessaoPautaItem.update({ where: { id }, data: data as any });
  }
  excluirPautaItem(id: string) {
    return this.prisma.db.sessaoPautaItem.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ========================================================= Presença
  /** Registra/atualiza presenças em lote (upsert por sessão+vereador). */
  async registrarPresencas(sessaoId: string, dto: RegistrarPresencasDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscar(sessaoId);
    const resultado = [] as unknown[];
    for (const p of dto.presencas) {
      const item = await this.prisma.db.sessaoPresenca.upsert({
        where: { sessaoId_vereadorId: { sessaoId, vereadorId: p.vereadorId } },
        update: { situacao: p.situacao || 'presente', observacao: p.observacao },
        create: {
          tenantId, sessaoId, vereadorId: p.vereadorId,
          situacao: p.situacao || 'presente', observacao: p.observacao,
        },
      });
      resultado.push(item);
    }
    await this.audit(tenantId, atorId, 'SESSAO_PRESENCAS_REGISTRADAS', 'sessoes', sessaoId, { total: dto.presencas.length });
    return resultado;
  }
  excluirPresenca(id: string) {
    return this.prisma.db.sessaoPresenca.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ============================================================== Ata
  /** Publica/atualiza/despublica a ata. Auditoria de publicação (LGPD/aceite). */
  async gerirAta(sessaoId: string, dto: PublicarAtaDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscar(sessaoId);
    const data: Record<string, unknown> = {};
    if (dto.ataConteudo !== undefined) data.ataConteudo = dto.ataConteudo;
    if (dto.publicar !== undefined) data.ataPublicadaEm = dto.publicar ? new Date() : null;
    data.atualizadoEm = new Date();
    const s = await this.prisma.db.sessao.update({ where: { id: sessaoId }, data: data as any });
    const acao = dto.publicar === false ? 'ATA_DESPUBLICADA' : dto.publicar === true ? 'ATA_PUBLICADA' : 'ATA_ATUALIZADA';
    await this.audit(tenantId, atorId, acao, 'sessoes', sessaoId, { publicadaEm: s.ataPublicadaEm });
    return s;
  }

  // ========================================================= Gravações
  async addGravacao(sessaoId: string, dto: GravacaoDto) {
    const tenantId = TenantContext.tenantId()!;
    await this.buscar(sessaoId);
    return this.prisma.db.sessaoGravacao.create({
      data: {
        tenantId, sessaoId, titulo: dto.titulo, videoUrl: dto.videoUrl,
        storageKey: dto.storageKey, duracao: dto.duracao, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirGravacao(id: string) {
    return this.prisma.db.sessaoGravacao.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // =========================================================== helpers
  private async audit(tenantId: string, atorId: string | undefined, acao: string, entidade: string, entidadeId: string, dados: any) {
    await this.prisma.db.auditLog.create({
      data: { tenantId, atorId: atorId ?? null, acao, entidade, entidadeId, dados },
    });
  }
}
