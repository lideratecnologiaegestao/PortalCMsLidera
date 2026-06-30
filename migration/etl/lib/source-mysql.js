// =====================================================================
// Fonte: MySQL do Laravel antigo. Wrapper fino sobre 'mysql2/promise'.
// Apenas LEITURA — o ETL nunca escreve na origem.
// =====================================================================
import mysql from 'mysql2/promise';
import config from './config.js';
import log from './logger.js';

let pool = null;

export async function connectMysql() {
  if (pool) return pool;
  pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    database: config.mysql.database,
    user: config.mysql.user,
    password: config.mysql.password,
    charset: config.mysql.charset,
    dateStrings: config.mysql.dateStrings,
    connectionLimit: 4,
    // Datas zeradas do legado ("0000-00-00 00:00:00") => null (não lança).
    typeCast(field, next) {
      if (
        (field.type === 'DATE' || field.type === 'DATETIME' || field.type === 'TIMESTAMP')
      ) {
        const val = field.string();
        if (val === null) return null;
        if (/^0000-00-00/.test(val)) return null;
        return new Date(val);
      }
      return next();
    },
  });
  // valida a conexão cedo (falha clara se credenciais/rede estão erradas).
  const conn = await pool.getConnection();
  await conn.ping();
  conn.release();
  log.info(`MySQL conectado: ${config.mysql.user}@${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`);
  return pool;
}

// Existe a tabela na origem? (algumas instalações legadas não têm todos os módulos.)
export async function mysqlTableExists(table) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
     WHERE table_schema = ? AND table_name = ?`,
    [config.mysql.database, table],
  );
  return rows[0].n > 0;
}

// Lista de colunas existentes na tabela (para SELECT defensivo).
export async function mysqlColumns(table) {
  const [rows] = await pool.query(
    `SELECT column_name AS c FROM information_schema.columns
     WHERE table_schema = ? AND table_name = ?`,
    [config.mysql.database, table],
  );
  return new Set(rows.map((r) => r.c));
}

// Itera linhas de uma query em "páginas" para não estourar memória em tabelas grandes.
// A query DEVE conter ORDER BY estável (geralmente `id`) e os placeholders LIMIT/OFFSET.
export async function* selectPaged(baseSql, params = [], pageSize = 1000) {
  let offset = 0;
  for (;;) {
    const sql = `${baseSql} LIMIT ${pageSize} OFFSET ${offset}`;
    const [rows] = await pool.query(sql, params);
    if (rows.length === 0) break;
    for (const r of rows) yield r;
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
}

// SELECT simples retornando todas as linhas (use só em tabelas pequenas/médias).
export async function selectAll(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function closeMysql() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
