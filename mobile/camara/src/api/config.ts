import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string>;

/**
 * Base URL da API NestJS.
 *
 * Precedência:
 *   1. EXPO_PUBLIC_API_URL (env de build/dev — sobrescreve tudo)
 *   2. app.json > expo.extra.apiUrl (white-label por câmara — "baked" no build)
 *   3. fallback de desenvolvimento
 *
 * O backend resolve o TENANT (câmara) pelo Host da requisição, então a base é o
 * próprio domínio da câmara. O app NUNCA acessa banco/storage/filas — apenas a API.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  extra.apiUrl ??
  'https://camara-exemplo.lidera.app.br';

/** Slug informativo do tenant (o isolamento real é pelo Host na API). */
export const TENANT_SLUG =
  process.env.EXPO_PUBLIC_TENANT_SLUG ?? extra.tenantSlug ?? 'camara-exemplo';

/** Prefixo de todas as rotas REST do backend. */
export const API_PREFIX = '/api';
