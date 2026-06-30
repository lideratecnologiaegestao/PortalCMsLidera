import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, SemRedeError } from '../api/client';

/**
 * Tema do app, por câmara (white-label). As cores da marca vêm de GET /api/theme
 * (token primary/secondary do tenant). Há um default legislativo embutido para
 * funcionar offline e antes da API responder. Modo claro/escuro/auto persistido.
 *
 * Contraste mínimo: a cor do texto sobre a primária é escolhida pela luminância
 * (preto ou branco), garantindo legibilidade independente da cor do tenant (WCAG).
 */

export interface Cores {
  primary: string;
  primaryFg: string;
  secondary: string;
  accent: string;
  bg: string;
  card: string;
  fg: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
}

export type ModoTema = 'claro' | 'escuro' | 'auto';

// Marca padrão: azul institucional legislativo + verde (gov.br-like).
const MARCA_PADRAO = {
  primary: '#0B5394',
  secondary: '#1565C0',
  accent: '#168821',
  success: '#168821',
  warning: '#b88c00',
  danger: '#b30000',
};

function corTextoSobre(hex: string): string {
  const limpo = hex.replace('#', '');
  if (limpo.length < 6) return '#ffffff';
  const n = parseInt(limpo.slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? '#1b1b1f' : '#ffffff';
}

function claro(m: typeof MARCA_PADRAO): Cores {
  return {
    ...m,
    primaryFg: corTextoSobre(m.primary),
    bg: '#f4f6f9',
    card: '#ffffff',
    fg: '#15181d',
    muted: '#5a6170',
    border: '#e1e5ea',
  };
}

function escuro(m: typeof MARCA_PADRAO): Cores {
  return {
    ...m,
    primaryFg: corTextoSobre(m.primary),
    bg: '#0e1116',
    card: '#171b22',
    fg: '#e8eaed',
    muted: '#9aa1ac',
    border: '#2a2f38',
  };
}

interface PortalInfo {
  nome: string;
  uf: string;
  logo?: string;
}

interface ThemeState {
  c: Cores;
  modo: ModoTema;
  ehEscuro: boolean;
  setModo: (m: ModoTema) => void;
  portal: PortalInfo;
  carregando: boolean;
}

const Ctx = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTheme deve ser usado dentro de <ThemeProvider>.');
  return t;
}

const KEY_MODO = 'camara.tema.modo';

interface ThemeResp {
  portal?: { nome?: string; uf?: string; logo?: string };
  tokens?: { colors?: Partial<typeof MARCA_PADRAO> };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme();
  const [modo, setModoState] = useState<ModoTema>('auto');
  const [marca, setMarca] = useState(MARCA_PADRAO);
  const [portal, setPortal] = useState<PortalInfo>({ nome: 'Câmara Municipal', uf: '' });
  const [carregando, setCarregando] = useState(true);

  // Preferência de modo salva.
  useEffect(() => {
    AsyncStorage.getItem(KEY_MODO)
      .then((v) => {
        if (v === 'claro' || v === 'escuro' || v === 'auto') setModoState(v);
      })
      .catch(() => undefined);
  }, []);

  // Branding do tenant (cores + nome) via API; offline mantém defaults.
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<ThemeResp>('/theme', { semAuth: true });
        if (data?.portal) {
          setPortal({
            nome: data.portal.nome ?? 'Câmara Municipal',
            uf: data.portal.uf ?? '',
            logo: data.portal.logo,
          });
        }
        const col = data?.tokens?.colors ?? {};
        setMarca((prev) => ({
          primary: col.primary ?? prev.primary,
          secondary: col.secondary ?? prev.secondary,
          accent: col.accent ?? prev.accent,
          success: col.success ?? prev.success,
          warning: col.warning ?? prev.warning,
          danger: col.danger ?? prev.danger,
        }));
      } catch (e) {
        if (!(e instanceof SemRedeError)) {
          // erro não-rede (ex.: 404 do /theme): mantém defaults silenciosamente.
        }
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  const ehEscuro = modo === 'escuro' || (modo === 'auto' && sistema === 'dark');
  const c = useMemo(() => (ehEscuro ? escuro(marca) : claro(marca)), [ehEscuro, marca]);

  const setModo = (m: ModoTema) => {
    setModoState(m);
    AsyncStorage.setItem(KEY_MODO, m).catch(() => undefined);
  };

  const value: ThemeState = { c, modo, ehEscuro, setModo, portal, carregando };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
