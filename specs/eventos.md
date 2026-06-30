# Spec — L6 Eventos & Audiências Públicas (com certificação)

## 1. Objetivo
Gerir eventos institucionais e **audiências públicas** da câmara: agenda, inscrições, controle de presença e **certificado de participação**. Integra-se a sessões (L2) e à Escola Legislativa (L4, templates/certificados). Origem Laravel: `Evento`, `EventoInscricao`, `Assinante`.

## 2. Conformidade legal
Audiências públicas são instrumento de participação social (transparência e LRF para audiências fiscais); acessibilidade AA; LGPD para inscritos.

## 3. Requisitos funcionais
1. CRUD de evento: tipo (audiência pública, palestra, seminário, solenidade), data/hora, local/online, vagas, descrição (EditorJS), capa.
2. **Inscrição** (cidadão, com ou sem login conforme config); confirmação e lista.
3. **Presença**: registro (check-in) para fins de certificado.
4. **Certificado de participação**: emissão com `codigo` + QR usando template (reuso do L4); validação pública.
5. Vinculação opcional a uma sessão (L2) quando a audiência ocorre em plenário.
6. Calendário público integrado ao de sessões.

## 4. Não-funcionais
Acessibilidade AA; geração de certificado assíncrona; auditoria; throttling na inscrição pública.

## 5. Modelo de dados (db/1xx_eventos.sql — `tenant_id` + RLS)
- `eventos` (tipo, titulo, descricao, data_hora, local, vagas, online_url, sessao_id?).
- `evento_inscricoes` (evento_id, cidadao_id?/nome/email, status, presente).
- `evento_certificados` (evento_id, inscricao_id, codigo, pdf ref) — reusa templates do L4.
> Capa/anexos via `media`.

## 6. Contrato de API
- Público: `GET /api/eventos`, `GET /api/eventos/:id`, `POST /api/eventos/:id/inscrever`.
- Cidadão (auth): `GET /api/eventos/minhas-inscricoes`, `GET /api/eventos/certificados/:id/download`.
- Admin: CRUD eventos, gestão de inscrições/presença, emissão de certificados.
- Validação pública de certificado reaproveita `GET /api/validar/:codigo` (L4).

## 7. Papéis (RBAC)
`admin_prefeitura`/`gestor`/`servidor`: gestão e presença. `cidadao`: inscrição e certificado. Validação pública.

## 8. Feature flag
`funcionalidades.eventos` (default `true` em `camara`).

## 9. LGPD
Dados de inscrito (nome, e-mail, CPF p/ certificado) → base legal: consentimento/execução; minimização; logs; certificado expõe só o necessário.

## 10. Critérios de aceite
- Cidadão se inscreve, tem presença registrada e emite certificado válido.
- Certificado valida em `/validar/{codigo}`.
- Evento pode vincular-se a uma sessão do plenário.
- Teste de isolamento RLS (tenant A ≠ B).

## 11. Fora de escopo
Bilhetagem paga; transmissão ao vivo (usa URL externa, ver L2).
