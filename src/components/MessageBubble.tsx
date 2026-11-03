import { StyleSheet, View } from 'react-native';
import { clockTime } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Message } from '@/types/db';
import { Text } from '@/ui';

export function MessageBubble({ message, mine }: { message: Message; mine: boolean }) {
  if (message.kind === 'system') {
    return (
      <View style={styles.system}>
        <Text variant="caption" muted style={styles.systemText}>
          {message.body}
        </Text>
      </View>
    );
  }
  return (
    <View style={[styles.wrap, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text color={mine ? colors.accentText : colors.textOnSheet}>{message.body}</Text>
      </View>
      <Text variant="caption" muted style={styles.time}>
        {clockTime(message.created_at)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { maxWidth: '80%', gap: 2, marginVertical: 3 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.lg },
  mine: { backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.sheetMuted, borderBottomLeftRadius: 6 },
  time: { fontSize: 11, marginHorizontal: 6 },
  system: { alignSelf: 'center', marginVertical: spacing.sm, paddingHorizontal: spacing.lg, maxWidth: '90%' },
  systemText: { textAlign: 'center' },
});
