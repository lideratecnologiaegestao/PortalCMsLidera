# DE-PARA — Mapeamento campo a campo (MySQL Laravel → PostgreSQL plataforma)

> Origem: `portal-camara-old` (Laravel 12, MySQL). Destino: `portal-camara`
> (`db/004` manifestações + `db/103–108` legislativo + `db/002/007/106` base).
> Toda linha de destino recebe `tenant_id` do tenant **Serra Nova Dourada**.
> IDs: legado `bigint` → destino `uuid` por **UUIDv5 determinístico**
> `uid('<tabela_logica>', <id_legado>)` (idempotência + resolução de FK).

Convenções desta tabela:
- **(uid)** = uuid determinístico via `idmap`.
- **(NF)** = referência por uuid **sem FK** no destino (módulos independentes).
- **—** = sem origem direta (valor default/derivado).

---

## 1. Usuários e papéis — `users` → `users` (db/002, db/026)

| Origem (`users`) | Destino (`users`) | Transformação |
|---|---|---|
| `id` | `id` | (uid `users`) |
| `name` | `nome` | trim; fallback "Sem nome" |
| `email` | `email` | lowercase; `EMAIL_SANDBOX_SUFFIX` em staging |
| `password` (bcrypt `$2y$`) | `senha_hash` | `PASSWORD_STRATEGY=preserve`: copia. `reset`: NULL + `auth_verificacoes(reset)` |
| `cpf` | `cpf` | só dígitos, exige 11 (`cpf11`), senão NULL |
| `role` (enum amplo) | `role` (`user_role`) | ver mapa de papéis abaixo |
| `telefone`/`phone` | `telefone` | só dígitos |
| `email_verified_at` | `email_verificado` | bool (not null) |
| `active` | `ativo` | bool, default true |
| `created_at`/`updated_at` | `criado_em`/`atualizado_em` | timestamptz |
| `mfa_*` | `mfa_habilitado` | false (legado não tinha MFA) |

**Mapa de papéis** (`users.role` → `user_role`):

| Legado | Destino | Nota |
|---|---|---|
| `super-admin`/`super_admin` | `super_admin` | plataforma |
| `admin` | `admin_prefeitura` | "Administrador da Câmara" (relabel só na UI) |
| `presidente` | `admin_prefeitura` | preside e administra o tenant |
| `secretario` | `gestor` | |
| `funcionario` | `servidor` | servidor legislativo |
| `operador` (SIGLM) | `servidor` | acesso interno |
| `ouvidor` | `ouvidor` | |
| `vereador` | `vereador` | |
| `professor` | `professor` | |
| `cidadao` | `cidadao` | |

> **Pendências:** flags de permissão fina do ouvidor legado
> (`pode_gerenciar_esic`, `pode_responder_manifestacoes`, etc.) **não** têm coluna
> 1:1 no destino — o controle agora é por RBAC (`@Roles` + `RolesGuard`).
> Campos de cidadão (rg, endereço, dados eleitorais) e SIGLM **não** migram
> (minimização LGPD / fora de escopo). Vínculo vereador↔user não existe como FK
> no legado: `vereadores.user_id` fica NULL (resolver pós-carga por e-mail).

---

## 2. Parlamentar (L1) — db/103

### 2.1 `vereadores` → `vereadores`

| Origem | Destino | Transformação |
|---|---|---|
| `id` | `id` | (uid `vereadores`) |
| `nome` | `nome` | |
| `nome_parlamentar` | `nome_parlamentar` | fallback = `nome` |
| — | `slug` | slug de `nome_parlamentar` (único na carga) |
| `partido` | `partido` | |
| `status` (ativo/inativo/licenciado/afastado) | `status` | mesmo domínio |
| `legislatura` (int) | `legislatura` (text) | `String(int)` |
| `inicio_mandato`/`fim_mandato` | `mandato_inicio`/`mandato_fim` | date |
| `email`/`telefone` | `email`/`telefone` | |
| `foto` (path ou media_id) | `foto_url` | preservado; `storage_key` NULL (re-host) |
| `biografia` | `biografia` | HTML |
| `redes_sociais` (json) | `redes` (jsonb) | |
| `created_at`/`updated_at` | `criado_em`/`atualizado_em` | |

