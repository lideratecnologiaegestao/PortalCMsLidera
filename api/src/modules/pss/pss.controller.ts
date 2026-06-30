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
import { PssService } from './pss.service';
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

/**
 * Leitura pública do PSS: lista de editais, detalhe e ranking publicado.
 * Inscrição do cidadão exige autenticação (JwtAuthGuard soft global popula
 * req.user; o service rejeita anônimos).
 */
@Controller('pss')
export class PssPublicController {
  constructor(private readonly service: PssService) {}

  @Get('editais')
  listar() {
    return this.service.listarPublicos();
  }

  @Get('minhas-inscricoes')
  minhas(@CurrentUser() user?: AuthUser) {
    return this.service.minhasInscricoes(user?.sub);
  }

  @Get('editais/:id')
  detalhe(@Param('id') id: string) {
    return this.service.detalhePublico(id);
  }

  @Get('editais/:id/ranking')
  ranking(@Param('id') id: string) {
    return this.service.rankingPublico(id);
  }

  @Post('editais/:id/inscrever')
  inscrever(@Param('id') id: string, @Body() dto: InscreverDto, @CurrentUser() user?: AuthUser) {
    return this.service.inscrever(id, dto, user?.sub);
  }
}

/**
 * Gestão admin/comissão do PSS. RBAC: GESTOR, ADMIN_PREFEITURA, SERVIDOR
 * (membro da comissão lança notas). RLS automático por tenant.
 */
@Controller('admin/pss')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA, Role.SERVIDOR)
export class PssAdminController {
  constructor(private readonly service: PssService) {}

  // ── editais ──────────────────────────────────────────────────────────
  @Get('editais')
  listar(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listarAdmin({
      page: Math.max(1, Number(page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize ?? 20))),
    });
  }
  @Get('editais/:id')
  buscar(@Param('id') id: string) {
    return this.service.buscarEdital(id);
  }
  @Post('editais')
  criar(@Body() dto: CriarEditalDto, @CurrentUser() user?: AuthUser) {
    return this.service.criarEdital(dto, user?.sub);
  }
  @Put('editais/:id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarEditalDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizarEdital(id, dto, user?.sub);
  }
  @Delete('editais/:id')
  excluir(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluirEdital(id, user?.sub);
  }

  // ── vagas ────────────────────────────────────────────────────────────
  @Post('editais/:id/vagas')
  addVaga(@Param('id') id: string, @Body() dto: VagaDto) {
    return this.service.addVaga(id, dto);
  }
  @Delete('vagas/:vid')
  delVaga(@Param('vid') vid: string) {
    return this.service.excluirVaga(vid);
  }

  // ── fases ────────────────────────────────────────────────────────────
  @Post('editais/:id/fases')
  addFase(@Param('id') id: string, @Body() dto: FaseDto) {
    return this.service.addFase(id, dto);
  }
  @Delete('fases/:fid')
  delFase(@Param('fid') fid: string) {
    return this.service.excluirFase(fid);
  }

  // ── critérios ────────────────────────────────────────────────────────
  @Post('fases/:fid/criterios')
  addCriterio(@Param('fid') fid: string, @Body() dto: CriterioDto) {
    return this.service.addCriterio(fid, dto);
  }
  @Delete('criterios/:cid')
  delCriterio(@Param('cid') cid: string) {
    return this.service.excluirCriterio(cid);
  }

  // ── anexos ───────────────────────────────────────────────────────────
  @Post('editais/:id/anexos')
  addAnexo(@Param('id') id: string, @Body() dto: AnexoEditalDto) {
    return this.service.addAnexoEdital(id, dto);
  }
  @Delete('anexos/:aid')
  delAnexo(@Param('aid') aid: string) {
    return this.service.excluirAnexo(aid);
  }

  // ── inscrições (gestão/comissão) ─────────────────────────────────────
  @Get('editais/:id/inscricoes')
  inscricoes(@Param('id') id: string, @Query('status') status?: string) {
    return this.service.listarInscricoes(id, status);
  }
  @Put('inscricoes/:iid')
  atualizarInscricao(@Param('iid') iid: string, @Body() dto: AtualizarInscricaoDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizarInscricao(iid, dto, user?.sub);
  }

  // ── notas (comissão) ─────────────────────────────────────────────────
  @Post('notas')
  lancarNota(@Body() dto: LancarNotaDto, @CurrentUser() user?: AuthUser) {
    return this.service.lancarNota(dto, user?.sub);
  }

  // ── ranking ──────────────────────────────────────────────────────────
  @Get('editais/:id/ranking/previa')
  previaRanking(@Param('id') id: string) {
    return this.service.calcularRanking(id, false);
  }
  @Post('editais/:id/ranking/publicar')
  publicarRanking(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.publicarRanking(id, user?.sub);
  }

  // ── APLIC ────────────────────────────────────────────────────────────
  @Post('editais/:id/aplic/aberturas')
  addAbertura(@Param('id') id: string, @Body() dto: AberturaRetificacaoDto) {
    return this.service.addAbertura(id, dto);
  }
  @Delete('aplic/aberturas/:bid')
  delAbertura(@Param('bid') bid: string) {
    return this.service.excluirAbertura(bid);
  }
  @Post('editais/:id/aplic/comissao')
  addComissao(@Param('id') id: string, @Body() dto: ComissaoMembroDto) {
    return this.service.addComissaoMembro(id, dto);
  }
  @Delete('aplic/comissao/:mid')
  delComissao(@Param('mid') mid: string) {
    return this.service.excluirComissaoMembro(mid);
  }
  @Post('editais/:id/aplic/tabela-salarial')
  addTabela(@Param('id') id: string, @Body() dto: TabelaSalarialDto) {
    return this.service.addTabelaSalarial(id, dto);
  }
  @Delete('aplic/tabela-salarial/:tid')
  delTabela(@Param('tid') tid: string) {
    return this.service.excluirTabelaSalarial(tid);
  }
  @Get('editais/:id/aplic/export')
  exportAplic(@Param('id') id: string) {
    return this.service.exportarAplic(id);
  }
}
