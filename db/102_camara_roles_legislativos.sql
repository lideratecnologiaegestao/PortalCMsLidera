-- =====================================================================
-- 102 — Novos papéis do domínio legislativo (plataforma Câmara)
-- =====================================================================
-- Adiciona ao enum user_role os papéis exigidos pelos módulos legislativos
-- novos (Parlamentar, Sessões, Legislativo, Escola Legislativa):
--
--   vereador    → parlamentar eleito. Acessa sua área (perfil público,
--                 posts, representações) e, quando habilitado, painel de
--                 sessões/votação. NÃO é admin do tenant.
--
--   professor   → instrutor da Escola Legislativa. Cria/edita cursos,
--                 módulos, aulas e provas; corrige dissertativas. Escopo
--                 restrito à Escola Legislativa.
--
-- Observações de compatibilidade (decisão da Fase 0):
--   * `admin_prefeitura` é MANTIDO como o papel "administrador do tenant"
--     (referenciado por todos os módulos da base). Na UI da câmara ele é
--     relabelado como "Administrador da Câmara" — sem renomear no banco
--     para não quebrar policies/guards existentes.
--   * "servidor legislativo" reaproveita o papel existente `servidor`.
--
-- IMPORTANTE: ALTER TYPE ADD VALUE não é transacional no PostgreSQL — o
-- novo valor não pode ser usado na MESMA transação em que é criado. Por
-- isso esta migration apenas ADICIONA os valores; policies/guards que os
-- referenciam virão em migrations dos respectivos módulos.
-- =====================================================================

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'vereador';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'professor';
