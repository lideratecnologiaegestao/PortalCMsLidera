import { api } from './client';
import type {
  Canal,
  ManifestacaoDetalhe,
  MinhaManifestacao,
  RegistroManifestacaoResposta,
} from './types';

/** Entrada para abrir uma manifestação (Ouvidoria) ou pedido (e-SIC). */
export interface NovaManifestacao {
  canal: Canal;
  tipo: string;
  assunto: string;
  descricao: string;
  /** Anonimato só é permitido na Ouvidoria; e-SIC exige identificação (LAI). */
  anonima?: boolean;
  solicitanteNome?: string;
  solicitanteEmail?: string;
}

/**
 * POST /api/manifestacoes — registra a manifestação.
 * O cidadaoId vem do token no backend (nunca do body). Retorna o protocolo e a
 * CHAVE de acompanhamento (mostrada uma única vez ao cidadão).
 */
export function registrarManifestacao(
  input: NovaManifestacao,
): Promise<RegistroManifestacaoResposta> {
  return api.post<RegistroManifestacaoResposta>('/manifestacoes', input);
}

/**
 * GET /api/manifestacoes/acompanhar — consulta por protocolo (+ chave para
 * anônimas / não-dono). Se logado, o bearer é injetado automaticamente.
 */
export function acompanharManifestacao(
  protocolo: string,
  chave?: string,
): Promise<ManifestacaoDetalhe> {
  return api.get<ManifestacaoDetalhe>('/manifestacoes/acompanhar', {
    query: { protocolo, chave },
  });
}

/** POST /api/manifestacoes/acompanhar/mensagem — cidadão complementa a tramitação. */
export function responderManifestacao(
  protocolo: string,
  conteudo: string,
  chave?: string,
): Promise<ManifestacaoDetalhe> {
  return api.post<ManifestacaoDetalhe>('/manifestacoes/acompanhar/mensagem', {
    protocolo,
    chave,
    conteudo,
  });
}

/** POST /api/manifestacoes/acompanhar/anexo — anexa um arquivo (multipart, via API). */
export function anexarManifestacao(
  protocolo: string,
  arquivo: { uri: string; name: string; type: string },
  chave?: string,
): Promise<ManifestacaoDetalhe> {
  const form = new FormData();
  form.append('protocolo', protocolo);
  if (chave) form.append('chave', chave);
  // O React Native aceita { uri, name, type } como parte de arquivo do FormData.
  form.append('file', arquivo as unknown as Blob);
  return api.postForm<ManifestacaoDetalhe>('/manifestacoes/acompanhar/anexo', form);
}

/** GET /api/manifestacoes/minhas — painel do cidadão logado (requer bearer). */
export function minhasManifestacoes(canal?: Canal): Promise<MinhaManifestacao[]> {
  return api.get<MinhaManifestacao[]>('/manifestacoes/minhas', { query: { canal } });
}

/** POST /api/manifestacoes/recuperar-protocolos — envia protocolos ao e-mail do titular. */
export function recuperarProtocolos(email: string): Promise<{ enviado: boolean }> {
  return api.post('/manifestacoes/recuperar-protocolos', { email }, { semAuth: true });
}
