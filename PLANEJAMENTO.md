# Planejamento — Portal da Câmara (SaaS Legislativo Multi-entidades)

> Documento-mestre de planejamento. Base: fork de `portal-prefeitura` (SaaS multi-tenant NestJS + Next.js + PostgreSQL/RLS) + migração de **todas** as funcionalidades de `portal-camara-old` (Laravel 12).
> Gerado em 2026-06-29.

---

## 1. Objetivo

Construir uma **plataforma SaaS multi-tenant para Câmaras Municipais** — uma base de código e infraestrutura únicas servindo **N câmaras** (cada câmara = um *tenant* isolado por Row Level Security), cobrindo todo o ciclo do **poder legislativo** com IA, transparência e conformidade legal como diferenciais.

O sistema atual da Câmara de Serra Nova Dourada/MT (`portal-camara-old`, Laravel monolítico mono-entidade) será o **primeiro tenant**, com **todos os seus dados migrados** (MySQL → PostgreSQL).

### Decisões estratégicas (aprovadas)

| Decisão | Escolha | Implicação |
|---|---|---|
| **Estratégia base** | **Fork completo** de `portal-prefeitura` | Herda 100% da infra/módulos transversais; neutraliza vocabulário executivo; adiciona módulos legislativos |
| **Mobile** | **Reconstruir em Expo/React Native** | Stack unificada com a plataforma; app Flutter antigo serve apenas como referência de contrato/telas |
| **Dados** | **Migrar tudo (MySQL→Postgres)** | ETL completo: vereadores, leis, sessões, ESIC, ouvidoria, cursos, certificados, transparência |
| **Diferencial** | **Os 4 eixos** | Núcleo legislativo forte · IA legislativa · Escola Legislativa · Conformidade total (LAI/LGPD/WCAG/PNTP) |

---

## 2. Princípio central: o que já temos de graça

`portal-prefeitura` **não é um scaffold** — é uma plataforma madura (100 migrations SQL, ~45 módulos NestJS implementados, 60+ páginas admin Next.js). O fork herda toda a camada transversal. **A maior parte do trabalho da câmara já está pronta** — o esforço novo concentra-se nos módulos legislativos.

### 2.1 Reaproveitado **como está** (apenas reconfigurar/renomear)

| Capacidade | Módulo na base | Uso na câmara |
|---|---|---|
| **Multi-tenancy por RLS** | `common/tenant`, `prisma` (RLS automático) | **É o "multientidades"** — cada câmara é um tenant isolado no banco |
| **RBAC** (papéis + 50+ permissões) | `common/rbac` | Adaptar papéis: `super_admin`, `admin_camara`, `vereador`, `servidor_legislativo`, `ouvidor`, `professor`, `cidadao` |
| **Auth gov.br + local + MFA** | `auth` (OIDC, Sanctum-like JWT, sessões stateful) | Login do cidadão e do servidor (Lei 14.129/Gov Digital) |
| **ESIC (LAI) + Ouvidoria (13.460)** | `manifestacoes` (FSM, SLA 20+10 / 30+30, recursos, worker de prazo) | **Idêntico ao que a câmara precisa** — substitui Esic*/Ouvidoria* do Laravel |
| **Transparência + dados abertos** | `transparencia`, `aplic` (ETL APLIC/TCE-MT, datasets, CSV/JSON, PNTP) | Receitas/despesas/contratos/licitações/folha/verbas da câmara |
| **IA (RAG, triagem, chatbot, OCR)** | `ia` (Anthropic, embeddings, indexador) | Base para a **IA legislativa** (busca semântica em leis, resumo de atas) |
| **Tema dinâmico WCAG AA** | `theme` (tokens JSONB, contraste bloqueante, VLibras) | Identidade visual + ribbon de luto/campanha por câmara |
| **CMS / Notícias / Documentos** | `cms`, `noticias`, `documentos` (EditorJS-equivalente, FTS, OCR) | Notícias, páginas institucionais, base de documentos legais |
| **Enquetes / Formulários / Campanhas** | `enquetes`, `formularios`, `campanhas` | Participação cidadã, formulários dinâmicos, campanhas sazonais |
| **LGPD self-service** | `lgpd` (direitos do titular, incidentes ANPD, consentimento) | Conformidade 13.709 completa (já implementada) |
| **WhatsApp omnichannel + Notificações** | `atendimento`, `whatsapp`, `notificacoes` | Atendimento ao cidadão, alertas de prazo/protocolo |
| **Diário Oficial** | `diario` (versionamento, OCR, FTS) | Publicações oficiais da câmara |
| **Busca unificada / PWA / Backup / Galeria** | `busca`, `pwa`, `backup`, `media` | Infra de portal completa |
| **Infra & DevOps** | Docker (dev+prod), k8s, Terraform (AWS/GCP), CI com **teste de isolamento RLS** | Deploy no servidor Lidera (WSL2) reusando Redis/Evolution/Nginx/Cloudflare |
| **Orquestração Claude Code** | `.claude/` (10 agents, 5 skills, 4 commands) | Acelera o desenvolvimento dos módulos novos |

