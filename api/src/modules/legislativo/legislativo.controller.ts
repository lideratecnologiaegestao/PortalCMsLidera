import {
  Body,
  Controller,
  Delete,
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
import { LegislativoService } from './legislativo.service';
import {
  AtualizarLeiDto,
  AtualizarProposicaoDto,
  CriarLeiDto,
  CriarProposicaoDto,
  EmendaDto,
  RegistrarVotacaoDto,
  TramitarDto,
} from './legislativo.dto';

/** Leitura pública: proposições (projetos de lei), votação nominal e leis. */
@Controller()
export class LegislativoPublicController {
  constructor(private readonly service: LegislativoService) {}

  @Get('proposicoes')
  listarProposicoes(
    @Query('tipo') tipo?: string,
    @Query('ano') ano?: string,
    @Query('autor') autor?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listarProposicoes({ tipo, ano, autor, status });
  }

  @Get('proposicoes/:id')
  proposicao(@Param('id') id: string) {
    return this.service.buscarProposicao(id);
  }

  @Get('proposicoes/:id/votacao')
  votacao(@Param('id') id: string) {
    return this.service.votacaoProposicao(id);
  }

  @Get('leis')
  listarLeis(
    @Query('tipo') tipo?: string,
    @Query('ano') ano?: string,
    @Query('vigente') vigente?: string,
  ) {
    return this.service.listarLeis({ tipo, ano, vigente });
  }

  @Get('leis/:id')
  lei(@Param('id') id: string) {
    return this.service.buscarLei(id);
  }
}

/** Gestão admin do módulo Legislativo. RBAC: GESTOR, ADMIN_PREFEITURA. */
@Controller('admin/legislativo')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA)
export class LegislativoAdminController {
  constructor(private readonly service: LegislativoService) {}

  // ── Proposições (CRUD) ──────────────────────────────────────────────────
  @Get('proposicoes')
  listarProposicoes(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listarProposicoesAdmin({
      page: Math.max(1, Number(page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize ?? 20))),
    });
  }
  @Get('proposicoes/:id')
  buscarProposicao(@Param('id') id: string) {
    return this.service.buscarProposicaoAdmin(id);
  }
  @Post('proposicoes')
  criarProposicao(@Body() dto: CriarProposicaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.criarProposicao(dto, user?.sub);
  }
  @Put('proposicoes/:id')
  atualizarProposicao(@Param('id') id: string, @Body() dto: AtualizarProposicaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizarProposicao(id, dto, user?.sub);
  }
  @Delete('proposicoes/:id')
  excluirProposicao(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluirProposicao(id, user?.sub);
  }

  // ── Tramitação (transição append-only) ──────────────────────────────────
  @Post('proposicoes/:id/tramitar')
  tramitar(@Param('id') id: string, @Body() dto: TramitarDto, @CurrentUser() user?: AuthUser) {
    return this.service.tramitar(id, dto, user?.sub);
  }

  // ── Votação nominal (registrar votos) ───────────────────────────────────
  @Post('proposicoes/:id/votacao')
  votacao(@Param('id') id: string, @Body() dto: RegistrarVotacaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.registrarVotacao(id, dto, user?.sub);
  }

  // ── Emendas ─────────────────────────────────────────────────────────────
  @Post('proposicoes/:id/emendas')
  addEmenda(@Param('id') id: string, @Body() dto: EmendaDto) {
    return this.service.addEmenda(id, dto);
  }
  @Delete('emendas/:eid')
  delEmenda(@Param('eid') eid: string) {
    return this.service.excluirEmenda(eid);
  }

  // ── Leis (CRUD) ─────────────────────────────────────────────────────────
  @Get('leis')
  listarLeis(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listarLeisAdmin({
      page: Math.max(1, Number(page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize ?? 20))),
    });
  }
  @Post('leis')
  criarLei(@Body() dto: CriarLeiDto, @CurrentUser() user?: AuthUser) {
    return this.service.criarLei(dto, user?.sub);
  }
  @Patch('leis/:id')
  atualizarLei(@Param('id') id: string, @Body() dto: AtualizarLeiDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizarLei(id, dto, user?.sub);
  }
  @Delete('leis/:id')
  excluirLei(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluirLei(id, user?.sub);
  }
}
