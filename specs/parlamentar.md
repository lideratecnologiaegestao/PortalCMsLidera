# Spec — L1 Parlamentar (Vereadores, Mesa Diretora, Comissões)

## 1. Objetivo
Gerir e publicar a composição do poder legislativo municipal: vereadores (perfil público, mandato, biografia), **Mesa Diretora** (presidente, vice, 1º/2º secretários com vigência), **comissões** (permanentes e temporárias) e a produção parlamentar de cada vereador (posts, representações). Origem Laravel: `Vereador`, `VereadorPost(+Midia)`, `VereadorRepresentacao`, `Comissao`, `ComissaoCargo`, `ComissaoDocumento`.

## 2. Conformidade legal
Transparência legislativa (LAI 12.527/2011 + LC 131/2009): composição da Casa, mandatos, comissões e frequência são informações de transparência ativa. Mesa Diretora e comissões são estrutura obrigatória prevista em regimento interno e Lei Orgânica.

## 3. Requisitos funcionais
1. CRUD de vereador: nome civil, nome parlamentar, partido, foto (via media library), status (`ativo`/`licenciado`/`afastado`/`inativo`), legislatura, início/fim de mandato, biografia (EditorJS), contatos e redes.
2. **Mesa Diretora**: marcar cargo (presidente/vice/1º secretário/2º secretário) com vigência (`inicio`/`fim`); resolver a mesa vigente por data.
3. **Comissões**: CRUD de comissão (tipo permanente/temporária/CPI), composição via cargos (presidente/vice/relator/membro) com vigência, documentos anexos.
4. **Posts do vereador**: publicações sociais com mídia (área do vereador).
5. **Representações**: encaminhamentos do vereador (sugestões/denúncias/ofícios), com acompanhamento.
6. Perfil público do vereador: biografia, comissões, estatísticas (presença, projetos de autoria, votos), posts.
7. Estatísticas agregadas para transparência: presença em sessões, projetos de autoria/relatoria.

## 4. Não-funcionais
Acessibilidade AA nas páginas públicas; fotos servidas via API; cache do perfil público; auditoria das edições.

## 5. Modelo de dados (db/1xx_parlamentar.sql — todas com `tenant_id` + `app_enable_tenant_rls()`)
- `vereadores` (dados de mandato, status, legislatura, biografia, contatos).
- `vereador_mesa_cargos` (vereador_id, cargo, inicio, fim) — vigência da Mesa.
- `comissoes` (nome, tipo, descricao, legislatura).
- `comissao_cargos` (comissao_id, vereador_id, cargo, inicio, fim).
- `comissao_documentos` (comissao_id, documento/media ref).
- `vereador_posts` (+ `vereador_post_midias`).
- `vereador_representacoes` (tipo, assunto, descricao, status).
> Foto/anexos via `media` (módulo da base). Não gravar em storage fora da API.

## 6. Contrato de API
- `GET /api/vereadores` — lista pública (filtros: status, partido, legislatura).
- `GET /api/vereadores/:id` — perfil completo (biografia, comissões, estatísticas, mesa).
- `GET /api/vereadores/:id/posts` · `GET /api/vereadores/:id/representacoes`.
- `GET /api/mesa-diretora` — composição vigente (ou por `?data=`).
- `GET /api/comissoes` · `GET /api/comissoes/:id`.
- Admin: `POST/PATCH/DELETE /api/admin/vereadores`, `.../comissoes`, gestão de cargos de mesa/comissão.
- Vereador (role `vereador`): `POST /api/vereador/posts`, `POST /api/vereador/representacoes`.

## 7. Papéis (RBAC)
`admin_prefeitura` (admin da câmara) e `gestor`: CRUD completo. `vereador`: gerencia seus próprios posts/representações e edita campos do próprio perfil habilitados. `cidadao`: leitura pública.

## 8. Feature flag
`funcionalidades.parlamentar` (default `true` em tenant `camara`).

## 9. LGPD
Dados de vereador são públicos por finalidade (agente político); contatos pessoais minimizados. Auditoria de edição em `audit_log`.

## 10. Critérios de aceite
- Mesa Diretora vigente resolvida corretamente por data; histórico preservado.
- Perfil público mostra comissões, mesa e estatísticas.
- Vereador só altera o que é seu (RLS + RBAC).
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Votação nominal (ver `legislativo-tramitacao.md` e `sessoes-plenarias.md`); folha/verbas (ver `transparencia.md`).
