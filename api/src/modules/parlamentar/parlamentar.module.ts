import { Module } from '@nestjs/common';
import { ParlamentarPublicController, ParlamentarAdminController } from './parlamentar.controller';
import { ParlamentarService } from './parlamentar.service';

/**
 * L1 Parlamentar — Vereadores, Mesa Diretora, Comissões, posts e representações.
 * Leitura pública; gestão via admin (RBAC + RLS). Ver specs/parlamentar.md.
 */
@Module({
  controllers: [ParlamentarPublicController, ParlamentarAdminController],
  providers: [ParlamentarService],
  exports: [ParlamentarService],
})
export class ParlamentarModule {}
