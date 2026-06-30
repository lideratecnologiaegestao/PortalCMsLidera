# CLAUDE.md — Contexto do Projeto (Portal da Câmara)

> Este arquivo é lido automaticamente pelo Claude Code no início de cada sessão.
> Ele define **como** trabalhar neste repositório. Leia também `PLANEJAMENTO.md` (plano-mestre) e os docs/specs apontados abaixo antes de implementar qualquer módulo.

## O que é

Plataforma **SaaS multi-tenant** para **Câmaras Municipais** (poder legislativo) que serve N câmaras a partir de um único código e uma única infraestrutura. Cada câmara (tenant) tem domínio, identidade visual e conteúdo próprios. O produto cobre o ciclo legislativo (Parlamentar, Sessões Plenárias, Tramitação de Projetos de Lei, Leis), Transparência, ESIC/Ouvidoria, Escola Legislativa, PSS, CMS dinâmico, App do Cidadão e camada de IA legislativa.

> **Origem:** este repositório é um **fork de `portal-prefeitura`** (plataforma de poder executivo). A camada transversal (multi-tenancy RLS, auth, manifestações, transparência, IA, tema, CMS, LGPD, WhatsApp) é **reaproveitada como está**; os módulos do **domínio legislativo** são construídos por cima. Ver `PLANEJAMENTO.md` para a estratégia completa e o roadmap de 8 fases.

## Stack

- **API:** NestJS 10 (monólito modular) + Prisma + PostgreSQL 16 + PostGIS
- **Filas:** BullMQ 5 + Redis 7 (`ioredis`)
- **Portal:** Next.js 14 (App Router, SSR/ISR)
- **Mobile:** React Native + Expo (a construir — Fase 6)
- **Integrações/ETL:** n8n
- **Infra:** Docker, Kubernetes, GitHub Actions
- **IA:** API Anthropic (triagem, RAG, chatbot, OCR, resumo de atas)

> **Infra alvo (produção):** Servidor Lidera (Docker em WSL2). Reusa Redis e Evolution API (WhatsApp) já existentes; o portal provisiona seu próprio Postgres com PostGIS e storage (MinIO). Exposição via Nginx + Cloudflare Zero Trust. Detalhes em `docs/12-infraestrutura.md`.

## Regras invioláveis (NUNCA quebrar)

1. **Isolamento por RLS.** Toda tabela com dados de tenant tem `tenant_id` e policy de Row Level Security. O acesso passa pelo `PrismaService` (que seta `app.current_tenant_id` na transação). **Nunca** desabilite RLS nem consulte cross-tenant fora de `prisma.platform()`. Câmara nova = tabela nova **sempre** nasce com `tenant_id` + `app_enable_tenant_rls()`.
2. **Duas camadas de segurança.** RBAC (`@Roles` + `RolesGuard`) controla *o que pode fazer*; RLS controla *o que pode ver*. As duas são obrigatórias e independentes.
   **2b. Fronteira de camadas (gateway único).** Frontend e App falam **somente** com o backend (API). O frontend/app **nunca** acessa banco, storage, filas ou APIs externas. Toda foto/arquivo sobe **via API** (multipart), e a API grava no storage.
3. **Acessibilidade é lei.** Tema reprovado no contraste WCAG AA **não salva**. O portal carrega VLibras e segue o Design System gov.br.
4. **Prazos legais.** ESIC = 20+10 dias (LAI 12.527/2011); Ouvidoria = 30+30 (Lei 13.460/2017). A FSM e o SLA worker garantem alerta e vencimento. Não altere prazos sem ADR.
5. **LGPD.** Minimização de dados, base legal por finalidade, logs de acesso a dados pessoais, anonimização. Ver `docs/06-lgpd-gdpr.md`.
6. **Auditoria.** Toda ação sensível e toda falha de worker (dead-letter) gravam em `audit_log`.
7. **Filas.** Conexão Redis com `maxRetriesPerRequest: null` e `enableReadyCheck: false`. Idempotência por `jobId`. Nomes sempre via constantes em `queue.constants.ts`.
8. **Migrations primeiro.** Mudança de dados começa por `db/*.sql` (fonte da verdade do RLS), depois `prisma db pull`. Nunca edite `schema.prisma` à mão.

