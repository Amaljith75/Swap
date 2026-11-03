import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { publicUrl } from '@/lib/media';
import { colors } from '@/theme/tokens';

interface Props {
  path?: string | null;
  style?: ViewStyle;
  radius?: number;
  label?: string;
}

export function Photo({ path, style, radius = 16, label }: Props) {
  const uri = publicUrl(path);
  return (
    <View style={[styles.wrap, { borderRadius: radius }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessibilityLabel={label}
        />
      ) : (
        <Ionicons name="image-outline" size={24} color={colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surfaceRaised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
