import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useUserListings } from '@/api/listings';
import { useProfile, useRatings } from '@/api/profiles';
import { useBlockUser, useBlocks } from '@/api/safety';
import { ItemRow } from '@/components/ItemRow';
import { TrustLine } from '@/components/TrustLine';
import { errorMessage } from '@/lib/errors';
import { memberSince, timeAgo } from '@/lib/format';
import { useUserId } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';
import { Avatar, EmptyState, ErrorView, Header, HeaderIcon, Loading, Stars, Text } from '@/ui';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useUserId();
  const profile = useProfile(id);
  const items = useUserListings(id);
  const ratings = useRatings(id);
  const blocks = useBlocks();
  const block = useBlockUser();
  const isMe = id === me;
  const blocked = !!blocks.data?.some((b) => b.blocked_id === id);

  if (profile.isLoading) return <Loading />;
  if (profile.isError || !profile.data)
    return (
      <View style={styles.root}>
        <Header />
        <ErrorView error={profile.error ?? 'Profile not found.'} onRetry={() => void profile.refetch()} />
      </View>
    );
  const p = profile.data;

  const menu = () =>
    Alert.alert(p.display_name, undefined, [
      { text: 'Report', onPress: () => router.push({ pathname: '/report', params: { user: p.id } }) },
      {
        text: blocked ? 'Unblock' : 'Block',
        style: blocked ? 'default' : 'destructive',
        onPress: () =>
          block.mutate({ userId: p.id, block: !blocked }, { onError: (e) => Alert.alert('Something went wrong', errorMessage(e)) }),
      },
      { text: 'Close', style: 'cancel' },
    ]);

  return (
    <View style={styles.root}>
      <Header right={!isMe ? <HeaderIcon icon="ellipsis-horizontal" label="More options" onPress={menu} /> : undefined} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.head}>
          <Avatar name={p.display_name} path={p.avatar_url} size={84} />
          <Text variant="title">{p.display_name}</Text>
          <TrustLine rating={p.rating_avg} count={p.rating_count} trades={p.trades_completed} />
          <Text variant="caption" muted>
            {p.city ? `${p.city} · ` : ''}Member since {memberSince(p.created_at)}
          </Text>
          {!!p.bio && <Text style={{ textAlign: 'center' }}>{p.bio}</Text>}
          {blocked && (
            <Text variant="caption" color={colors.warning}>
              You blocked this person.
            </Text>
          )}
        </View>

        <Text variant="heading">{isMe ? 'Your available items' : 'Available to swap'}</Text>
        {items.isLoading ? (
          <Loading />
        ) : items.data && items.data.length > 0 ? (
          <View style={styles.items}>
            {items.data.map((l) => (
              <ItemRow key={l.id} item={l} onPress={() => router.push(`/item/${l.id}`)} />
            ))}
          </View>
        ) : (
          <Text muted>Nothing listed right now.</Text>
        )}

        <Text variant="heading" style={{ marginTop: spacing.lg }}>
          Ratings
        </Text>
        {ratings.data && ratings.data.length > 0 ? (
          ratings.data.map((r) => (
            <View key={r.id} style={styles.rating}>
              <View style={styles.ratingTop}>
                <Avatar name={r.rater.display_name} path={r.rater.avatar_url} size={28} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {r.rater.display_name}
                </Text>
                <Stars value={r.stars} size={12} />
              </View>
              {!!r.comment && <Text muted>{r.comment}</Text>}
              <Text variant="caption" muted>
                {timeAgo(r.created_at)}
              </Text>
            </View>
          ))
        ) : ratings.isLoading ? null : (
          <EmptyState icon="star-outline" title="No ratings yet" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  head: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  items: { gap: spacing.sm },
  rating: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: 6 },
  ratingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
