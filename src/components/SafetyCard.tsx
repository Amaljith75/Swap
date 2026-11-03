import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { safetyTips } from '@/lib/config';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/ui';

export function SafetyCard({ compact }: { compact?: boolean }) {
  const tips = compact ? safetyTips.slice(0, 2) : safetyTips;
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
        <Text variant="heading">Swap safely</Text>
      </View>
      {tips.map((t) => (
        <View key={t} style={styles.tip}>
          <Text muted>•</Text>
          <Text muted style={styles.tipText}>
            {t}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.sm },
  tipText: { flex: 1 },
});
