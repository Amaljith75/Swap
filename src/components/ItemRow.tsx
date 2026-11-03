import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { conditionLabel } from '@/lib/config';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ListingLite } from '@/types/db';
import { Photo, Text } from '@/ui';

interface Props {
  item: ListingLite;
  onPress?: () => void;
  /** Shows a checkbox for multi-select lists. */
  selected?: boolean;
  trailing?: string;
}

export function ItemRow({ item, onPress, selected, trailing }: Props) {
  const selectable = selected !== undefined;
  return (
    <Pressable
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={item.title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.selected, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Photo path={item.photos[0]} style={styles.thumb} radius={radius.sm} label={item.title} />
      <View style={styles.text}>
        <Text variant="heading" numberOfLines={1}>
          {item.title}
        </Text>
        <Text variant="caption" muted>
          {trailing ?? conditionLabel(item.condition)}
        </Text>
      </View>
      {selectable && (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? colors.accent : colors.textMuted}
        />
      )}
      {!selectable && onPress && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selected: { borderColor: colors.accent },
  thumb: { width: 56, height: 56 },
  text: { flex: 1, gap: 2 },
});
