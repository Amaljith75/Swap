import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/tokens';
import { Text } from '@/ui';

export function TrustLine({ rating, count, trades }: { rating: number | null; count?: number; trades: number }) {
  return (
    <View style={styles.row}>
      <Ionicons name="star" size={13} color={colors.warning} />
      <Text variant="caption" muted>
        {rating ? `${Number(rating).toFixed(1)}${count ? ` (${count})` : ''}` : 'New'}
        {'  ·  '}
        {trades === 1 ? '1 swap' : `${trades} swaps`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 4 } });
