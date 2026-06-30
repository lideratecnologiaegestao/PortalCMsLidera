# Conformidade da Câmara — Checklist (LAI · LGPD · WCAG 2.1 AA · PNTP · Dados Abertos)

> Documento de conformidade da plataforma SaaS de Câmaras (Fase 8). Mapeia, por
> eixo legal, **o que a plataforma já entrega** (módulos reais do repositório) e
> **o que cada câmara precisa configurar** para ficar conforme. Nada aqui é
> aspiracional: cada item "coberto" aponta o módulo/arquivo que o implementa.
>
> Escopo: poder **legislativo municipal** (tenant `tipo='camara'`). Onde a
> exigência muda em relação ao executivo, está sinalizado.
>
> Legenda: **[Plataforma]** já implementado na base · **[Config]** depende de
> configuração por câmara · **[Decisão]** requer decisão humana/jurídica.

---

## 1. LAI — Lei de Acesso à Informação (Lei 12.527/2011)

A LAI tem duas faces: **transparência passiva** (e-SIC: o cidadão pede, o órgão
responde) e **transparência ativa** (publicação espontânea — ver seções 4 e 5).

### Transparência passiva (e-SIC)

| Requisito legal | Situação | Onde |
|---|---|---|
| Canal e-SIC para pedidos de informação | **[Plataforma]** | Módulo `manifestacoes` (canal `esic`); portal `/esic` (`SiteHeader`, `EsicForm`) |
| Prazo de resposta de **20 dias, prorrogável por +10** | **[Plataforma]** | `manifestacoes/sla.ts` (`PRAZO_ESIC = { dias: 20, prorrogacaoDias: 10 }`); worker de SLA (`workers/sla.worker.ts`) |
| Prorrogação com justificativa registrada | **[Plataforma]** | FSM `state-machine.ts` + `tramitacao.service.ts` |
| **Recurso** do solicitante (autoridade decide em 5 dias) | **[Plataforma]** | `sla.ts` (`PRAZO_RECURSO_ESIC = { dias: 5 }`) |
| Protocolo rastreável + consulta pública por protocolo | **[Plataforma]** | `manifestacoes.service.ts`; portal `AcompanharClient`, `MinhasManifestacoes` |
| Alerta antecipado antes do vencimento (~80% do prazo) | **[Plataforma]** | `sla.ts` (`instanteAlerta`) + `sla-scheduler.ts` |
| Resposta gratuita; identificação mínima do solicitante | **[Plataforma]** | Fluxo de manifestação (minimização de dados) |
| Designar a **autoridade de monitoramento da LAI** (art. 40) | **[Config][Decisão]** | Papel `ouvidor`/`admin` no tenant — definir a pessoa |
| Rol de informações classificadas (sigilo) e desclassificação | **[Decisão]** | Não há módulo de classificação de sigilo; tratar por processo administrativo |
| Contagem em dias **úteis × corridos** e calendário de feriados | **[Config][Decisão]** | `sla.ts` suporta `uteis` + feriados; definir a regra adotada pela câmara |

**A configurar por câmara:** indicar ouvidor/autoridade de monitoramento;
publicar o regulamento do e-SIC; definir feriados locais; revisar a política de
prazos (corridos é o piso legal padrão configurado).

---

## 2. LGPD — Lei Geral de Proteção de Dados (Lei 13.709/2018)

| Requisito legal | Situação | Onde |
|---|---|---|
| **Direitos do titular** (acesso, portabilidade, correção, eliminação) | **[Plataforma]** | Módulo `lgpd`: `meus-dados.service.ts` (exportação art. 18 II/V), `solicitacoes.service.ts` + FSM (`lgpd-fsm.ts`) |
| Self-service do titular (área "Meus dados") | **[Plataforma]** | `lgpd` + portal do cidadão |
| **Registro/comunicação de incidentes** à ANPD | **[Plataforma]** | `incidentes.service.ts`; admin `/admin/lgpd-incidentes` |
| Painel de conformidade LGPD do gestor | **[Plataforma]** | `lgpd-dashboard.service.ts`; admin `/admin/lgpd-conformidade` |
| **DPIA / Relatório de Impacto (RIPD)** | **[Plataforma]** | `docs/07-dpia.md` (base existente) |
| Minimização de dados / sem PII sensível em claro | **[Plataforma]** | `meus-dados` mascara WhatsApp/CPF; sem `senhaHash`/`mfaSecret` na exportação; `transparencia/mascarar-doc.util.ts` |
| Logs de acesso a dados pessoais (auditoria) | **[Plataforma]** | `audit_log` (db/001); regra 6 do CLAUDE.md |
| Base legal por finalidade documentada | **[Plataforma]** | `docs/06-lgpd-gdpr.md` |
| Geração da **documentação LGPD por entidade** (DPO, política) | **[Plataforma][Config]** | `lgpd/doc/lgpd-doc.service.ts`; super_admin gera por tenant (`/config/lgpd`) |
| Consentimento de cookies | **[Plataforma]** | `CookieConsent.tsx` |
| **Indicar o Encarregado (DPO)** — nome, e-mail, contato | **[Config][Decisão]** | `getLgpdConfig`/`salvarLgpdConfig` (super_admin) — preencher por câmara |
| Bases legais específicas do legislativo (ex.: dados de inscritos em PSS/Escola, votação nominal pública) | **[Decisão]** | Revisar finalidade/base legal de cada novo dado pessoal dos módulos L4/L5/L6 |

