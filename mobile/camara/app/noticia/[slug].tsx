import { Image, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { obterNoticia } from '../../src/api/noticias';
import { useTheme } from '../../src/state/theme';
import { Aviso, Carregando, Pill, Tela, Titulo } from '../../src/ui/componentes';
import { Html } from '../../src/ui/Html';
import { dataBR } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

export default function NoticiaDetalhe() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { dados: n, carregando, atualizando, recarregar, erro } = useRecurso(
    () => obterNoticia(String(slug)),
    [slug],
  );

  if (carregando) return <Carregando />;
  if (erro || !n)
    return (
      <Tela>
        <Aviso tipo="erro">{erro ?? 'Notícia não encontrada.'}</Aviso>
      </Tela>
    );

  const imagem = n.imagemUrl ?? n.imagemDestaqueUrl;
  const corpo = n.conteudo ?? n.corpo;

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: 'Notícia' }} />
      {imagem && (
        <Image
          source={{ uri: imagem }}
          style={{ width: '100%', height: 200, borderRadius: 12, backgroundColor: c.border }}
        />
      )}
      <View style={{ gap: 6 }}>
        {n.categoria && <Pill texto={n.categoria} />}
        <Titulo>{n.titulo}</Titulo>
        {n.publicadoEm && <Text style={{ color: c.muted, fontSize: 12.5 }}>{dataBR(n.publicadoEm)}</Text>}
      </View>
      {n.resumo && (
        <Text style={{ color: c.fg, fontSize: 15, fontWeight: '500', lineHeight: 22 }}>{n.resumo}</Text>
      )}
      {corpo ? <Html html={corpo} altura={620} /> : null}
    </Tela>
  );
}
