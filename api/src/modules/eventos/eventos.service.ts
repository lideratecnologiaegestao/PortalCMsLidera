import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant.context';
import {
  AtualizarEventoDto,
  AtualizarInscricaoDto,
  CriarEventoDto,
  InscreverDto,
} from './eventos.dto';

/** Slug URL-safe (minúsculo, sem acento, hífens). Mesmo padrão de parlamentar. */
function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function dateOrThrow(v: string, campo: string): Date {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${campo} inválida.`);
  return d;
}
function dateOrNull(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Data inválida.');
  return d;
}

@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =========================================================== Público (leitura)
  /** Lista eventos publicados/ativos, ordenados pelos mais próximos primeiro. */
  listarPublicos(filtros: { tipo?: string } = {}) {
    return this.prisma.db.evento.findMany({
      where: {
        ativo: true,
        publicado: true,
        ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      },
      orderBy: { dataHora: 'asc' },
      select: {
        id: true, tipo: true, titulo: true, slug: true, dataHora: true, dataFim: true,
        local: true, onlineUrl: true, vagas: true, capaUrl: true, certificavel: true,
        inscricoesAbertas: true, sessaoId: true,
      },
    });
  }

  /** Detalhe público do evento (por id ou slug), com contagem de vagas. */
  async buscarPublico(idOrSlug: string) {
    const ev = await this.prisma.db.evento.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], ativo: true, publicado: true },
    });
    if (!ev) throw new NotFoundException('Evento não encontrado.');
    const inscritos = await this.prisma.db.eventoInscricao.count({
      where: { eventoId: ev.id, status: 'confirmada' },
    });
    const vagasRestantes = ev.vagas == null ? null : Math.max(0, ev.vagas - inscritos);
    return { ...ev, inscritos, vagasRestantes };
  }

  // ============================================================ Inscrição (público)
  /**
   * Inscreve um cidadão (com ou sem login). Respeita vagas e janela de
   * inscrições. cidadaoId vem do JWT quando logado (vincula a inscrição ao user).
   */
  async inscrever(eventoId: string, dto: InscreverDto, cidadaoId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const ev = await this.prisma.db.evento.findFirst({
      where: { id: eventoId, ativo: true, publicado: true },
    });
    if (!ev) throw new NotFoundException('Evento não encontrado.');
    if (!ev.inscricoesAbertas) throw new BadRequestException('Inscrições encerradas para este evento.');

    if (!dto.nome?.trim()) throw new BadRequestException('Informe seu nome.');
    if (!dto.email?.trim()) throw new BadRequestException('Informe seu e-mail.');
    const email = dto.email.trim().toLowerCase();

    // Define status conforme disponibilidade de vagas.
    let status = 'confirmada';
    if (ev.vagas != null) {
      const confirmadas = await this.prisma.db.eventoInscricao.count({
        where: { eventoId, status: 'confirmada' },
      });
      if (confirmadas >= ev.vagas) status = 'lista_espera';
    }

    try {
      const insc = await this.prisma.db.eventoInscricao.create({
        data: {
          tenantId, eventoId, cidadaoId: cidadaoId || null,
          nome: dto.nome.trim(), email, telefone: dto.telefone?.trim() || null,
          documento: dto.documento?.trim() || null, status, presente: false,
        },
        select: { id: true, status: true, nome: true, email: true },
      });

      await this.prisma.db.auditLog.create({
        data: {
          tenantId, atorId: cidadaoId ?? null, acao: 'EVENTO_INSCRICAO_CRIADA',
          entidade: 'evento_inscricoes', entidadeId: insc.id,
          dados: { eventoId, status: insc.status },
        },
      });
      return insc;
    } catch (err: any) {
      // Viola o índice único (tenant_id, evento_id, lower(email))
      if (err?.code === 'P2002') {
        throw new ConflictException('Este e-mail já está inscrito neste evento.');
      }
      throw err;
    }
  }

  // ====================================================== Cidadão autenticado
  /** Inscrições do cidadão logado (com dados básicos do evento e certificado). */
  async minhasInscricoes(cidadaoId: string) {
    const inscricoes = await this.prisma.db.eventoInscricao.findMany({
      where: { cidadaoId },
      orderBy: { criadoEm: 'desc' },
      include: {
        evento: { select: { id: true, titulo: true, slug: true, tipo: true, dataHora: true, local: true } },
        certificado: { select: { id: true, codigo: true, emitidoEm: true } },
      },
    });
    return inscricoes.map((i) => ({
      id: i.id, status: i.status, presente: i.presente, criadoEm: i.criadoEm,
      evento: i.evento, certificado: i.certificado,
    }));
  }

  /**
   * Resolve o certificado para download pelo cidadão logado.
   * Garante que o certificado pertence a uma inscrição do próprio cidadão.
   */
  async certificadoParaDownload(certificadoId: string, cidadaoId: string) {
    const cert = await this.prisma.db.eventoCertificado.findUnique({
      where: { id: certificadoId },
      include: { inscricao: { select: { cidadaoId: true } }, evento: { select: { titulo: true } } },
    });
    if (!cert) throw new NotFoundException('Certificado não encontrado.');
    if (cert.inscricao.cidadaoId !== cidadaoId) {
      throw new ForbiddenException('Este certificado não pertence a você.');
    }
    return {
      id: cert.id, codigo: cert.codigo, nome: cert.nome, pdfUrl: cert.pdfUrl,
      emitidoEm: cert.emitidoEm, eventoTitulo: cert.evento.titulo,
    };
  }

  // ============================================================ Admin — eventos
  async listarAdmin(opts: { page: number; pageSize: number }) {
    const [items, total] = await Promise.all([
      this.prisma.db.evento.findMany({
        orderBy: { dataHora: 'desc' },
        skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize,
      }),
      this.prisma.db.evento.count(),
    ]);
    return { items, total, page: opts.page, pageSize: opts.pageSize };
  }

  async buscar(id: string) {
    const ev = await this.prisma.db.evento.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Evento não encontrado.');
    return ev;
  }

  async criar(dto: CriarEventoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    if (!dto.titulo?.trim()) throw new BadRequestException('Informe o título do evento.');
    const slug = await this.slugUnico(dto.slug ? slugify(dto.slug) : slugify(dto.titulo), tenantId);

    const ev = await this.prisma.db.evento.create({
      data: {
        tenantId, tipo: dto.tipo || 'audiencia_publica', titulo: dto.titulo.trim(), slug,
        descricao: dto.descricao || null, dataHora: dateOrThrow(dto.dataHora, 'Data/hora'),
        dataFim: dateOrNull(dto.dataFim), local: dto.local?.trim() || null,
        onlineUrl: dto.onlineUrl?.trim() || null, vagas: dto.vagas ?? null,
        capaUrl: dto.capaUrl?.trim() || null, certificavel: dto.certificavel ?? false,
        inscricoesAbertas: dto.inscricoesAbertas ?? true, sessaoId: dto.sessaoId || null,
        publicado: dto.publicado ?? true, ativo: dto.ativo ?? true,
      },
    });

    await this.prisma.db.auditLog.create({
      data: {
        tenantId, atorId: atorId ?? null, acao: 'EVENTO_CRIADO',
        entidade: 'eventos', entidadeId: ev.id, dados: { titulo: ev.titulo, tipo: ev.tipo, slug },
      },
    });
    return ev;
  }

  async atualizar(id: string, dto: AtualizarEventoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const anterior = await this.buscar(id); // existência via RLS

    const data: Record<string, unknown> = {};
    if (dto.titulo !== undefined) data.titulo = dto.titulo.trim();
    if (dto.tipo !== undefined) data.tipo = dto.tipo;
    if (dto.descricao !== undefined) data.descricao = dto.descricao || null;
    if (dto.dataHora !== undefined) data.dataHora = dateOrThrow(dto.dataHora, 'Data/hora');
    if (dto.dataFim !== undefined) data.dataFim = dateOrNull(dto.dataFim);
    if (dto.local !== undefined) data.local = dto.local?.trim() || null;
    if (dto.onlineUrl !== undefined) data.onlineUrl = dto.onlineUrl?.trim() || null;
    if (dto.vagas !== undefined) data.vagas = dto.vagas ?? null;
    if (dto.capaUrl !== undefined) data.capaUrl = dto.capaUrl?.trim() || null;
    if (dto.certificavel !== undefined) data.certificavel = dto.certificavel;
    if (dto.inscricoesAbertas !== undefined) data.inscricoesAbertas = dto.inscricoesAbertas;
    if (dto.sessaoId !== undefined) data.sessaoId = dto.sessaoId || null;
    if (dto.publicado !== undefined) data.publicado = dto.publicado;
    if (dto.ativo !== undefined) data.ativo = dto.ativo;

    if (dto.slug) {
      const candidato = slugify(dto.slug);
      if (candidato !== (anterior.slug ?? '')) data.slug = await this.slugUnico(candidato, tenantId, id);
    }

    const atualizado = await this.prisma.db.evento.update({ where: { id }, data });
    await this.prisma.db.auditLog.create({
      data: {
        tenantId, atorId: atorId ?? null, acao: 'EVENTO_ATUALIZADO',
        entidade: 'eventos', entidadeId: id, dados: { campos: Object.keys(data) },
      },
    });
    return atualizado;
  }

  async excluir(id: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const ev = await this.buscar(id);
    await this.prisma.db.evento.delete({ where: { id } });
    await this.prisma.db.auditLog.create({
      data: {
        tenantId, atorId: atorId ?? null, acao: 'EVENTO_EXCLUIDO',
        entidade: 'eventos', entidadeId: id, dados: { titulo: ev.titulo },
      },
    });
    return { excluido: true };
  }

  // ================================================== Admin — inscrições/presença
  listarInscricoes(eventoId: string) {
    return this.prisma.db.eventoInscricao.findMany({
      where: { eventoId },
      orderBy: { criadoEm: 'asc' },
      select: {
        id: true, nome: true, email: true, telefone: true, documento: true,
        status: true, presente: true, presenteEm: true, cidadaoId: true, criadoEm: true,
      },
    });
  }

  /** Atualiza status e/ou presença (check-in) de uma inscrição. */
  async atualizarInscricao(inscricaoId: string, dto: AtualizarInscricaoDto, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const insc = await this.prisma.db.eventoInscricao.findUnique({ where: { id: inscricaoId } });
    if (!insc) throw new NotFoundException('Inscrição não encontrada.');

    const data: Record<string, unknown> = {};
    if (dto.status !== undefined) {
      if (!['confirmada', 'lista_espera', 'cancelada'].includes(dto.status)) {
        throw new BadRequestException('Status inválido.');
      }
      data.status = dto.status;
    }
    if (dto.presente !== undefined) {
      data.presente = dto.presente;
      data.presenteEm = dto.presente ? new Date() : null;
    }

    const atualizada = await this.prisma.db.eventoInscricao.update({ where: { id: inscricaoId }, data });
    await this.prisma.db.auditLog.create({
      data: {
        tenantId, atorId: atorId ?? null, acao: 'EVENTO_INSCRICAO_ATUALIZADA',
        entidade: 'evento_inscricoes', entidadeId: inscricaoId, dados: { campos: Object.keys(data) },
      },
    });
    return atualizada;
  }

  // ================================================== Admin — certificados
  /**
   * Emite o certificado de participação para uma inscrição PRESENTE.
   * Gera código verificável; o PDF é produzido de forma assíncrona (a ref fica
   * pendente até o worker preencher pdf_url/storage_key). Idempotente: se já
   * existir certificado para a inscrição, retorna o existente.
   */
  async emitirCertificado(inscricaoId: string, atorId?: string) {
    const tenantId = TenantContext.tenantId()!;
    const insc = await this.prisma.db.eventoInscricao.findUnique({
      where: { id: inscricaoId },
      include: { evento: { select: { id: true, certificavel: true } } },
    });
    if (!insc) throw new NotFoundException('Inscrição não encontrada.');
    if (!insc.evento.certificavel) {
      throw new BadRequestException('Este evento não emite certificado.');
    }
    if (!insc.presente) {
      throw new BadRequestException('A presença do participante não foi registrada.');
    }

    const existente = await this.prisma.db.eventoCertificado.findFirst({
      where: { inscricaoId },
    });
    if (existente) return existente;

    const codigo = this.gerarCodigo();
    const cert = await this.prisma.db.eventoCertificado.create({
      data: {
        tenantId, eventoId: insc.evento.id, inscricaoId, codigo, nome: insc.nome,
      },
    });

    await this.prisma.db.auditLog.create({
      data: {
        tenantId, atorId: atorId ?? null, acao: 'EVENTO_CERTIFICADO_EMITIDO',
        entidade: 'evento_certificados', entidadeId: cert.id,
        dados: { eventoId: insc.evento.id, inscricaoId, codigo },
      },
    });
    // O PDF é gerado de forma assíncrona (não-funcional da spec) — fora de escopo
    // deste módulo a fila; o worker preencherá pdf_url/storage_key depois.
    return cert;
  }

  /**
   * Emite certificados em lote para TODOS os presentes de um evento certificável.
   * Reaproveita emitirCertificado (idempotente).
   */
  async emitirCertificadosEvento(eventoId: string, atorId?: string) {
    const ev = await this.buscar(eventoId);
    if (!ev.certificavel) throw new BadRequestException('Este evento não emite certificado.');
    const presentes = await this.prisma.db.eventoInscricao.findMany({
      where: { eventoId, presente: true },
      select: { id: true },
    });
    const emitidos: string[] = [];
    for (const p of presentes) {
      const cert = await this.emitirCertificado(p.id, atorId);
      emitidos.push(cert.id);
    }
    return { total: emitidos.length };
  }

  // ----------------------------------------------------------------- helpers
  /** Código público de validação (12 chars hex maiúsculo, ex.: A1B2C3D4E5F6). */
  private gerarCodigo(): string {
    return randomBytes(6).toString('hex').toUpperCase();
  }

  /** Garante slug único dentro do tenant (sufixo aleatório em colisão). */
  private async slugUnico(base: string, tenantId: string, excludeId?: string): Promise<string> {
    const db = this.prisma.platform();
    const existe = await db.evento.findFirst({
      where: { tenantId, slug: base, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!existe) return base;
    return `${base}-${randomBytes(2).toString('hex')}`;
  }
}
