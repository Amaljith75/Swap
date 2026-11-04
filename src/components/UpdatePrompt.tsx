import { useState } from 'react';
import { Linking, Modal, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpdateAvailable } from '@/lib/updates';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, Text } from '@/ui';

/** "New update available" sheet, shown once per app session when a newer APK exists. */
export function UpdatePrompt() {
  const { available, release } = useUpdateAvailable();
  const [dismissedBuild, setDismissedBuild] = useState<number | null>(null);
  const open = available && release?.build !== dismissedBuild;
  if (!release) return null;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => setDismissedBuild(release.build)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={28} color={colors.accentText} />
          </View>
          <Text variant="title">New update available</Text>
          <Text muted style={styles.center}>
            A newer version of Swap is ready{release.build ? ` (build ${release.build})` : ''}. Download it and install it over
            this one. Your account and items stay as they are.
          </Text>
          <Button
            label="Update now"
            icon="download-outline"
            style={styles.full}
            onPress={() => {
              if (release.url) void Linking.openURL(release.url);
              setDismissedBuild(release.build);
            }}
          />
          <Button label="Later" variant="ghost" onPress={() => setDismissedBuild(release.build)} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  full: { alignSelf: 'stretch' },
});
