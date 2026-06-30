# ETL de migração — MySQL (Laravel antigo) → PostgreSQL (plataforma nova)

> **Fase 7** do roadmap (`PLANEJAMENTO.md`). Migra os dados de produção da
> **Câmara de Serra Nova Dourada/MT** do sistema Laravel monolítico
> (`portal-camara-old`, MySQL) para o schema multi-tenant da plataforma nova
> (`portal-camara`, PostgreSQL 16 + RLS), carregando tudo como o tenant
> **Serra Nova Dourada**.

Scripts em **Node.js puro** (sem framework pesado), usando apenas `mysql2`
(origem) e `pg` (destino), declarados no `package.json` deste diretório.

---

## 1. Princípios de projeto

| Princípio | Como é garantido |
|---|---|
| **Isolamento por RLS** (regra inviolável) | Todo INSERT roda dentro de uma transação que faz `SET LOCAL app.current_tenant_id = <tenant>` (igual ao `PrismaService` da API). O RLS `FORCE` do banco só aceita linhas com `tenant_id` do tenant ativo. Nunca desabilitamos RLS. Modo plataforma (`app.is_platform=on`) é usado **só** para resolver/criar o registro em `tenants` (tabela-registro sem RLS por tenant). Ver `lib/target-pg.js`. |
| **Idempotência** | IDs de destino são **UUIDv5 determinísticos** derivados de `(namespace do tenant + nome lógico da tabela + id legado)` (`lib/idmap.js`). Todo upsert é `INSERT ... ON CONFLICT (id) DO UPDATE`. Re-rodar **atualiza** as mesmas linhas — nunca duplica. As tabelas `transp_*` usam a **chave natural** do db/007 como alvo de conflito. |
| **Resolução de FK sem tabela de-para** | Como o UUID é determinístico, para referenciar o vereador #12 a partir de outro módulo basta recalcular `uid('vereadores', 12)`. Nenhuma tabela auxiliar de mapeamento é necessária. |
| **Fronteira de camadas / storage via API** | O ETL **não** faz upload binário para o storage (regra: upload sempre pela API). Ele **preserva os caminhos/URLs antigos** em colunas `*_url` e deixa `storage_key` NULL (ou um marcador `LEGADO_PENDENTE/...` onde a coluna é `NOT NULL`). Um passo posterior re-hospeda a mídia via API e preenche `storage_key`. |
| **Sem perda de dado** | Conteúdo rico (HTML/EditorJS, layout de certificado) que não tem coluna 1:1 é preservado encapsulado (bloco `raw` no jsonb de aulas; placeholder `__LAYOUT_LEGADO__` em `certificate_texts`). |

---

## 2. Ordem de carga (por dependência de FK)

O runner (`index.js`) executa nesta ordem. A ordem importa porque módulos
posteriores referenciam IDs dos anteriores.

1. **usuarios** — `users` (base de FK de quase tudo: manifestações, escola, etc.).
2. **parlamentar** — `vereadores` → mesa diretora, comissões, cargos, documentos,
   posts, representações.
3. **sessoes** — tipos de sessão, sessões, presença (depende de vereadores),
   pauta e gravações. A pauta referencia proposições por **uuid simples (sem FK)**.
4. **legislativo** — `projetos_lei → proposicoes` (+ autores, tramitação, votação,
   votos), `leis`, comitês de iniciativa popular.
5. **transparencia** — receitas/despesas/licitações/contratos/folha + verbas
   indenizatórias (independente; chave natural).
6. **manifestacoes** — ESIC + Ouvidoria → modelo unificado `manifestacoes`
   (cidadão/responsável → users).
