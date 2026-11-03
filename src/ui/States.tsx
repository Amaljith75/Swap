import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/errors';
import { colors, spacing } from '@/theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      {label && <Text muted>{label}</Text>}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={colors.accent} />
      </View>
      <Text variant="heading" style={styles.text}>
        {title}
      </Text>
      {body && (
        <Text muted style={styles.text}>
          {body}
        </Text>
      )}
      {action && <Button label={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={32} color={colors.textMuted} />
      <Text style={styles.text}>{errorMessage(error)}</Text>
      {onRetry && <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl, minHeight: 240 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.sm, alignSelf: 'stretch' },
});
