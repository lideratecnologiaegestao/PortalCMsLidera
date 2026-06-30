import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/state/auth';
import { ApiError, SemRedeError } from '../../src/api/client';
import { useTheme } from '../../src/state/theme';
import { Aviso, Botao, Campo, Subtitulo, Tela, Titulo } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';

export default function Login() {
  const { c } = useTheme();
  const { entrar } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function fazerLogin() {
    setErro(null);
    setEntrando(true);
    try {
      await entrar(email.trim(), senha);
      router.back();
    } catch (e) {
      if (e instanceof SemRedeError) setErro('Sem conexão. Verifique sua internet.');
      else if (e instanceof ApiError && e.status === 401) setErro('E-mail ou senha incorretos.');
      else setErro(e instanceof Error ? e.message : 'Não foi possível entrar.');
    } finally {
      setEntrando(false);
    }
  }

  return (
    <Tela>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
        <Icone nome="account-circle-outline" tamanho={56} cor={c.primary} />
        <Titulo>Entrar</Titulo>
        <Subtitulo>Acesse para abrir pedidos de e-SIC e acompanhar suas manifestações.</Subtitulo>
      </View>

      <Campo label="E-mail" valor={email} onChange={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
      <Campo label="Senha" valor={senha} onChange={setSenha} placeholder="Sua senha" secure autoCapitalize="none" />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Botao titulo="Entrar" icone="login" carregando={entrando} disabled={!email.trim() || !senha} onPress={fazerLogin} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text onPress={() => router.push('/conta/recuperar')} style={{ color: c.primary, fontWeight: '600' }}>
          Esqueci a senha
        </Text>
        <Text onPress={() => router.push('/conta/cadastro')} style={{ color: c.primary, fontWeight: '600' }}>
          Criar conta
        </Text>
      </View>
    </Tela>
  );
}
