import { Tabs } from 'expo-router';
import { useTheme } from '../../src/state/theme';
import { Icone, NomeIcone } from '../../src/ui/icone';

const TabIcone =
  (nome: NomeIcone) =>
  ({ color }: { color: string }) =>
    <Icone nome={nome} tamanho={24} cor={color} />;

export default function TabsLayout() {
  const { c, portal } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: c.primary },
        headerTintColor: c.primaryFg,
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.card,
          borderTopColor: c.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: portal.nome || 'Câmara Municipal', tabBarLabel: 'Início', tabBarIcon: TabIcone('home-variant-outline') }}
      />
      <Tabs.Screen
        name="noticias"
        options={{ title: 'Notícias', tabBarIcon: TabIcone('newspaper-variant-outline') }}
      />
      <Tabs.Screen
        name="sessoes"
        options={{ title: 'Sessões e TV', tabBarLabel: 'Sessões', tabBarIcon: TabIcone('gavel') }}
      />
      <Tabs.Screen
        name="vereadores"
        options={{ title: 'Vereadores', tabBarIcon: TabIcone('account-group-outline') }}
      />
      <Tabs.Screen
        name="mais"
        options={{ title: 'Mais', tabBarIcon: TabIcone('dots-horizontal') }}
      />
    </Tabs>
  );
}
