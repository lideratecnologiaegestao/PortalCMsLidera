# Runbook de Deploy — Portal da Câmara (SaaS multi-câmaras)

> Servidor **Lidera** (Windows Server 2022 + WSL2/Ubuntu + Docker). Reusa a
> infra existente (`D:\Infraestrutura\Infraestrutura.md`): Redis, MinIO e
> Evolution na rede Docker `evolution-net`. Banco **dedicado** `camara-postgres`
> (postgis + pgvector). Exposição via Nginx (Windows) + Cloudflare Zero Trust.

## Topologia

```
Internet ─► Cloudflare ZT Tunnel ─► Nginx (C:\nginx, :80) ─┬─ / ───► 127.0.0.1:3010  camara-web (Next.js)
   *.camara.lidera.app.br                                  ├─ /api ► 127.0.0.1:3011  camara-api (NestJS)
                                                           └─ /midia ► camara-api
camara-api ─(evolution-net)─► camara-postgres:5432 (portal_app)  · redis:6379/DB4  · portal-minio:9000  · evolution-api:8080
```

Portas (loopback): câmara **web 3010 / api 3011 / postgres 5435** (a prefeitura usa 3000/3001/5434 — sem colisão).

## Regras invioláveis

- **RLS:** a API conecta como **`portal_app`** (`NOSUPERUSER NOBYPASSRLS`). Superusuário burla o RLS e quebra o isolamento entre câmaras. Nunca usar `postgres` na `DATABASE_URL`.
- Segredos ficam só em `.env.prod` (gitignored). Rotacionar se vazar.

---

## 1. Provisionamento do banco (FEITO — referência para reprovisionar)

```bash
# Container dedicado (postgis + pgvector), volume e porta próprios:
wsl docker run -d --name camara-postgres --restart=always --network evolution-net \
  -p 127.0.0.1:5435:5432 \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD="$PG_SUPER" -e POSTGRES_DB=camara \
  -v camara_postgres_data:/var/lib/postgresql/data \
  portal-postgres-pgvector:16

# Roles da aplicação (NOSUPERUSER NOBYPASSRLS):
wsl docker exec camara-postgres psql -U postgres -d camara \
  -c "CREATE ROLE portal_app LOGIN PASSWORD '$PG_APP' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;" \
  -c "CREATE ROLE portal_ro  LOGIN PASSWORD '$PG_RO'  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;"

# Migrations 001–109 (109 concede grants ao portal_app):
wsl bash -c 'cat /mnt/d/Site/portal-camara/db/[0-9]*.sql | docker exec -i camara-postgres psql -U postgres -d camara -v ON_ERROR_STOP=1 -q'

# Seed de demonstração (opcional — "Câmara Municipal de Exemplo"):
wsl bash -c 'docker exec -i camara-postgres psql -U postgres -d camara < /mnt/d/Site/portal-camara/db/scripts/seed_camara_exemplo.sql'
```

> Senhas geradas no provisioning estão em `.env.prod` (`DATABASE_URL`, `POSTGRES_SUPERUSER_PASSWORD`). RLS verificado: `portal_app` lê 5 vereadores com o GUC do tenant e 0 sem.

## 2. Build + subida da aplicação

```bash
# Da raiz do projeto, via WSL (Docker está no WSL2):
wsl bash -c "cd /mnt/d/Site/portal-camara && docker compose -f docker-compose.camara.prod.yml --env-file .env.prod up -d --build"

# Verificar:
wsl docker ps --filter name=camara-
wsl docker logs --tail 50 camara-api
curl -s -H 'Host: camara-exemplo' http://127.0.0.1:3011/api/vereadores | head -c 300
```

> A primeira build instala deps e compila (api: `nest build`; web: `next build` standalone). Imagens: `portal-camara-api:latest`, `portal-camara-web:latest`.

## 3. Bucket de storage (MinIO)

Criar o bucket `camara` no MinIO compartilhado (uploads de anexos/documentos/certificados):

```bash
wsl docker run --rm --network evolution-net minio/mc sh -c \
  "mc alias set lid http://portal-minio:9000 KzBVjyTCbup6qAJM7GFx '<MINIO_SECRET>' && mc mb -p lid/camara"
```

> Recomendado (segurança): criar uma **access key dedicada** para a câmara com política restrita ao bucket `camara` e trocar `STORAGE_ACCESS_KEY/SECRET` no `.env.prod` (hoje usa a root). 

## 4. Nginx — roteamento por Host (câmara × prefeitura)

