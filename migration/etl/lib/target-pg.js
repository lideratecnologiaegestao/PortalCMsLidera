// =====================================================================
// Destino: PostgreSQL 16 da plataforma nova.
//
// PONTO CRÍTICO DE RLS:
//   Toda tabela de tenant tem Row Level Security FORCE com a policy
//   `tenant_isolation` (db/001). Um INSERT só passa no WITH CHECK se
//   `tenant_id = app_current_tenant()` OU `app_is_platform() = on`.
//   Por isso, antes de QUALQUER escrita, o ETL faz `SET LOCAL` do GUC
//   `app.current_tenant_id` para o tenant alvo (mesmo contrato do
//   PrismaService da aplicação). Não desabilitamos RLS nem usamos modo
//   plataforma para inserir dados de tenant — respeitamos o isolamento.
//
//   `app.is_platform = on` é usado APENAS para operações de registro
//   (resolver/criar o próprio tenant em `tenants`, que não tem RLS por
//   tenant_id), via withPlatform().
// =====================================================================
import pg from 'pg';
import config from './config.js';
import log from './logger.js';

// Numeric/bigint do PG vêm como string por padrão; para contadores de
// reconciliação queremos números. (Valores monetários permanecem string
// quando inseridos via parâmetro — não há perda.)
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // int8/bigint
pg.types.setTypeParser(1700, (v) => (v === null ? null : v)); // numeric: mantém string

let pool = null;

export async function connectPg() {
  if (pool) return pool;
  const opts = config.pg.connectionString
    ? { connectionString: config.pg.connectionString, ssl: config.pg.ssl }
    : {
        host: config.pg.host,
        port: config.pg.port,
        database: config.pg.database,
        user: config.pg.user,
        password: config.pg.password,
        ssl: config.pg.ssl,
      };
  pool = new pg.Pool({ ...opts, max: 4 });
  const c = await pool.connect();
  await c.query('SELECT 1');
  c.release();
  log.info(`PostgreSQL conectado: ${config.pg.database}`);
  return pool;
}

// Executa `fn(client)` dentro de uma transação com o contexto de TENANT ativo.
// O GUC é setado com SET LOCAL (escopo da transação) — exatamente como a API.
export async function withTenant(tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(..., true) = LOCAL à transação. Faz o RLS enxergar o tenant.
    await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
    await client.query(`SELECT set_config('app.is_platform', 'off', true)`);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// Executa `fn(client)` em MODO PLATAFORMA (cross-tenant). Use só para a
// tabela-registro `tenants` (sem RLS por tenant_id). NUNCA para dados de tenant.
export async function withPlatform(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.is_platform', 'on', true)`);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// COUNT(*) de uma tabela do destino, no contexto do tenant (p/ reconciliação).
export async function countTenant(tenantId, table, whereSql = '', whereParams = []) {
  return withTenant(tenantId, async (client) => {
    const sql = `SELECT count(*)::bigint AS n FROM ${table} ${whereSql}`;
    const { rows } = await client.query(sql, whereParams);
    return rows[0].n;
  });
}

export async function closePg() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
