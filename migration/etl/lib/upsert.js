// =====================================================================
// UPSERT em lote, idempotente, respeitando RLS (executa dentro de withTenant).
//
// Estratégia de idempotência: como o `id` de destino é um uuid determinístico
// (idmap.js), usamos `INSERT ... ON CONFLICT (id) DO UPDATE`. Re-rodar o ETL
// atualiza as mesmas linhas (não duplica) e preserva o uuid p/ FKs.
//
// `tenant_id` é injetado em toda linha (regra inviolável de multi-tenancy).
// =====================================================================
import config from './config.js';
import log from './logger.js';
import { withTenant } from './target-pg.js';

// Converte valores JS -> aceitáveis pelo driver pg.
function normalize(v) {
  if (v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  // objetos/arrays -> JSON (para colunas jsonb)
  if (v !== null && typeof v === 'object') return JSON.stringify(v);
  return v;
}

/**
 * upsertBatch
 * @param {string}   tenantId  uuid do tenant alvo (vai em toda linha)
 * @param {string}   table     nome da tabela de destino
 * @param {string[]} columns   colunas (NÃO inclua tenant_id; é adicionado)
 * @param {object[]} rows      array de objetos {coluna: valor}
 * @param {object}   opts
 *   - conflictTarget: coluna(s) do ON CONFLICT (default 'id')
 *   - updateColumns:  colunas a atualizar no conflito (default: todas menos id/criado_em)
 *   - returning:      coluna a retornar (opcional)
 * @returns {Promise<{inserted:number, rows:any[]}>}
 */
export async function upsertBatch(tenantId, table, columns, rows, opts = {}) {
  if (!rows || rows.length === 0) return { inserted: 0, rows: [] };

  const allCols = ['tenant_id', ...columns];
  const conflictTarget = opts.conflictTarget || 'id';
  const updateCols =
    opts.updateColumns ||
    columns.filter((c) => c !== 'id' && c !== 'criado_em' && c !== 'created_at');

  if (config.etl.dryRun) {
    log.debug(`[dry-run] ${table}: ${rows.length} linha(s) (upsert simulado)`);
    return { inserted: rows.length, rows: [] };
  }

  const batchSize = config.etl.batchSize;
  let total = 0;
  const returned = [];

  await withTenant(tenantId, async (client) => {
    for (let i = 0; i < rows.length; i += batchSize) {
      const slice = rows.slice(i, i + batchSize);
      const params = [];
      const tuples = slice.map((row) => {
        const placeholders = allCols.map((col) => {
          const value = col === 'tenant_id' ? tenantId : normalize(row[col]);
          params.push(value);
          return `$${params.length}`;
        });
        return `(${placeholders.join(', ')})`;
      });

      const setClause =
        updateCols.length > 0
          ? updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ')
          : null;

      const onConflict = setClause
        ? `ON CONFLICT (${conflictTarget}) DO UPDATE SET ${setClause}`
        : `ON CONFLICT (${conflictTarget}) DO NOTHING`;

      const sql =
        `INSERT INTO ${table} (${allCols.join(', ')}) VALUES ${tuples.join(', ')} ` +
        `${onConflict}` +
        (opts.returning ? ` RETURNING ${opts.returning}` : '');

      const res = await client.query(sql, params);
      total += res.rowCount || 0;
      if (opts.returning && res.rows) returned.push(...res.rows);
    }
  });

  log.info(`  ${table}: ${total} linha(s) upsertadas (de ${rows.length} candidatas)`);
  return { inserted: total, rows: returned };
}

export default upsertBatch;
