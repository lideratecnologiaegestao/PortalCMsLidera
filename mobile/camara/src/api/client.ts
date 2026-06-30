import { API_PREFIX, API_URL } from './config';
import { tokenStore } from './token-store';

/**
 * Cliente HTTP único do app (fetch nativo, sem dependências externas).
 *
 * Responsabilidades:
 *  - montar a URL a partir da base configurável (EXPO_PUBLIC_API_URL);
 *  - injetar o bearer token (interceptor de saída) lendo do armazenamento seguro;
 *  - padronizar o tratamento de erros do backend NestJS;
 *  - sinalizar falta de rede (offline) de forma distinta de erro HTTP.
 *
 * Regra de fronteira de camadas: o app fala SOMENTE com a API. Nenhum acesso a
 * banco, storage ou filas — tudo passa por aqui.
 */

/** Falha de rede (sem internet/DNS/TLS): o fetch rejeita ANTES de uma resposta HTTP. */
export class SemRedeError extends Error {
  constructor(mensagem = 'Sem conexão com a internet.') {
    super(mensagem);
    this.name = 'SemRedeError';
  }
}

/** Erro HTTP com status e mensagem extraída do corpo do backend. */
export class ApiError extends Error {
  readonly status: number;
  readonly corpo: unknown;
  constructor(status: number, mensagem: string, corpo?: unknown) {
    super(mensagem);
    this.name = 'ApiError';
    this.status = status;
    this.corpo = corpo;
  }
  get naoAutorizado(): boolean {
    return this.status === 401;
  }
  get naoEncontrado(): boolean {
    return this.status === 404;
  }
}

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface OpcoesRequisicao {
  metodo?: Metodo;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Quando true, NÃO injeta o bearer (rotas públicas que nunca precisam dele). */
  semAuth?: boolean;
  /** Body multipart (FormData); o cliente não força Content-Type nesse caso. */
  form?: FormData;
  /** Bearer explícito (ex.: logo após login, antes de persistir). */
  tokenExplicito?: string | null;
  signal?: AbortSignal;
}

function montarUrl(
  path: string,
  query?: OpcoesRequisicao['query'],
): string {
  const base = `${API_URL}${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

/** Extrai a mensagem amigável do padrão de erro do NestJS. */
function mensagemDeErro(corpo: unknown, status: number): string {
  if (corpo && typeof corpo === 'object') {
    const m = (corpo as Record<string, unknown>).message;
    if (Array.isArray(m)) return m.map(String).join('; ');
    if (typeof m === 'string') return m;
    const e = (corpo as Record<string, unknown>).error;
    if (typeof e === 'string') return e;
  }
  return `Erro ${status}.`;
}

async function executar<T>(path: string, opts: OpcoesRequisicao = {}): Promise<T> {
  const url = montarUrl(path, opts.query);
  const headers: Record<string, string> = { Accept: 'application/json' };

  // Interceptor de bearer: token explícito > token salvo (a menos que semAuth).
  if (!opts.semAuth) {
    const token =
      opts.tokenExplicito !== undefined
        ? opts.tokenExplicito
        : await tokenStore.lerToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let bodyInit: BodyInit | undefined;
  if (opts.form) {
    bodyInit = opts.form; // fetch define o boundary do multipart automaticamente
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.metodo ?? 'GET',
      headers,
      body: bodyInit,
      signal: opts.signal,
    });
  } catch (e) {
    // fetch só rejeita por falha de REDE — nunca por status HTTP 4xx/5xx.
    throw new SemRedeError(e instanceof Error ? e.message : undefined);
  }

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  let dados: unknown = undefined;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = texto; // resposta não-JSON (ex.: HTML de erro de proxy)
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, mensagemDeErro(dados, res.status), dados);
  }
  return dados as T;
}

export const api = {
  get: <T>(path: string, opts: Omit<OpcoesRequisicao, 'metodo' | 'body' | 'form'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'GET' }),

  post: <T>(path: string, body?: unknown, opts: Omit<OpcoesRequisicao, 'metodo' | 'body'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'POST', body }),

  put: <T>(path: string, body?: unknown, opts: Omit<OpcoesRequisicao, 'metodo' | 'body'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, opts: Omit<OpcoesRequisicao, 'metodo' | 'body'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'PATCH', body }),

  delete: <T>(path: string, opts: Omit<OpcoesRequisicao, 'metodo' | 'body'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'DELETE' }),

  /** Envio multipart (uploads via API; o backend grava no storage). */
  postForm: <T>(path: string, form: FormData, opts: Omit<OpcoesRequisicao, 'metodo' | 'form' | 'body'> = {}) =>
    executar<T>(path, { ...opts, metodo: 'POST', form }),
};