**A configurar por câmara:** nomear e publicar o DPO; gerar a documentação LGPD
da entidade; revisar bases legais dos módulos legislativos que coletam dados
pessoais (Escola Legislativa, PSS, inscrições em eventos).

---

## 3. Acessibilidade — WCAG 2.1 AA + e-MAG + Lei 13.146/2015 (LBI)

| Requisito | Situação | Onde |
|---|---|---|
| **Contraste WCAG AA bloqueante** — tema reprovado não salva | **[Plataforma]** | `theme.service.ts` (`saveTokens`/`aplicarModelo` validam `contrast.util.ts`; bloqueante por lei) |
| Tradução em **Libras (VLibras)** | **[Plataforma]** | `components/VLibras.tsx` (no layout público) |
| Barra de acessibilidade (alto contraste, fonte, skip links) | **[Plataforma]** | `AccessibilityBar.tsx`, `UtilityBar.tsx` |
| Navegação por teclado + ARIA nos menus/dropdowns | **[Plataforma]** | `MainNav.tsx`, `AdminShell.tsx` (foco, `aria-expanded`, Escape, skip link) |
| Design System gov.br (tokens, semântica) | **[Plataforma]** | `theme.ts`/tokens; `globals.css` |
| Idioma da página, foco visível, landmarks | **[Plataforma]** | `layout.tsx` (`lang="pt-BR"`, `role="banner"`, `<main id="conteudo">`) |
| **Testes automatizados axe/Lighthouse/Pa11y** no CI | **[Decisão]** | Não verificado no repo — recomendar adicionar ao pipeline |
| Auditoria manual de leitor de tela (NVDA/VoiceOver) | **[Decisão]** | Processo humano por câmara/release |
| Acessibilidade de **PDFs publicados** (atas, leis, editais) | **[Config][Decisão]** | Conteúdo enviado pela câmara — orientar geração de PDFs acessíveis |

**A configurar por câmara:** garantir que o tema escolhido passe no contraste
(o sistema impede salvar se reprovar); publicar a **página de acessibilidade**
(VLibras já carregado); orientar autores sobre PDFs marcados/acessíveis.

---

## 4. PNTP — Programa Nacional de Transparência Pública (Atricon/EBT 360°)

> Metodologia, pesos e selos detalhados em `docs/13-pntp-criterios.md`. Para
> **Câmara** vale a matriz de comuns + a dimensão **Atividades Finalísticas
> (Legislativo)** (peso 3) — NÃO as dimensões exclusivas do Executivo.

| Dimensão PNTP | Cobertura na plataforma | Onde |
|---|---|---|
| Informações Prioritárias / Institucionais (portal/CMS) | **[Plataforma]** | `cms`, `noticias`, `documentos`, `home` |
| Receita / Despesa / Planejamento e Prestação de Contas | **[Plataforma][Config]** | `transparencia` + `aplic` (ETL APLIC/TCE-MT) — exige UG configurada |
| Recursos Humanos / Diárias / Folha | **[Plataforma][Config]** | `transparencia` datasets |
| Licitações / Contratos / Convênios / Obras | **[Plataforma]** | `/admin/licitacoes`, `/admin/contratos`, `/admin/convenios` |
| **SIC (LAI passiva)** | **[Plataforma]** | `manifestacoes` (e-SIC) — ver seção 1 |
| **Ouvidoria** (Lei 13.460) | **[Plataforma]** | `manifestacoes` (canal ouvidoria; 30+30) |
| Acessibilidade | **[Plataforma]** | ver seção 3 |
| LGPD e Governo Digital | **[Plataforma]** | ver seção 2 + dados abertos (seção 5) |
| **Atividades Finalísticas (Legislativo)** — vereadores, mesa, comissões, proposições, tramitação, votação nominal, leis, sessões/atas, presença | **[Plataforma]** | Módulos L1–L3 (db/103–105); portal público de vereadores/sessões/leis |
| Painel de conformidade PNTP (autoavaliação) | **[Plataforma]** | `/admin/conformidade`; `getPntp`/`AplicConfig` (selo, índice, bloqueantes) |
| 5 itens de verificação por critério (disponibilidade, atualidade, série histórica, download aberto, filtro) | **[Plataforma]** | `transparencia/datasets.controller.ts` expõe os 5 itens |

