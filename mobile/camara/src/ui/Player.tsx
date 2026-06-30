import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../state/theme';
import { youtubeId } from './formato';
import { Aviso } from './componentes';

/**
 * Player de vídeo embutido (TV Câmara / gravações de sessão).
 * Para YouTube, usa o embed oficial; para outras URLs (HLS/mp4/iframe externo),
 * carrega a própria URL no WebView. Mantém proporção 16:9 e bordas arredondadas.
 */
export function Player({ url, plataforma }: { url?: string | null; plataforma?: string | null }) {
  const { c } = useTheme();

  if (!url) {
    return <Aviso tipo="info">Vídeo indisponível no momento.</Aviso>;
  }

  const yid = youtubeId(url);
  const src =
    yid && (plataforma === 'youtube' || plataforma == null || /youtu/.test(url))
      ? `https://www.youtube.com/embed/${yid}?playsinline=1&rel=0`
      : url;

  return (
    <View
      style={{
        width: '100%',
        aspectRatio: 16 / 9,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <WebView
        source={{ uri: src }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        style={{ flex: 1, backgroundColor: '#000' }}
      />
    </View>
  );
}
