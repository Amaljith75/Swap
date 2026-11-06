import { Pressable, StyleSheet, View } from 'react-native';
import { formatDistance } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';
import type { NearbyListing } from '@/types/db';
import { Photo, Text } from '@/ui';

export function ListingCard({ item, onPress }: { item: NearbyListing; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.distance_km == null ? item.title : `${item.title}, ${formatDistance(item.distance_km)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Photo thumb path={item.photos[0]} style={styles.photo} radius={radius.md} label={item.title} />
      {item.distance_km != null && (
        <View style={styles.distance}>
          <Text variant="caption" color={colors.accentText} style={styles.distanceText}>
            {formatDistance(item.distance_km)}
          </Text>
        </View>
      )}
      <View style={styles.body}>
        <Text variant="heading" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" muted numberOfLines={1}>
          {item.looking_for ? `Wants: ${item.looking_for}` : 'Open to offers'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 6 },
  photo: { width: '100%', aspectRatio: 1 },
  distance: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  distanceText: { fontSize: 11, fontWeight: '700' },
  body: { padding: spacing.sm, gap: 2 },
});
