import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { cleanOldUpdates, useInstallUpdate } from '@/lib/installUpdate';
import { currentBuild, useUpdateAvailable } from '@/lib/updates';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, Text } from '@/ui';

/** "New update available" sheet. Downloads in the app and opens Android's installer. */
export function UpdatePrompt() {
  const { available, release } = useUpdateAvailable();
  const install = useInstallUpdate();
  const [dismissedBuild, setDismissedBuild] = useState<number | null>(null);

  useEffect(() => {
    void cleanOldUpdates(currentBuild());
  }, []);

  if (!release) return null;
  const busy = install.phase === 'downloading' || install.phase === 'installing';
  const open = (available && release.build !== dismissedBuild) || busy;

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={() => !busy && setDismissedBuild(release.build)}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityRole="alert">
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={28} color={colors.accentText} />
          </View>
          <Text variant="title">New update available</Text>
          <UpdateBody />
          <UpdateActions onLater={() => setDismissedBuild(release.build)} />
        </View>
      </View>
    </Modal>
  );
}

/** Shared by the prompt and the App version screen. */
export function UpdateBody() {
  const { release } = useUpdateAvailable();
  const install = useInstallUpdate();
  if (install.phase === 'downloading') {
    const pct = Math.round(install.progress * 100);
    return (
      <View style={styles.progressWrap}>
        <Text muted>Downloading {pct}%</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
    );
  }
  if (install.phase === 'installing') {
    return <Text muted style={styles.center}>Opening the installer… Tap Update to finish.</Text>;
  }
  if (install.phase === 'error') {
    return (
      <Text color={colors.danger} style={styles.center}>
        {install.error} Check your connection and tap Try again.
      </Text>
    );
  }
  return (
    <Text muted style={styles.center}>
      {release?.name ?? 'A newer version of Swap'} is ready. It installs over this version; your account and items stay as they
      are.
    </Text>
  );
}

export function UpdateActions({ onLater }: { onLater?: () => void }) {
  const { release } = useUpdateAvailable();
  const install = useInstallUpdate();
  if (!release?.url) return null;
  const busy = install.phase === 'downloading' || install.phase === 'installing';
  return (
    <View style={styles.actions}>
      <Button
        label={install.phase === 'error' ? 'Try again' : 'Update now'}
        icon="download-outline"
        loading={busy}
        onPress={() => void install.start(release.url!, release.build)}
      />
      {onLater && !busy && <Button label="Later" variant="ghost" onPress={onLater} />}
    </View>
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
  actions: { alignSelf: 'stretch', gap: spacing.sm },
  progressWrap: { alignSelf: 'stretch', gap: spacing.sm, alignItems: 'center' },
  track: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent },
});