**A configurar por câmara:** habilitar a fonte APLIC e informar a **UG (7
dígitos)** do TCE-MT (`/config/aplic`); manter a periodicidade de atualização;
publicar planejamento e prestação de contas; rodar o auditor PNTP
(`docs/pntp-auditor.md`, `docs/auditar-pntp.md`) antes de pleitear o selo.

> **[Decisão]** A matriz oficial PNTP por **Poder Legislativo** difere da do
> Executivo. Confirmar com o agente `pntp-auditor` a lista exata de critérios
> aplicáveis à Câmara no ciclo vigente antes de pontuar (a doc 13 foca o
> Executivo; a dimensão Legislativo é peso 3).

---

## 5. Dados Abertos (LC 131/2009 · Decreto 8.777/2016 · INDA)

| Requisito | Situação | Onde |
|---|---|---|
| Exportação em **formato aberto (CSV/JSON)** dos datasets | **[Plataforma]** | `transparencia/datasets.controller.ts` (download CSV/JSON); `csv.util.ts` |
| Atualidade / última sincronização visível | **[Plataforma]** | datasets expõem o item "atualidade" |
| Série histórica por exercício | **[Plataforma]** | datasets expõem "série histórica" |
| Filtro de pesquisa nos conjuntos | **[Plataforma]** | datasets expõem "filtro" |
| Transparência em **tempo real** (LC 131) das despesas/receitas | **[Plataforma][Config]** | ETL `aplic` (periodicidade depende da carga configurada) |
| Licença de uso dos dados (ex.: CC-BY / domínio público) | **[Decisão]** | Definir e publicar a licença dos dados abertos |
| Catálogo/inventário de dados abertos (PDA) | **[Decisão]** | Publicar o **Plano de Dados Abertos** da câmara |
| Dados legislativos abertos (proposições, votações, presença) | **[Plataforma]** | Módulos L1–L3 já estruturam os dados; exportação aberta a confirmar por dataset |

**A configurar por câmara:** publicar o Plano de Dados Abertos e a licença;
manter a periodicidade da carga APLIC; validar os downloads CSV/JSON de cada
conjunto.

---

## 6. Ouvidoria (Lei 13.460/2017 · Decreto 9.492/2018)

Embora não seja um dos quatro eixos do título, a Ouvidoria é exigência legal e
já é coberta pela mesma base das manifestações.

| Requisito | Situação | Onde |
|---|---|---|
| Canal de ouvidoria (reclamação, denúncia, sugestão, elogio) | **[Plataforma]** | `manifestacoes` (canal ouvidoria); portal `/ouvidoria`, `OuvidoriaForm` |
| Prazo de **30 dias, prorrogável por +30** | **[Plataforma]** | `sla.ts` (`PRAZO_OUVIDORIA = { dias: 30, prorrogacaoDias: 30 }`) |
| Carta de Serviços ao Usuário | **[Plataforma][Config]** | módulo `servicos` (opcional na câmara) |
| Pesquisa de satisfação / avaliação do atendimento | **[Plataforma]** | `servico_avaliacoes` (db/044); `AvaliacaoServico.tsx` |
| Designar **Ouvidor** | **[Config][Decisão]** | Papel `ouvidor` — definir a pessoa |

---

## 7. Resumo — pendências que dependem de configuração ou decisão

**Por câmara (configuração no admin/super_admin):**
- Indicar **DPO/Encarregado** e gerar a documentação LGPD da entidade.
- Indicar **Ouvidor** e **autoridade de monitoramento da LAI**.
- Habilitar **APLIC** e informar a **UG (TCE-MT)**; manter a periodicidade.
- Escolher tema que passe no contraste (bloqueio automático já garante o piso).
- Definir feriados e a regra de contagem de prazos (úteis × corridos).

**Decisões humanas/jurídicas (fora do escopo de código):**
- Matriz PNTP exata aplicável ao **Legislativo** no ciclo vigente.
- Política de classificação de sigilo da LAI (não há módulo dedicado).
- Licença dos dados abertos + Plano de Dados Abertos (PDA).
- Bases legais LGPD dos novos dados pessoais (Escola Legislativa, PSS, eventos).
- Testes automatizados de acessibilidade (axe/Lighthouse/Pa11y) no CI.
- Acessibilidade dos PDFs publicados (atas, leis, editais).

---

*Fonte: módulos reais do repositório (api/src/modules/*, web/*, db/*). Atualizar
quando novos módulos legislativos forem ao ar. Fase 8 — 2026-06.*
