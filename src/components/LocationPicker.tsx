import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import MapView, { PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '@/lib/location';
import { colors, radius, spacing } from '@/theme/tokens';
import { Text } from '@/ui';

export interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  error?: string;
}

const DELTA = 0.02; // ~2 km across: enough to recognise the neighbourhood

/**
 * Move the map so the pin sits where the item is. Only the ~500 m area is ever
 * stored and shown to others, never this exact point.
 */
export function LocationPicker({ value, onChange, error }: Props) {
  const location = useLocation();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);

  // Start at the phone's position when nothing is set yet.
  useEffect(() => {
    if (value) return;
    void (location.coords ? Promise.resolve(location.coords) : location.request()).then((c) => {
      if (c) onChange(c);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = async () => {
    const c = await location.request();
    if (!c) return;
    onChange(c);
    map.current?.animateToRegion({ latitude: c.lat, longitude: c.lng, latitudeDelta: DELTA, longitudeDelta: DELTA }, 400);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" muted style={styles.label}>
        Where is the item?
      </Text>
      <View style={[styles.mapBox, error ? styles.errorBorder : null]}>
        {value ? (
          <>
            <MapView
              ref={map}
              style={StyleSheet.absoluteFill}
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              initialRegion={{ latitude: value.lat, longitude: value.lng, latitudeDelta: DELTA, longitudeDelta: DELTA }}
              onMapReady={() => setReady(true)}
              onRegionChangeComplete={(r: Region) => {
                if (ready) onChange({ lat: r.latitude, lng: r.longitude });
              }}
              showsUserLocation
              showsMyLocationButton={false}
              toolbarEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle="dark"
              accessibilityLabel="Map. Drag to place the pin where the item is."
            />
            {/* Fixed pin in the middle: the map moves under it. */}
            <View pointerEvents="none" style={styles.pinWrap}>
              <Ionicons name="location" size={40} color={colors.accent} style={styles.pin} />
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Use my location" onPress={() => void recenter()} style={styles.locate}>
              <Ionicons name="locate" size={20} color={colors.text} />
            </Pressable>
          </>
        ) : (
          <Pressable accessibilityRole="button" onPress={() => void recenter()} style={styles.empty}>
            <Ionicons name="location-outline" size={26} color={colors.accent} />
            <Text muted>{location.status === 'loading' ? 'Finding you…' : 'Tap to use your location'}</Text>
          </Pressable>
        )}
      </View>
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : (
        <Text variant="caption" muted>
          Drag the map to move the pin. Others only see the rough area (about 500 m), never this exact spot.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { marginLeft: 4 },
  mapBox: {
    height: 220,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorBorder: { borderColor: colors.danger },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pin: { marginBottom: 38 }, // tip of the pin on the map centre
  locate: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(14,14,16,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