## Papéis (RBAC)

`super_admin` (plataforma) · `admin_prefeitura` (**admin do tenant** — relabel "Administrador da Câmara" na UI; mantido no banco por compatibilidade) · `gestor` · `ouvidor` · `assistente_ouvidoria` · `servidor` (servidor legislativo) · `ti` · `vereador` (novo) · `professor` (Escola Legislativa, novo) · `cidadao`. Ver `api/src/common/rbac/roles.enum.ts` e migrations `db/002`, `db/064`, `db/102`.

## Tipo de entidade e feature flags

Cada tenant tem `tenants.tipo` (`camara` | `prefeitura`) e `tenants.funcionalidades` (jsonb). Módulos do executivo (ex.: `chamados` de zeladoria) são ocultados em tenants `camara`; módulos legislativos (parlamentar, sessões, legislativo, escola, pss) são habilitados. Ver `db/101_camara_tenant_tipo_funcionalidades.sql`.

## Comandos

```bash
docker compose up -d                      # sobe db+redis+n8n+api+web
cd api && npm run start:dev               # API em watch
cd api && npm run prisma:generate         # regenera o client após mudar schema
for f in db/*.sql; do psql "$DATABASE_URL" -f "$f"; done   # migrations (RLS)
cd web && npm run dev                      # portal
```

## Mapa do repositório

```
PLANEJAMENTO.md  plano-mestre (estratégia, roadmap 8 fases, mapa Laravel→novo)
db/              migrations SQL — fonte da verdade do RLS (001–100 base + 101+ câmara)
api/             NestJS (common/tenant, common/rbac, prisma, modules/*)
web/             Next.js (tema dinâmico por tenant)
mobile/          Expo (a criar — Fase 6)
docs/            arquitetura, requisitos, segurança, LGPD, banco, roadmap, ADRs
specs/           specs por módulo (contrato que os agents implementam; L1–L6 a criar)
infra/           k8s + terraform + observabilidade
.claude/         agents, skills, commands (orquestração do Claude Code)
```

## Módulos legislativos a construir (o diferencial — ver PLANEJAMENTO.md)

| # | Módulo | Entrega |
|---|--------|---------|
| L1 | **Parlamentar** | Vereadores, Mesa Diretora, Comissões, posts, representações |
| L2 | **Sessões Plenárias** | Pauta, ata, presença, TV Câmara, calendário |
| L3 | **Legislativo** | Projetos de Lei, tramitação, votação nominal, Leis, iniciativa popular |
| L4 | **Escola Legislativa** | Cursos, provas, certificados QR + validação pública, fórum |
| L5 | **PSS** | Editais, vagas, fases, inscrição, ranking, integração APLIC |
| L6 | **Eventos** | Eventos/audiências públicas com inscrição e certificação |

## Fluxo de trabalho esperado do Claude Code

1. **Antes de codar:** leia `PLANEJAMENTO.md`, a spec do módulo em `specs/` e os docs relevantes em `docs/`.
2. **Delegue** para o subagent certo (`.claude/agents/`): arquiteto, backend-nestjs, frontend-nextjs, dba-postgres-rls, segurança, lgpd, qa, revisor.
3. **Use as skills** (`.claude/skills/`): `multi-tenant-rls`, `manifestacoes-fsm-sla`, `tema-wcag`, `govbr-login-unico`, `transparencia-dados-abertos`.
4. **Migrations primeiro**, depois `prisma db pull`.
5. **Testes** acompanham a feature (unit + e2e). PR sem teste de isolamento RLS quando há tabela nova **não passa**.
6. **Commits** em Conventional Commits; CI verde (lint, test, SAST, RLS-check).

## Definição de pronto (DoD)

Spec atendida · testes passando (incl. isolamento RLS) · acessibilidade verificada quando há UI · base legal LGPD documentada quando há dado pessoal · auditoria registrada nas ações sensíveis · docs/spec atualizados · CI verde.

*Última atualização: 2026-06-29 — bootstrap do fork (Fase 0).*
