import { Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { minhasManifestacoes } from '../src/api/manifestacoes';
import { useTheme } from '../src/state/theme';
import { useAuth } from '../src/state/auth';
import { Botao, Card, Carregando, Pill, Subtitulo, Tela, Vazio } from '../src/ui/componentes';
import { Icone } from '../src/ui/icone';
import { dataBR, rotuloStatusManifestacao } from '../src/ui/formato';
import { useRecurso } from '../src/ui/useRecurso';

export default function MinhasManifestacoes() {
  const { c } = useTheme();
  const { token } = useAuth();
  const router = useRouter();

  const { dados, carregando, atualizando, recarregar, erro } = useRecurso(
    () => (token ? minhasManifestacoes() : Promise.resolve([])),
    [token],
  );

  if (!token) {
    return (
      <Tela>
        <Stack.Screen options={{ title: 'Minhas manifestações' }} />
        <Vazio icone="account-lock-outline">Entre na sua conta para ver suas manifestações.</Vazio>
        <Botao titulo="Entrar" icone="login" onPress={() => router.push('/conta/login')} />
      </Tela>
    );
  }

  if (carregando) return <Carregando />;

  const lista = dados ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: 'Minhas manifestações' }} />
      <Subtitulo>Ouvidoria e e-SIC abertos com a sua conta.</Subtitulo>
      {erro && <Subtitulo>{erro}</Subtitulo>}
      {lista.length === 0 ? (
        <Vazio icone="folder-open-outline">Você ainda não abriu manifestações identificadas.</Vazio>
      ) : (
        lista.map((m) => (
          <Card
            key={m.id}
            onPress={() => router.push({ pathname: '/ouvidoria/consultar', params: { protocolo: m.protocolo } })}
            accessibilityLabel={`Protocolo ${m.protocolo}`}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.fg, fontWeight: '700' }}>{m.protocolo}</Text>
              <Pill texto={rotuloStatusManifestacao(m.status)} cor={c.secondary} />
            </View>
            <Text style={{ color: c.fg, fontSize: 14, marginTop: 6 }} numberOfLines={2}>{m.assunto}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
              <Pill texto={m.canal === 'esic' ? 'e-SIC' : 'Ouvidoria'} cor={c.muted} />
              <Icone nome="calendar" tamanho={13} cor={c.muted} />
              <Text style={{ color: c.muted, fontSize: 12 }}>{dataBR(m.criadoEm)}</Text>
            </View>
          </Card>
        ))
      )}
    </Tela>
  );
}
