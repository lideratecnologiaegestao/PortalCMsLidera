import { Module } from '@nestjs/common';
import {
  EventosAdminController,
  EventosCidadaoController,
  EventosPublicController,
} from './eventos.controller';
import { EventosService } from './eventos.service';

/**
 * L6 Eventos & Audiências Públicas — agenda, inscrições, presença e
 * certificados de participação. Leitura pública; área do cidadão (auth) para
 * minhas inscrições/certificados; gestão via admin (RBAC + RLS).
 * Ver specs/eventos.md.
 *
 * Ordem dos controllers: o de cidadão vem ANTES do público para que as rotas
 * estáticas (/eventos/minhas-inscricoes, /eventos/certificados/:id/download)
 * sejam casadas antes do parâmetro genérico /eventos/:id.
 */
@Module({
  controllers: [EventosCidadaoController, EventosPublicController, EventosAdminController],
  providers: [EventosService],
  exports: [EventosService],
})
export class EventosModule {}
