import { Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listarNoticias } from '../../src/api/noticias';
import { useTheme } from '../../src/state/theme';
import { Card, Carregando, Subtitulo, Tela, Vazio } from '../../src/ui/componentes';
import { dataBR } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

export default function Noticias() {
  const { c } = useTheme();
  const router = useRouter();
  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(
    () => listarNoticias({ pageSize: 30 }),
    [],
  );

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Subtitulo>Comunicados e matérias do Legislativo.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="newspaper-variant-outline">Nenhuma notícia publicada por enquanto.</Vazio>
      ) : (
        lista.map((n) => (
          <Card key={n.id} onPress={() => router.push(`/noticia/${n.slug}`)} accessibilityLabel={`Notícia: ${n.titulo}`}>
            {(n.imagemUrl || n.imagemDestaqueUrl) && (
              <Image
                source={{ uri: n.imagemUrl ?? n.imagemDestaqueUrl ?? undefined }}
                style={{ width: '100%', height: 160, borderRadius: 10, marginBottom: 10, backgroundColor: c.border }}
              />
            )}
            <View style={{ gap: 5 }}>
              <Text style={{ color: c.fg, fontWeight: '700', fontSize: 16 }}>{n.titulo}</Text>
              {n.publicadoEm && <Text style={{ color: c.muted, fontSize: 12 }}>{dataBR(n.publicadoEm)}</Text>}
              {n.resumo && (
                <Text numberOfLines={3} style={{ color: c.muted, fontSize: 13.5, lineHeight: 19 }}>
                  {n.resumo}
                </Text>
              )}
            </View>
          </Card>
        ))
      )}
    </Tela>
  );
}
