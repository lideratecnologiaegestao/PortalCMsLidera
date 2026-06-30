# Spec — L3 Legislativo (Projetos de Lei, Tramitação, Votação, Leis)

## 1. Objetivo
Gerir o ciclo legislativo: **projetos de lei** (e demais proposições) com **tramitação** por fases (protocolo → comissões → plenário → votação → sanção/promulgação), **votação nominal**, publicação de **leis** sancionadas e compilação de normas, além de **iniciativa popular**. Origem Laravel: `ProjetoLei`, `Lei`, `ComiteIniciativaPopular`, `VerbaIndenizatoria`.

## 2. Conformidade legal
LAI + LC 131 (transparência da produção legislativa); regimento interno (rito de tramitação); CF art. 29 (processo legislativo municipal). Votação nominal é instrumento de transparência (quem votou como).

## 3. Requisitos funcionais
1. CRUD de proposição: tipo (PL ordinária/complementar, resolução, decreto legislativo, requerimento, moção, emenda), número/ano, protocolo, ementa, autor(es) (vereador/mesa/comissão/iniciativa popular), texto/PDF.
2. **Tramitação (FSM)**: fases configuráveis com histórico imutável de movimentações (data, fase, despacho, comissão/relator).
3. **Votação nominal**: registrar resultado por vereador (`favoravel`/`contrario`/`abstencao`/`ausente`) vinculada a uma sessão (L2); apurar resultado (aprovado/rejeitado) e quórum.
4. **Emendas/coautoria**: vincular emendas e coautores à proposição.
5. **Leis**: ao sancionar/promulgar, gerar/registrar a `lei` (número, tipo, data, PDF), vinculada à proposição de origem; compilação/normas vigentes pesquisáveis.
6. **Iniciativa popular**: comitê, coleta/validação de apoios, conversão em proposição.
7. **Verbas indenizatórias**: publicação (transparência) — pode delegar ao módulo `transparencia`.
8. Download de PDF e busca (integra `busca`/FTS da base).

## 4. Não-funcionais
Histórico de tramitação imutável (append-only); auditoria; acessibilidade AA; indexação para IA (busca semântica de leis/projetos — ver `ia-assistida.md`).

## 5. Modelo de dados (db/1xx_legislativo.sql — `tenant_id` + RLS)
- `proposicoes` (tipo, numero, ano, protocolo, ementa, texto, status_atual, autor_principal_id, data_protocolo).
- `proposicao_autores` (proposicao_id, vereador_id, papel [`autor`|`coautor`|`relator`]).
- `proposicao_tramitacoes` (proposicao_id, fase, despacho, comissao_id?, relator_id?, data) — append-only.
- `proposicao_votacoes` (proposicao_id, sessao_id, resultado, quorum, data).
- `proposicao_votos` (votacao_id, vereador_id, voto).
- `proposicao_emendas` (proposicao_id, numero, tipo, texto).
- `leis` (numero, tipo, ementa, data_sancao, proposicao_id?, pdf/media ref, vigente).
- `iniciativa_popular_comites` (+ apoios/assinaturas com validação).
> Texto/PDF via `media`. Reusar FSM/skill quando aplicável.

## 6. Contrato de API
- `GET /api/proposicoes` — lista pública (filtros: tipo, ano, autor, status). `GET /api/proposicoes/:id` (tramitação + votação + emendas).
- `GET /api/leis` · `GET /api/leis/:id` · download PDF.
- `GET /api/proposicoes/:id/votacao` — votação nominal pública.
- Admin: `POST/PATCH /api/admin/proposicoes`, `POST .../:id/tramitar` (transição), `POST .../:id/votacao` (registrar votos), `POST /api/admin/leis`.

## 7. Papéis (RBAC)
`admin_prefeitura`/`gestor`/`servidor`: gestão de proposições/tramitação/votação/leis. `vereador`: protocolar proposição de própria autoria (se habilitado). `cidadao`: leitura pública + apoio a iniciativa popular (autenticado).

## 8. Feature flag
`funcionalidades.legislativo` (default `true` em `camara`).

## 9. LGPD
Apoios de iniciativa popular contêm dado pessoal (CPF/identificação) → base legal: exercício regular de direito; minimização e proteção; auditoria. Votos de vereadores são públicos.

## 10. Critérios de aceite
- Tramitação registra movimentações imutáveis; transição inválida é rejeitada.
- Votação nominal apura resultado e expõe voto por vereador.
- Sanção gera/vincula `lei` pesquisável; PDF baixa.
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Assinatura digital ICP-Brasil da lei (delegar ao `diario-oficial.md`); integração SIGLM (conector externo opcional, pós go-live).
