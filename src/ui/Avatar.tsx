import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { publicUrl } from '@/lib/media';
import { colors } from '@/theme/tokens';
import { Text } from './Text';

export function Avatar({ name, path, size = 40 }: { name: string; path?: string | null; size?: number }) {
  const uri = publicUrl(path);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" accessibilityLabel={name} />
      ) : (
        <Text variant="heading" color={colors.accentText} style={{ fontSize: size * 0.42 }}>
          {initial}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
