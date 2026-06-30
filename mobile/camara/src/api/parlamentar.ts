import { api } from './client';
import type {
  Comissao,
  MesaDiretoraItem,
  Representacao,
  VereadorDetalhe,
  VereadorPost,
  VereadorResumo,
} from './types';

/** GET /api/vereadores — lista pública (ordenada: mesa diretora primeiro). */
export function listarVereadores(filtros: {
  status?: string;
  partido?: string;
  legislatura?: string;
} = {}): Promise<VereadorResumo[]> {
  return api.get<VereadorResumo[]>('/vereadores', { query: filtros, semAuth: true });
}

/** GET /api/vereadores/:slug — perfil público completo. */
export function obterVereador(slugOrId: string): Promise<VereadorDetalhe> {
  return api.get<VereadorDetalhe>(`/vereadores/${encodeURIComponent(slugOrId)}`, { semAuth: true });
}

/** GET /api/vereadores/:id/posts — posts/atividades do parlamentar. */
export function listarPostsVereador(id: string): Promise<VereadorPost[]> {
  return api.get<VereadorPost[]>(`/vereadores/${encodeURIComponent(id)}/posts`, { semAuth: true });
}

/** GET /api/vereadores/:id/representacoes. */
export function listarRepresentacoes(id: string): Promise<Representacao[]> {
  return api.get<Representacao[]>(`/vereadores/${encodeURIComponent(id)}/representacoes`, { semAuth: true });
}

/** GET /api/mesa-diretora — composição vigente (ou em `data`). */
export function obterMesaDiretora(data?: string): Promise<MesaDiretoraItem[]> {
  return api.get<MesaDiretoraItem[]>('/mesa-diretora', { query: { data }, semAuth: true });
}

/** GET /api/comissoes — lista de comissões. */
export function listarComissoes(): Promise<Comissao[]> {
  return api.get<Comissao[]>('/comissoes', { semAuth: true });
}

/** GET /api/comissoes/:slug — detalhe de comissão. */
export function obterComissao(slug: string): Promise<Comissao> {
  return api.get<Comissao>(`/comissoes/${encodeURIComponent(slug)}`, { semAuth: true });
}
