import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom space, e.g. for the floating tab bar. */
  bottomInset?: number;
  style?: ViewStyle;
}

export function Screen({ children, scroll = true, bottomInset = 0, style }: Props) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: insets.top + spacing.md,
    paddingBottom: insets.bottom + spacing.xl + bottomInset,
    paddingHorizontal: spacing.lg,
  };
  if (!scroll) return <View style={[styles.root, pad, style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[pad, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });
