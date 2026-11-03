import { Pressable, StyleSheet, View } from 'react-native';
import { describeOffer } from '@/lib/offerState';
import { timeAgo } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Offer } from '@/types/db';
import { Photo, Text } from '@/ui';
import { StatusBadge } from './StatusBadge';

export function OfferRow({ offer, me, onPress }: { offer: Offer; me: string; onPress: () => void }) {
  const d = describeOffer(offer, me);
  const theirs = d.theirItems[0];
  const mine = d.myItems[0];
  const summary = `${d.myItems.length > 1 ? `${d.myItems.length} items` : (mine?.title ?? 'Item')} ⇄ ${
    d.theirItems.length > 1 ? `${d.theirItems.length} items` : (theirs?.title ?? 'Item')
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${d.other.display_name}: ${summary}. ${d.label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={styles.thumbs}>
        <Photo path={mine?.photos[0]} style={styles.thumbBack} radius={radius.sm} />
        <Photo path={theirs?.photos[0]} style={styles.thumbFront} radius={radius.sm} />
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text variant="heading" numberOfLines={1} style={styles.name}>
            {d.other.display_name}
          </Text>
          <Text variant="caption" muted>
            {timeAgo(offer.updated_at)}
          </Text>
        </View>
        <Text variant="caption" muted numberOfLines={1}>
          {summary}
        </Text>
        <StatusBadge label={d.label} tone={d.tone} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  thumbs: { width: 64, height: 64 },
  thumbBack: { position: 'absolute', top: 0, left: 0, width: 44, height: 44, opacity: 0.7 },
  thumbFront: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  text: { flex: 1, gap: 4 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
});
