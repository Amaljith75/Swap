import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { colors, radius } from '@/theme/tokens';
import { Text } from '@/ui';

/** Approximate area of an item: a ~600 m circle around its (already rounded) location. */
export function AreaMap({ lat, lng }: { lat: number; lng: number }) {
  return (
    <View style={styles.box}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={{ latitude: lat, longitude: lng, latitudeDelta: 0.03, longitudeDelta: 0.03 }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
        accessibilityLabel="Map showing the approximate area of the item"
      >
        <Circle
          center={{ latitude: lat, longitude: lng }}
          radius={600}
          strokeColor={colors.accent}
          fillColor="rgba(183,243,74,0.22)"
          strokeWidth={2}
        />
      </MapView>
      <View style={styles.tag} pointerEvents="none">
        <Text variant="caption" color={colors.accentText} style={{ fontWeight: '700' }}>
          Approximate area
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { height: 170, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  tag: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
