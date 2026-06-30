import { Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { listarProposicoes } from '../../src/api/legislativo';
import { useTheme } from '../../src/state/theme';
import { Card, Carregando, Pill, Subtitulo, Tela, Vazio } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { dataBR, rotuloProposicao, rotuloStatusProposicao } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

export default function Proposicoes() {
  const { c } = useTheme();
  const router = useRouter();
  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(
    () => listarProposicoes(),
    [],
  );

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: 'Proposições' }} />
      <Subtitulo>Projetos de lei, requerimentos, indicações e moções em tramitação.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="file-document-outline">Nenhuma proposição publicada.</Vazio>
      ) : (
        lista.map((p) => (
          <Card key={p.id} onPress={() => router.push(`/proposicao/${p.id}`)} accessibilityLabel={`Proposição ${rotuloProposicao(p.tipo, p.numero, p.ano)}`}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Pill texto={rotuloProposicao(p.tipo, p.numero, p.ano)} />
              {p.statusAtual && <Pill texto={rotuloStatusProposicao(p.statusAtual)} cor={c.secondary} />}
            </View>
            <Text style={{ color: c.fg, fontSize: 14, marginTop: 8, lineHeight: 20 }} numberOfLines={4}>
              {p.ementa ?? 'Sem ementa.'}
            </Text>
            {p.dataProtocolo && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
                <Icone nome="calendar" tamanho={13} cor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 12 }}>Protocolada em {dataBR(p.dataProtocolo)}</Text>
              </View>
            )}
          </Card>
        ))
      )}
    </Tela>
  );
}
