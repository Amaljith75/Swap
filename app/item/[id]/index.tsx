import { useEffect, useState } from 'react';
import { Dimensions, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListing, useListingArea, useListingDistance } from '@/api/listings';
import { AreaMap } from '@/components/AreaMap';
import { useMyOpenOfferOn } from '@/api/offers';
import { TrustLine } from '@/components/TrustLine';
import { categoryLabel, conditionLabel, links } from '@/lib/config';
import { formatDistance, timeAgo } from '@/lib/format';
import { useLocation } from '@/lib/location';
import { useUserId } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';
import { Avatar, Button, EmptyState, ErrorView, Header, HeaderIcon, Loading, Photo, Text } from '@/ui';

const W = Dimensions.get('window').width;

/** Opens the phone's share sheet (WhatsApp, Instagram, Telegram, SMS, ...) with a link to the item. */
async function shareItem(id: string, title: string, mine: boolean) {
  const url = links.item(id);
  const message = mine
    ? `I'm swapping my ${title} on Swap. Got something to trade? ${url}`
    : `Check out "${title}" on Swap, the app for swapping things nearby. ${url}`;
  try {
    await Share.share({ message, title }, { dialogTitle: 'Share this item' });
  } catch {
    // the person closed the share sheet
  }
}

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const uid = useUserId();
  const { coords, status, request } = useLocation();
  const listing = useListing(id);
  const distance = useListingDistance(id, coords);
  const myOffer = useMyOpenOfferOn(id);
  const area = useListingArea(id);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (status === 'idle') void request();
  }, [status, request]);

  if (listing.isLoading) return <Loading />;
  if (listing.isError)
    return (
      <View style={styles.root}>
        <Header />
        <ErrorView error={listing.error} onRetry={() => void listing.refetch()} />
      </View>
    );
  const l = listing.data;
  if (!l)
    return (
      <View style={styles.root}>
        <Header />
        <EmptyState icon="cube-outline" title="This item is gone" body="It may have been swapped or removed." />
      </View>
    );

  const mine = l.owner_id === uid;
  const unavailable = l.status !== 'available';

  return (
    <View style={styles.root}>
      <Header
        floating
        right={
          <>
            {!unavailable && (
              <HeaderIcon icon="share-social-outline" label="Share this item" onPress={() => void shareItem(l.id, l.title, mine)} />
            )}
            {!mine && (
              <HeaderIcon
                icon="flag-outline"
                label="Report this item"
                onPress={() => router.push({ pathname: '/report', params: { user: l.owner_id, listing: l.id } })}
              />
            )}
          </>
        }
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 140 + insets.bottom }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}
        >
          {l.photos.map((p, i) => (
            <Photo key={p} path={p} style={{ width: W, height: W }} radius={0} label={`${l.title} photo ${i + 1}`} />
          ))}
        </ScrollView>
        {l.photos.length > 1 && (
          <View style={styles.dots}>
            {l.photos.map((p, i) => (
              <View key={p} style={[styles.dot, i === page && styles.dotOn]} />
            ))}
          </View>
        )}

        <View style={styles.body}>
          {unavailable && (
            <View style={styles.banner}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.warning} />
              <Text variant="caption" color={colors.warning}>
                {l.status === 'reserved' ? 'In an accepted trade' : l.status === 'traded' ? 'Already swapped' : 'No longer listed'}
              </Text>
            </View>
          )}
          <Text variant="title">{l.title}</Text>
          <View style={styles.meta}>
            <Tag icon="pricetag-outline" text={categoryLabel(l.category)} />
            <Tag icon="sparkles-outline" text={conditionLabel(l.condition)} />
            {!mine && distance.data != null && <Tag icon="location-outline" text={formatDistance(distance.data)} />}
            <Tag icon="time-outline" text={timeAgo(l.created_at)} />
          </View>

          <View style={styles.wants}>
            <Text variant="caption" muted>
              Would like in return
            </Text>
            <Text variant="heading">{l.looking_for || 'Open to offers'}</Text>
          </View>

          {!!l.description && <Text style={styles.desc}>{l.description}</Text>}

          {area.data && <AreaMap lat={area.data.lat} lng={area.data.lng} />}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${l.owner.display_name}'s profile`}
            onPress={() => router.push(`/user/${l.owner_id}`)}
            style={styles.owner}
          >
            <Avatar name={l.owner.display_name} path={l.owner.avatar_url} size={44} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{mine ? 'You' : l.owner.display_name}</Text>
              <TrustLine rating={l.owner.rating_avg} count={l.owner.rating_count} trades={l.owner.trades_completed} />
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        {mine ? (
          <Button
            label="Edit item"
            icon="create-outline"
            variant="secondary"
            disabled={unavailable}
            onPress={() => router.push(`/item/${l.id}/edit`)}
          />
        ) : myOffer.data ? (
          <Button label="View your offer" icon="swap-horizontal" onPress={() => router.push(`/offer/${myOffer.data!.id}`)} />
        ) : (
          <Button
            label="Offer a swap"
            icon="swap-horizontal"
            disabled={unavailable}
            onPress={() => router.push({ pathname: '/offer/new', params: { listing: l.id } })}
          />
        )}
      </View>
    </View>
  );
}

function Tag({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.tag}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text variant="caption" muted>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accent, width: 18 },
  body: { padding: spacing.lg, gap: spacing.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  wants: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.lg, gap: 4 },
  desc: { lineHeight: 22 },
  owner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
