import { Module } from '@nestjs/common';
import { LegislativoPublicController, LegislativoAdminController } from './legislativo.controller';
import { LegislativoService } from './legislativo.service';

/**
 * L3 Legislativo — Proposições (projetos de lei), tramitação (FSM append-only),
 * votação nominal, emendas e leis sancionadas. Leitura pública; gestão via
 * admin (RBAC + RLS). Ver specs/legislativo-tramitacao.md.
 */
@Module({
  controllers: [LegislativoPublicController, LegislativoAdminController],
  providers: [LegislativoService],
  exports: [LegislativoService],
})
export class LegislativoModule {}
