import { api } from './client';
import type { LeiResumo, ProposicaoDetalhe, ProposicaoResumo, Votacao } from './types';

/** GET /api/proposicoes — projetos de lei e demais proposições publicadas. */
export function listarProposicoes(filtros: {
  tipo?: string;
  ano?: string;
  autor?: string;
  status?: string;
} = {}): Promise<ProposicaoResumo[]> {
  return api.get<ProposicaoResumo[]>('/proposicoes', { query: filtros, semAuth: true });
}

/** GET /api/proposicoes/:id — detalhe (autores, tramitação, votações, emendas). */
export function obterProposicao(id: string): Promise<ProposicaoDetalhe> {
  return api.get<ProposicaoDetalhe>(`/proposicoes/${encodeURIComponent(id)}`, { semAuth: true });
}

/** GET /api/proposicoes/:id/votacao — votação nominal. */
export function obterVotacao(id: string): Promise<Votacao[]> {
  return api.get<Votacao[]>(`/proposicoes/${encodeURIComponent(id)}/votacao`, { semAuth: true });
}

/** GET /api/leis — leis sancionadas/publicadas. */
export function listarLeis(filtros: {
  tipo?: string;
  ano?: string;
  vigente?: string;
} = {}): Promise<LeiResumo[]> {
  return api.get<LeiResumo[]>('/leis', { query: filtros, semAuth: true });
}

/** GET /api/leis/:id — detalhe de uma lei. */
export function obterLei(id: string): Promise<LeiResumo & { textoHtml?: string | null }> {
  return api.get(`/leis/${encodeURIComponent(id)}`, { semAuth: true });
}
