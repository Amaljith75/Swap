import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useIsAdmin } from '@/api/admin';
import { useMe } from '@/api/profiles';
import { useTabBarSpace } from '@/components/TabBar';
import { TrustLine } from '@/components/TrustLine';
import { links } from '@/lib/config';
import { selfUpdates } from '@/lib/channel';
import { memberSince } from '@/lib/format';
import { unregisterForPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { currentBuild, useUpdateAvailable } from '@/lib/updates';
import { colors, radius, spacing } from '@/theme/tokens';
import { Avatar, ErrorView, Loading, Screen, Text } from '@/ui';

type IconName = keyof typeof Ionicons.glyphMap;

function Row({ icon, label, value, onPress, danger }: { icon: IconName; label: string; value?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={styles.rowLabel} color={danger ? colors.danger : undefined}>
        {label}
      </Text>
      {value && (
        <Text variant="caption" muted>
          {value}
        </Text>
      )}
      {!danger && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" muted style={styles.sectionTitle}>
        {title}
      </Text>
      <View style={styles.group}>{children}</View>
    </View>
  );
}

export default function Profile() {
  const router = useRouter();
  const me = useMe();
  const tabSpace = useTabBarSpace();
  const update = useUpdateAvailable();
  const isAdmin = useIsAdmin();

  if (me.isLoading) return <Loading />;
  if (me.isError || !me.data) return <ErrorView error={me.error} onRetry={() => void me.refetch()} />;
  const p = me.data;

  return (
    <Screen bottomInset={tabSpace}>
      <Text variant="display" style={styles.title}>
        Profile
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View your public profile"
        onPress={() => router.push(`/user/${p.id}`)}
        style={styles.card}
      >
        <Avatar name={p.display_name} path={p.avatar_url} size={60} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title">{p.display_name}</Text>
          <TrustLine rating={p.rating_avg} count={p.rating_count} trades={p.trades_completed} />
          <Text variant="caption" muted>
            {p.city ? `${p.city} · ` : ''}Member since {memberSince(p.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Section title="Account">
        <Row icon="create-outline" label="Edit profile" onPress={() => router.push('/settings/edit-profile')} />
        <Row icon="cube-outline" label="My items" onPress={() => router.navigate('/(tabs)/items')} />
      </Section>
      <Section title="Safety">
        <Row icon="shield-checkmark-outline" label="How to swap safely" onPress={() => router.push('/settings/safety')} />
        <Row icon="ban-outline" label="Blocked people" onPress={() => router.push('/settings/blocked')} />
        {isAdmin.data && <Row icon="flag-outline" label="Reports (admin)" onPress={() => router.push('/admin')} />}
      </Section>
      <Section title="App">
        <Row
          icon={selfUpdates ? 'cloud-download-outline' : 'information-circle-outline'}
          label={update.available ? 'Update available' : 'App version'}
          value={update.available ? `Build ${update.release?.build}` : `Build ${currentBuild() || '–'}`}
          onPress={() => router.push('/settings/update')}
        />
        <Row icon="lock-closed-outline" label="Privacy Policy" onPress={() => void Linking.openURL(links.privacy)} />
        <Row icon="document-text-outline" label="Terms of Use" onPress={() => void Linking.openURL(links.terms)} />
      </Section>
      <Section title="Session">
        <Row
          icon="log-out-outline"
          label="Sign out"
          danger
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void unregisterForPush().finally(() => supabase.auth.signOut()) },
            ])
          }
        />
        <Row icon="trash-outline" label="Delete account" danger onPress={() => router.push('/settings/delete-account')} />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  section: { marginTop: spacing.xl, gap: spacing.sm },
  sectionTitle: { marginLeft: spacing.sm },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: { flex: 1 },
});
