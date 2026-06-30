# Spec — L4 Escola Legislativa (Cursos, Provas, Certificados)

## 1. Objetivo
Plataforma de educação cidadã da câmara: **cursos** (módulos → aulas em EditorJS), **provas** (objetivas e dissertativas com correção do professor), **fórum de dúvidas**, **inscrição** e **certificados PDF com QR + validação pública**, com editor visual de templates de certificado. Origem Laravel: 22 models `Curso*`, `CursoProva/Questao/Opcao/Tentativa*`, `CursoInscricao`, `CursoCertificado`, `Certificate*`.

## 2. Conformidade legal
Acessibilidade AA (Lei 13.146) no conteúdo e nas provas; LGPD para dados de alunos; validade do certificado por verificação pública (autenticidade).

## 3. Requisitos funcionais
1. **Cursos**: CRUD com carga horária, período, capa, certificação automática (sim/não), restrições de inscrição.
2. **Estrutura**: módulos ordenados → aulas (conteúdo EditorJS, mídia, duração); registro de conclusão por aula.
3. **Provas**: por módulo ou final; questões objetivas (múltipla escolha) e **dissertativas**; nota mínima, tempo, número de tentativas; `heartbeat` durante a prova; submissão e resultado.
4. **Correção**: painel do professor para corrigir dissertativas; cálculo de nota final.
5. **Fórum**: dúvidas por aula + respostas (professor/alunos).
6. **Inscrição/Área do aluno**: meus cursos, progresso, provas, certificados.
7. **Certificados**: emissão com `codigo` único + QR; geração de PDF a partir de **template visual** (elementos/textos/fotos posicionáveis); **validação pública** em `/validar/{codigo}`.
8. **Feedback** do curso pelo aluno.

## 4. Não-funcionais
Geração de PDF/QR assíncrona (fila) ou on-demand; alerta de permissão de escrita p/ certificados; acessibilidade AA; auditoria de emissão.

## 5. Modelo de dados (db/1xx_escola_legislativa.sql — `tenant_id` + RLS)
- `cursos`, `curso_modulos`, `curso_aulas`, `curso_aula_conclusoes`.
- `curso_provas`, `curso_questoes`, `curso_opcoes`.
- `curso_tentativas_prova`, `curso_tentativa_questoes`.
- `curso_inscricoes`, `curso_certificados` (codigo, pdf ref, emitido_em).
- `certificate_templates`, `certificate_elements`, `certificate_texts`, `certificate_photos`, `certificate_types`.
- `curso_aula_duvidas`, `curso_aula_respostas`, `curso_feedbacks`, `curso_restricoes`.
> Mídia/PDF via `media`. Reusar geração de PDF/QR já existente na plataforma.

## 6. Contrato de API
- Público: `GET /api/cursos`, `GET /api/cursos/:slug`, `GET /api/validar/:codigo` (validação de certificado).
- Aluno (auth): `POST /api/cursos/:slug/inscrever`, `GET /api/aluno/cursos`, aulas/conclusão, `GET/POST /api/cursos/:slug/prova` (throttle), `GET /api/certificados/:id/download`, fórum.
- Professor (role `professor`): CRUD curso/módulo/aula/prova, `GET /api/professor/correcoes`, `POST .../corrigir`.
- Admin: gestão de templates de certificado e tipos.

## 7. Papéis (RBAC)
`professor`: cria/edita cursos e corrige provas (escopo Escola). `admin_prefeitura`/`gestor`: gestão e templates. `cidadao` (aluno autenticado): inscrição/aulas/provas/certificados. Validação de certificado é pública.

## 8. Feature flag
`funcionalidades.escola_legislativa` (default `true` em `camara`).

## 9. LGPD
Dados de aluno (nome, e-mail, CPF p/ certificado) → base legal: execução de serviço educacional/consentimento; minimização; logs de acesso; certificado público expõe só o necessário (nome, curso, data, código).

## 10. Critérios de aceite
- Aluno percorre curso → prova → aprovação → certificado com QR.
- `/validar/{codigo}` confirma autenticidade (e migra códigos legados sem quebrar).
- Dissertativa exige correção do professor antes da nota final.
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Videoconferência ao vivo; emissão de certificado por terceiros fora da plataforma.
