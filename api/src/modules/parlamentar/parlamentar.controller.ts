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
import { ParlamentarService } from './parlamentar.service';
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

/** Leitura pública: vereadores, mesa diretora e comissões. */
@Controller()
export class ParlamentarPublicController {
  constructor(private readonly service: ParlamentarService) {}

  @Get('vereadores')
  listar(
    @Query('status') status?: string,
    @Query('partido') partido?: string,
    @Query('legislatura') legislatura?: string,
  ) {
    return this.service.listarAtivos({ status, partido, legislatura });
  }

  @Get('mesa-diretora')
  mesa(@Query('data') data?: string) {
    return this.service.mesaDiretora(data);
  }

  @Get('comissoes')
  comissoes() {
    return this.service.listarComissoes();
  }

  @Get('comissoes/:slug')
  comissao(@Param('slug') slug: string) {
    return this.service.comissaoPorSlug(slug);
  }

  @Get('vereadores/:slug')
  vereador(@Param('slug') slug: string) {
    return this.service.buscarPorSlug(slug);
  }

  @Get('vereadores/:id/posts')
  posts(@Param('id') id: string) {
    return this.service.listarPosts(id);
  }

  @Get('vereadores/:id/representacoes')
  representacoes(@Param('id') id: string) {
    return this.service.listarRepresentacoes(id);
  }
}

/** Gestão admin do módulo Parlamentar. RBAC: GESTOR, ADMIN_PREFEITURA. */
@Controller('admin/parlamentar')
@UseGuards(RolesGuard)
@Roles(Role.GESTOR, Role.ADMIN_PREFEITURA)
export class ParlamentarAdminController {
  constructor(private readonly service: ParlamentarService) {}

  // vereadores
  @Get('vereadores')
  listar(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.service.listarAdmin({
      page: Math.max(1, Number(page ?? 1)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize ?? 20))),
    });
  }
  @Get('vereadores/:id')
  buscar(@Param('id') id: string) {
    return this.service.buscar(id);
  }
  @Post('vereadores')
  criar(@Body() dto: CriarVereadorDto, @CurrentUser() user?: AuthUser) {
    return this.service.criar(dto, user?.sub);
  }
  @Put('vereadores/:id')
  atualizar(@Param('id') id: string, @Body() dto: AtualizarVereadorDto, @CurrentUser() user?: AuthUser) {
    return this.service.atualizar(id, dto, user?.sub);
  }
  @Delete('vereadores/:id')
  excluir(@Param('id') id: string, @CurrentUser() user?: AuthUser) {
    return this.service.excluir(id, user?.sub);
  }

  // mesa diretora
  @Get('mesa')
  listarMesa() {
    return this.service.listarMesa();
  }
  @Post('mesa')
  addMesa(@Body() dto: CargoMesaDto) {
    return this.service.definirCargoMesa(dto);
  }
  @Delete('mesa/:id')
  delMesa(@Param('id') id: string) {
    return this.service.excluirCargoMesa(id);
  }

  // comissões
  @Post('comissoes')
  criarComissao(@Body() dto: CriarComissaoDto) {
    return this.service.criarComissao(dto);
  }
  @Put('comissoes/:id')
  atualizarComissao(@Param('id') id: string, @Body() dto: AtualizarComissaoDto) {
    return this.service.atualizarComissao(id, dto);
  }
  @Delete('comissoes/:id')
  excluirComissao(@Param('id') id: string) {
    return this.service.excluirComissao(id);
  }
  @Post('comissoes/:id/cargos')
  addCargo(@Param('id') id: string, @Body() dto: CargoComissaoDto) {
    return this.service.addCargoComissao(id, dto);
  }
  @Delete('comissoes/cargos/:cid')
  delCargo(@Param('cid') cid: string) {
    return this.service.excluirCargoComissao(cid);
  }
  @Post('comissoes/:id/documentos')
  addDoc(@Param('id') id: string, @Body() dto: ComissaoDocumentoDto) {
    return this.service.addDocComissao(id, dto);
  }
  @Delete('comissoes/documentos/:did')
  delDoc(@Param('did') did: string) {
    return this.service.excluirDocComissao(did);
  }

  // posts e representações (gestão)
  @Post('vereadores/:id/posts')
  addPost(@Param('id') id: string, @Body() dto: VereadorPostDto) {
    return this.service.criarPost(id, dto);
  }
  @Delete('posts/:pid')
  delPost(@Param('pid') pid: string) {
    return this.service.excluirPost(pid);
  }
  @Post('vereadores/:id/representacoes')
  addRepr(@Param('id') id: string, @Body() dto: RepresentacaoDto) {
    return this.service.criarRepresentacao(id, dto);
  }
  @Delete('representacoes/:rid')
  delRepr(@Param('rid') rid: string) {
    return this.service.excluirRepresentacao(rid);
  }
}
