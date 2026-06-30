import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  AtualizarComissaoDto,
  AtualizarVereadorDto,
  CargoComissaoDto,
  CargoMesaDto,
  ComissaoDocumentoDto,
  CriarComissaoDto,
  CriarVereadorDto,
  RepresentacaoDto,
  VereadorPostDto,
} from './parlamentar.dto';

/** Slug URL-safe (minúsculo, sem acento, hífens). Mesmo padrão de secretarias. */
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

@Injectable()
export class ParlamentarService {
  private readonly logger = new Logger(ParlamentarService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================== Vereadores (público)
  listarAtivos(filtros: { status?: string; partido?: string; legislatura?: string } = {}) {
    return this.prisma.db.vereador.findMany({
      where: {
        ativo: true,
        ...(filtros.status ? { status: filtros.status } : {}),
        ...(filtros.partido ? { partido: filtros.partido } : {}),
        ...(filtros.legislatura ? { legislatura: filtros.legislatura } : {}),
      },
      orderBy: [{ ordem: 'asc' }, { nomeParlamentar: 'asc' }],
      select: {
        id: true, nome: true, nomeParlamentar: true, slug: true, partido: true,
        status: true, legislatura: true, fotoUrl: true, email: true, telefone: true,
      },
    });
  }

  /** Perfil público completo do vereador: dados + mesa + comissões + posts. */
  async buscarPorSlug(slugOrId: string) {
    const v = await this.prisma.db.vereador.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }], ativo: true },
      include: {
        mesaCargos: { orderBy: { inicio: 'desc' } },
        comissaoCargos: {
          include: { comissao: { select: { id: true, nome: true, slug: true, tipo: true } } },
          orderBy: { ordem: 'asc' },
        },
        posts: {
          where: { publicado: true }, orderBy: { publicadoEm: 'desc' }, take: 12,
          include: { midias: { orderBy: { ordem: 'asc' } } },
        },
        representacoes: { orderBy: { criadoEm: 'desc' }, take: 20 },
      },
    });
    if (!v) throw new NotFoundException('Vereador não encontrado.');
    return v;
  }

  /** Mesa Diretora vigente (ou em `data`), com dados do vereador. */
  async mesaDiretora(data?: string) {
    const ref = data ? new Date(data) : new Date();
    if (Number.isNaN(ref.getTime())) throw new BadRequestException('Data inválida.');
    const cargos = await this.prisma.db.vereadorMesaCargo.findMany({
      where: { inicio: { lte: ref }, OR: [{ fim: null }, { fim: { gte: ref } }] },
      orderBy: { ordem: 'asc' },
      include: {
        vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true, fotoUrl: true } },
      },
    });
    return cargos.map((c) => ({
      cargo: c.cargo, inicio: c.inicio, fim: c.fim, legislatura: c.legislatura, vereador: c.vereador,
    }));
  }

  // ====================================================== Vereadores (admin)
  async listarAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.vereador.findMany({
        orderBy: [{ ordem: 'asc' }, { nomeParlamentar: 'asc' }],
        skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize,
      }),
      this.prisma.db.vereador.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async buscar(id: string) {
    const v = await this.prisma.db.vereador.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Vereador não encontrado.');
    return v;
  }

  async criar(dto: CriarVereadorDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const slug = await this.slugUnico('vereador', dto.slug ? slugify(dto.slug) : slugify(dto.nomeParlamentar), tenantId);
    const v = await this.prisma.db.vereador.create({
      data: {
        tenantId, userId: dto.userId || null, nome: dto.nome, nomeParlamentar: dto.nomeParlamentar,
        slug, partido: dto.partido, status: dto.status || 'ativo', legislatura: dto.legislatura,
        mandatoInicio: dateOrNull(dto.mandatoInicio), mandatoFim: dateOrNull(dto.mandatoFim),
        email: dto.email, telefone: dto.telefone, fotoUrl: dto.fotoUrl, biografia: dto.biografia,
        redes: dto.redes ?? {}, ordem: dto.ordem ?? 0, ativo: dto.ativo ?? true,
      },
    });
    await this.audit(tenantId, atorId, 'VEREADOR_CRIADO', 'vereadores', v.id, { nome: v.nome, slug });
    return v;
  }

  async atualizar(id: string, dto: AtualizarVereadorDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const anterior = await this.buscar(id);
    const data: Record<string, unknown> = {};
    const campos: (keyof AtualizarVereadorDto)[] = [
      'nome', 'nomeParlamentar', 'userId', 'partido', 'status', 'legislatura',
      'email', 'telefone', 'fotoUrl', 'biografia', 'redes', 'ordem', 'ativo',
    ];
    for (const c of campos) if (dto[c] !== undefined) (data as any)[c] = dto[c];
    if (dto.mandatoInicio !== undefined) data.mandatoInicio = dateOrNull(dto.mandatoInicio);
    if (dto.mandatoFim !== undefined) data.mandatoFim = dateOrNull(dto.mandatoFim);
    if (dto.slug) {
      const cand = slugify(dto.slug);
      if (cand !== (anterior.slug ?? '')) data.slug = await this.slugUnico('vereador', cand, tenantId, id);
    }
    data.atualizadoEm = new Date();
    const v = await this.prisma.db.vereador.update({ where: { id }, data: data as any });
    await this.audit(tenantId, atorId, 'VEREADOR_ATUALIZADO', 'vereadores', id, { campos: Object.keys(data) });
    return v;
  }

  async excluir(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const v = await this.buscar(id);
    await this.prisma.db.vereador.delete({ where: { id } });
    await this.audit(tenantId, atorId, 'VEREADOR_EXCLUIDO', 'vereadores', id, { nome: v.nome });
    return { excluido: true };
  }

  // ======================================================= Mesa Diretora (admin)
  listarMesa() {
    return this.prisma.db.vereadorMesaCargo.findMany({
      orderBy: [{ inicio: 'desc' }, { ordem: 'asc' }],
      include: { vereador: { select: { id: true, nomeParlamentar: true } } },
    });
  }
  async definirCargoMesa(dto: CargoMesaDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.vereadorMesaCargo.create({
      data: {
        tenantId, vereadorId: dto.vereadorId, cargo: dto.cargo,
        inicio: new Date(dto.inicio), fim: dateOrNull(dto.fim),
        legislatura: dto.legislatura, ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirCargoMesa(id: string) {
    return this.prisma.db.vereadorMesaCargo.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // =========================================================== Comissões
  listarComissoes() {
    return this.prisma.db.comissao.findMany({
      where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    });
  }
  async comissaoPorSlug(slugOrId: string) {
    const c = await this.prisma.db.comissao.findFirst({
      where: { OR: [{ slug: slugOrId }, { id: slugOrId }], ativo: true },
      include: {
        cargos: {
          orderBy: { ordem: 'asc' },
          include: { vereador: { select: { id: true, nomeParlamentar: true, slug: true, partido: true, fotoUrl: true } } },
        },
        documentos: { orderBy: { ordem: 'asc' } },
      },
    });
    if (!c) throw new NotFoundException('Comissão não encontrada.');
    return c;
  }
  async criarComissao(dto: CriarComissaoDto) {
    const tenantId = TenantContext.tenantId()!;
    const slug = await this.slugUnico('comissao', dto.slug ? slugify(dto.slug) : slugify(dto.nome), tenantId);
    return this.prisma.db.comissao.create({
      data: {
        tenantId, nome: dto.nome, slug, tipo: dto.tipo || 'permanente',
        descricao: dto.descricao, legislatura: dto.legislatura,
        ordem: dto.ordem ?? 0, ativo: dto.ativo ?? true,
      },
    });
  }
  async atualizarComissao(id: string, dto: AtualizarComissaoDto) {
    const tenantId = TenantContext.tenantId()!;
    const data: Record<string, unknown> = {};
    for (const c of ['nome', 'tipo', 'descricao', 'legislatura', 'ordem', 'ativo'] as const) {
      if (dto[c] !== undefined) (data as any)[c] = dto[c];
    }
    if (dto.slug) data.slug = await this.slugUnico('comissao', slugify(dto.slug), tenantId, id);
    data.atualizadoEm = new Date();
    return this.prisma.db.comissao.update({ where: { id }, data: data as any });
  }
  excluirComissao(id: string) {
    return this.prisma.db.comissao.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // cargos de comissão
  async addCargoComissao(comissaoId: string, dto: CargoComissaoDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.comissaoCargo.create({
      data: {
        tenantId, comissaoId, vereadorId: dto.vereadorId, cargo: dto.cargo || 'membro',
        inicio: dateOrNull(dto.inicio), fim: dateOrNull(dto.fim), ordem: dto.ordem ?? 0,
      },
    });
  }
  excluirCargoComissao(id: string) {
    return this.prisma.db.comissaoCargo.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // documentos de comissão
  async addDocComissao(comissaoId: string, dto: ComissaoDocumentoDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.comissaoDocumento.create({
      data: { tenantId, comissaoId, titulo: dto.titulo, arquivoUrl: dto.arquivoUrl, storageKey: dto.storageKey, ordem: dto.ordem ?? 0 },
    });
  }
  excluirDocComissao(id: string) {
    return this.prisma.db.comissaoDocumento.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // =========================================================== Posts
  listarPosts(vereadorId: string) {
    return this.prisma.db.vereadorPost.findMany({
      where: { vereadorId }, orderBy: { publicadoEm: 'desc' },
      include: { midias: { orderBy: { ordem: 'asc' } } },
    });
  }
  async criarPost(vereadorId: string, dto: VereadorPostDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.vereadorPost.create({
      data: {
        tenantId, vereadorId, titulo: dto.titulo, conteudo: dto.conteudo,
        publicado: dto.publicado ?? true,
        midias: dto.midias?.length
          ? { create: dto.midias.map((m) => ({ tenantId, tipo: m.tipo || 'foto', url: m.url, storageKey: m.storageKey, ordem: m.ordem ?? 0 })) }
          : undefined,
      },
      include: { midias: true },
    });
  }
  excluirPost(id: string) {
    return this.prisma.db.vereadorPost.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // ====================================================== Representações
  listarRepresentacoes(vereadorId: string) {
    return this.prisma.db.vereadorRepresentacao.findMany({
      where: { vereadorId }, orderBy: { criadoEm: 'desc' },
    });
  }
  async criarRepresentacao(vereadorId: string, dto: RepresentacaoDto) {
    const tenantId = TenantContext.tenantId()!;
    return this.prisma.db.vereadorRepresentacao.create({
      data: {
        tenantId, vereadorId, tipo: dto.tipo || 'sugestao', assunto: dto.assunto,
        descricao: dto.descricao, status: dto.status || 'aberta',
      },
    });
  }
  excluirRepresentacao(id: string) {
    return this.prisma.db.vereadorRepresentacao.delete({ where: { id } }).then(() => ({ excluido: true }));
  }

  // =========================================================== helpers
  private async audit(tenantId: string, atorId: string | undefined, acao: string, entidade: string, entidadeId: string, dados: any) {
    await this.prisma.db.auditLog.create({
      data: { tenantId, atorId: atorId ?? null, acao, entidade, entidadeId, dados },
    });
  }

  private async slugUnico(tabela: 'vereador' | 'comissao', base: string, tenantId: string, excludeId?: string): Promise<string> {
    const db = this.prisma.platform();
    const where = (slug: string) => ({ tenantId, slug, ...(excludeId ? { NOT: { id: excludeId } } : {}) });
    const existe =
      tabela === 'vereador'
        ? await db.vereador.findFirst({ where: where(base), select: { id: true } })
        : await db.comissao.findFirst({ where: where(base), select: { id: true } });
    if (!existe) return base;
    const { randomBytes } = await import('node:crypto');
    return `${base}-${randomBytes(2).toString('hex')}`;
  }
}
