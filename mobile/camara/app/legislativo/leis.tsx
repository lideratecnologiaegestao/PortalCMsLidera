import { Linking, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { listarLeis } from '../../src/api/legislativo';
import { useTheme } from '../../src/state/theme';
import { Botao, Card, Carregando, Pill, Subtitulo, Tela, Vazio } from '../../src/ui/componentes';
import { dataBR } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

export default function Leis() {
  const { c } = useTheme();
  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(() => listarLeis(), []);

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: 'Leis municipais' }} />
      <Subtitulo>Legislação sancionada pela Câmara. Toque no PDF para abrir o texto oficial.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="book-open-variant">Nenhuma lei publicada.</Vazio>
      ) : (
        lista.map((l) => (
          <Card key={l.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Pill texto={`${(l.tipo || 'Lei').toUpperCase()} ${l.numero ?? ''}/${l.ano ?? ''}`} />
              <Pill texto={l.vigente ? 'Vigente' : 'Revogada'} cor={l.vigente ? c.success : c.muted} />
            </View>
            <Text style={{ color: c.fg, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
              {l.ementa ?? 'Sem ementa.'}
            </Text>
            {l.dataSancao && (
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>
                Sancionada em {dataBR(l.dataSancao)}
              </Text>
            )}
            {l.pdfUrl && (
              <Botao
                titulo="Abrir PDF"
                variante="contorno"
                icone="file-pdf-box"
                style={{ marginTop: 10 }}
                onPress={() => Linking.openURL(l.pdfUrl!)}
              />
            )}
          </Card>
        ))
      )}
    </Tela>
  );
}
