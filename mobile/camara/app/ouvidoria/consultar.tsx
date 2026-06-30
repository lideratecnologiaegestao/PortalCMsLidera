import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  acompanharManifestacao,
  responderManifestacao,
} from '../../src/api/manifestacoes';
import type { ManifestacaoDetalhe } from '../../src/api/types';
import { ApiError, SemRedeError } from '../../src/api/client';
import { useTheme } from '../../src/state/theme';
import {
  Aviso,
  Botao,
  Campo,
  Card,
  Carregando,
  Pill,
  SecaoTitulo,
  Subtitulo,
  Tela,
} from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { dataHoraBR, rotuloStatusManifestacao } from '../../src/ui/formato';

export default function Consultar() {
  const params = useLocalSearchParams<{ protocolo?: string; chave?: string }>();
  const { c } = useTheme();

  const [protocolo, setProtocolo] = useState(params.protocolo ?? '');
  const [chave, setChave] = useState(params.chave ?? '');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [m, setM] = useState<ManifestacaoDetalhe | null>(null);

  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function consultar() {
    if (!protocolo.trim()) return;
    setCarregando(true);
    setErro(null);
    setM(null);
    try {
      const r = await acompanharManifestacao(protocolo.trim(), chave.trim() || undefined);
      setM(r);
    } catch (e) {
      if (e instanceof SemRedeError) setErro('Sem conexão. Tente novamente.');
      else if (e instanceof ApiError && e.naoEncontrado) setErro('Protocolo não encontrado. Confira o número e a chave.');
      else setErro(e instanceof Error ? e.message : 'Não foi possível consultar.');
    } finally {
      setCarregando(false);
    }
  }

  // Se veio com protocolo na rota (ex.: após abrir), consulta automaticamente.
  useEffect(() => {
    if (params.protocolo) consultar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function responder() {
    if (!m || resposta.trim().length < 2) return;
    setEnviando(true);
    setErro(null);
    try {
      const atualizado = await responderManifestacao(m.protocolo, resposta.trim(), chave.trim() || undefined);
      setM(atualizado);
      setResposta('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a mensagem.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela>
      <SecaoTitulo>Consultar protocolo</SecaoTitulo>
      <Campo label="Número do protocolo" valor={protocolo} onChange={setProtocolo} placeholder="Ex.: OUV2026000001" autoCapitalize="none" />
      <Campo
        label="Chave de acompanhamento (se anônima/sem login)"
        valor={chave}
        onChange={setChave}
        placeholder="Chave recebida ao registrar"
        autoCapitalize="none"
      />
      <Botao titulo="Consultar" icone="magnify" carregando={carregando} onPress={consultar} disabled={!protocolo.trim()} />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {m && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: c.fg, fontWeight: '800', fontSize: 18 }}>{m.protocolo}</Text>
              <Pill texto={rotuloStatusManifestacao(m.status)} cor={c.secondary} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              <Pill texto={m.canal === 'esic' ? 'e-SIC' : 'Ouvidoria'} />
              <Pill texto={m.tipo} cor={c.muted} />
              {m.prorrogado && <Pill texto="Prazo prorrogado" cor={c.warning} />}
            </View>
            <Text style={{ color: c.fg, fontWeight: '700', marginTop: 10 }}>{m.assunto}</Text>
            <Text style={{ color: c.muted, fontSize: 13.5, marginTop: 4, lineHeight: 20 }}>{m.descricao}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Icone nome="clock-outline" tamanho={14} cor={c.muted} />
              <Text style={{ color: c.muted, fontSize: 12.5 }}>Prazo até {dataHoraBR(m.prazoEm)}</Text>
            </View>
          </Card>

          {/* Resposta oficial */}
          {m.resposta && (
            <>
              <SecaoTitulo>Resposta</SecaoTitulo>
              <Card style={{ borderColor: c.success }}>
                <Text style={{ color: c.fg, fontSize: 14, lineHeight: 21 }}>{m.resposta}</Text>
              </Card>
            </>
          )}

          {/* Tramitação */}
          {m.eventos.length > 0 && (
            <>
              <SecaoTitulo>Andamento</SecaoTitulo>
              <Card>
                {m.eventos.map((ev, i) => (
                  <View key={ev.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary, marginTop: 4 }} />
                      {i < m.eventos.length - 1 && <View style={{ width: 2, flex: 1, backgroundColor: c.border, marginTop: 2 }} />}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 4 }}>
                      <Text style={{ color: c.fg, fontWeight: '600', fontSize: 13.5 }}>
                        {rotuloStatusManifestacao(ev.paraStatus)}
                      </Text>
                      {ev.observacao && <Text style={{ color: c.muted, fontSize: 13 }}>{ev.observacao}</Text>}
                      <Text style={{ color: c.muted, fontSize: 11.5 }}>{dataHoraBR(ev.criadoEm)}</Text>
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}

          {/* Mensagens da tramitação */}
          {m.mensagens.length > 0 && (
            <>
              <SecaoTitulo>Mensagens</SecaoTitulo>
              {m.mensagens.map((msg) => (
                <Card key={msg.id}>
                  <Text style={{ color: c.primary, fontWeight: '700', fontSize: 12.5 }}>
                    {msg.autorNome} • {msg.autorTipo}
                  </Text>
                  <Text style={{ color: c.fg, fontSize: 13.5, marginTop: 4 }}>{msg.conteudo}</Text>
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{dataHoraBR(msg.criadoEm)}</Text>
                </Card>
              ))}
            </>
          )}

          {/* Complementar */}
          <SecaoTitulo>Complementar</SecaoTitulo>
          <Campo valor={resposta} onChange={setResposta} placeholder="Adicione uma informação ao seu protocolo" multiline />
          <Botao titulo="Enviar mensagem" icone="send" carregando={enviando} disabled={resposta.trim().length < 2} onPress={responder} />
        </>
      )}
    </Tela>
  );
}
