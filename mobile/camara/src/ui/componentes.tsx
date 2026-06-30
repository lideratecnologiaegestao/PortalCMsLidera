import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../state/theme';
import { Icone, NomeIcone } from './icone';

/**
 * Biblioteca de componentes base, temada (claro/escuro por câmara) e com
 * acessibilidade (rótulos, papéis, alvos de toque >= 44px).
 */

export function Tela({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const base: ViewStyle = { flex: 1, backgroundColor: c.bg };
  if (!scroll) return <View style={[base, { padding: 16 }, style]}>{children}</View>;
  return (
    <ScrollView
      style={base}
      contentContainerStyle={[{ padding: 16, gap: 14 }, style]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

export function Titulo({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontSize: 21, fontWeight: '800', color: c.fg }, style]}>
      {children}
    </Text>
  );
}

export function Subtitulo({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  return <Text style={{ fontSize: 13.5, color: c.muted, lineHeight: 20 }}>{children}</Text>;
}

export function SecaoTitulo({ children, acao }: { children: React.ReactNode; acao?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
      <Text accessibilityRole="header" style={{ fontSize: 16.5, fontWeight: '700', color: c.fg }}>
        {children}
      </Text>
      {acao}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const s: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.border,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [s, pressed && { opacity: 0.85 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[s, style]}>{children}</View>;
}

export function Botao({
  titulo,
  onPress,
  variante = 'primario',
  carregando,
  disabled,
  icone,
  style,
  accessibilityLabel,
}: {
  titulo: string;
  onPress?: () => void;
  variante?: 'primario' | 'contorno' | 'sutil' | 'perigo';
  carregando?: boolean;
  disabled?: boolean;
  icone?: NomeIcone;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const bg =
    variante === 'primario'
      ? c.primary
      : variante === 'perigo'
      ? c.danger
      : variante === 'sutil'
      ? c.muted + '22'
      : 'transparent';
  const fg = variante === 'primario' || variante === 'perigo' ? '#ffffff' : c.primary;
  const borda = variante === 'contorno' ? c.primary : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || carregando}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || carregando), busy: !!carregando }}
      accessibilityLabel={accessibilityLabel ?? titulo}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: borda,
          borderWidth: variante === 'contorno' ? 1.5 : 0,
          paddingVertical: 13,
          paddingHorizontal: 16,
          borderRadius: 12,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
        },
        (disabled || carregando) && { opacity: 0.55 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {carregando && <ActivityIndicator color={fg} size="small" />}
      {!carregando && icone && <Icone nome={icone} tamanho={18} cor={fg} />}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{titulo}</Text>
    </Pressable>
  );
}

export function Campo({
  label,
  valor,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  secure,
  accessibilityHint,
}: {
  label?: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  secure?: boolean;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <Text style={{ color: c.fg, fontWeight: '600', fontSize: 14 }}>{label}</Text>}
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={secure}
        accessibilityLabel={label ?? placeholder}
        accessibilityHint={accessibilityHint}
        style={{
          backgroundColor: c.card,
          color: c.fg,
          borderWidth: 1,
          borderColor: c.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 15,
          minHeight: multiline ? 110 : 48,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
    </View>
  );
}

export function Pill({ texto, cor }: { texto: string; cor?: string }) {
  const { c } = useTheme();
  const base = cor ?? c.primary;
  return (
    <View
      style={{
        backgroundColor: base + '22',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 999,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: base, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'ok' | 'info'; children: React.ReactNode }) {
  const { c } = useTheme();
  const cor = tipo === 'erro' ? c.danger : tipo === 'ok' ? c.success : c.secondary;
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: cor + '18', borderColor: cor + '55', borderWidth: 1, borderRadius: 10, padding: 11 }}
    >
      <Text style={{ color: cor, fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Vazio({ children, icone }: { children: React.ReactNode; icone?: NomeIcone }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 32, gap: 10 }}>
      {icone && <Icone nome={icone} tamanho={40} cor={c.muted} />}
      <Text style={{ color: c.muted, textAlign: 'center', fontSize: 14 }}>{children}</Text>
    </View>
  );
}

export function Carregando({ texto }: { texto?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
      <ActivityIndicator color={c.primary} size="large" />
      {texto && <Text style={{ color: c.muted, fontSize: 14 }}>{texto}</Text>}
    </View>
  );
}

/** Seletor de opção única (chips). Alvo de toque >= 44px, marca o selecionado. */
export function Seletor<T extends string>({
  opcoes,
  valor,
  onChange,
  label,
}: {
  opcoes: { value: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={{ color: c.fg, fontWeight: '600', fontSize: 14 }}>{label}</Text>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.map((o) => {
          const ativo = o.value === valor;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={o.label}
              style={({ pressed }) => [
                {
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  minHeight: 44,
                  justifyContent: 'center',
                  backgroundColor: ativo ? c.primary : 'transparent',
                  borderColor: ativo ? c.primary : c.border,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={{ color: ativo ? '#ffffff' : c.fg, fontWeight: '600', fontSize: 13.5 }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Caixa de seleção (switch acessível) com rótulo. */
export function Checkbox({
  valor,
  onChange,
  label,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!valor)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor }}
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}
    >
      <Icone nome={valor ? 'checkbox-marked' : 'checkbox-blank-outline'} tamanho={24} cor={valor ? c.primary : c.muted} />
      <Text style={{ color: c.fg, fontSize: 14, flex: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** Linha rótulo+valor, usada em perfis/detalhes. */
export function LinhaInfo({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  const { c } = useTheme();
  if (!valor) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 3 }}>
      <Text style={{ color: c.muted, fontSize: 13.5, width: 110 }}>{rotulo}</Text>
      <Text style={{ color: c.fg, fontSize: 13.5, flex: 1, fontWeight: '500' }}>{valor}</Text>
    </View>
  );
}
