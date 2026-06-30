import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/state/theme';
import { AuthProvider } from '../src/state/auth';

/** Stack raiz: define o cabeçalho temado e as telas fora das abas. */
function Navegacao() {
  const { c, ehEscuro } = useTheme();
  return (
    <>
      <StatusBar style={ehEscuro ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.primary },
          headerTintColor: c.primaryFg,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/* Parlamentar */}
        <Stack.Screen name="vereador/[slug]" options={{ title: 'Vereador(a)' }} />

        {/* Sessões */}
        <Stack.Screen name="sessao/[id]" options={{ title: 'Sessão' }} />

        {/* Legislativo */}
        <Stack.Screen name="proposicao/[id]" options={{ title: 'Proposição' }} />

        {/* Notícias */}
        <Stack.Screen name="noticia/[slug]" options={{ title: 'Notícia' }} />

        {/* Ouvidoria / e-SIC */}
        <Stack.Screen name="ouvidoria/abrir" options={{ title: 'Ouvidoria / e-SIC', presentation: 'modal' }} />
        <Stack.Screen name="ouvidoria/consultar" options={{ title: 'Consultar protocolo' }} />

        {/* Conta */}
        <Stack.Screen name="conta/login" options={{ title: 'Entrar' }} />
        <Stack.Screen name="conta/cadastro" options={{ title: 'Criar conta' }} />
        <Stack.Screen name="conta/recuperar" options={{ title: 'Recuperar senha' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Navegacao />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
