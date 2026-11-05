import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { errorMessage } from '@/lib/errors';
import { pickImages, takePhoto } from '@/lib/media';
import { colors, radius, spacing } from '@/theme/tokens';
import { Photo, Text } from '@/ui';

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  max: number;
  error?: string;
}

/** Holds a mix of uploaded storage paths and new local file URIs. */
export function PhotoPicker({ value, onChange, max, error }: Props) {
  const room = max - value.length;

  const add = () => {
    Alert.alert('Add photos', undefined, [
      {
        text: 'Take photo',
        onPress: async () => {
          try {
            const uri = await takePhoto();
            if (uri) onChange([...value, uri].slice(0, max));
          } catch (e) {
            Alert.alert('Camera', errorMessage(e));
          }
        },
      },
      {
        text: 'Choose from gallery',
        onPress: async () => {
          try {
            const uris = await pickImages(room);
            if (uris.length) onChange([...value, ...uris].slice(0, max));
          } catch (e) {
            Alert.alert('Photos', errorMessage(e));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {value.map((p, i) => (
          <View key={`${p}-${i}`}>
            <Photo thumb path={p} style={styles.tile} radius={radius.md} />
            {i === 0 && (
              <View style={styles.cover}>
                <Text variant="caption" color={colors.accentText} style={styles.coverText}>
                  Cover
                </Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              hitSlop={8}
              onPress={() => onChange(value.filter((_, j) => j !== i))}
              style={styles.remove}
            >
              <Ionicons name="close" size={16} color={colors.text} />
            </Pressable>
          </View>
        ))}
        {room > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel="Add photos" onPress={add} style={[styles.tile, styles.add]}>
            <Ionicons name="camera-outline" size={26} color={colors.accent} />
            <Text variant="caption" muted>
              {value.length === 0 ? 'Add photos' : `${room} more`}
            </Text>
          </Pressable>
        )}
      </ScrollView>
      {error ? (
        <Text variant="caption" color={colors.danger}>
          {error}
        </Text>
      ) : (
        <Text variant="caption" muted>
          Clear photos get more offers. The first one is the cover.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { gap: spacing.sm },
  tile: { width: 104, height: 104 },
  add: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(14,14,16,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coverText: { fontSize: 11, fontWeight: '700' },
});
