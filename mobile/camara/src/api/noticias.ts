import { api } from './client';
import { SemRedeError } from './client';
import type { NoticiaDetalhe, NoticiaResumo, Paginado } from './types';

/**
 * GET /api/noticias — lista paginada ({ items, total, page, pageSize }).
 * Tolerante a offline/erro: devolve lista vazia para a home não quebrar.
 */
export async function listarNoticias(opts: {
  page?: number;
  pageSize?: number;
  categoria?: string;
  q?: string;
} = {}): Promise<NoticiaResumo[]> {
  try {
    const data = await api.get<Paginado<NoticiaResumo> | NoticiaResumo[]>('/noticias', {
      query: {
        page: opts.page ?? 1,
        pageSize: opts.pageSize ?? 12,
        categoria: opts.categoria,
        q: opts.q,
      },
      semAuth: true,
    });
    if (Array.isArray(data)) return data;
    return data.items ?? [];
  } catch (e) {
    if (e instanceof SemRedeError) throw e;
    return [];
  }
}

/** GET /api/noticias/:slug — detalhe da notícia. */
export function obterNoticia(slug: string): Promise<NoticiaDetalhe> {
  return api.get<NoticiaDetalhe>(`/noticias/${encodeURIComponent(slug)}`, { semAuth: true });
}
