/**
 * Feature flags por tipo de entidade — PARTE SERVER (usa next/headers).
 *
 * Busca tipo/funcionalidades do tenant atual via API (endpoint público de tema)
 * e resolve com o helper puro de `funcionalidades.ts`. Server-only.
 *
 * Fronteira de camadas (CLAUDE.md 2b): o frontend NUNCA acessa o banco. Os dados
 * de tipo/funcionalidades chegam pela API. Enquanto o backend não os expõe no
 * GET /api/theme, este helper degrada com segurança para o default de CÂMARA.
 */
import { headers } from 'next/headers';
import {
  resolverFuncionalidades,
  type Funcionalidades,
  type FuncionalidadesMap,
} from './funcionalidades';

const API = process.env.API_URL ?? 'http://localhost:3001';

interface ThemeConfigResp {
  tipo?: string | null;
  funcionalidades?: FuncionalidadesMap | null;
}

/**
 * Busca tipo/funcionalidades do tenant atual via API (endpoint público de tema).
 * Resolve o tenant pelo Host, com chave de cache única por tenant (`__h=`).
 * Degrada com segurança: em erro/ausência, assume 'camara'.
 */
export async function getFuncionalidades(): Promise<Funcionalidades> {
  const host = headers().get('host') ?? '';
  try {
    const res = await fetch(`${API}/api/theme?__h=${encodeURIComponent(host)}`, {
      headers: { 'x-forwarded-host': host },
      next: { revalidate: 30, tags: [`funcionalidades:${host}`] },
    });
    if (!res.ok) return resolverFuncionalidades('camara', null);
    const data = (await res.json()) as ThemeConfigResp;
    return resolverFuncionalidades(data.tipo ?? null, data.funcionalidades ?? null);
  } catch {
    return resolverFuncionalidades('camara', null);
  }
}
