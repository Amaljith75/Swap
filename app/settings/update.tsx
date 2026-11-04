import { Linking, View } from 'react-native';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { currentBuild, useLatestRelease } from '@/lib/updates';
import { colors, spacing } from '@/theme/tokens';
import { Button, Header, Loading, Screen, Text } from '@/ui';

export default function UpdateScreen() {
  const latest = useLatestRelease();
  const mine = currentBuild();
  const r = latest.data;
  const newer = !!r?.url && r.build > mine;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="App version" />
      <Screen style={{ gap: spacing.lg }}>
        <Text variant="title">Swap {Application.nativeApplicationVersion ?? ''}</Text>
        <Text muted>This phone has build {mine || 'unknown'}.</Text>
        {Platform.OS !== 'android' ? (
          <Text muted>Updates on iPhone come through the App Store.</Text>
        ) : latest.isLoading ? (
          <Loading />
        ) : newer ? (
          <>
            <Text>{r!.name ?? `Build ${r!.build}`} is available.</Text>
            <Button label="Update now" icon="download-outline" onPress={() => void Linking.openURL(r!.url!)} />
            <Text variant="caption" muted>
              Your browser downloads the new APK. Open it to install over this version.
            </Text>
          </>
        ) : (
          <Text color={colors.accent}>You have the latest version.</Text>
        )}
        <Button label="Check again" variant="secondary" loading={latest.isFetching} onPress={() => void latest.refetch()} />
      </Screen>
    </View>
  );
}