### 2.2 A **construir** (o coração legislativo — não existe na base)

Estes módulos são o trabalho real e o diferencial. Cada um segue o padrão obrigatório da base: **tabela com `tenant_id` + policy RLS** (skill `multi-tenant-rls`), módulo NestJS, páginas admin + públicas Next.js, teste de isolamento.

| # | Módulo novo | Origem no Laravel (models) | Núcleo do que entrega |
|---|---|---|---|
| L1 | **Parlamentar** | `Vereador`, `VereadorPost(+Midia)`, `VereadorRepresentacao`, `Comissao`, `ComissaoCargo`, `ComissaoDocumento` | Vereadores, perfil público, mandato, **Mesa Diretora** (presidente/vice/secretários com vigência), comissões, posts sociais, representações |
| L2 | **Sessões Plenárias** | `Sessao`, `TipoSessao`, `Evento`, `EventoInscricao` | Agenda de sessões, pauta, **ata**, presença/ausência de vereadores, **TV Câmara** (ao vivo/gravadas), calendário |
| L3 | **Legislativo / Tramitação** | `ProjetoLei`, `Lei`, `ComiteIniciativaPopular`, `VerbaIndenizatoria` | Projetos de lei + **tramitação** (comissões→plenária→votação→sanção), **votação nominal**, leis sancionadas, compilação de normas, iniciativa popular |
| L4 | **Escola Legislativa** | 22 models: `Curso*`, `CursoProva/Questao/Opcao/Tentativa*`, `CursoInscricao`, `CursoCertificado`, `Certificate*` | Cursos→módulos→aulas (EditorJS), provas objetivas+dissertativas, fórum de dúvidas, **certificados PDF com QR + validação pública**, editor visual de templates |
| L5 | **PSS — Processo Seletivo** | 14 models: `PssEdital/Vaga/Fase/Criterio/Inscricao/Nota/Anexo`, `PssAplic*` | Editais, vagas, fases, inscrição do cidadão, notas, **ranking dinâmico**, integração APLIC |
| L6 | **Eventos & Certificação** | `Evento`, `EventoInscricao`, `Assinante` | Eventos/audiências públicas, inscrições, certificado de participação |

> **Nota de reuso:** L4 (certificados QR) e o `aplic` da base (L5) compartilham componentes já existentes — geração de PDF e ETL APLIC já têm precedente na plataforma.

### 2.3 Neutralização do vocabulário executivo

O fork traz módulos do executivo que devem ser **adaptados ou ocultados** por tipo de entidade:

| Na base (executivo) | Ação na câmara |
|---|---|
| `prefeito`, `primeira_dama`, `vice-prefeito` | → **Mesa Diretora / Presidente da Câmara** (reusar o módulo, trocar entidade) |
| `secretarias` (organograma) | → **Comissões / Estrutura administrativa da câmara** |
| `servicos` (Carta de Serviços executiva) | Manter opcional (câmara pode ter carta de serviços) |
| `chamados` georreferenciados (app cidadão/zeladoria) | **Ocultar** — é típico de executivo (buracos, iluminação); manter código dormindo |
| `historia`, `hino-brasao` | Reusar (história/símbolos do município) |

Estratégia: **feature flags por tenant + tipo de entidade** (`tenant.tipo = 'camara' | 'prefeitura'`) controlando quais módulos aparecem no menu/admin. Isso prepara o terreno para, no futuro, unificar num monorepo se desejado.

---

## 3. Arquitetura alvo

Idêntica à base (sem reinvenção):

```
Internet → Cloudflare Zero Trust → Nginx → Docker (WSL2/Lidera)
   Next.js 14 (SSR/ISR, tema por tenant, VLibras)
      → NestJS 10 (TenantMiddleware → AsyncLocalStorage → RolesGuard → módulos)
          → PostgreSQL 16 + PostGIS (RLS: app.current_tenant_id)
          → Redis 7 (BullMQ: SLA, notificações, IA, OCR, ETL)
          → MinIO (anexos, PDFs, mídia)
      Anthropic API (triagem, RAG, chatbot, OCR, resumo de atas)
```

**Duas camadas de segurança invioláveis (herdadas):** RBAC (*o que pode fazer*) + RLS (*o que pode ver*). Toda tabela legislativa nova nasce com `tenant_id` + `app_enable_tenant_rls()`.

