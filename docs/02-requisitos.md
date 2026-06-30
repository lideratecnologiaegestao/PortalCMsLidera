# 02 — Requisitos

## Requisitos funcionais (por módulo)

### Plataforma / Admin
- Cadastro e gestão de tenants (câmaras municipais), domínios, planos.
- Gestão de usuários, setores/comissões e papéis por tenant.
- Painel de filas (BullBoard) restrito a admin.
- Auditoria consultável de ações sensíveis.

### Parlamentar
- Cadastro de vereadores (mandato, partido, biografia, contato, posts).
- **Mesa Diretora** com vigência (presidente, vice, secretários) e histórico de composições.
- **Comissões** (permanentes/temporárias), membros e representações.

### Sessões Plenárias
- Pauta, ata, **presença/frequência** dos vereadores e calendário de sessões.
- **TV Câmara**: transmissões ao vivo e acervo de sessões gravadas.

### Legislativo (Proposições)
- Projetos de lei e demais proposições com **tramitação** (FSM: do protocolo à sanção/promulgação/arquivamento).
- **Votação nominal** (registro de quem votou como) e resultado por sessão.
- Repositório de **leis/normas** publicadas, com busca; **iniciativa popular**.

### CMS dinâmico
- Páginas compostas por blocos configuráveis (hero, vereadores, sessões, notícias, galeria, "História da Câmara").
- Edição de identidade visual (tema) com pré-visualização e validação de acessibilidade.
- Publicação/despublicação e SEO por página.

### ESIC (LAI)
- Registro de pedido de acesso à informação (autenticado via gov.br; nível mínimo configurável).
- Triagem, encaminhamento ao setor/comissão responsável, resposta, indeferimento, atendimento parcial.
- Prorrogação justificada (+10 dias). Recursos de 1ª e 2ª instância.
- Protocolo, acompanhamento e notificação ao cidadão. Controle de sigilo.

### Ouvidoria (Lei 13.460)
- Manifestações: denúncia (anônima permitida), reclamação, sugestão, elogio, solicitação.
- Tratamento, resposta e conclusão; pesquisa de satisfação.
- Carta de Serviços ao Usuário.

### Transparência
- **Transparência da produção legislativa**: proposições, tramitação, **votação nominal** (quem votou como), presença/frequência de vereadores, leis/normas publicadas.
- Execução orçamentária **da própria Câmara** (despesas até 24h via LC 131/LRF), licitações, contratos, folha dos servidores da Câmara, diárias dos vereadores, verba de gabinete.
- Exportação em dados abertos (CSV/JSON) e API pública com dicionário de dados.
- ETL a partir do sistema contábil/APLIC-TCE (via n8n).

### Diário Oficial (da Câmara)
- Publicação de edições e atos legislativos com **assinatura digital ICP-Brasil**, imutabilidade e carimbo de tempo.
- Busca por número/data/assunto; arquivo histórico.

### Escola Legislativa
- Cursos, provas e **certificados com QR + validação pública**; fórum.

### Eventos & Audiências Públicas
- Inscrição em eventos/audiências e emissão de certificado de participação.

### App do Cidadão
- Acompanhamento da atividade legislativa (proposições, sessões, leis), agenda da Câmara e notificações (push).
- Abertura e acompanhamento de manifestações de Ouvidoria/e-SIC por protocolo.

### IA legislativa assistida
- Triagem/classificação de manifestações; sugestão de roteamento e prioridade.
- **Busca semântica (RAG) em leis, normas e proposições**; **resumo de atas**; chatbot da Câmara.
- OCR de documentos (projetos, atas, leis digitalizadas).

## Requisitos não-funcionais

| Categoria | Requisito |
|-----------|-----------|
| **Acessibilidade** | WCAG 2.1 AA, Design System gov.br, VLibras, ABNT NBR 17225. Bloqueante no tema. |
| **Desempenho** | Páginas públicas via ISR/cache; p95 < 500 ms em leitura cacheada; registro de manifestação p95 < 1 s. |
| **Disponibilidade** | Alvo 99,9% para o portal público; degradação graciosa do app offline-first. |
| **Segurança** | Ver [04](04-seguranca.md). RLS, RBAC, OWASP ASVS, segredos fora do git. |
| **Privacidade** | Ver [06](06-lgpd-gdpr.md). LGPD/GDPR por design. |
| **Escalabilidade** | Ver [09](09-escalabilidade.md). Horizontal na API/web; filas para picos. |
| **Observabilidade** | Logs estruturados, métricas, tracing, alertas de SLA e de erro. |
| **Conformidade legal** | LAI 12.527, LC 131/LRF, Lei 13.460, LGPD 13.709, WCAG 2.1 AA/eMAG (Lei 13.146), PNTP/Atricon (dimensão Atividades Finalísticas do Legislativo), gov.br (Lei 14.129/2021), ICP-Brasil para o Diário Oficial. |
| **Localização** | pt-BR; valores monetários e datas no padrão brasileiro. |
| **Auditabilidade** | Trilha imutável de eventos de manifestação, **de tramitação de proposições e de votação nominal**, e `audit_log` de ações sensíveis. |
| **Portabilidade** | Containerizado; sem dependência de provedor específico além do object storage/IA. |

## Critérios de aceite globais (DoD)

Toda feature: spec atendida · testes (incl. isolamento RLS) · acessibilidade quando há UI · base legal LGPD quando há dado pessoal · auditoria em ação sensível · docs atualizados · CI verde.
