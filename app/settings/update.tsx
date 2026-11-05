import { Linking, Platform, View } from 'react-native';
import * as Application from 'expo-application';
import { UpdateActions, UpdateBody } from '@/components/UpdatePrompt';
import { PLAY_STORE_URL, selfUpdates } from '@/lib/channel';
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
        <Text variant="title">Swap V {Application.nativeApplicationVersion ?? ''}</Text>
        <Text muted>This phone has build {mine || 'unknown'}.</Text>
        {Platform.OS === 'ios' ? (
          <Text muted>Updates on iPhone come through the App Store.</Text>
        ) : !selfUpdates ? (
          <>
            <Text muted>Google Play keeps Swap up to date.</Text>
            <Button label="Open in Google Play" variant="secondary" onPress={() => void Linking.openURL(PLAY_STORE_URL)} />
          </>
        ) : latest.isLoading ? (
          <Loading />
        ) : newer ? (
          <>
            <UpdateBody />
            <UpdateActions />
          </>
        ) : (
          <Text color={colors.accent}>You have the latest version.</Text>
        )}
        {selfUpdates && (
          <Button label="Check again" variant="secondary" loading={latest.isFetching} onPress={() => void latest.refetch()} />
        )}
      </Screen>
    </View>
  );
}