### 2.2 Mesa diretora → `vereador_mesa_cargos` (explode booleans)

O legado guarda a mesa como **booleans + pares de datas na linha do vereador**.
Cada flag verdadeira vira **uma linha de cargo**:

| Origem (col. em `vereadores`) | Destino (`vereador_mesa_cargos`) |
|---|---|
| `presidente`=true + `presidente_inicio`/`presidente_fim` | `cargo='presidente'`, `inicio`, `fim` |
| `vice_presidente` + `vice_inicio`/`vice_fim` | `cargo='vice_presidente'` |
| `primeiro_secretario` + `primeiro_secretario_inicio/fim` | `cargo='primeiro_secretario'` |
| `segundo_secretario` + `segundo_secretario_inicio/fim` | `cargo='segundo_secretario'` |

`inicio` cai para `inicio_mandato` se a data específica for nula.

### 2.3 `comissoes` → `comissoes`

| Origem | Destino | Nota |
|---|---|---|
| `id`/`nome`/`slug`/`descricao` | idem | |
| `status` (ativo/inativo) | `ativo` (bool) | `tipo` = `'permanente'` (legado não tipifica) |

### 2.4 `comissao_cargos` → `comissao_cargos`

| Origem | Destino | Nota |
|---|---|---|
| `comissao_id`/`vereador_id` | (uid) | FK no destino |
| `cargo` (presidente/vice_presidente/relator) | `cargo` | `membro` é o default p/ desconhecidos |
| `data_inicio`/`data_fim` | `inicio`/`fim` | |

### 2.5 `comissao_documentos` → `comissao_documentos`

| Origem | Destino |
|---|---|
| `titulo` | `titulo` |
| `arquivo_path` | `arquivo_url` (storage_key NULL) |

### 2.6 `vereador_posts` (+ `vereador_post_midias`)

`vereador_posts` legado tem `tipo` (texto/foto/video) + `midia_path`/`video_url`
na mesma linha. No destino o **post** (texto) e a **mídia** são separados:

| Origem | Destino |
|---|---|
| `conteudo` | `vereador_posts.conteudo` |
| `publicado_em` | `publicado_em` |
| `midia_path`/`video_url` (se houver) | 1 linha em `vereador_post_midias` (tipo foto/video, `url`, `storage_key` NULL) |

### 2.7 `vereador_representacoes` → `vereador_representacoes`

| Origem | Destino | Nota |
|---|---|---|
| `entidade` | `assunto` | entidade representada |
| `cargo`+`ato_nomeacao` | `descricao` | concatenado |
| `status` (bool) | `status` | true→`em_andamento`, false→`arquivada` |
| — | `tipo` | `'outro'` (legado não tipifica) |

---

## 3. Sessões (L2) — db/104

### 3.1 `tipo_sessaos` (+ enum textual) → `tipos_sessao`

- `tipo_sessaos` legado → `tipos_sessao` (uid `tipos_sessao`).
- Valores do **enum textual** `sessoes.tipo` (ordinaria/extraordinaria/solene/
  especial) viram **tipos sintéticos** (uid `tipos_sessao_enum:<key>`) quando a
  sessão não tem `tipo_sessao_id`.

### 3.2 `sessoes` → `sessoes`

| Origem | Destino | Transformação |
|---|---|---|
| `numero_sessao` | `titulo` | `"Sessão {numero}"` |
| `data_sessao` + `hora_inicio` | `data_hora` | **combinados** em timestamptz |
| `local` | `local` | |
| `status` | `status` | `finalizada`→`encerrada`; resto igual |
| `tipo_sessao_id` ou `tipo` | `tipo_sessao_id` | FK preferida; senão tipo sintético |
| `transmissao_online`+`link_transmissao` | `video_ao_vivo_url` | |
| `ata` | `ata_conteudo` | e `ata_publicada_em` heurístico se houver ata |
| `arquivo_video` | → `sessao_gravacoes` | 1 gravação no acervo (TV Câmara) |

