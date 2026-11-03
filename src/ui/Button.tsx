import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, radius } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const palette: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText },
  secondary: { bg: colors.surfaceRaised, fg: colors.text },
  danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.text },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style }: Props) {
  const inactive = disabled || loading;
  const p = palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      hitSlop={size === 'sm' ? 6 : 0}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: p.bg, opacity: inactive ? 0.45 : pressed ? 0.8 : 1 },
        p.border ? { borderWidth: 1, borderColor: p.border } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={p.fg} />}
          <Text variant={size === 'sm' ? 'caption' : 'heading'} color={p.fg} style={size === 'sm' ? styles.smLabel : null}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 54, paddingHorizontal: 22 },
  sm: { minHeight: 36, paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smLabel: { fontWeight: '600' },
});
