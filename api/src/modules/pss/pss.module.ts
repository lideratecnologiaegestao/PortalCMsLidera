import { Module } from '@nestjs/common';
import { PssPublicController, PssAdminController } from './pss.controller';
import { PssService } from './pss.service';

/**
 * L5 PSS — Processo Seletivo Simplificado (câmara).
 * Editais, vagas, fases, critérios, inscrição do cidadão, notas e ranking
 * com desempate determinístico; integração APLIC (TCE-MT).
 * Leitura pública; gestão via admin/comissão (RBAC + RLS). Ver specs/pss.md.
 */
@Module({
  controllers: [PssPublicController, PssAdminController],
  providers: [PssService],
  exports: [PssService],
})
export class PssModule {}
