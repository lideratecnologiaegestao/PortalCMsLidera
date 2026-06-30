import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { SessoesService } from './sessoes.service';
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

/** Leitura pública: sessões plenárias, detalhe e TV Câmara. */
@Controller()
export class SessoesPublicController {
  constructor(private readonly service: SessoesService) {}

  @Get('sessoes')
  listar(
    @Query('tipo') tipo?: string,
    @Query('status') status?: string,
    @Query('de') de?: string,
    @Query('ate') ate?: string,
  ) {
    return this.service.listarPublico({ tipo, status, de, ate });
  }

  @Get('tv-camara')
  tvCamara() {
    return this.service.tvCamara();
  }

  @Get('sessoes/:id')
  detalhe(@Param('id') id: string) {
    return this.service.buscarPublico(id);
  }
}

/** Gestão admin do módulo Sessões. RBAC: GESTOR, ADMIN_PREFEITURA. */
@Controller('admin/sessoes')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA)
export class SessoesAdminController {
  constructor(private readonly service: SessoesService) {}

  // tipos de sessão
  @Get('tipos')
  listarTipos() {
    return this.service.listarTipos();
  }
  @Post('tipos')
  criarTipo(@Body() dto: CriarTipoSessaoDto) {
    return this.service.criarTipo(dto);
  }
  @Put('tipos/:id')
  atualizarTipo(@Param('id') id: string, @Body() dto: AtualizarTipoSessaoDto) {
    return this.service.atualizarTipo(id, dto);
  }
  @Delete('tipos/:id')
  excluirTipo(@Param('id') id: string) {
    return this.service.excluirTipo(id);
  }

  // sessões (CRUD)
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
  criar(@Body() dto: CriarSessaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.criar(dto, user?.sub);
  }
  @Put(':id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarSessaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizar(id, dto, user?.sub);
  }
  @Delete(':id')
  excluir(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluir(id, user?.sub);
  }

  // pauta
  @Post(':id/pauta')
  addPauta(@Param('id') id: string, @Body() dto: PautaItemDto) {
    return this.service.addPautaItem(id, dto);
  }
  @Put('pauta/:itemId')
  atualizarPauta(@Param('itemId') itemId: string, @Body() dto: AtualizarPautaItemDto) {
    return this.service.atualizarPautaItem(itemId, dto);
  }
  @Delete('pauta/:itemId')
  delPauta(@Param('itemId') itemId: string) {
    return this.service.excluirPautaItem(itemId);
  }

  // presença
  @Post(':id/presencas')
  presencas(@Param('id') id: string, @Body() dto: RegistrarPresencasDto, @CurrentUser() user?: AuthUser) {
    return this.service.registrarPresencas(id, dto, user?.sub);
  }
  @Delete('presencas/:presencaId')
  delPresenca(@Param('presencaId') presencaId: string) {
    return this.service.excluirPresenca(presencaId);
  }

  // ata
  @Put(':id/ata')
  ata(@Param('id') id: string, @Body() dto: PublicarAtaDto, @CurrentUser() user?: AuthUser) {
    return this.service.gerirAta(id, dto, user?.sub);
  }

  // gravações
  @Post(':id/gravacoes')
  addGravacao(@Param('id') id: string, @Body() dto: GravacaoDto) {
    return this.service.addGravacao(id, dto);
  }
  @Delete('gravacoes/:gravacaoId')
  delGravacao(@Param('gravacaoId') gravacaoId: string) {
    return this.service.excluirGravacao(gravacaoId);
  }
}
