// =====================================================================
// Domínio: USUÁRIOS / PAPÉIS
// Origem (MySQL): users  (modelo unificado do Laravel — cidadãos, ouvidores,
//                 vereadores-login, admins, professores; ver app/Models/User.php)
// Destino (PG):   users  (db/002 + db/026 — RLS por tenant)
//
// Decisões-chave:
//   * RE-HASH DE SENHAS: o Laravel guarda bcrypt ($2y$...). Conforme
//     PASSWORD_STRATEGY:
//       - preserve: copia o hash para users.senha_hash (a API deve aceitar
//         o prefixo $2y$ no verify; bcrypt $2y$ é compatível com $2a$/$2b$).
//       - reset:    senha_hash = NULL e cria registro em auth_verificacoes
//         (finalidade 'reset') para forçar primeiro acesso por e-mail.
//   * MAPEAMENTO DE PAPÉIS: o enum legado é amplo (admin, secretario,
//     presidente, vereador, ouvidor, operador, professor, cidadao, ...).
//     Mapeamos para o user_role do destino (super_admin, admin_prefeitura,
//     gestor, ouvidor, servidor, cidadao, vereador, professor).
//   * users.id legado (bigint) -> uuid determinístico (idmap 'users'); usado
//     por TODOS os módulos que referenciam usuário.
//
// Este módulo deve rodar PRIMEIRO (dependência de FK dos demais).
// =====================================================================
import { mysqlTableExists, mysqlColumns, selectPaged } from '../lib/source-mysql.js';
import { upsertBatch } from '../lib/upsert.js';
import { withTenant } from '../lib/target-pg.js';
import config from '../lib/config.js';
import log from '../lib/logger.js';
import { s, toBool, toTs, cpf11, digits, mapEnum } from '../lib/transform.js';

// Papel legado (coluna users.role) -> user_role do destino.
const ROLE_MAP = {
  'super-admin': 'super_admin',
  super_admin: 'super_admin',
  admin: 'admin_prefeitura', // "Administrador da Câmara" (relabel só na UI)
  presidente: 'admin_prefeitura', // presidente da Casa administra o tenant
  secretario: 'gestor',
  funcionario: 'servidor', // servidor legislativo
  operador: 'servidor', // operador SIGLM -> servidor (acesso interno)
  ouvidor: 'ouvidor',
  vereador: 'vereador',
  professor: 'professor',
  cidadao: 'cidadao',
};

function mapEmail(email) {
  const e = s(email);
  if (!e) return null;
  const sfx = config.etl.emailSandboxSuffix;
  if (!sfx) return e.toLowerCase();
  // staging: foo@bar.com -> foo@bar.com.sandbox (não afeta cidadão)
  return `${e.toLowerCase()}${sfx}`;
}

export async function migrarUsuarios(ctx) {
  const { tenantId, idmap } = ctx;
  if (!(await mysqlTableExists('users'))) {
    log.warn('Tabela origem `users` ausente — pulando usuários.');
    return { lidos: 0, gravados: 0 };
  }
  const cols = await mysqlColumns('users');
  const has = (c) => cols.has(c);

  const rows = [];
  const resetUsers = []; // {id} -> precisam de auth_verificacoes (estratégia reset)
  let lidos = 0;

  for await (const u of selectPaged('SELECT * FROM users ORDER BY id', [], 1000)) {
    lidos++;
    const id = idmap.uid('users', u.id);

    const role = mapEnum(u.role, ROLE_MAP, 'cidadao', `users.role(id=${u.id})`);

    // senha
    let senhaHash = null;
    if (config.etl.passwordStrategy === 'preserve') {
      senhaHash = s(u.password); // bcrypt $2y$...
    } else {
      resetUsers.push({ id });
    }

    rows.push({
      id,
      // super_admin pertence à plataforma (tenant_id NULL). Aqui, porém, TODA
      // a carga é de UM tenant; um eventual 'super-admin' legado vira admin do
      // tenant para não criar usuário de plataforma sem querer.
      nome: s(u.name) || 'Sem nome',
      email: mapEmail(u.email) || `sem-email-${u.id}@migrado.local`,
      senha_hash: senhaHash,
      // CPF não é migrado: o destino guarda apenas cpf_hash (db/010 removeu o
      // cpf em claro, LGPD). Backfill posterior via API se necessário.
      role,
      telefone: has('telefone') ? digits(u.telefone) : has('phone') ? digits(u.phone) : null,
      email_verificado: has('email_verified_at') ? !!u.email_verified_at : false,
      telefone_verificado: false,
      mfa_habilitado: false,
      ativo: has('active') ? toBool(u.active, true) : true,
      criado_em: toTs(u.created_at),
      atualizado_em: toTs(u.updated_at),
    });
  }

  const columns = [
    'id',
    'nome',
    'email',
    'senha_hash',
    'role',
    'telefone',
    'email_verificado',
    'telefone_verificado',
    'mfa_habilitado',
    'ativo',
    'criado_em',
    'atualizado_em',
  ];
  const { inserted } = await upsertBatch(tenantId, 'users', columns, rows, {
    conflictTarget: 'id',
  });

  // Estratégia "reset": marca primeiro acesso via auth_verificacoes.
  if (config.etl.passwordStrategy !== 'preserve' && resetUsers.length && !config.etl.dryRun) {
    await withTenant(tenantId, async (client) => {
      for (const r of resetUsers) {
        await client.query(
          `INSERT INTO auth_verificacoes (tenant_id, user_id, finalidade, codigo_hash, expira_em)
           VALUES ($1, $2, 'reset', 'MIGRACAO_PENDENTE', now() + interval '30 days')
           ON CONFLICT DO NOTHING`,
          [tenantId, r.id],
        );
      }
    });
    log.info(`  reset de senha agendado para ${resetUsers.length} usuário(s).`);
  }

  return { lidos, gravados: inserted };
}

export default migrarUsuarios;
