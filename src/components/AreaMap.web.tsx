// Web fallback for the browser demo.
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/ui';

export function AreaMap(_: { lat: number; lng: number }) {
  return (
    <View style={styles.box}>
      <Ionicons name="map-outline" size={24} color={colors.accent} />
      <Text variant="caption" muted>
        Approximate area map (shown in the phone app)
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
