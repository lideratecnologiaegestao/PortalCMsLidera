import { Image, Pressable, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { listarNoticias } from '../../src/api/noticias';
import { obterMesaDiretora } from '../../src/api/parlamentar';
import { obterTvCamara } from '../../src/api/sessoes';
import type { MesaDiretoraItem, NoticiaResumo, TvCamara } from '../../src/api/types';
import { useTheme } from '../../src/state/theme';
import {
  Card,
  Carregando,
  Pill,
  SecaoTitulo,
  Subtitulo,
  Tela,
  Titulo,
} from '../../src/ui/componentes';
import { Icone, NomeIcone } from '../../src/ui/icone';
import { dataBR, rotuloCargo } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

interface HomeData {
  noticias: NoticiaResumo[];
  mesa: MesaDiretoraItem[];
  tv: TvCamara | null;
}

const ATALHOS: { titulo: string; icone: NomeIcone; rota: string }[] = [
  { titulo: 'Vereadores', icone: 'account-group-outline', rota: '/(tabs)/vereadores' },
  { titulo: 'Sessões', icone: 'gavel', rota: '/(tabs)/sessoes' },
  { titulo: 'Proposições', icone: 'file-document-outline', rota: '/legislativo/proposicoes' },
  { titulo: 'Leis', icone: 'book-open-variant', rota: '/legislativo/leis' },
  { titulo: 'Ouvidoria', icone: 'message-alert-outline', rota: '/ouvidoria/abrir' },
  { titulo: 'Protocolo', icone: 'magnify', rota: '/ouvidoria/consultar' },
];

export default function Home() {
  const { c, portal } = useTheme();
  const router = useRouter();

  const { dados, carregando, atualizando, recarregar } = useRecurso<HomeData>(async () => {
    const [noticias, mesa, tv] = await Promise.all([
      listarNoticias({ pageSize: 5 }).catch(() => [] as NoticiaResumo[]),
      obterMesaDiretora().catch(() => [] as MesaDiretoraItem[]),
      obterTvCamara().catch(() => null),
    ]);
    return { noticias, mesa, tv };
  }, []);

  if (carregando) return <Carregando texto="Carregando a câmara..." />;

  const tv = dados?.tv ?? null;
  const aoVivo = tv?.aoVivo;

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <View style={{ gap: 4 }}>
        <Titulo>{portal.nome || 'Câmara Municipal'}</Titulo>
        <Subtitulo>Acompanhe o trabalho do Legislativo e fale com a Câmara.</Subtitulo>
      </View>

      {/* TV Câmara — destaque ao vivo */}
      <Card
        onPress={() => router.push('/(tabs)/sessoes')}
        accessibilityLabel="Abrir TV Câmara e sessões"
        style={{ borderColor: aoVivo ? c.danger : c.border }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icone nome="television-play" tamanho={32} cor={aoVivo ? c.danger : c.primary} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15 }}>TV Câmara</Text>
            {aoVivo ? (
              <>
                <Pill texto="● AO VIVO AGORA" cor={c.danger} />
                <Text style={{ color: c.muted, fontSize: 13 }}>{aoVivo.titulo}</Text>
              </>
            ) : tv?.proxima ? (
              <Text style={{ color: c.muted, fontSize: 13 }}>
                Próxima sessão: {dataBR(tv.proxima.dataHora)}
              </Text>
            ) : (
              <Text style={{ color: c.muted, fontSize: 13 }}>Veja as sessões gravadas</Text>
            )}
          </View>
          <Icone nome="chevron-right" tamanho={22} cor={c.muted} />
        </View>
      </Card>

      {/* Atalhos */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {ATALHOS.map((a) => (
          <Pressable
            key={a.titulo}
            onPress={() => router.push(a.rota as never)}
            accessibilityRole="button"
            accessibilityLabel={a.titulo}
            style={({ pressed }) => [
              {
                width: '31%',
                backgroundColor: c.card,
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: 'center',
                gap: 6,
                minHeight: 84,
                justifyContent: 'center',
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icone nome={a.icone} tamanho={26} cor={c.primary} />
            <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
              {a.titulo}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Mesa Diretora */}
      {dados && dados.mesa.length > 0 && (
        <>
          <SecaoTitulo
            acao={
              <Pressable onPress={() => router.push('/(tabs)/vereadores')}>
                <Text style={{ color: c.primary, fontWeight: '600' }}>Ver todos</Text>
              </Pressable>
            }
          >
            Mesa Diretora
          </SecaoTitulo>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {dados.mesa.slice(0, 4).map((m) => (
              <Card
                key={m.cargo + m.vereador.id}
                onPress={() => m.vereador.slug && router.push(`/vereador/${m.vereador.slug}`)}
                accessibilityLabel={`${rotuloCargo(m.cargo)}: ${m.vereador.nomeParlamentar}`}
                style={{ width: '47%', alignItems: 'center', gap: 6 }}
              >
                <Avatar uri={m.vereador.fotoUrl} nome={m.vereador.nomeParlamentar} cor={c.primary} />
                <Pill texto={rotuloCargo(m.cargo)} />
                <Text numberOfLines={1} style={{ color: c.fg, fontWeight: '700', fontSize: 13 }}>
                  {m.vereador.nomeParlamentar}
                </Text>
                {m.vereador.partido && (
                  <Text style={{ color: c.muted, fontSize: 12 }}>{m.vereador.partido}</Text>
                )}
              </Card>
            ))}
          </View>
        </>
      )}

      {/* Notícias em destaque */}
      {dados && dados.noticias.length > 0 && (
        <>
          <SecaoTitulo
            acao={
              <Pressable onPress={() => router.push('/(tabs)/noticias')}>
                <Text style={{ color: c.primary, fontWeight: '600' }}>Ver mais</Text>
              </Pressable>
            }
          >
            Últimas notícias
          </SecaoTitulo>
          {dados.noticias.map((n) => (
            <Card
              key={n.id}
              onPress={() => router.push(`/noticia/${n.slug}`)}
              accessibilityLabel={`Notícia: ${n.titulo}`}
            >
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {(n.imagemUrl || n.imagemDestaqueUrl) && (
                  <Image
                    source={{ uri: n.imagemUrl ?? n.imagemDestaqueUrl ?? undefined }}
                    style={{ width: 78, height: 78, borderRadius: 10, backgroundColor: c.border }}
                  />
                )}
                <View style={{ flex: 1, gap: 4 }}>
                  <Text numberOfLines={2} style={{ color: c.fg, fontWeight: '700', fontSize: 14.5 }}>
                    {n.titulo}
                  </Text>
                  {n.publicadoEm && (
                    <Text style={{ color: c.muted, fontSize: 12 }}>{dataBR(n.publicadoEm)}</Text>
                  )}
                  {n.resumo && (
                    <Text numberOfLines={2} style={{ color: c.muted, fontSize: 13 }}>
                      {n.resumo}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          ))}
        </>
      )}
    </Tela>
  );
}

/** Avatar circular com fallback de inicial. */
export function Avatar({
  uri,
  nome,
  cor,
  tamanho = 64,
}: {
  uri?: string | null;
  nome: string;
  cor: string;
  tamanho?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor + '22' }}
      />
    );
  }
  const inicial = nome.trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho / 2,
        backgroundColor: cor + '22',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: cor, fontWeight: '800', fontSize: tamanho * 0.4 }}>{inicial}</Text>
    </View>
  );
}
