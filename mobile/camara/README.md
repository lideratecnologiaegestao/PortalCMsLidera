# App do Cidadão — Câmara Municipal (Expo / React Native)

App mobile (Android/iOS) do portal legislativo. Consome **exclusivamente** a API
NestJS por HTTP (Bearer token) — nunca acessa banco, storage ou filas
(fronteira de camadas). Faz parte da plataforma SaaS multi-tenant: a API resolve
a câmara (tenant) pelo Host, e o tema/branding vem de `GET /api/theme` em runtime.

## Stack

- Expo SDK 51 + React Native 0.74
- expo-router (roteamento por arquivos, abas + stack)
- expo-secure-store (token de sessão em Keychain/Keystore)
- TypeScript estrito, sem dependências de banco/SQL no cliente

## Telas

| Rota | Tela | Endpoints |
|---|---|---|
| `(tabs)/index` | Início (agregada) | `/noticias`, `/mesa-diretora`, `/tv-camara` |
| `(tabs)/noticias` + `noticia/[slug]` | Notícias e detalhe | `/noticias`, `/noticias/:slug` |
| `(tabs)/sessoes` + `sessao/[id]` | Sessões e TV Câmara | `/sessoes`, `/sessoes/:id`, `/tv-camara` |
| `(tabs)/vereadores` + `vereador/[slug]` | Vereadores e perfil | `/vereadores`, `/vereadores/:slug` |
| `parlamentar/comissoes` | Comissões | `/comissoes` |
| `legislativo/proposicoes` + `proposicao/[id]` | Proposições + votação nominal | `/proposicoes`, `/proposicoes/:id` |
| `legislativo/leis` | Leis municipais | `/leis` |
| `ouvidoria/abrir` | Abrir manifestação (Ouvidoria/e-SIC) | `POST /manifestacoes` |
| `ouvidoria/consultar` | Consultar protocolo + tramitação | `/manifestacoes/acompanhar` |
| `minhas` | Minhas manifestações (logado) | `/manifestacoes/minhas` |
| `conta/login` · `conta/cadastro` · `conta/recuperar` | Conta do cidadão | `/auth/cidadao/*` |

## Configuração

A base da API é configurável (não precisa editar código):

```bash
# .env (não versionado) ou variável de ambiente do build
EXPO_PUBLIC_API_URL=https://camara-exemplo.lidera.app.br
```

Sem `EXPO_PUBLIC_API_URL`, o app usa `expo.extra.apiUrl` do `app.json` (valor
"baked" por câmara no white-label). O `tenantSlug` é apenas informativo.

## Como rodar (desenvolvimento)

```bash
cd mobile/camara
npm install              # instala dependências (primeira vez)
npx expo start           # abre o Metro bundler (QR code)
# pressione a (Android), i (iOS) ou escaneie o QR com o Expo Go
```

Apontando para uma API local (a API resolve o tenant pelo Host; em dev, use o
domínio/porta do backend):

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 npx expo start
```

## Verificação

```bash
npm run typecheck        # tsc --noEmit (checagem de tipos)
```

## Estrutura

```
app/                    rotas (expo-router): abas + telas de stack
src/api/                cliente HTTP (bearer interceptor) + módulos por domínio + tipos
src/state/              contextos de auth (token seguro) e tema (branding por câmara)
src/ui/                 design system (componentes, ícones, player, html, formatadores)
assets/                 ícone/splash (placeholders — trocar antes de publicar)
```

Ver `BUILD-APK.md` para gerar binários (EAS) e o que falta para publicar nas lojas.
