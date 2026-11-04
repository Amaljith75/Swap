// Web fallback (used only by the browser demo): maps aren't available there.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/lib/location';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/ui';
import type { LatLng } from './LocationPicker';

export type { LatLng };

export function LocationPicker({ value, onChange }: { value: LatLng | null; onChange: (v: LatLng) => void; error?: string }) {
  const location = useLocation();
  useEffect(() => {
    if (!value) void location.request().then((c) => c && onChange(c));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" muted style={{ marginLeft: 4 }}>
        Where is the item?
      </Text>
      <View style={styles.box}>
        <Ionicons name="map-outline" size={28} color={colors.accent} />
        <Text muted style={{ textAlign: 'center' }}>
          On the phone app this is a Google map you drag to place the pin.{'\n'}Using your current area.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
});
