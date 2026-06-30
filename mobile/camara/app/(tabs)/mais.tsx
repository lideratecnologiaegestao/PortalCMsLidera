import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, type ModoTema } from '../../src/state/theme';
import { useAuth } from '../../src/state/auth';
import { Botao, Card, Pill, SecaoTitulo, Subtitulo, Tela } from '../../src/ui/componentes';
import { Icone, NomeIcone } from '../../src/ui/icone';

function ItemLink({
  icone,
  titulo,
  descricao,
  onPress,
}: {
  icone: NomeIcone;
  titulo: string;
  descricao?: string;
  onPress: () => void;
}) {
  const { c } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={titulo}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icone nome={icone} tamanho={24} cor={c.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: c.fg, fontWeight: '700', fontSize: 14.5 }}>{titulo}</Text>
          {descricao && <Text style={{ color: c.muted, fontSize: 12.5 }}>{descricao}</Text>}
        </View>
        <Icone nome="chevron-right" tamanho={22} cor={c.muted} />
      </View>
    </Card>
  );
}

export default function Mais() {
  const { c, modo, setModo, portal } = useTheme();
  const { usuario, token, sair } = useAuth();
  const router = useRouter();

  const modos: { v: ModoTema; rotulo: string; icone: NomeIcone }[] = [
    { v: 'claro', rotulo: 'Claro', icone: 'white-balance-sunny' },
    { v: 'escuro', rotulo: 'Escuro', icone: 'weather-night' },
    { v: 'auto', rotulo: 'Auto', icone: 'theme-light-dark' },
  ];

  return (
    <Tela>
      {/* Conta */}
      <SecaoTitulo>Minha conta</SecaoTitulo>
      {token && usuario ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icone nome="account-circle-outline" tamanho={40} cor={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }}>{usuario.nome}</Text>
              {usuario.email && <Text style={{ color: c.muted, fontSize: 12.5 }}>{usuario.email}</Text>}
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <View style={{ gap: 10 }}>
            <Subtitulo>Entre para acompanhar suas manifestações e pedidos de e-SIC.</Subtitulo>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Botao titulo="Entrar" icone="login" onPress={() => router.push('/conta/login')} style={{ flex: 1 }} />
              <Botao
                titulo="Criar conta"
                variante="contorno"
                onPress={() => router.push('/conta/cadastro')}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Card>
      )}

      {token && (
        <ItemLink
          icone="folder-account-outline"
          titulo="Minhas manifestações"
          descricao="Ouvidoria e e-SIC que você abriu"
          onPress={() => router.push('/minhas')}
        />
      )}

      {/* Participação */}
      <SecaoTitulo>Participação</SecaoTitulo>
      <ItemLink
        icone="message-alert-outline"
        titulo="Ouvidoria / e-SIC"
        descricao="Reclamação, denúncia, sugestão ou pedido de informação"
        onPress={() => router.push('/ouvidoria/abrir')}
      />
      <ItemLink
        icone="magnify"
        titulo="Consultar protocolo"
        descricao="Acompanhe uma manifestação pelo número e chave"
        onPress={() => router.push('/ouvidoria/consultar')}
      />

      {/* Legislativo */}
      <SecaoTitulo>Legislativo</SecaoTitulo>
      <ItemLink
        icone="file-document-outline"
        titulo="Proposições"
        descricao="Projetos de lei, requerimentos, indicações"
        onPress={() => router.push('/legislativo/proposicoes')}
      />
      <ItemLink
        icone="book-open-variant"
        titulo="Leis municipais"
        descricao="Legislação sancionada e vigente"
        onPress={() => router.push('/legislativo/leis')}
      />
      <ItemLink
        icone="account-multiple-outline"
        titulo="Comissões"
        descricao="Comissões permanentes e temporárias"
        onPress={() => router.push('/parlamentar/comissoes')}
      />

      {/* Aparência */}
      <SecaoTitulo>Aparência</SecaoTitulo>
      <Card>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {modos.map((m) => {
            const ativo = modo === m.v;
            return (
              <Botao
                key={m.v}
                titulo={m.rotulo}
                icone={m.icone}
                variante={ativo ? 'primario' : 'contorno'}
                onPress={() => setModo(m.v)}
                style={{ flex: 1 }}
              />
            );
          })}
        </View>
      </Card>

      {token && (
        <Botao titulo="Sair da conta" variante="perigo" icone="logout" onPress={sair} />
      )}

      <View style={{ alignItems: 'center', paddingVertical: 8, gap: 2 }}>
        <Pill texto={portal.uf ? `${portal.nome} • ${portal.uf}` : portal.nome} cor={c.muted} />
        <Text style={{ color: c.muted, fontSize: 11 }}>App do Cidadão • Câmara Municipal</Text>
      </View>
    </Tela>
  );
}
