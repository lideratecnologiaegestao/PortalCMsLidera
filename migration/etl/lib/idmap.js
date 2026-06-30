// =====================================================================
// Mapa de IDs legado (bigint) -> destino (uuid) por UUIDv5 DETERMINÍSTICO.
//
// Por que determinístico: o destino usa uuid como PK e o legado usa bigint.
// Gerando o uuid de destino a partir de (namespace do tenant + nome lógico da
// tabela + id legado) garantimos:
//   1. IDEMPOTÊNCIA: re-rodar o ETL gera o MESMO uuid -> ON CONFLICT atualiza
//      a linha já existente em vez de duplicar.
//   2. RESOLUÇÃO DE FK sem tabela de-para: para referenciar o vereador #12 a
//      partir de outro módulo, basta recalcular uid('vereadores', 12).
//
// O namespace por tenant evita colisão entre câmaras diferentes (multi-tenant).
// Implementação de UUIDv5 (SHA-1) em puro Node 'crypto' — sem dependência extra.
// =====================================================================
import { createHash } from 'node:crypto';

// Namespace base do ETL (UUID fixo, arbitrário porém constante). NÃO mudar:
// alterá-lo quebraria a idempotência de cargas já feitas.
const ETL_ROOT_NAMESPACE = '6b1f6c1e-9d2a-5e8b-bf1a-0c7d3e2f4a90';

function uuidV5(name, namespaceUuid) {
  const nsBytes = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1')
    .update(nsBytes)
    .update(Buffer.from(String(name), 'utf8'))
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // versão 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20)}`;
}

// Cria uma "fábrica" de uuids amarrada ao tenant alvo.
export function makeIdMapper(tenantId) {
  // namespace específico do tenant = v5(tenantId, ROOT)
  const tenantNs = uuidV5(`tenant:${tenantId}`, ETL_ROOT_NAMESPACE);
  return {
    tenantNs,
    // uid('vereadores', 12) -> uuid estável p/ a linha 12 da tabela legada 'vereadores'
    uid(logicalTable, legacyId) {
      if (legacyId === null || legacyId === undefined) return null;
      return uuidV5(`${logicalTable}:${legacyId}`, tenantNs);
    },
  };
}
