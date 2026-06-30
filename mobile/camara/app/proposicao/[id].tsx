import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { obterProposicao } from '../../src/api/legislativo';
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
import {
  dataBR,
  rotuloProposicao,
  rotuloStatusProposicao,
  rotuloVoto,
} from '../../src/ui/formato';
import { useRecurso } from '../../src/ui/useRecurso';

/** Cor do voto: favorável = verde, contrário = vermelho, demais = neutro. */
function corVoto(voto: string, c: { success: string; danger: string; muted: string }): string {
  if (['favoravel', 'sim'].includes(voto)) return c.success;
  if (['contrario', 'nao'].includes(voto)) return c.danger;
  return c.muted;
}

export default function ProposicaoDetalhe() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { dados: p, carregando, atualizando, recarregar, erro } = useRecurso(
    () => obterProposicao(String(id)),
    [id],
  );

  if (carregando) return <Carregando />;
  if (erro || !p)
    return (
      <Tela>
        <Aviso tipo="erro">{erro ?? 'Proposição não encontrada.'}</Aviso>
      </Tela>
    );

  return (
    <Tela refreshing={atualizando} onRefresh={recarregar}>
      <Stack.Screen options={{ title: rotuloProposicao(p.tipo, p.numero, p.ano) }} />

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Pill texto={rotuloProposicao(p.tipo, p.numero, p.ano)} />
          {p.statusAtual && <Pill texto={rotuloStatusProposicao(p.statusAtual)} cor={c.secondary} />}
        </View>
        <Text style={{ color: c.fg, fontSize: 15, lineHeight: 22 }}>{p.ementa ?? 'Sem ementa.'}</Text>
        {p.dataProtocolo && (
          <Text style={{ color: c.muted, fontSize: 12.5 }}>Protocolada em {dataBR(p.dataProtocolo)}</Text>
        )}
      </View>

      {/* Autores */}
      {p.autores && p.autores.length > 0 && (
        <>
          <SecaoTitulo>Autoria</SecaoTitulo>
          <Card>
            {p.autores.map((a) => (
              <View key={a.vereador.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                <Icone nome="account-outline" tamanho={18} cor={c.primary} />
                <Text style={{ color: c.fg, fontSize: 14, flex: 1 }}>{a.vereador.nomeParlamentar}</Text>
                {a.vereador.partido && <Text style={{ color: c.muted, fontSize: 12 }}>{a.vereador.partido}</Text>}
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Tramitação */}
      {p.tramitacoes && p.tramitacoes.length > 0 && (
        <>
          <SecaoTitulo>Tramitação</SecaoTitulo>
          <Card>
            {p.tramitacoes.map((t, i) => (
              <View key={t.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 4 }} />
                  {i < p.tramitacoes.length - 1 && (
                    <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginTop: 2 }} />
                  )}
                </View>
                <View style={{ flex: 1, paddingBottom: 6 }}>
                  {t.situacao && <Text style={{ color: c.fg, fontWeight: '600' }}>{t.situacao}</Text>}
                  {t.descricao && <Text style={{ color: c.muted, fontSize: 13 }}>{t.descricao}</Text>}
                  <Text style={{ color: c.muted, fontSize: 11.5 }}>{dataBR(t.data)}</Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Votações nominais */}
      {p.votacoes && p.votacoes.length > 0 && (
        <>
          <SecaoTitulo>Votação nominal</SecaoTitulo>
          {p.votacoes.map((vt) => (
            <Card key={vt.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: c.muted, fontSize: 12.5 }}>{dataBR(vt.data)}</Text>
                {vt.resultado && <Pill texto={vt.resultado} cor={c.accent} />}
              </View>
              {vt.votos.map((v) => (
                <View key={v.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
                  <Text style={{ color: c.fg, fontSize: 14, flex: 1 }}>{v.vereador.nomeParlamentar}</Text>
                  <Pill texto={rotuloVoto(v.voto)} cor={corVoto(v.voto, c)} />
                </View>
              ))}
            </Card>
          ))}
        </>
      )}

      {/* Emendas */}
      {p.emendas && p.emendas.length > 0 && (
        <>
          <SecaoTitulo>Emendas</SecaoTitulo>
          <Card>
            {p.emendas.map((e) => (
              <View key={e.id} style={{ paddingVertical: 4 }}>
                <Text style={{ color: c.fg, fontWeight: '600' }}>Emenda nº {e.numero}</Text>
                {e.ementa && <Text style={{ color: c.muted, fontSize: 13 }}>{e.ementa}</Text>}
              </View>
            ))}
          </Card>
        </>
      )}
    </Tela>
  );
}
