import { useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../state/theme';

/**
 * Renderizador de HTML (conteúdo de notícia / texto de lei). Usa WebView com uma
 * folha de estilo que herda as cores do tema (claro/escuro) e a tipografia do
 * sistema, garantindo legibilidade e contraste. Altura fixa simples (rolagem
 * interna) — suficiente para corpo de notícia/lei.
 */
export function Html({ html, altura = 520 }: { html?: string | null; altura?: number }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();

  const doc = `<!DOCTYPE html><html><head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
    <style>
      :root { color-scheme: ${c.bg === '#f4f6f9' ? 'light' : 'dark'}; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 0;
        font-family: -apple-system, Roboto, "Segoe UI", sans-serif;
        font-size: 16px; line-height: 1.6;
        color: ${c.fg}; background: ${c.bg};
        word-wrap: break-word;
      }
      a { color: ${c.primary}; }
      img, video, iframe { max-width: 100%; height: auto; border-radius: 8px; }
      h1,h2,h3 { color: ${c.fg}; line-height: 1.3; }
      blockquote { border-left: 3px solid ${c.primary}; margin: 0; padding-left: 12px; color: ${c.muted}; }
      table { width: 100%; border-collapse: collapse; }
      td, th { border: 1px solid ${c.border}; padding: 6px; }
    </style>
  </head><body>${html ?? ''}</body></html>`;

  return (
    <WebView
      originWhitelist={['*']}
      source={{ html: doc }}
      style={{ width: width - 32, height: altura, backgroundColor: c.bg }}
      scrollEnabled
      showsVerticalScrollIndicator={false}
    />
  );
}
