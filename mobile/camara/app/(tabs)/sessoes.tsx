import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { listarSessoes, obterTvCamara } from '../../src/api/sessoes';
import type { SessaoResumo, TvCamara } from '../../src/api/types';
import { useTheme } from '../../src/state/theme';
import {
  Botao,
  Card,
  Carregando,
  Pill,
  SecaoTitulo,
  Subtitulo,
  Tela,
  Vazio,
} from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { Player } from '../../src/ui/Player';
import { dataHoraBR, rotuloStatusSessao } from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

interface Dados {
  tv: TvCamara | null;
  sessoes: SessaoResumo[];
}

export default function Sessoes() {
  const { c } = useTheme();
  const router = useRouter();

  const { dados, carregando, atualizando, recarregar } = useRecurso<Dados>(async () => {
    const [tv, sessoes] = await Promise.all([
      obterTvCamara().catch(() => null),
      listarSessoes().catch(() => [] as SessaoResumo[]),
    ]);
    return { tv, sessoes };
  }, []);

  if (carregando) return <Carregando />;

  const tv = dados?.tv ?? null;
  const aoVivo = tv?.aoVivo;
  const sessoes = dados?.sessoes ?? [];

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      {/* TV Câmara */}
      <SecaoTitulo>TV Câmara</SecaoTitulo>
      {aoVivo && aoVivo.videoAoVivoUrl ? (
        <View style={{ gap: 8 }}>
          <Pill texto="● TRANSMISSÃO AO VIVO" cor={c.danger} />
          <Player url={aoVivo.videoAoVivoUrl} />
          <Text style={{ color: c.fg, fontWeight: '700' }}>{aoVivo.titulo}</Text>
        </View>
      ) : (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icone nome="television-off" tamanho={24} cor={c.muted} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.fg, fontWeight: '600' }}>Sem transmissão ao vivo agora.</Text>
              {tv?.proxima && (
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  Próxima: {tv.proxima.titulo} — {dataHoraBR(tv.proxima.dataHora)}
                </Text>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* Acervo de gravações */}
      {tv && tv.acervo.length > 0 && (
        <>
          <SecaoTitulo>Sessões gravadas</SecaoTitulo>
          {tv.acervo.slice(0, 6).map((s) => (
            <Card key={s.id} onPress={() => router.push(`/sessao/${s.id}`)} accessibilityLabel={`Gravação: ${s.titulo}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icone nome="play-circle-outline" tamanho={30} cor={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: c.fg, fontWeight: '700' }}>{s.titulo}</Text>
                  <Text style={{ color: c.muted, fontSize: 12.5 }}>{dataHoraBR(s.dataHora)}</Text>
                </View>
                <Pill texto={`${s.gravacoes.length} vídeo(s)`} />
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Agenda / histórico de sessões */}
      <SecaoTitulo>Sessões plenárias</SecaoTitulo>
      <Subtitulo>Pauta, presença dos vereadores e ata de cada sessão.</Subtitulo>
      {sessoes.length === 0 ? (
        <Vazio icone="gavel">Nenhuma sessão cadastrada.</Vazio>
      ) : (
        sessoes.map((s) => (
          <Card key={s.id} onPress={() => router.push(`/sessao/${s.id}`)} accessibilityLabel={`Sessão: ${s.titulo}`}>
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ color: c.fg, fontWeight: '700', fontSize: 15, flex: 1 }}>{s.titulo}</Text>
                <Pill
                  texto={rotuloStatusSessao(s.status)}
                  cor={s.status === 'em_andamento' ? c.danger : s.status === 'agendada' ? c.secondary : c.muted}
                />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icone nome="calendar-clock" tamanho={15} cor={c.muted} />
                <Text style={{ color: c.muted, fontSize: 13 }}>{dataHoraBR(s.dataHora)}</Text>
              </View>
              {s.tipoSessao && <Text style={{ color: c.muted, fontSize: 12.5 }}>{s.tipoSessao.nome}</Text>}
              {s.ataPublicadaEm && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icone nome="file-check-outline" tamanho={14} cor={c.success} />
                  <Text style={{ color: c.success, fontSize: 12 }}>Ata publicada</Text>
                </View>
              )}
            </View>
          </Card>
        ))
      )}

      <Botao
        titulo="Ver proposições e leis"
        variante="contorno"
        icone="file-document-outline"
        onPress={() => router.push('/legislativo/proposicoes')}
      />
    </Tela>
  );
}
