import { ActivityIndicator, View } from 'react-native';
import { colors } from '@/theme/tokens';

// The auth gate in _layout decides where to go; this is only a placeholder.
export default function Index() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
