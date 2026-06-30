# Spec — L5 PSS (Processo Seletivo Simplificado)

## 1. Objetivo
Gerir processos seletivos simplificados da câmara: **editais**, **vagas**, **fases**, **critérios**, **inscrição do cidadão**, **notas** e **ranking/classificação**, com integração ao **APLIC** (TCE-MT). Origem Laravel: 14 models `Pss*` (`PssEdital/Vaga/Fase/Criterio/Inscricao/Nota/Anexo`, `PssAplic*`).

## 2. Conformidade legal
Princípios da Administração (impessoalidade, publicidade, isonomia); transparência do certame; prestação de contas ao TCE-MT via APLIC; LGPD para dados de candidatos.

## 3. Requisitos funcionais
1. **Edital**: CRUD com período de inscrição, status, fases, critérios, anexos; aberturas/retificações versionadas.
2. **Vagas**: cargo, quantidade, requisitos, tabela salarial (APLIC).
3. **Fases**: inscrição, prova objetiva, prova prática, entrevista, títulos — ordenadas, com critérios e pesos.
4. **Critérios**: pontuação por título/experiência/prova; configuráveis por fase.
5. **Inscrição** (cidadão autenticado): formulário + upload de documentos (anexos); validação.
6. **Notas e ranking**: lançamento de notas por fase/critério; cálculo de classificação com desempate; publicação do ranking.
7. **Comissão**: membros da comissão do certame (APLIC).
8. **Exportação APLIC**: gerar pacotes/validações no leiaute do TCE-MT.

## 4. Não-funcionais
Imutabilidade de resultados publicados; auditoria; acessibilidade AA; geração de atas/relatórios; throttling em endpoints públicos.

## 5. Modelo de dados (db/1xx_pss.sql — `tenant_id` + RLS)
- `pss_editais`, `pss_vagas`, `pss_fases`, `pss_criterios`.
- `pss_inscricoes`, `pss_inscricao_criterios`, `pss_notas`, `pss_anexos`.
- `pss_aplic_abertura_retificacao`, `pss_aplic_comissao_membro`, `pss_aplic_situacao`, `pss_aplic_tabela_salarial`.
> Anexos via `media`. Considerar reuso do módulo `aplic` da base p/ leiaute/exportação.

## 6. Contrato de API
- Público: `GET /api/pss/editais`, `GET /api/pss/editais/:id`, `GET /api/pss/editais/:id/ranking` (espelha o app antigo).
- Cidadão (auth): `POST /api/pss/editais/:id/inscrever`, `GET /api/pss/minhas-inscricoes`.
- Admin/comissão: CRUD editais/vagas/fases/critérios; `POST .../notas`; publicação de ranking; export APLIC.

## 7. Papéis (RBAC)
`admin_prefeitura`/`gestor`/`servidor` (comissão): gestão e lançamento de notas. `cidadao`: inscrição e consulta. Ranking público.

## 8. Feature flag
`funcionalidades.pss` (default `true` em `camara`).

## 9. LGPD
Dados de candidato (CPF, documentos) → base legal: procedimento seletivo/obrigação legal; minimização; acesso restrito à comissão; logs; retenção conforme edital.

## 10. Critérios de aceite
- Edital publica fases/critérios; cidadão se inscreve com anexos.
- Notas geram ranking com desempate determinístico.
- Exportação APLIC válida no leiaute TCE-MT.
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Concurso público de provas e títulos completo (escopo PSS); pagamento de taxa de inscrição.