7. **escola** — cursos/módulos/aulas/inscrições/provas/tentativas/**certificados**,
   fórum, feedback, templates de certificado.

Rodar um subconjunto:

```bash
node index.js --only=usuarios,parlamentar
node index.js --skip=transparencia
```

---

## 3. Configuração

Copie `.env.example` para `.env` e ajuste. Variáveis principais:

- **Origem MySQL:** `MYSQL_HOST/PORT/DATABASE/USER/PASSWORD`.
- **Destino Postgres:** `DATABASE_URL` **ou** `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD` (+ `PGSSLMODE`).
- **Tenant alvo:** `TENANT_SLUG` (resolve por slug; cria se `TENANT_CREATE_IF_MISSING=true`).
- **Senhas:** `PASSWORD_STRATEGY` (`preserve` | `reset`) — ver seção 4.
- **Lote/log:** `BATCH_SIZE`, `LOG_LEVEL`, `DRY_RUN`.

> O `.env` **não** deve ser commitado (já no `.gitignore`).

### Pré-requisitos no destino

As migrations `db/001–108` precisam estar aplicadas no Postgres alvo (o schema
e o RLS são a fonte da verdade). O ETL **não** cria tabelas — só popula.

---

## 4. Re-hash / tratamento de senhas

O Laravel guarda senha em **bcrypt** (`$2y$...`). Duas estratégias:

- **`preserve`** (padrão): copia o hash para `users.senha_hash`. Bcrypt `$2y$`
  é compatível com `$2a$/$2b$` na verificação — a API deve aceitar o prefixo
  `$2y$` no login (a maioria das libs Node como `bcryptjs` aceita; caso a API
  use `argon2`, prefira `reset`). Login do cidadão continua funcionando sem
  fricção.
- **`reset`**: **não** copia a senha (`senha_hash = NULL`) e cria um registro
  em `auth_verificacoes` (finalidade `reset`) para **forçar primeiro acesso**
  por e-mail. Use quando o algoritmo de hash da plataforma nova diferir do
  bcrypt, ou por política de segurança no cutover.

A decisão é por env — não exige mudança de código.

---

## 5. Preservação de protocolos e códigos (validação pública)

Itens cuja **URL pública não pode quebrar** são copiados **1:1**:

- **Protocolos ESIC/Ouvidoria** (`ESIC2026…`, `OUV2026…`): copiados para
  `manifestacoes.protocolo`. Unicidade no destino é `(tenant_id, protocolo)`.
  **Bug do legado corrigido:** `OuvidoriaManifestacao::gerarProtocolo()` ignorava
  registros soft-deleted, o que podia gerar **colisão**. O ETL detecta colisão
  de protocolo dentro do mesmo canal e **desambigua** sufixando `-D{id}`,
  registrando a correção em `manifestacao_eventos.observacao`. Sem colisão,
  o protocolo permanece idêntico.
- **Códigos de certificado** (`curso_certificados.codigo`): copiados 1:1
  (destino tem `UNIQUE(codigo)` global). A rota `/validar/{codigo}` continua
  resolvendo.

---

## 6. Modo de execução

```bash
npm install              # instala mysql2 + pg + dotenv
cp .env.example .env     # e edite
npm run etl:dry          # ensaio: lê/transforma, NÃO escreve (valida mapeamentos)
npm run etl              # carga real (idempotente)
npm run reconcile        # só recontagem do destino
```

- `--dry-run` (`DRY_RUN=true`) **não escreve nada**; serve para validar
  conexões e o volume estimado.
- Em erro de uma fase, o runner **aborta** (a ordem de FK importa). Como tudo é
  idempotente, basta corrigir e **re-rodar** — as fases já concluídas apenas
  fazem upsert de novo, sem efeito colateral.

---

## 7. Reconciliação

Ao final (ou via `--reconcile-only`), o runner imprime `COUNT(*)` por tabela de
destino no contexto do tenant. Compare manualmente com os `COUNT(*)` da origem
para validar a integridade (ex.: `SELECT count(*) FROM vereadores` no MySQL vs.
`vereadores` no relatório). Os contadores quebram `manifestacoes` por canal
(`esic` / `ouvidoria`) para conferência separada.

---

## 8. Estrutura

```
migration/etl/
  package.json          deps próprias (mysql2, pg, dotenv)
  .env.example          config por ambiente
  README.md             este arquivo (estratégia)
  DEPARA.md             mapa de-para campo a campo (origem → destino)
  index.js              runner (ordem de carga, args, reconciliação)
  lib/
    config.js           parsing de env
    logger.js           log por nível
    source-mysql.js     conexão/leitura MySQL (somente leitura)
    target-pg.js        conexão Postgres + withTenant (RLS) + withPlatform
    idmap.js            UUIDv5 determinístico (idempotência + FK)
    upsert.js           upsert em lote por id (ON CONFLICT)
    transform.js        helpers (datas, slug, enum, cpf, json)
    tenant.js           resolve/cria o tenant alvo
  modules/
    usuarios.js         users / papéis (re-hash de senha)
    parlamentar.js      vereadores, mesa, comissões, posts, representações
    sessoes.js          tipos, sessões, presença, pauta, gravações
    legislativo.js      proposições, tramitação, votação, leis, iniciativa popular
    transparencia.js    receitas/despesas/licitações/contratos/folha/verbas
    manifestacoes.js    ESIC + ouvidoria → manifestações unificadas
    escola.js           cursos, provas, certificados, fórum, templates
```

Ver **`DEPARA.md`** para o mapeamento detalhado de cada tabela/campo e as
decisões de transformação.
