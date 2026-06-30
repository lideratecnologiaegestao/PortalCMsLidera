import { api } from './client';

/**
 * Autenticação do CIDADÃO (e-mail + senha), espelhando o backend
 * `POST /api/auth/cidadao/*`. O token (JWT bearer) volta no corpo do login para
 * o app guardar no armazenamento seguro; o gov.br permanece disponível no portal
 * web como opção de login federado.
 */

export interface UsuarioApi {
  id: string;
  nome: string;
  email?: string;
}

export interface RespostaLogin {
  ok: boolean;
  token: string;
  user: UsuarioApi;
}

export interface RespostaCadastro {
  precisaVerificar?: { email: boolean; telefone: boolean };
  emailEnviado?: boolean;
  telefoneEnviado?: boolean;
  [k: string]: unknown;
}

/** POST /api/auth/cidadao/login → { ok, token, user }. */
export function loginCidadao(email: string, senha: string): Promise<RespostaLogin> {
  return api.post<RespostaLogin>('/auth/cidadao/login', { email, senha }, { semAuth: true });
}

/** POST /api/auth/cidadao/cadastro — cria conta (cidadão) e dispara verificação. */
export function cadastrarCidadao(dados: {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
}): Promise<RespostaCadastro> {
  return api.post<RespostaCadastro>('/auth/cidadao/cadastro', dados, { semAuth: true });
}

/** POST /api/auth/cidadao/verificar — confirma o código enviado por e-mail/SMS. */
export function verificarCidadao(
  email: string,
  finalidade: 'email' | 'telefone',
  codigo: string,
): Promise<unknown> {
  return api.post('/auth/cidadao/verificar', { email, finalidade, codigo }, { semAuth: true });
}

/** POST /api/auth/cidadao/reenviar — reenvia o código de verificação. */
export function reenviarVerificacao(
  email: string,
  finalidade: 'email' | 'telefone',
): Promise<unknown> {
  return api.post('/auth/cidadao/reenviar', { email, finalidade }, { semAuth: true });
}

/** POST /api/auth/cidadao/recuperar — inicia recuperação de senha. */
export function recuperarSenha(email: string): Promise<unknown> {
  return api.post('/auth/cidadao/recuperar', { email }, { semAuth: true });
}

/** POST /api/auth/cidadao/redefinir — define nova senha com o código recebido. */
export function redefinirSenha(
  email: string,
  codigo: string,
  novaSenha: string,
): Promise<unknown> {
  return api.post('/auth/cidadao/redefinir', { email, codigo, novaSenha }, { semAuth: true });
}
