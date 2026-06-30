import { api } from './client';
import type { SessaoDetalhe, SessaoResumo, TvCamara } from './types';

/** GET /api/sessoes — agenda/histórico de sessões plenárias. */
export function listarSessoes(filtros: {
  tipo?: string;
  status?: string;
  de?: string;
  ate?: string;
} = {}): Promise<SessaoResumo[]> {
  return api.get<SessaoResumo[]>('/sessoes', { query: filtros, semAuth: true });
}

/** GET /api/sessoes/:id — detalhe (pauta, presenças, gravações, ata se publicada). */
export function obterSessao(id: string): Promise<SessaoDetalhe> {
  return api.get<SessaoDetalhe>(`/sessoes/${encodeURIComponent(id)}`, { semAuth: true });
}

/** GET /api/tv-camara — ao vivo / próxima / última / acervo de gravações. */
export function obterTvCamara(): Promise<TvCamara> {
  return api.get<TvCamara>('/tv-camara', { semAuth: true });
}
