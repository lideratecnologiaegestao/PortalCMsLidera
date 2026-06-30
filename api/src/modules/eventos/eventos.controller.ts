import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/rbac/roles.decorator';
import { Role } from '../../common/rbac/roles.enum';
import { RolesGuard } from '../../common/rbac/roles.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/jwt-auth.guard';
import { EventosService } from './eventos.service';
import {
  AtualizarEventoDto,
  AtualizarInscricaoDto,
  CriarEventoDto,
  InscreverDto,
} from './eventos.dto';

/**
 * Leitura pública da agenda de eventos/audiências e inscrição.
 * A inscrição é "soft-auth": vincula ao cidadão se houver sessão (JwtAuthGuard
 * global popula req.user), mas não exige login.
 */
@Controller('eventos')
export class EventosPublicController {
  constructor(private readonly service: EventosService) {}

  @Get()
  listar(@Query('tipo') tipo?: string) {
    return this.service.listarPublicos({ tipo });
  }

  @Get(':id')
  detalhe(@Param('id') id: string) {
    return this.service.buscarPublico(id);
  }

  @Post(':id/inscrever')
  inscrever(
    @Param('id') id: string,
    @Body() dto: InscreverDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.inscrever(id, dto, user?.sub);
  }
}

/**
 * Área do cidadão autenticado: suas inscrições e download de certificados.
 * RBAC exige login (RolesGuard barra anônimos); CIDADAO é o papel-base do portal.
 */
@Controller('eventos')
@UseGuards(RolesGuard)
@Roles(Role.CIDADAO)
export class EventosCidadaoController {
  constructor(private readonly service: EventosService) {}

  @Get('minhas-inscricoes')
  minhasInscricoes(@CurrentUser() user?: AuthUser) {
    if (!user?.sub) throw new ForbiddenException('Não autenticado.');
    return this.service.minhasInscricoes(user.sub);
  }

  @Get('certificados/:id/download')
  baixarCertificado(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    if (!user?.sub) throw new ForbiddenException('Não autenticado.');
    return this.service.certificadoParaDownload(id, user.sub);
  }
}

/** Gestão admin do módulo Eventos. RBAC: GESTOR, ADMIN_PREFEITURA. */
@Controller('admin/eventos')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA)
export class EventosAdminController {
  constructor(private readonly service: EventosService) {}

  // eventos
  @Get()
  listar(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listarAdmin({
      page: Math.max(1, Number(page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize ?? 20))),
    });
  }
  @Get(':id')
  buscar(@Param('id') id: string) {
    return this.service.buscar(id);
  }
  @Post()
  criar(@Body() dto: CriarEventoDto, @CurrentUser() user?: AuthUser) {
    return this.service.criar(dto, user?.sub);
  }
  @Put(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarEventoDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizar(id, dto, user?.sub);
  }
  @Delete(':id')
  excluir(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluir(id, user?.sub);
  }

  // inscrições / presença
  @Get(':id/inscricoes')
  inscricoes(@Param('id') id: string) {
    return this.service.listarInscricoes(id);
  }
  @Patch('inscricoes/:inscricaoId')
  atualizarInscricao(
    @Param('inscricaoId') inscricaoId: string,
    @Body() dto: AtualizarInscricaoDto,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.service.atualizarInscricao(inscricaoId, dto, user?.sub);
  }

  // certificados
  @Post('inscricoes/:inscricaoId/certificado')
  emitirCertificado(@Param('inscricaoId') inscricaoId: string, @CurrentUser() user?: AuthUser) {
    return this.service.emitirCertificado(inscricaoId, user?.sub);
  }
  @Post(':id/certificados')
  emitirCertificadosEvento(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.emitirCertificadosEvento(id, user?.sub);
  }
}
