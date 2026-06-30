// =====================================================================
// Funções de transformação reutilizáveis (origem MySQL -> destino PG).
// =====================================================================

// Date/Datetime -> ISO timestamptz (string) ou null.
export function toTs(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// Date -> 'YYYY-MM-DD' ou null (para colunas `date`).
export function toDate(v) {
  const ts = toTs(v);
  return ts ? ts.slice(0, 10) : null;
}

// Combina data (date) + hora (time string 'HH:MM:SS') do legado em timestamptz.
// Usado em sessões: a origem guarda data_sessao + hora_inicio separados.
export function combineDateTime(dateVal, timeVal) {
  const d = toDate(dateVal);
  if (!d) return null;
  const t = (timeVal && String(timeVal).trim()) || '00:00:00';
  const iso = `${d}T${/^\d{2}:\d{2}/.test(t) ? t : '00:00:00'}`;
  const dt = new Date(iso);
  return Number.isNaN(dt.getTime()) ? `${d}T00:00:00.000Z` : dt.toISOString();
}

// Bool tolerante (0/1, '0'/'1', true/false, 'true'/'false', null).
export function toBool(v, def = false) {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'boolean') return v;
  return ['1', 'true', 't', 'yes', 'sim'].includes(String(v).toLowerCase());
}

export function toInt(v, def = null) {
  if (v === null || v === undefined || v === '') return def;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export function toNum(v, def = null) {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

// String trim -> null quando vazia.
export function s(v) {
  if (v === null || v === undefined) return null;
  const str = String(v).trim();
  return str === '' ? null : str;
}

// Parse de coluna JSON do MySQL (pode vir string ou já objeto/array via driver).
export function jsonOf(v, def = null) {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(v);
  } catch {
    return def;
  }
}

// Só dígitos (CPF/CNPJ/telefone). Retorna null se vazio.
export function digits(v) {
  if (v === null || v === undefined) return null;
  const d = String(v).replace(/\D+/g, '');
  return d === '' ? null : d;
}

// CPF -> exatamente 11 dígitos ou null (descarta lixo/parciais).
export function cpf11(v) {
  const d = digits(v);
  return d && d.length === 11 ? d : null;
}

// Slug ASCII a partir de texto (fallback quando a origem não tem slug).
export function slugify(text) {
  const base = s(text);
  if (!base) return null;
  return base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || null;
}

// Mapeia valor de enum via dicionário; loga e cai no fallback se desconhecido.
export function mapEnum(value, dict, fallback, ctx = '') {
  const key = s(value);
  if (key === null) return fallback;
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
  // eslint-disable-next-line no-console
  console.error(`[map] valor de enum desconhecido ${ctx}: "${key}" -> usando "${fallback}"`);
  return fallback;
}

// Garante que `slug` seja único dentro do conjunto já visto nesta carga,
// sufixando com o id legado em caso de colisão (preserva determinismo).
export function uniqueSlug(slug, legacyId, seen) {
  let base = slug || `item-${legacyId}`;
  if (!seen.has(base)) {
    seen.add(base);
    return base;
  }
  const withId = `${base}-${legacyId}`;
  seen.add(withId);
  return withId;
}
