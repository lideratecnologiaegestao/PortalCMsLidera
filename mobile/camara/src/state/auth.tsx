import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  cadastrarCidadao,
  loginCidadao,
  recuperarSenha,
  redefinirSenha,
  reenviarVerificacao,
  verificarCidadao,
} from '../api/auth';
import { tokenStore, type UsuarioArmazenado } from '../api/token-store';

/**
 * Estado global de autenticação do cidadão.
 *
 * O token (JWT bearer) é persistido com expo-secure-store (token-store) e
 * injetado automaticamente pelo cliente HTTP. Aqui mantemos apenas o estado
 * reativo (logado/usuário) e as ações de login/cadastro/logout.
 */

interface AuthState {
  token: string | null;
  usuario: UsuarioArmazenado | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  cadastrar: (d: { nome: string; email: string; senha: string; telefone?: string }) => Promise<void>;
  verificar: (email: string, finalidade: 'email' | 'telefone', codigo: string) => Promise<void>;
  reenviar: (email: string, finalidade: 'email' | 'telefone') => Promise<void>;
  recuperar: (email: string) => Promise<void>;
  redefinir: (email: string, codigo: string, novaSenha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth deve ser usado dentro de <AuthProvider>.');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<UsuarioArmazenado | null>(null);
  const [carregando, setCarregando] = useState(true);

  // Restaura a sessão do armazenamento seguro no boot.
  useEffect(() => {
    (async () => {
      const [t, u] = await Promise.all([tokenStore.lerToken(), tokenStore.lerUsuario()]);
      if (t) setToken(t);
      if (u) setUsuario(u);
      setCarregando(false);
    })();
  }, []);

  const entrar = useCallback(async (email: string, senha: string) => {
    const r = await loginCidadao(email, senha);
    const u: UsuarioArmazenado = { id: r.user.id, nome: r.user.nome, email: r.user.email };
    await tokenStore.salvarSessao(r.token, u);
    setToken(r.token);
    setUsuario(u);
  }, []);

  const cadastrar = useCallback(
    async (d: { nome: string; email: string; senha: string; telefone?: string }) => {
      await cadastrarCidadao(d);
      // Cadastro não autentica: o cidadão verifica o e-mail e depois faz login.
    },
    [],
  );

  const verificar = useCallback(
    async (email: string, finalidade: 'email' | 'telefone', codigo: string) => {
      await verificarCidadao(email, finalidade, codigo);
    },
    [],
  );

  const reenviar = useCallback(
    async (email: string, finalidade: 'email' | 'telefone') => {
      await reenviarVerificacao(email, finalidade);
    },
    [],
  );

  const recuperar = useCallback(async (email: string) => {
    await recuperarSenha(email);
  }, []);

  const redefinir = useCallback(
    async (email: string, codigo: string, novaSenha: string) => {
      await redefinirSenha(email, codigo, novaSenha);
    },
    [],
  );

  const sair = useCallback(async () => {
    await tokenStore.limpar();
    setToken(null);
    setUsuario(null);
  }, []);

  const value: AuthState = {
    token,
    usuario,
    carregando,
    entrar,
    cadastrar,
    verificar,
    reenviar,
    recuperar,
    redefinir,
    sair,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
