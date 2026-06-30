import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../../common/rbac/roles.decorator';
import { Role } from '../../../common/rbac/roles.enum';
import { RolesGuard } from '../../../common/rbac/roles.guard';
import { TenantContext } from '../../../common/tenant/tenant.context';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingsService } from '../embeddings.service';
import { QUEUE_IA } from '../../queue/queue.constants';
import { LegislativoIaService } from './legislativo-ia.service';
import { LegislativoIndexadorService } from './legislativo-indexador.service';

/**
 * Nome do job de reindexação do corpus LEGISLATIVO. Idealmente vive em
 * `queue.constants.ts` (ver integracaoSnippets) — definido aqui também para o
 * módulo compilar/funcionar de forma autossuficiente. O snippet do worker
 * (DocumentosFtsWorker.process) trata um job com ESTE name.
 */
export const JOB_IA_REINDEX_LEGISLATIVO = 'ia.reindexar-corpus-legislativo';

/**
 * Endpoints da IA LEGISLATIVA (Fase 5).
 *
 * Público (sem guard, igual a /api/ia/busca|chat da base — throttle apertado por
 * IP porque há custo de tokens/embeddings):
 *   - POST /api/ia/legislativo/busca  → busca semântica na legislação (com citações).
 *   - POST /api/ia/legislativo/chat   → chat do assistente legislativo.
 *
 * Administrativo (RBAC + RLS automático por TenantContext):
 *   - POST /api/admin/ia/legislativo/reindexar     → enfileira indexação do corpus.
 *   - GET  /api/admin/ia/legislativo/index-status  → estado do corpus legislativo.
 */
@Throttle({ default: { limit: 15, ttl: 60_000 } })
@Controller('ia/legislativo')
export class LegislativoIaController {
  constructor(private readonly ia: LegislativoIaService) {}

  /** Busca semântica de legislação (público). */
  @Post('busca')
  busca(@Body() body: { pergunta: string }) {
    return this.ia.busca(body?.pergunta ?? '');
  }

  /** Chat do assistente legislativo (público; respeita iaChatHabilitada). */
  @Post('chat')
  chat(@Body() body: { pergunta: string }) {
    return this.ia.chat(body?.pergunta ?? '');
  }
}

/**
 * Controller administrativo da indexação legislativa.
 * Separado para aplicar o RolesGuard sem afetar as rotas públicas acima.
 */
@Controller('admin/ia/legislativo')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA, Role.SERVIDOR)
export class LegislativoIaAdminController {
  constructor(
    @InjectQueue(QUEUE_IA) private readonly iaQueue: Queue,
    private readonly embeddings: EmbeddingsService,
    private readonly indexador: LegislativoIndexadorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Enfileira a reindexação do corpus legislativo do tenant na QUEUE_IA.
   * Idempotente (jobId fixo por tenant). Degrada sem chave de embeddings.
   */
  @Post('reindexar')
  async reindexar(@Request() req: { user?: { id?: string } }) {
    const tenantId = TenantContext.tenantId();
    if (!tenantId) {
      return { enfileirado: false, configurado: false, aviso: 'Tenant não identificado.' };
    }

    const info = await this.embeddings.infoParaTenant(tenantId);
    if (!info.configurado) {
      return {
        enfileirado: false,
        configurado: false,
        aviso:
          'Configure a chave de embeddings (Voyage/OpenAI) — globalmente ou nesta câmara — para habilitar a busca semântica legislativa.',
      };
    }

    await this.prisma.db.auditLog.create({
      data: {
        tenantId,
        atorId: req.user?.id ?? null,
        acao: 'IA_LEGISLATIVO_REINDEX_SOLICITADO',
        entidade: 'ia_chunks',
        entidadeId: null,
        dados: { provider: info.provider, modelo: info.modelo } as object,
      },
    });

    const jobId = `ia-reindex-legislativo-${tenantId}`;
    await this.iaQueue.add(
      JOB_IA_REINDEX_LEGISLATIVO,
      { tenantId },
      {
        jobId,
        removeOnComplete: true,
        removeOnFail: true,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10_000 },
      },
    );

    return { enfileirado: true, configurado: true, jobId };
  }

  /** Estado atual do corpus legislativo (contagem por fonte). */
  @Get('index-status')
  async indexStatus() {
    const tenantId = TenantContext.tenantId();
    if (!tenantId) {
      return { configurado: this.embeddings.configurado, total: 0, porFonte: [] };
    }
    return this.indexador.status(tenantId);
  }
}
