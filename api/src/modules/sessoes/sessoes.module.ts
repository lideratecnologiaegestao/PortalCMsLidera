import { Module } from '@nestjs/common';
import { SessoesPublicController, SessoesAdminController } from './sessoes.controller';
import { SessoesService } from './sessoes.service';

/**
 * L2 Sessões Plenárias — agenda, tipos, pauta, ata, presença, gravações e
 * TV Câmara. Leitura pública; gestão via admin (RBAC + RLS).
 * Ver specs/sessoes-plenarias.md.
 */
@Module({
  controllers: [SessoesPublicController, SessoesAdminController],
  providers: [SessoesService],
  exports: [SessoesService],
})
export class SessoesModule {}
