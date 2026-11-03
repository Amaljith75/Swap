import { View } from 'react-native';
import { SafetyCard } from '@/components/SafetyCard';
import { colors, spacing } from '@/theme/tokens';
import { Header, Screen, Text } from '@/ui';

export default function Safety() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Swap safely" />
      <Screen style={{ gap: spacing.lg }}>
        <SafetyCard />
        <Text muted>
          Swap connects people who want to trade. We do not inspect items or attend meetups, so the swap itself is between you and the
          other person. Ratings, reports and blocking help keep the community honest.
        </Text>
        <Text muted>Do not list anything illegal, dangerous, counterfeit, or that you do not own.</Text>
      </Screen>
    </View>
  );
}
