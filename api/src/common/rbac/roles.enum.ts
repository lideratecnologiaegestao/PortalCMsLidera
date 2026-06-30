/**
 * Roles da plataforma. Mantido em sincronia com o enum SQL `user_role`.
 *
 * Plataforma Câmara (poder legislativo). `ADMIN_PREFEITURA` é mantido como o
 * papel "administrador do tenant" (relabelado para "Administrador da Câmara" na
 * UI) para não quebrar policies/guards da base. Papéis legislativos novos
 * (`VEREADOR`, `PROFESSOR`) adicionados nas migrations 102+.
 */
export enum Role {
  SUPER_ADMIN            = 'super_admin',            // plataforma (SaaS), cross-tenant
  ADMIN_PREFEITURA       = 'admin_prefeitura',       // administrador do tenant (UI câmara: "Administrador da Câmara")
  GESTOR                 = 'gestor',                 // gestor de secretaria/setor (sem acesso a ouvidoria/e-SIC)
  OUVIDOR                = 'ouvidor',                // autoridade — vê e gerencia ESIC + Ouvidoria
  ASSISTENTE_OUVIDORIA   = 'assistente_ouvidoria',   // auxiliar da ouvidoria — mesmas permissões de conteúdo que ouvidor
  SERVIDOR               = 'servidor',               // servidor (legislativo) designado a manifestações específicas
  TI                     = 'ti',                     // TI do tenant — acesso técnico pleno EXCETO ouvidoria/e-SIC
  VEREADOR               = 'vereador',               // parlamentar eleito — área do vereador / sessões / votação
  PROFESSOR              = 'professor',              // instrutor da Escola Legislativa — cursos / provas
  CIDADAO                = 'cidadao',                // portal/app do cidadão
}
