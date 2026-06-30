import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Armazenamento SEGURO do token de sessão (JWT bearer).
 *
 * Usa expo-secure-store (Keychain no iOS, Keystore/EncryptedSharedPreferences no
 * Android). Em ambiente web (onde SecureStore não existe) cai para um fallback
 * em memória — o app web é apenas para desenvolvimento/preview, não para produção.
 */

const KEY_TOKEN = 'camara.auth.token';
const KEY_USER = 'camara.auth.user';

// Fallback em memória para web (SecureStore indisponível no browser).
const memoria = new Map<string, string>();
const ehWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (ehWeb) {
    memoria.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (ehWeb) return memoria.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function removeItem(key: string): Promise<void> {
  if (ehWeb) {
    memoria.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export interface UsuarioArmazenado {
  id: string;
  nome: string;
  email?: string;
}

export const tokenStore = {
  async salvarSessao(token: string, usuario: UsuarioArmazenado): Promise<void> {
    await Promise.all([
      setItem(KEY_TOKEN, token),
      setItem(KEY_USER, JSON.stringify(usuario)),
    ]);
  },

  async lerToken(): Promise<string | null> {
    return getItem(KEY_TOKEN);
  },

  async lerUsuario(): Promise<UsuarioArmazenado | null> {
    const raw = await getItem(KEY_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UsuarioArmazenado;
    } catch {
      return null;
    }
  },

  async limpar(): Promise<void> {
    await Promise.all([removeItem(KEY_TOKEN), removeItem(KEY_USER)]);
  },
};
