import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/state/auth';
import { useTheme } from '../../src/state/theme';
import { Aviso, Botao, Campo, Subtitulo, Tela, Titulo } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';

export default function Recuperar() {
  const { c } = useTheme();
  const { recuperar, redefinir } = useAuth();
  const router = useRouter();

  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviarCodigo() {
    setErro(null);
    setEnviando(true);
    try {
      await recuperar(email.trim());
      setEtapa('codigo');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o código.');
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    setErro(null);
    if (novaSenha.length < 8) {
      setErro('A nova senha deve ter ao menos 8 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      await redefinir(email.trim(), codigo.trim(), novaSenha);
      setOk(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Código inválido ou expirado.');
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <Tela>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
          <Icone nome="lock-check-outline" tamanho={56} cor={c.success} />
          <Titulo>Senha redefinida</Titulo>
          <Subtitulo>Você já pode entrar com a nova senha.</Subtitulo>
        </View>
        <Botao titulo="Ir para o login" icone="login" onPress={() => router.replace('/conta/login')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo>Recuperar senha</Titulo>
      {etapa === 'email' ? (
        <>
          <Subtitulo>Informe seu e-mail para receber um código de redefinição.</Subtitulo>
          <Campo label="E-mail" valor={email} onChange={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao titulo="Enviar código" icone="email-fast-outline" carregando={enviando} disabled={!/\S+@\S+\.\S+/.test(email)} onPress={enviarCodigo} />
        </>
      ) : (
        <>
          <Subtitulo>Digite o código recebido por e-mail e defina uma nova senha.</Subtitulo>
          <Campo label="Código" valor={codigo} onChange={setCodigo} placeholder="Código de 6 dígitos" keyboardType="numeric" autoCapitalize="none" />
          <Campo label="Nova senha" valor={novaSenha} onChange={setNovaSenha} placeholder="Mínimo 8 caracteres" secure autoCapitalize="none" />
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <Botao titulo="Redefinir senha" icone="lock-reset" carregando={enviando} disabled={!codigo.trim() || novaSenha.length < 8} onPress={confirmar} />
        </>
      )}
    </Tela>
  );
}
