/**
 * Feature flags por tipo de entidade (câmara × prefeitura) — PARTE PURA.
 *
 * A plataforma nasceu como portal de PREFEITURA (poder executivo) e foi forkada
 * para servir CÂMARAS (poder legislativo). Cada tenant declara `tenant.tipo`
 * ('camara' | 'prefeitura') e um mapa `tenant.funcionalidades` (jsonb) que
 * liga/desliga módulos no menu, no admin e na navegação pública.
 *
 * Este arquivo é CLIENT-SAFE (sem `next/headers`): pode ser importado tanto por
 * Server quanto por Client Components. A busca server-side via API vive em
 * `funcionalidades.server.ts` (importa next/headers).
 *
 * Fonte da verdade no banco: db/101_camara_tenant_tipo_funcionalidades.sql.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type TipoEntidade = 'camara' | 'prefeitura';

/**
 * Chaves de módulo reconhecidas: módulos do executivo a OCULTAR em câmaras e
 * módulos legislativos a MOSTRAR. Em sincronia com a migration 101 e a seção 2.3
 * do PLANEJAMENTO.md.
 */
export type Modulo =
  // Executivo (ocultar em câmara)
  | 'chamados' // zeladoria georreferenciada (denúncias do app)
  | 'prefeito' // Prefeito/Prefeita, primeira-dama, vice
  // Legislativo (mostrar em câmara)
  | 'parlamentar' // vereadores / mesa diretora / comissões
  | 'sessoes' // sessões plenárias / TV Câmara
  | 'legislativo' // projetos de lei / tramitação / leis
  | 'escola' // Escola Legislativa (cursos, certificados)
  | 'pss' // processo seletivo simplificado
  | 'eventos'; // eventos / audiências públicas

/** Mapa de flags vindo de `tenant.funcionalidades` (jsonb). */
export type FuncionalidadesMap = Partial<Record<string, boolean>>;

export interface Funcionalidades {
  tipo: TipoEntidade;
  ehCamara: boolean;
  ehPrefeitura: boolean;
  /** Resolve um módulo: flag explícito → default por tipo. */
  modulo: (m: Modulo) => boolean;
  /** Mapa cru de flags (para casos avançados). */
  flags: FuncionalidadesMap;
}

// ─── Defaults por tipo de entidade ──────────────────────────────────────────
// Quando `funcionalidades` não trouxer a chave, vale o default abaixo.

const DEFAULTS: Record<TipoEntidade, Record<Modulo, boolean>> = {
  camara: {
    chamados: false, // executivo — oculto
    prefeito: false, // executivo — oculto (Mesa Diretora ocupa o lugar)
    parlamentar: true,
    sessoes: true,
    legislativo: true,
    escola: true,
    pss: true,
    eventos: true,
  },
  prefeitura: {
    chamados: true, // zeladoria — típica do executivo
    prefeito: true,
    parlamentar: false, // câmara não faz parte do executivo
    sessoes: false,
    legislativo: false,
    escola: false,
    pss: false,
    eventos: false,
  },
};

/** Aliases entre a chave de navegação e a chave persistida na migration 101. */
const ALIASES: Partial<Record<Modulo, string[]>> = {
  escola: ['escola', 'escola_legislativa'],
};

// ─── Resolução pura (client-safe) ───────────────────────────────────────────

/**
 * Resolve as funcionalidades a partir do tipo + mapa de flags. Pode ser usado
 * em Client Components recebendo os dados via props. Default da plataforma é
 * 'camara' (migration 101: DEFAULT 'camara').
 */
export function resolverFuncionalidades(
  tipo: string | null | undefined,
  flags: FuncionalidadesMap | null | undefined,
): Funcionalidades {
  const t: TipoEntidade = tipo === 'prefeitura' ? 'prefeitura' : 'camara';
  const mapa: FuncionalidadesMap = flags ?? {};

  const modulo = (m: Modulo): boolean => {
    const chaves = ALIASES[m] ?? [m];
    for (const chave of chaves) {
      const v = mapa[chave];
      if (typeof v === 'boolean') return v;
    }
    return DEFAULTS[t][m];
  };

  return {
    tipo: t,
    ehCamara: t === 'camara',
    ehPrefeitura: t === 'prefeitura',
    modulo,
    flags: mapa,
  };
}