### 3.3 Presença → `sessao_presencas`

- **Preferido:** pivot `sessao_vereador` (`presente`, `justificativa_ausencia`).
  `presente=true`→`presente`; `false`+justificativa→`justificado`; senão `ausente`.
- **Fallback:** coluna JSON `sessoes.presencas` (array de IDs) → todos `presente`.

### 3.4 Pauta → `sessao_pauta_itens`

| Origem (`sessao_projeto_lei`) | Destino | Nota |
|---|---|---|
| `projeto_lei_id` | `proposicao_id` | **(NF)** uid `proposicoes` |
| `ordem_pauta` | `ordem` | |
| `observacoes` | `titulo` | |
| `resultado_votacao` | `descricao` | |

---

## 4. Legislativo (L3) — db/105

### 4.1 `projetos_lei` → `proposicoes`

| Origem | Destino | Transformação |
|---|---|---|
| `id` | `id` | (uid `proposicoes`) |
| `numero`/`numero_projeto` | `numero` (int) | extrai dígitos |
| `ano` | `ano` | |
| `protocolo_numero` ou `numero` | `protocolo` | string livre |
| `tipo` | `tipo` | ver mapa abaixo |
| `ementa`/`titulo` | `ementa` | fallback título |
| `texto_integral` | `texto` | |
| `arquivo_original` | `pdf_url` | storage_key NULL |
| `status` | `status_atual` | ver mapa abaixo |
| `autor_id` | `autor_principal_id` | **(NF)** uid `vereadores` |
| `data_protocolo` | `data_protocolo` | |

**Mapa de `tipo`:** projeto_lei→`pl_ordinaria`; projeto_lei_complementar→`pl_complementar`;
projeto_resolucao→`resolucao`; projeto_decreto / projeto_decreto_legislativo→`decreto_legislativo`;
emenda / emenda_lom→`emenda`; mocao→`mocao`; requerimento→`requerimento`;
**indicacao→`requerimento`** (sem tipo próprio no destino).

**Mapa de `status`** (enum expandido do legado → 9 status do destino):
protocolado→`protocolada`; tramitando/em_tramitacao/distribuido/em_comissao/
em_consulta_publica/aguardando_audiencia→`em_comissao`; pronto_pauta/em_votacao/
aprovado_1_turno→`pauta`; aprovado_2_turno/aprovado/enviado_executivo→`aprovada`;
rejeitado→`rejeitada`; arquivado/retirado/veto_mantido→`arquivada`;
sancionado→`sancionada`; vetado→`vetada`; veto_derrubado/promulgado/publicado→`promulgada`.

### 4.2 Autores/coautores/relator → `proposicao_autores`

| Origem | Destino (`papel`) |
|---|---|
| `autor_id` | `autor` |
| `relator_id` (se houver) | `relator` |
| `coautores` (json) e pivot `projeto_lei_coautor` | `coautor` |

### 4.3 Tramitação → `proposicao_tramitacoes` (append-only)

- Coluna JSON `tramitacao` (lista) → 1 linha por evento (`fase` mapeada do status,
  `despacho`, `data`). Se ausente, gera **1 tramitação inicial** `protocolada`.

### 4.4 Votação → `proposicao_votacoes` (+ `proposicao_votos`)

- Contadores `votos_favoraveis/contrarios/abstencoes/ausencias` → **1 votação
  agregada** (quando soma > 0). `resultado` derivado do status/contadores.
- Votos **nominais** só quando o JSON `votacoes` traz lista por vereador
  (`{vereador_id, voto}`) → `proposicao_votos` (sim/favoravel, nao/contrario,
  abstencao, ausente).

### 4.5 `leis` → `leis`

