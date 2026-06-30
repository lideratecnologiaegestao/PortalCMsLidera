import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { obterSessao } from '../../src/api/sessoes';
import { useTheme } from '../../src/state/theme';
import {
  Aviso,
  Card,
  Carregando,
  Pill,
  SecaoTitulo,
  Tela,
} from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { Html } from '../../src/ui/Html';
import { Player } from '../../src/ui/Player';
import { dataHoraBR, rotuloStatusSessao } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

export default function SessaoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { dados: s, carregando, atualizando, recarregar, erro } = useRecurso(
    () => obterSessao(String(id)),
    [id],
  );

  if (carregando) return <Carregando />;
  if (erro || !s)
    return (
      <Tela>
        <Aviso tipo="erro">{erro ?? 'Sessão não encontrada.'}</Aviso>
      </Tela>
    );

  const presentes = s.presencas.filter((p) => p.presente).length;

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: s.tipoSessao?.nome ?? 'Sessão' }} />

      <View style={{ gap: 6 }}>
        <Text style={{ color: c.fg, fontWeight: '800', fontSize: 19 }}>{s.titulo}</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Pill
            texto={rotuloStatusSessao(s.status)}
            cor={s.status === 'em_andamento' ? c.danger : c.secondary}
          />
          {s.tipoSessao && <Pill texto={s.tipoSessao.nome} cor={c.muted} />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icone nome="calendar-clock" tamanho={15} cor={c.muted} />
          <Text style={{ color: c.muted, fontSize: 13.5 }}>{dataHoraBR(s.dataHora)}</Text>
        </View>
        {s.local && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icone nome="map-marker-outline" tamanho={15} cor={c.muted} />
            <Text style={{ color: c.muted, fontSize: 13.5 }}>{s.local}</Text>
          </View>
        )}
      </View>

      {/* Ao vivo */}
      {s.status === 'em_andamento' && s.videoAoVivoUrl && (
        <>
          <SecaoTitulo>Transmissão ao vivo</SecaoTitulo>
          <Player url={s.videoAoVivoUrl} />
        </>
      )}

      {/* Gravações */}
      {s.gravacoes.length > 0 && (
        <>
          <SecaoTitulo>Gravações</SecaoTitulo>
          {s.gravacoes.map((g) => (
            <View key={g.id} style={{ gap: 6 }}>
              {g.titulo && <Text style={{ color: c.fg, fontWeight: '600' }}>{g.titulo}</Text>}
              <Player url={g.url} plataforma={g.plataforma} />
            </View>
          ))}
        </>
      )}

      {/* Pauta */}
      {s.pautaItens.length > 0 && (
        <>
          <SecaoTitulo>Pauta</SecaoTitulo>
          {s.pautaItens.map((item) => (
            <Card key={item.id}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ color: c.primary, fontWeight: '800' }}>{item.ordem}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.fg, fontWeight: '600' }}>{item.titulo}</Text>
                  {item.descricao && (
                    <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{item.descricao}</Text>
                  )}
                  {item.resultado && <Pill texto={item.resultado} cor={c.accent} />}
                </View>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Presenças */}
      {s.presencas.length > 0 && (
        <>
          <SecaoTitulo>Presença ({presentes}/{s.presencas.length})</SecaoTitulo>
          <Card>
            {s.presencas.map((p) => (
              <View
                key={p.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}
              >
                <Icone
                  nome={p.presente ? 'check-circle' : 'close-circle-outline'}
                  tamanho={18}
                  cor={p.presente ? c.success : c.danger}
                />
                <Text style={{ color: c.fg, fontSize: 14, flex: 1 }}>{p.vereador.nomeParlamentar}</Text>
                {p.vereador.partido && (
                  <Text style={{ color: c.muted, fontSize: 12 }}>{p.vereador.partido}</Text>
                )}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Ata (só se publicada) */}
      {s.ataConteudo ? (
        <>
          <SecaoTitulo>Ata da sessão</SecaoTitulo>
          <Card>
            <Html html={s.ataConteudo} altura={400} />
          </Card>
        </>
      ) : (
        <Aviso tipo="info">A ata desta sessão ainda não foi publicada.</Aviso>
      )}
    </Tela>
  );
}
