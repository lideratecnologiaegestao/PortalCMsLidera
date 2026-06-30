import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listarVereadores } from '../../src/api/parlamentar';
import { useTheme } from '../../src/state/theme';
import { Card, Carregando, Pill, Subtitulo, Tela, Vazio } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { useRecurso } from '../../src/ui/useRecurso';
import { Avatar } from './index';

export default function Vereadores() {
  const { c } = useTheme();
  const router = useRouter();
  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(
    () => listarVereadores({ status: 'ativo' }),
    [],
  );

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Subtitulo>Conheça os parlamentares e acompanhe seus mandatos.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="account-group-outline">Nenhum vereador cadastrado.</Vazio>
      ) : (
        lista.map((v) => (
          <Card
            key={v.id}
            onPress={() => v.slug && router.push(`/vereador/${v.slug}`)}
            accessibilityLabel={`Perfil de ${v.nomeParlamentar}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar uri={v.fotoUrl} nome={v.nomeParlamentar} cor={c.primary} tamanho={56} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15.5 }}>{v.nomeParlamentar}</Text>
                {v.nome !== v.nomeParlamentar && (
                  <Text style={{ color: c.muted, fontSize: 12.5 }}>{v.nome}</Text>
                )}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {v.partido && <Pill texto={v.partido} />}
                  {v.legislatura && <Pill texto={`Legislatura ${v.legislatura}`} cor={c.muted} />}
                </View>
              </View>
              <Icone nome="chevron-right" tamanho={22} cor={c.muted} />
            </View>
          </Card>
        ))
      )}
    </Tela>
  );
}
