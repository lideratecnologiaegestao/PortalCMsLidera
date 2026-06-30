import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { registrarManifestacao } from '../../src/api/manifestacoes';
import type { Canal, RegistroManifestacaoResposta } from '../../src/api/types';
import { ApiError } from '../../src/api/client';
import { useTheme } from '../../src/state/theme';
import { useAuth } from '../../src/state/auth';
import {
  Aviso,
  Botao,
  Campo,
  Card,
  Checkbox,
  Seletor,
  Subtitulo,
  Tela,
  Titulo,
} from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';
import { PRAZO_DESCRICAO, tiposDoCanal } from '../../src/ui/ouvidoria';

export default function AbrirManifestacao() {
  const { c } = useTheme();
  const { token, usuario } = useAuth();
  const router = useRouter();

  const [canal, setCanal] = useState<Canal>('ouvidoria');
  const [tipo, setTipo] = useState<string>('reclamacao');
  const [assunto, setAssunto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [anonima, setAnonima] = useState(false);
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [email, setEmail] = useState(usuario?.email ?? '');

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RegistroManifestacaoResposta | null>(null);

  const trocarCanal = (novo: Canal) => {
    setCanal(novo);
    setTipo(tiposDoCanal(novo)[0].value);
    if (novo === 'esic') setAnonima(false); // e-SIC exige identificação (LAI)
  };

  const podeEnviar =
    assunto.trim().length >= 3 &&
    descricao.trim().length >= 10 &&
    (anonima || (canal === 'ouvidoria' ? true : !!token));

  async function enviar() {
    setErro(null);
    if (canal === 'esic' && !token) {
      setErro('Pedidos de e-SIC (acesso à informação) exigem identificação. Faça login para continuar.');
      return;
    }
    setEnviando(true);
    try {
      const r = await registrarManifestacao({
        canal,
        tipo,
        assunto: assunto.trim(),
        descricao: descricao.trim(),
        anonima: canal === 'ouvidoria' ? anonima : false,
        solicitanteNome: anonima ? undefined : nome.trim() || undefined,
        solicitanteEmail: anonima ? undefined : email.trim() || undefined,
      });
      setResultado(r);
    } catch (e) {
      if (e instanceof ApiError) setErro(e.message);
      else setErro('Não foi possível registrar agora. Verifique sua conexão e tente de novo.');
    } finally {
      setEnviando(false);
    }
  }

  // Tela de sucesso: mostra protocolo + chave (única vez).
  if (resultado) {
    return (
      <Tela>
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Icone nome="check-circle" tamanho={56} cor={c.success} />
          <Titulo>Manifestação registrada</Titulo>
        </View>
        <Card>
          <Text style={{ color: c.muted, fontSize: 13 }}>Protocolo</Text>
          <Text selectable style={{ color: c.fg, fontSize: 22, fontWeight: '800', letterSpacing: 1 }}>
            {resultado.protocolo}
          </Text>
          <View style={{ height: 12 }} />
          <Text style={{ color: c.muted, fontSize: 13 }}>Chave de acompanhamento</Text>
          <Text selectable style={{ color: c.fg, fontSize: 18, fontWeight: '700', letterSpacing: 1 }}>
            {resultado.chave}
          </Text>
        </Card>
        <Aviso tipo="info">
          Guarde a chave: ela é exibida apenas uma vez e é necessária para consultar manifestações
          anônimas ou sem login.
        </Aviso>
        <Botao
          titulo="Compartilhar protocolo"
          variante="contorno"
          icone="share-variant"
          onPress={() =>
            Share.share({
              message: `Protocolo: ${resultado.protocolo}\nChave: ${resultado.chave}`,
            })
          }
        />
        <Botao
          titulo="Acompanhar agora"
          icone="magnify"
          onPress={() =>
            router.replace({
              pathname: '/ouvidoria/consultar',
              params: { protocolo: resultado.protocolo, chave: resultado.chave },
            })
          }
        />
      </Tela>
    );
  }

  return (
    <Tela>
      <Seletor<Canal>
        label="Canal"
        opcoes={[
          { value: 'ouvidoria', label: 'Ouvidoria' },
          { value: 'esic', label: 'e-SIC (LAI)' },
        ]}
        valor={canal}
        onChange={trocarCanal}
      />
      <Subtitulo>{PRAZO_DESCRICAO[canal]}</Subtitulo>

      <Seletor label="Tipo" opcoes={tiposDoCanal(canal)} valor={tipo} onChange={setTipo} />

      <Campo label="Assunto" valor={assunto} onChange={setAssunto} placeholder="Resuma em poucas palavras" autoCapitalize="sentences" />
      <Campo
        label="Descrição"
        valor={descricao}
        onChange={setDescricao}
        placeholder="Descreva sua manifestação com o máximo de detalhes (mínimo 10 caracteres)"
        multiline
        autoCapitalize="sentences"
      />

      {canal === 'ouvidoria' && (
        <Card>
          <Checkbox valor={anonima} onChange={setAnonima} label="Registrar de forma anônima (sem identificação)" />
        </Card>
      )}

      {!anonima && (
        <>
          <Campo label="Seu nome" valor={nome} onChange={setNome} placeholder="Nome completo" autoCapitalize="words" />
          <Campo
            label="Seu e-mail"
            valor={email}
            onChange={setEmail}
            placeholder="email@exemplo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityHint="Usado para enviar atualizações do protocolo"
          />
        </>
      )}

      {canal === 'esic' && !token && (
        <Aviso tipo="info">Pedidos de e-SIC exigem login. Entre na sua conta para enviar.</Aviso>
      )}

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Botao titulo="Enviar manifestação" icone="send" carregando={enviando} disabled={!podeEnviar} onPress={enviar} />
      <Subtitulo>
        Ao enviar, você concorda com o tratamento dos dados para fins de atendimento, conforme a LGPD.
      </Subtitulo>
    </Tela>
  );
}
