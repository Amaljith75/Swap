import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { isSupabaseConfigured } from '@/lib/config';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, Screen, Text } from '@/ui';

const points = [
  { icon: 'camera-outline', text: 'List things you no longer use' },
  { icon: 'swap-horizontal', text: 'Offer your items for things nearby' },
  { icon: 'chatbubbles-outline', text: 'Chat, meet in public, swap' },
] as const;

export default function Welcome() {
  const router = useRouter();
  return (
    <Screen scroll={false}>
      <View style={styles.top}>
        <LinearGradient colors={[...colors.gradientHero]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.logo}>
            <Ionicons name="swap-horizontal" size={30} color={colors.accent} />
          </View>
          <Text variant="display" onSheet>
            Swap
          </Text>
          <Text onSheet muted>
            Trade things you have for things you want, with people near you. No money involved.
          </Text>
        </LinearGradient>
        <View style={styles.points}>
          {points.map((p) => (
            <View key={p.text} style={styles.point}>
              <Ionicons name={p.icon} size={20} color={colors.accent} />
              <Text>{p.text}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.bottom}>
        {!isSupabaseConfigured && (
          <Text variant="caption" color={colors.warning}>
            This build has no Supabase keys. Add them as GitHub secrets and rebuild.
          </Text>
        )}
        <Button label="Create account" disabled={!isSupabaseConfigured} onPress={() => router.push('/(auth)/sign-in?mode=signup')} />
        <Button
          label="I already have an account"
          variant="secondary"
          disabled={!isSupabaseConfigured}
          onPress={() => router.push('/(auth)/sign-in?mode=signin')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flex: 1, justifyContent: 'center', gap: spacing.xl },
  hero: { borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, minHeight: 240, justifyContent: 'flex-end' },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  points: { gap: spacing.md, paddingHorizontal: spacing.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bottom: { gap: spacing.md },
});
