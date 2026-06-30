import { Linking, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { obterVereador } from '../../src/api/parlamentar';
import { useTheme } from '../../src/state/theme';
import {
  Aviso,
  Card,
  Carregando,
  LinhaInfo,
  Pill,
  SecaoTitulo,
  Tela,
} from '../../src/ui/componentes';
import { Icone, NomeIcone } from '../../src/ui/icone';
import { dataBR, rotuloCargo } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';
import { Avatar } from '../(tabs)/index';

const ICONE_REDE: Record<string, NomeIcone> = {
  facebook: 'facebook',
  instagram: 'instagram',
  twitter: 'twitter',
  x: 'twitter',
  youtube: 'youtube',
  whatsapp: 'whatsapp',
  site: 'web',
  tiktok: 'music-note',
};

export default function VereadorPerfil() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { c } = useTheme();
  const { dados: v, carregando, atualizando, recarregar, erro } = useRecurso(
    () => obterVereador(String(slug)),
    [slug],
  );

  if (carregando) return <Carregando />;
  if (erro || !v)
    return (
      <Tela>
        <Aviso tipo="erro">{erro ?? 'Vereador não encontrado.'}</Aviso>
      </Tela>
    );

  const redes = v.redes ?? {};

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: v.nomeParlamentar }} />

      {/* Cabeçalho */}
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Avatar uri={v.fotoUrl} nome={v.nomeParlamentar} cor={c.primary} tamanho={96} />
        <Text style={{ color: c.fg, fontWeight: '800', fontSize: 19, textAlign: 'center' }}>
          {v.nomeParlamentar}
        </Text>
        {v.nome !== v.nomeParlamentar && <Text style={{ color: c.muted }}>{v.nome}</Text>}
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {v.partido && <Pill texto={v.partido} />}
          {v.legislatura && <Pill texto={`Legislatura ${v.legislatura}`} cor={c.muted} />}
          {v.mesaCargos?.[0] && <Pill texto={rotuloCargo(v.mesaCargos[0].cargo)} cor={c.accent} />}
        </View>

        {/* Redes sociais */}
        {Object.keys(redes).length > 0 && (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            {Object.entries(redes).map(([rede, url]) =>
              url ? (
                <Icone
                  key={rede}
                  nome={ICONE_REDE[rede.toLowerCase()] ?? 'link-variant'}
                  tamanho={24}
                  cor={c.primary}
                />
              ) : null,
            )}
          </View>
        )}
      </Card>

      {/* Contato e mandato */}
      <Card>
        <LinhaInfo rotulo="E-mail" valor={v.email} />
        <LinhaInfo rotulo="Telefone" valor={v.telefone} />
        <LinhaInfo rotulo="Início do mandato" valor={v.mandatoInicio ? dataBR(v.mandatoInicio) : null} />
        <LinhaInfo rotulo="Fim do mandato" valor={v.mandatoFim ? dataBR(v.mandatoFim) : null} />
        {v.email && (
          <Text
            onPress={() => Linking.openURL(`mailto:${v.email}`)}
            style={{ color: c.primary, marginTop: 8, fontWeight: '600' }}
          >
            Enviar e-mail
          </Text>
        )}
      </Card>

      {/* Biografia */}
      {v.biografia && (
        <>
          <SecaoTitulo>Biografia</SecaoTitulo>
          <Card>
            <Text style={{ color: c.fg, fontSize: 14, lineHeight: 21 }}>{v.biografia}</Text>
          </Card>
        </>
      )}

      {/* Comissões */}
      {v.comissaoCargos && v.comissaoCargos.length > 0 && (
        <>
          <SecaoTitulo>Comissões</SecaoTitulo>
          {v.comissaoCargos.map((cc, i) => (
            <Card key={`${cc.comissao.id}-${i}`}>
              <Text style={{ color: c.fg, fontWeight: '700' }}>{cc.comissao.nome}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <Pill texto={rotuloCargo(cc.cargo)} />
                {cc.comissao.tipo && <Pill texto={cc.comissao.tipo} cor={c.muted} />}
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Atividades / posts */}
      {v.posts && v.posts.length > 0 && (
        <>
          <SecaoTitulo>Atividades</SecaoTitulo>
          {v.posts.map((p) => (
            <Card key={p.id}>
              {p.titulo && <Text style={{ color: c.fg, fontWeight: '700', marginBottom: 4 }}>{p.titulo}</Text>}
              {p.conteudo && (
                <Text numberOfLines={6} style={{ color: c.muted, fontSize: 13.5, lineHeight: 20 }}>
                  {p.conteudo}
                </Text>
              )}
              {p.publicadoEm && (
                <Text style={{ color: c.muted, fontSize: 11.5, marginTop: 6 }}>{dataBR(p.publicadoEm)}</Text>
              )}
            </Card>
          ))}
        </>
      )}

      {/* Representações */}
      {v.representacoes && v.representacoes.length > 0 && (
        <>
          <SecaoTitulo>Representações</SecaoTitulo>
          {v.representacoes.map((r) => (
            <Card key={r.id}>
              {r.titulo && <Text style={{ color: c.fg, fontWeight: '600' }}>{r.titulo}</Text>}
              {r.descricao && <Text style={{ color: c.muted, fontSize: 13 }}>{r.descricao}</Text>}
            </Card>
          ))}
        </>
      )}
    </Tela>
  );
}
