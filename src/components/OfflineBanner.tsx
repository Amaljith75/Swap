import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme/tokens';
import { Text } from '@/ui';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const insets = useSafeAreaInsets();
  useEffect(
    () => NetInfo.addEventListener((s) => setOffline(s.isConnected === false || s.isInternetReachable === false)),
    [],
  );
  if (!offline) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 4 }]} accessibilityLiveRegion="polite">
      <Text variant="caption" color={colors.accentText} style={styles.text}>
        Connection lost. Changes will not save until you are back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, backgroundColor: colors.warning, paddingBottom: 6 },
  text: { textAlign: 'center', fontWeight: '600' },
});
