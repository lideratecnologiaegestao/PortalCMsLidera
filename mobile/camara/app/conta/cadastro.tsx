import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/state/auth';
import { ApiError } from '../../src/api/client';
import { useTheme } from '../../src/state/theme';
import { Aviso, Botao, Campo, Subtitulo, Tela, Titulo } from '../../src/ui/componentes';
import { Icone } from '../../src/ui/icone';

export default function Cadastro() {
  const { c } = useTheme();
  const { cadastrar } = useAuth();
  const router = useRouter();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const valido =
    nome.trim().length >= 3 && /\S+@\S+\.\S+/.test(email) && senha.length >= 8 && senha === confirma;

  async function criar() {
    setErro(null);
    if (senha !== confirma) {
      setErro('As senhas não conferem.');
      return;
    }
    setEnviando(true);
    try {
      await cadastrar({ nome: nome.trim(), email: email.trim(), senha, telefone: telefone.trim() || undefined });
      setOk(true);
    } catch (e) {
      if (e instanceof ApiError) setErro(e.message);
      else setErro('Não foi possível criar a conta. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (ok) {
    return (
      <Tela>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
          <Icone nome="email-check-outline" tamanho={56} cor={c.success} />
          <Titulo>Confirme seu e-mail</Titulo>
          <Subtitulo>
            Enviamos um link/código de confirmação para {email}. Após confirmar, faça login.
          </Subtitulo>
        </View>
        <Botao titulo="Ir para o login" icone="login" onPress={() => router.replace('/conta/login')} />
      </Tela>
    );
  }

  return (
    <Tela>
      <Titulo>Criar conta</Titulo>
      <Subtitulo>Use seus dados para acompanhar manifestações e abrir pedidos de e-SIC.</Subtitulo>

      <Campo label="Nome completo" valor={nome} onChange={setNome} placeholder="Seu nome" autoCapitalize="words" />
      <Campo label="E-mail" valor={email} onChange={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" autoCapitalize="none" />
      <Campo label="Celular (opcional)" valor={telefone} onChange={setTelefone} placeholder="(00) 90000-0000" keyboardType="phone-pad" />
      <Campo label="Senha" valor={senha} onChange={setSenha} placeholder="Mínimo 8 caracteres" secure autoCapitalize="none" />
      <Campo label="Confirmar senha" valor={confirma} onChange={setConfirma} placeholder="Repita a senha" secure autoCapitalize="none" />

      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      <Botao titulo="Criar conta" icone="account-plus-outline" carregando={enviando} disabled={!valido} onPress={criar} />
    </Tela>
  );
}
