import { Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { listarComissoes } from '../../src/api/parlamentar';
import { useTheme } from '../../src/state/theme';
import { Card, Carregando, Pill, Subtitulo, Tela, Vazio } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { useRecurso } from '../../src/ui/useRecurso';

export default function Comissoes() {
  const { c } = useTheme();
  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(
    () => listarComissoes(),
    [],
  );

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: 'Comissões' }} />
      <Subtitulo>Comissões permanentes e temporárias da Câmara.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="account-multiple-outline">Nenhuma comissão cadastrada.</Vazio>
      ) : (
        lista.map((cm) => (
          <Card key={cm.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icone nome="account-multiple-outline" tamanho={24} cor={c.primary} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.fg, fontWeight: '700', fontSize: 14.5 }}>{cm.nome}</Text>
                {cm.descricao && (
                  <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13 }}>{cm.descricao}</Text>
                )}
              </View>
              {cm.tipo && <Pill texto={cm.tipo} cor={c.muted} />}
            </View>
          </Card>
        ))
      )}
    </Tela>
  );
}
