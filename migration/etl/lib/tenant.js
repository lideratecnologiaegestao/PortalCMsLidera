// =====================================================================
// Resolve (ou cria) o tenant alvo no destino e devolve seu uuid.
// A tabela `tenants` é a tabela-registro (sem RLS por tenant_id), então a
// operação roda em MODO PLATAFORMA (withPlatform) — único uso legítimo dele.
// =====================================================================
import config from './config.js';
import log from './logger.js';
import { withPlatform } from './target-pg.js';

export async function resolveTenant() {
  const { slug, nome, uf, municipioIbge, createIfMissing } = config.tenant;

  return withPlatform(async (client) => {
    const found = await client.query(`SELECT id, nome FROM tenants WHERE slug = $1`, [slug]);
    if (found.rows.length > 0) {
      log.info(`Tenant alvo: ${found.rows[0].nome} (${slug}) = ${found.rows[0].id}`);
      return found.rows[0].id;
    }

    if (!createIfMissing) {
      throw new Error(
        `Tenant slug="${slug}" não existe e TENANT_CREATE_IF_MISSING=false. ` +
          `Crie o tenant via plataforma antes de rodar o ETL.`,
      );
    }

    if (config.etl.dryRun) {
      log.warn(`[dry-run] tenant "${slug}" não existe; usaria um id novo (não persistido).`);
      // uuid de marcador apenas para o dry-run não quebrar downstream.
      return '00000000-0000-0000-0000-0000000000ff';
    }

    const ins = await client.query(
      `INSERT INTO tenants (slug, nome, uf, municipio_ibge, tipo, ativo)
       VALUES ($1, $2, $3, $4, 'camara', true)
       ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [slug, nome, uf, municipioIbge],
    );
    log.info(`Tenant criado: ${nome} (${slug}) = ${ins.rows[0].id}`);
    return ins.rows[0].id;
  });
}

export default resolveTenant;