---

## 4. Roadmap por fases

Ordem por dependência. Cada fase entrega valor e fecha com testes (incl. isolamento RLS) + conformidade verificada.

### Fase 0 — Bootstrap da plataforma (fundação)
- Fork `portal-prefeitura` → `portal-camara`; ajustar `.env`, branding, `CLAUDE.md`.
- Adicionar coluna/conceito `tenant.tipo = 'camara'` e **feature flags** por tipo de entidade.
- Neutralizar vocabulário executivo (seção 2.3); ocultar `chamados`.
- Adaptar enum de papéis (`vereador`, `servidor_legislativo`, `professor`).
- Subir Docker, rodar migrations 001–100, `prisma db pull`, smoke test.
- **Saída:** plataforma rodando, isolamento RLS verde, portal "neutro" no ar com seed de Câmara de Exemplo.

### Fase 1 — Núcleo legislativo I: Parlamentar + Sessões  *(diferencial)*
- Módulos **L1 (Parlamentar)** e **L2 (Sessões)**: migrations RLS, NestJS, admin + público.
- Mesa Diretora com vigência; comissões; perfil público do vereador; posts.
- Sessões: pauta, ata, presença, calendário, **TV Câmara** (embed ao vivo/gravadas).
- Endpoints REST para o app (contrato espelhando o Flutter antigo: `/home`, `/vereadores`, `/tv-camara`).
- **Saída:** portal mostra vereadores, mesa, agenda e sessões; transparência de presença.

### Fase 2 — Núcleo legislativo II: Tramitação + Transparência legislativa  *(diferencial)*
- Módulo **L3 (Legislativo)**: projetos de lei, **tramitação** (FSM por fases), **votação nominal**, leis, compilação de normas, iniciativa popular, verbas indenizatórias.
- Configurar `transparencia`/`aplic` para o orçamento da câmara (receitas/despesas/contratos/licitações/folha) + dados abertos PNTP.
- **Saída:** ciclo legislativo completo público + transparência ativa conforme LC 131.

### Fase 3 — Escola Legislativa  *(diferencial)*
- Módulo **L4**: cursos/módulos/aulas (EditorJS), provas objetivas+dissertativas, correção do professor, fórum, **certificados PDF+QR** com validação pública, editor de templates.
- Papel `professor` + área do aluno.
- **Saída:** Escola Legislativa funcional ponta a ponta (alto engajamento cidadão).

### Fase 4 — PSS + Eventos
- Módulos **L5 (PSS)** e **L6 (Eventos)**: editais, vagas, fases, inscrição, notas, ranking, integração APLIC; eventos/audiências com inscrição e certificação.
- **Saída:** processos seletivos e eventos com certificação.

### Fase 5 — IA legislativa  *(diferencial)*
- Sobre o módulo `ia` existente: indexar leis/projetos/atas; **busca semântica** na legislação; **chatbot da câmara**; **triagem automática** de manifestações; **resumo automático de sessões/atas**; OCR de documentos.
- **Saída:** assistente legislativo + busca semântica — diferencial competitivo claro.

### Fase 6 — App mobile (Expo/React Native)
- Reconstruir o app na stack da plataforma, consumindo a API NestJS. Referência de telas/contrato: app Flutter antigo (25 endpoints) + `specs/app-cidadao.md`.
- Telas: home, notícias, vereadores, TV Câmara, ouvidoria/ESIC, consulta de protocolo, login gov.br.
- **Saída:** app Android/iOS publicável.

### Fase 7 — Migração de dados (ETL MySQL→Postgres)
> Pode rodar em paralelo a partir da Fase 2, mas a carga final ocorre quando os módulos-alvo existem.
- ETL (via n8n ou script dedicado) mapeando os 102 models Laravel → schema novo, **como tenant "Serra Nova Dourada"**.
- Ordem: usuários/papéis → parlamentar → sessões → legislativo → transparência → ESIC/ouvidoria → escola/certificados → mídia.
- Validação de integridade + reconciliação de contagens; preservar protocolos (ESIC2026…, OUV2026…) e códigos de certificado (validação pública não pode quebrar).
- **Saída:** dados reais de produção no novo sistema.

### Fase 8 — Conformidade, acessibilidade e go-live  *(diferencial)*
- Auditoria final: **LAI**, **LGPD** (DPIA já existe na base), **WCAG 2.1 AA** (validação de tema bloqueante + VLibras + testes axe/Lighthouse/Pa11y), **PNTP**, dados abertos.
- "Selo de conformidade" como argumento comercial para N câmaras.
- Cutover Serra Nova Dourada; provisionar 2º tenant de validação.
- **Saída:** plataforma multi-câmara em produção.

