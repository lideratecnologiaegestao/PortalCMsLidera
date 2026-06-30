# Build e publicação

## Pré-requisitos

- Node 18+ e a CLI do Expo (`npx expo`).
- Conta Expo (EAS) — `npx eas login`.
- Para iOS: conta Apple Developer (US$ 99/ano).
- Para Android: conta Google Play Console (taxa única US$ 25) para publicar; o
  APK de teste roda sem conta.

## 1. Arte e identidade (antes de buildar)

Trocar os placeholders em `assets/` (ver `assets/README.md`):
`icon.png`, `adaptive-icon.png`, `splash.png`, `favicon.png`.

Ajustar em `app.json` por câmara (white-label):
- `expo.name` — nome exibido do app
- `expo.ios.bundleIdentifier` e `expo.android.package` — ex.: `br.leg.<municipio>.cidadao`
- `expo.extra.apiUrl` — domínio da câmara (ou usar `EXPO_PUBLIC_API_URL` no build)
- `splash.backgroundColor` / `android.adaptiveIcon.backgroundColor`

## 2. Build local de teste (APK)

```bash
cd mobile/camara
npm install
npx expo prebuild --platform android      # gera projeto nativo (opcional)
# APK de desenvolvimento via EAS (recomendado, não precisa de Android SDK local):
npx eas build -p android --profile preview
```

Adicione um `eas.json` com o perfil `preview` (APK) e `production` (AAB):

```json
{
  "build": {
    "preview":    { "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  }
}
```

## 3. Build de produção (lojas)

```bash
npx eas build -p android --profile production   # gera .aab para a Play Store
npx eas build -p ios --profile production       # gera .ipa (requer Apple Developer)
```

Envio às lojas:

```bash
npx eas submit -p android --latest
npx eas submit -p ios --latest
```

## O que falta para publicar

1. **Assets reais** (ícone/splash) — hoje são placeholders 1×1.
2. **`eas.json`** com perfis e **`projectId`/owner do EAS** (`npx eas init`).
3. **Bundle id / package** definitivos por câmara.
4. **Política de privacidade** (URL) — exigida por Play Store e App Store (LGPD).
5. **Apple Developer Account** para iOS.
6. **Push notifications** (opcional): integrar `expo-notifications` + registrar o
   device token na API (fora do escopo desta fase; o backend hoje notifica por e-mail).
7. **Login gov.br** (opcional): abrir o fluxo OIDC do portal web via `expo-web-browser`
   e capturar o callback; o backend já expõe a base de auth do cidadão.
8. **Testes em dispositivo** (Android e iOS) e screenshots para as fichas das lojas.
