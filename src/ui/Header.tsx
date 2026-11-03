import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme/tokens';
import { Text } from './Text';

interface Props {
  title?: string;
  right?: ReactNode;
  /** Draws over content (e.g. photo carousels) instead of taking space. */
  floating?: boolean;
  onBack?: () => void;
}

export function Header({ title, right, floating, onBack }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }, floating && styles.floating]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={10}
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={[styles.icon, floating && styles.iconFloating]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text variant="heading" numberOfLines={1} style={styles.title}>
        {title ?? ''}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function HeaderIcon({
  icon,
  onPress,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={styles.icon}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
  floating: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconFloating: { backgroundColor: 'rgba(14,14,16,0.7)' },
  title: { flex: 1, textAlign: 'center' },
  right: { minWidth: 40, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