| Origem | Destino | Transformação |
|---|---|---|
| `numero` | `numero` | |
| `tipo` (PT-BR) | `tipo` | "Lei Ordinária"→`lei_ordinaria`, "Lei Complementar"→`lei_complementar`, "Resolução"→`resolucao`, "Decreto Legislativo"→`decreto_legislativo`, "Lei Orgânica"/"Emenda à Lei Orgânica"→`emenda_lei_organica` |
| `exercicio` (year) | `ano` | |
| `ementa`/`titulo`/`descricao` | `ementa` | |
| `descricao` | `texto` | |
| `data` | `data_sancao` | |
| `arquivo_pdf` | `pdf_url` | |
| `ativo` | `vigente`/`publicada` | |

### 4.6 `comite_iniciativa_populars` → `iniciativa_popular_comites`

| Origem | Destino | Nota |
|---|---|---|
| `ementa`/`nome` | `titulo` | |
| `descricao`/`objetivo`/`observacoes` | `descricao` | |
| `nome` | `responsavel` | |
| `email`/`telefone` | `contato` | |
| `minimo_assinaturas` | `meta_apoios` | |
| `numero_assinaturas` | `apoios_validos` | |
| `status` | `status` | ativo→`coletando`; validado→`aprovada`; rejeitado/arquivado→`rejeitado`; convertido→`convertida` |

---

## 5. Transparência — db/007 (**chave natural**, não usa uid)

### 5.1 `receitas` → `transp_receitas` — UNIQUE `(tenant, exercicio, codigo, data_lancamento)`

`codigo`→`codigo`; `descricao`→`descricao`; `categoria`→`categoria`;
`fonte_recurso`/`origem`→`fonte`; `valor_previsto`/`valor_arrecadado` idem;
`data_arrecadacao`/`data_previsao`→`data_lancamento`; `ano_referencia`→`exercicio`.

### 5.2 `despesas` → `transp_despesas` — UNIQUE `(tenant, exercicio, empenho)`

`numero_empenho`→`empenho`; `funcao`→`funcao`; `elemento_despesa`→`elemento`;
`modalidade_licitacao`→`modalidade`; `favorecido`→`credor_nome`;
`cnpj_cpf_favorecido`→`credor_doc`; valores idem; `data_empenho` idem.

**Verbas indenizatórias** (`verbas_indenizatorias`, dos vereadores) → também
`transp_despesas` com `empenho='VERBA-{ano}-{mes}-V{vereador}'`,
`credor_nome` = nome do vereador, `elemento='Verba Indenizatória'`.

### 5.3 `licitacoes` → `transp_licitacoes` — UNIQUE `(tenant, exercicio, numero)`

`numero_processo`/`numero_edital`→`numero`; `modalidade`/`objeto` idem;
`valor_estimado` idem; `status`→`situacao`; `data_abertura`/`data_hora_abertura`→`data_abertura`;
`arquivo_edital`→`edital_url`.

### 5.4 `contratos` → `transp_contratos` — UNIQUE `(tenant, numero)`

`numero`→`numero` (desambigua duplicado com `-{id}`); `contratado`→`fornecedor_nome`;
`cnpj_cpf_contratado`→`fornecedor_doc`; `objeto` idem;
`valor_atual`/`valor_inicial`→`valor`; `data_inicio`/`data_assinatura`→`vigencia_inicio`;
`data_fim_atual`/`data_fim`→`vigencia_fim`.

### 5.5 `folha_pagamentos` → `transp_folha` — UNIQUE `(tenant, exercicio, mes, matricula)`

`nome_servidor`/`cargo`/`vinculo`/`lotacao`→`orgao`; `mes_referencia`→`mes`;
`matricula` (ou pseudônimo `SRV-{id}`). `remuneracao_bruta` = soma de
básica+vantagens+gratificações+adicionais; `descontos` = obrigatórios+outros;
`remuneracao_liquida` idem. **LGPD: NÃO copia CPF/endereço do servidor.**

---

## 6. Manifestações (ESIC + Ouvidoria) → `manifestacoes` (db/004)

Dois modelos legados num só destino, discriminados por `canal`.

### 6.1 `esic_solicitacoes` → `manifestacoes` (canal `esic`)

| Origem | Destino | Transformação |
|---|---|---|
| `id` | `id` | (uid `manifestacoes_esic`) |
| `protocolo` | `protocolo` | **preservado 1:1** (dedup por colisão → `-D{id}`) |
| — | `canal`/`tipo` | `'esic'` / `'acesso_informacao'` |
| `status` | `status` | pendente→registrada; em_analise idem; aguardando_informacoes→aguardando_cidadao; informacoes_recebidas→em_tratamento; respondida idem; negada→indeferida; parcialmente_atendida idem; recurso→recurso_1a_instancia; finalizada→concluida; arquivada/cancelada→arquivada |
| `user_id` | `cidadao_id` | uid `users` |
| `nome_solicitante`/`email_solicitante` | `solicitante_nome`/`solicitante_email` | |
| `assunto`/`descricao` | idem | |
| `responsavel_id` | `responsavel_id` | uid `users` |
| `data_limite_resposta` | `prazo_em` | NOT NULL: fallback `criado_em + 20 dias` (LAI) |
| `prazo_prorrogacao_dias>0` | `prorrogado` | |
| `resposta` | `resposta` | |
| `data_resposta` | `respondido_em` | |

### 6.2 `ouvidoria_manifestacoes` → `manifestacoes`

| Origem | Destino | Transformação |
|---|---|---|
| `id` | `id` | (uid `manifestacoes_ouv`) |
| `protocolo` | `protocolo` | **preservado** (dedup colisão) |
| `tipo` | `canal`+`tipo` | solicitacao_informacao→(esic, acesso_informacao); reclamacao/sugestao/elogio/denuncia idem; ouvidoria_geral→(ouvidoria, solicitacao) |
| `status` | `status` | nova→registrada; em_tramitacao→em_tratamento; aguardando_informacoes→aguardando_cidadao; demais ~iguais |
| `manifestacao_anonima` | `anonima` | se true, **não** copia nome/email (PII) |
| `ouvidor_responsavel_id` | `responsavel_id` | uid `users` |
| `prazo_resposta`/`prazo_prorrogado` | `prazo_em` | fallback +30 dias (13.460) / +20 (esic) |
| `respondida_em` | `respondido_em` | |
| `informacao_sigilosa` | `classificacao_sigilo` | true→`'reservada'` |
| `deleted_at` != null | `status='arquivada'` | soft-deleted preservado e arquivado |

### 6.3 Histórico → `manifestacao_eventos`

1 evento `registrada` por manifestação (PK bigint identity; reinserção limpa
eventos `registrada` antes p/ idempotência). Observação registra origem e
eventuais correções (colisão de protocolo, registro soft-deleted).

### 6.4 Anexos → `manifestacao_anexos`

Resolve o destino do anexo conforme a coluna preenchida no legado
(`esic_solicitacao_id` → `manifestacoes_esic`; `ouvidoria_manifestacao_id` →
`manifestacoes_ouv`). `storage_key` é `NOT NULL` → marcador `LEGADO_PENDENTE/{id}`
até a re-hospedagem via API.

---

## 7. Escola Legislativa (L4) — db/106

### 7.1 `cursos` → `cursos`

`titulo`/`slug`/`descricao`/`ementa`→(descricao); `carga_horaria_horas`→`carga_horaria`;
`data_inicio`/`data_fim`→`inicio_em`/`fim_em`; `certificado_automatico`→`certificacao`;
`ativo`→`publicado` e `status` (ativo→`publicado`, senão `rascunho`).
**`tipo` (presencial/ead/hibrido) não tem coluna no destino — ignorado.**

### 7.2 `curso_modulos` / `curso_aulas`

- `curso_aulas` legado liga a `curso_modulo_id`; destino exige `modulo_id` **e**
  `curso_id` → resolvido via mapa modulo→curso. Aula órfã (modulo inexistente)
  é descartada.
- `conteudo` (longText) → `conteudo` (jsonb EditorJS) encapsulando `{type:'raw',
  data:{html}}` (sem perda). `url_externa`→`video_url`; `arquivo_path`→`storage_key`.