Câmaras e prefeituras compartilham o espaço `*.lidera.app.br`. O Nginx decide o destino pelo **Host**, com base em `server_name` EXATOS (match exato vence o curinga `*.lidera.app.br` da prefeitura):

| Host | Destino |
|---|---|
| `camara.lidera.app.br` | **Painel geral** (plataforma); `/` → `/plataforma` |
| `<slug>.lidera.app.br` (listado no vhost) | Câmara (tenant pelo subdomínio) |
| `*.lidera.app.br` (resto) | Prefeitura (`prefeitura.conf`, intacto) |

```powershell
# Copiar o vhost + o snippet de locations:
copy D:\Site\portal-camara\infra\camara\camara.nginx.conf      C:\nginx\conf\sites\camara.conf
copy D:\Site\portal-camara\infra\camara\camara_locations.inc   C:\nginx\conf\sites\camara_locations.inc
C:\nginx\nginx.exe -p C:\nginx\ -t
Restart-Service nginx   # `-s reload` falha: Nginx roda como serviço (LocalSystem)
```

**➕ Nova câmara** = acrescentar o host no `server_name` do **2º server block** do `camara.conf` (ex.: `cmnovacamara.lidera.app.br`) + `nginx -t` + `Restart-Service nginx` + criar a linha em `tenants` (subdomínio = `cmnovacamara`). Nada mais.

> **Domínio oficial .leg.br** (ex.: `serranovadourada.mt.leg.br`): acrescente no `server_name` E **remova `*.mt.leg.br` do `prefeitura.conf`** (hoje a prefeitura captura todo `*.mt.leg.br`).

## 5. Cloudflare Zero Trust + DNS

**Nada a fazer por câmara** — como tudo vive em `*.lidera.app.br` (1 rótulo) e o wildcard `*.lidera.app.br` **já existe** no Cloudflare ZT apontando para `HTTP localhost:80`, qualquer `<slug>.lidera.app.br` e o próprio `camara.lidera.app.br` já chegam ao Nginx. O roteamento câmara/prefeitura é 100% do Nginx (seção 4).

- Painel geral: **`https://camara.lidera.app.br`** → redireciona para **`/plataforma`** (Gerenciador da Plataforma; login super_admin). Ativado por `PLATFORM_HOST=camara.lidera.app.br`.
- `PLATFORM_BASE_DOMAIN=lidera.app.br` faz `<slug>.lidera.app.br` resolver o tenant de subdomínio `<slug>` no banco da câmara.

## 6. Pós-deploy — criar uma câmara real (tenant)

Cada câmara é uma linha em `tenants` (resolução por Host/subdomínio). Exemplo:

```sql
-- como superusuário (admin), no banco camara:
INSERT INTO tenants (id, slug, nome, uf, tipo, subdominio, funcionalidades, ativo)
VALUES (gen_random_uuid(), 'serra-nova-dourada', 'Câmara Municipal de Serra Nova Dourada',
        'MT', 'camara', 'camara-snd',
        '{"parlamentar":true,"sessoes":true,"legislativo":true,"escola":true,"pss":true,"eventos":true,"chamados":false,"prefeito":false}'::jsonb,
        true);
```

Depois: criar usuário admin (módulo de usuários / endpoint de provisionamento), ajustar tema/branding, e migrar os dados reais (ver `migration/etl/`).

## 7. Operação

```bash
wsl docker logs -f camara-api          # logs da API
wsl docker logs -f camara-web          # logs do portal
wsl bash -c "cd /mnt/d/Site/portal-camara && docker compose -f docker-compose.camara.prod.yml restart camara-api"
# Backup do banco da câmara:
wsl bash -c "docker exec camara-postgres pg_dump -U postgres camara | gzip > ~/backups/camara_$(date +%F).sql.gz"
```

## 8. Checklist de go-live

- [ ] `camara-postgres` up, roles `portal_app`/`portal_ro` `NOSUPERUSER NOBYPASSRLS`, 189 tabelas, grants OK.
- [ ] `.env.prod` com `DATABASE_URL` apontando para **portal_app** (nunca postgres).
- [ ] `camara-api` e `camara-web` up; `/api/vereadores` responde com o Host do tenant.
- [ ] Bucket `camara` criado no MinIO (e idealmente access key dedicada).
- [ ] `camara.conf` no Nginx, `nginx -t` OK, reload feito.
- [ ] Hostname no Cloudflare ZT + DNS resolvendo.
- [ ] `ANTHROPIC_API_KEY` preenchida se for usar IA legislativa.
- [ ] Tenant(s) real(is) criados; dados migrados (ETL) quando aplicável.