---

## 5. Migração de dados — pontos de atenção

- **MySQL (mono-entidade) → Postgres (multi-tenant):** toda linha migrada recebe `tenant_id` do tenant Serra Nova Dourada.
- **Mídia:** `Spatie Media Library` (storage Windows via Junction NTFS) → MinIO via API (regra: upload sempre pelo backend).
- **EditorJS:** conteúdo JSON de notícias/aulas/páginas migra como blob; validar o renderer no Next.js.
- **Certificados:** preservar `codigo` de validação — a URL pública `/validar/{codigo}` precisa continuar resolvendo.
- **Protocolos ESIC/Ouvidoria:** preservar numeração; mapear status Laravel → FSM da base.
- **Senhas:** re-hash/forçar primeiro acesso (algoritmos podem diferir).
- **Bugs conhecidos do legado a corrigir na migração:** colisão em `OuvidoriaManifestacao::gerarProtocolo()` (ignora soft-deleted) e vazamento de PII em `/api/user` — resolver no contrato novo.

---

## 6. Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Acoplamento do executivo no fork (prefeito/secretarias/chamados) | Feature flags por `tenant.tipo`; neutralizar na Fase 0 antes de construir o novo |
| Volume dos módulos novos (Escola Legislativa = 22 models; PSS = 14) | Fasear (L4 e L5 isolados); reusar geração de PDF e ETL APLIC já existentes |
| Schema Prisma é **gerado** de `db/*.sql` | Disciplina: migration SQL primeiro (fonte da verdade RLS), depois `prisma db pull` |
| Migração de dados quebrar validação pública (certificados/protocolos) | Preservar códigos; reconciliação de contagens; ambiente de staging antes do cutover |
| Mobile reescrito do zero (Expo) atrasa | Portal já é PWA instalável; app é Fase 6 (não bloqueia go-live) |
| Conformidade WCAG/LGPD subestimada | Já há DPIA + validação WCAG bloqueante na base; auditar cedo (compliance-auditor) |

---

## 7. Próximos passos imediatos (Fase 0)

1. **Fork:** copiar `portal-prefeitura` → `portal-camara` (preservando `.git` ou iniciando novo histórico — definir).
2. Ajustar `CLAUDE.md`, `README.md`, `.env.example` para contexto câmara.
3. Migration: adicionar `tenant.tipo` + tabela/coluna de **feature flags** por tipo de entidade.
4. Adaptar enum de papéis em `common/rbac` (`vereador`, `servidor_legislativo`, `professor`).
5. Neutralizar vocabulário executivo + ocultar `chamados` (flags).
6. Subir Docker, rodar migrations, `prisma db pull`, smoke test + **teste de isolamento RLS**.
7. Criar specs dos módulos legislativos em `specs/` (L1–L6) seguindo o padrão da base.
8. Seed "Câmara Municipal de Exemplo" (multi-tenant) para validação visual.

---

## Apêndice A — Mapa de equivalência Laravel → Plataforma nova

| Domínio Laravel (old) | Destino na plataforma nova |
|---|---|
| `Esic*`, `Ouvidoria*`, `Notificacao` | `manifestacoes` + `notificacoes` (reuso direto) |
| `Receita/Despesa/Contrato/Licitacao/Folha/Verba`, `Transparencia/*` | `transparencia` + `aplic` (reuso/config) |
| `Noticia`, `Documento*`, `PaginaConteudo`, `Slide`, `Popup`, `Enquete*`, `CartaServico*` | `noticias`, `documentos`, `cms`, `popups`, `enquetes`, `servicos` (reuso) |
| `Theme`, `HeroConfiguration`, `Menu`, `AcessoRapido`, `ConfiguracaoGeral` | `theme`, `home`, `menus`, `secretarias`/config (reuso) |
| `User/Role/Permission`, `UserConsent`, `DataAccessLog`, `LegalDocument` | `auth`, `common/rbac`, `lgpd` (reuso) |
| `Vereador*`, `Comissao*` | **L1 Parlamentar (novo)** |
| `Sessao`, `TipoSessao`, `Evento`, `EventoInscricao` | **L2 Sessões / L6 Eventos (novo)** |
| `ProjetoLei`, `Lei`, `ComiteIniciativaPopular`, `VerbaIndenizatoria` | **L3 Legislativo (novo)** |
| `Curso*`, `Certificate*` | **L4 Escola Legislativa (novo)** |
| `Pss*` | **L5 PSS (novo)** |
| App Flutter (`APP-CELULAR`) | **Expo/RN (reconstruir — Fase 6)** |
| Integração SIGLM (standby) | Avaliar como conector externo opcional pós go-live |
