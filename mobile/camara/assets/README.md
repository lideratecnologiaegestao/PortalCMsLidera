# Assets

Os arquivos `icon.png`, `adaptive-icon.png`, `splash.png` e `favicon.png` neste
diretório são **placeholders** (PNG 1×1 transparente) só para o app compilar e
rodar no Expo Go / dev client.

Antes de publicar, substitua por arte real da câmara (white-label):

| Arquivo | Tamanho recomendado | Uso |
|---|---|---|
| `icon.png` | 1024×1024 | Ícone do app (iOS/Android) |
| `adaptive-icon.png` | 1024×1024 (foreground) | Ícone adaptativo Android |
| `splash.png` | 1284×2778 (ou 1242×2436) | Tela de abertura |
| `favicon.png` | 48×48 | Favicon do build web |

A cor de fundo do splash/ícone adaptativo está em `app.json`
(`splash.backgroundColor` / `android.adaptiveIcon.backgroundColor`). As cores da
interface (tema) vêm da API em runtime (`GET /api/theme`), sem rebuild.
