# Spec — L2 Sessões Plenárias (Pauta, Ata, Presença, TV Câmara)

## 1. Objetivo
Gerir e publicar as sessões do plenário: agenda, tipo de sessão, **pauta**, **ata**, registro de **presença/ausência** de vereadores e **TV Câmara** (transmissão ao vivo e acervo de gravações). Origem Laravel: `Sessao`, `TipoSessao`, `Evento`, `EventoInscricao`.

## 2. Conformidade legal
Transparência legislativa (LAI + LC 131): publicidade de pauta, ata e presença. Regimento interno define tipos e quórum. Acessibilidade da transmissão (Lei 13.146).

## 3. Requisitos funcionais
1. CRUD de sessão: tipo (ordinária/extraordinária/solene/audiência), data/hora, local, status (`agendada`/`em_andamento`/`encerrada`/`cancelada`), quórum.
2. **Pauta**: itens ordenados (matéria/projeto de lei vinculado, descrição), exportável em PDF.
3. **Ata**: conteúdo (EditorJS) e/ou PDF anexo; publicação após encerramento.
4. **Presença**: marcar presente/ausente/justificado por vereador; alimenta estatística do perfil parlamentar.
5. **TV Câmara**: sessão ao vivo (embed/URL de stream), próxima sessão e acervo de gravações (vincula gravação à sessão).
6. **Calendário público** de sessões e eventos legislativos.
7. Vinculação opcional de sessão a `eventos` (módulo L6) para inscrições.

## 4. Não-funcionais
Acessibilidade AA; player com legendas quando disponível; cache do calendário/TV; auditoria de publicação de ata.

## 5. Modelo de dados (db/1xx_sessoes.sql — `tenant_id` + RLS)
- `tipos_sessao` (nome, descricao).
- `sessoes` (tipo_sessao_id, titulo, data_hora, local, status, quorum, ata_conteudo, ata_publicada_em, video_ao_vivo_url).
- `sessao_pauta_itens` (sessao_id, ordem, titulo, descricao, projeto_lei_id?).
- `sessao_presencas` (sessao_id, vereador_id, situacao [`presente`|`ausente`|`justificado`]).
- `sessao_gravacoes` (sessao_id, titulo, video_url/media ref, duracao).
> Ata em PDF e gravações via `media`/storage da base.

## 6. Contrato de API
- `GET /api/sessoes` — lista/calendário (filtros: tipo, período, status).
- `GET /api/sessoes/:id` — detalhe (pauta, presenças, ata, gravações).
- `GET /api/tv-camara` — `{ aoVivo, proxima, ultima, acervo }` (espelha o app antigo).
- Admin: `POST/PATCH/DELETE /api/admin/sessoes`, gestão de pauta/presença/ata/gravações.

## 7. Papéis (RBAC)
`admin_prefeitura`/`gestor`/`servidor`: gestão. `cidadao`: leitura pública. Presença pode ser registrada por `servidor` designado.

## 8. Feature flag
`funcionalidades.sessoes` (default `true` em `camara`).

## 9. LGPD
Sem dado pessoal sensível além de presença de agentes políticos (público). Auditoria de ata.

## 10. Critérios de aceite
- Calendário e TV Câmara retornam ao vivo/próxima/última corretamente.
- Presença alimenta estatística do vereador.
- Ata só fica pública após publicação explícita.
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Votação nominal de matérias (ver `legislativo-tramitacao.md`); ingestão de streaming (usa URL/embed externo).
