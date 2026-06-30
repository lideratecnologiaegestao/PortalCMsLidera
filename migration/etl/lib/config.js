// =====================================================================
// Configuração do ETL a partir de variáveis de ambiente (.env).
// Centraliza parsing/validação para os demais módulos não tocarem em process.env.
// =====================================================================
import 'dotenv/config';

function bool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(String(v).toLowerCase());
}

function int(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

export const config = {
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: int(process.env.MYSQL_PORT, 3306),
    database: process.env.MYSQL_DATABASE || 'portal_camara_old',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    charset: process.env.MYSQL_CHARSET || 'utf8mb4',
    // datas inválidas ("0000-00-00") do MySQL legado viram null em vez de quebrar.
    dateStrings: false,
  },
  pg: {
    // DATABASE_URL tem prioridade sobre os campos avulsos.
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST || '127.0.0.1',
    port: int(process.env.PGPORT, 5432),
    database: process.env.PGDATABASE || 'portal_camara',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '',
    ssl:
      (process.env.PGSSLMODE || 'disable').toLowerCase() === 'require'
        ? { rejectUnauthorized: false }
        : false,
  },
  tenant: {
    slug: process.env.TENANT_SLUG || 'serra-nova-dourada-mt',
    nome: process.env.TENANT_NOME || 'Câmara Municipal de Serra Nova Dourada',
    uf: (process.env.TENANT_UF || 'MT').toUpperCase().slice(0, 2),
    municipioIbge: process.env.TENANT_MUNICIPIO_IBGE || null,
    createIfMissing: bool(process.env.TENANT_CREATE_IF_MISSING, true),
  },
  etl: {
    batchSize: int(process.env.BATCH_SIZE, 500),
    dryRun: bool(process.env.DRY_RUN, false),
    logLevel: (process.env.LOG_LEVEL || 'info').toLowerCase(),
    passwordStrategy: (process.env.PASSWORD_STRATEGY || 'preserve').toLowerCase(),
    emailSandboxSuffix: process.env.EMAIL_SANDBOX_SUFFIX || '',
    legadoPublicBaseUrl: (process.env.LEGADO_PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  },
};

export default config;
