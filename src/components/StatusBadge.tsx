import { StyleSheet, View } from 'react-native';
import type { Tone } from '@/lib/offerState';
import { colors, radius } from '@/theme/tokens';
import { Text } from '@/ui';

const toneColor: Record<Tone, string> = {
  action: colors.accent,
  waiting: colors.warning,
  good: colors.accent,
  closed: colors.textMuted,
};

export function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  const c = toneColor[tone];
  return (
    <View style={[styles.pill, { borderColor: c }, tone === 'action' && { backgroundColor: c }]}>
      <Text variant="caption" color={tone === 'action' ? colors.accentText : c} style={styles.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  text: { fontWeight: '600', fontSize: 12 },
});