### 7.3 `curso_inscricoes` → `curso_inscricoes`

`status`: cursando→`ativa`; concluido→`concluida`; reprovado→`ativa`;
cancelado→`cancelada`. `progresso` idem; `aprovado` = (status legado == concluido);
`data_conclusao`→`concluido_em`.

### 7.4 Conclusão / tentativa / certificado (legado liga a **inscrição**)

O legado referencia `curso_inscricao_id`; o destino exige `(user_id, curso_id)`.
Pré-carregamos `inscricao → {user, curso}` para resolver:

- `curso_aula_conclusoes`: + `aula_id` (uid), `curso_id` via aula→modulo→curso.
- `curso_tentativas_prova`: `aprovado`(bool)→`status` (aprovado/reprovado/em_andamento);
  `nota` preservada.
- `curso_tentativa_prova_questoes` → `curso_tentativa_questoes`: `resposta_json`
  serializado em `resposta_texto`; `correta` preservada.
- **`curso_certificados` → `curso_certificados`: `codigo` PRESERVADO 1:1**
  (validação pública `/validar/{codigo}`). `nome_aluno`/`titulo_curso` = snapshot.

### 7.5 Provas / questões / opções

`curso_provas` (1 por curso, sem módulo → `modulo_id=NULL`); `nota_minima`,
`tempo_limite_min`, `max_tentativas` idem. `curso_questoes.tipo`
(multipla_escolha/verdadeiro_falso → `objetiva`; dissertativa idem).
`curso_opcoes.texto_opcao`→`texto`; `correta` idem.

### 7.6 Fórum / feedback / restrições

- `curso_aula_duvidas` → `curso_aula_duvidas` (`status` fechada/respondida →
  `resolvida=true`).
- `curso_aula_respostas` → `curso_aula_respostas` (descarta `user_id` NULL —
  destino exige NOT NULL); `do_professor=false` (legado não distingue).
- `curso_feedbacks` → `curso_feedbacks` (`nota` 1..5).
- `curso_restricoes` (CPF/matrícula) → `curso_restricoes` (`tipo='aprovacao'`,
  `valor`=cpf|matricula, `config.origem`).

### 7.7 Templates de certificado

`certificate_types` → `certificate_types`. `certificate_templates` → cabeçalho
em `certificate_templates`; o **layout JSON bruto** do legado (coluna `json`) é
preservado num `certificate_texts` com prefixo `__LAYOUT_LEGADO__` (a aplicação
re-modela visualmente sem perda). `certificate_photos`/`elements` legados têm
estrutura diferente (catálogo global, não posicional) — **não** migram 1:1.

---

## 8. Pendências e ambiguidades de mapeamento

Listadas em detalhe no `observacoes` da saída estruturada da fase. Resumo:

1. **Vínculo vereador↔user**: o legado não tem FK; `vereadores.user_id` fica NULL.
2. **Permissões finas do ouvidor**: substituídas por RBAC; flags legadas não migram.
3. **`cidadao_id` da ouvidoria**: legado usa `esic_usuario_id` (FK p/ tabela
   `esic_usuarios`, não `users`) — mapeamento é **melhor esforço**; pode não casar
   com um `users.id`. Validar pós-carga.
4. **Votos nominais**: só migram quando o JSON `votacoes` traz lista por vereador;
   caso contrário só os contadores agregados são preservados.
5. **Comissões — `tipo`**: legado não distingue permanente/CPI/temporária → tudo
   `permanente`. Reclassificar manualmente as CPIs.
6. **Tipo de curso** (presencial/ead/hibrido) sem coluna no destino.
7. **Mídia/anexos**: `storage_key` fica NULL ou `LEGADO_PENDENTE/{id}`; depende de
   um passo posterior de re-hospedagem via API.
8. **`certificate_photos/elements`**: estrutura legada incompatível com o editor
   posicional do destino; só o cabeçalho + JSON bruto do template migram.
