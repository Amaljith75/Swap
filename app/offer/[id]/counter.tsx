import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUserListings } from '@/api/listings';
import { useOffer, useRespondOffer } from '@/api/offers';
import { ItemRow } from '@/components/ItemRow';
import { limits } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { useUserId } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';
import { Button, EmptyState, ErrorView, Header, Loading, Text } from '@/ui';

// The offered items always belong to the person who made the offer.
// The item owner uses this to ask for different items; the offerer uses it to change their offer.
export default function Counter() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useUserId();
  const offer = useOffer(id);
  const items = useUserListings(offer.data?.from_user);
  const respond = useRespondOffer(id!);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (offer.data) setSelected(offer.data.offer_items.map((i) => i.listing.id));
  }, [offer.data]);

  if (offer.isLoading || items.isLoading) return <Loading />;
  if (offer.isError || items.isError)
    return <ErrorView error={offer.error ?? items.error} onRetry={() => void Promise.all([offer.refetch(), items.refetch()])} />;
  const o = offer.data;
  if (!o) return <EmptyState icon="alert-circle-outline" title="Offer not found" />;
  const iAmOwner = o.to_user === me;
  const pickable = (items.data ?? []).filter((l) => l.id !== o.target_listing_id);

  const toggle = (lid: string) =>
    setSelected((s) => (s.includes(lid) ? s.filter((x) => x !== lid) : s.length >= limits.maxOfferItems ? s : [...s, lid]));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={iAmOwner ? 'Ask for different items' : 'Change your offer'} />
      <FlatList
        data={pickable}
        keyExtractor={(l) => l.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text muted style={styles.intro}>
            {iAmOwner
              ? `Pick which of ${o.from_profile.display_name}'s items you would take for your ${o.target.title}.`
              : `Pick which of your items to offer for ${o.target.title}.`}
          </Text>
        }
        renderItem={({ item }) => <ItemRow item={item} selected={selected.includes(item.id)} onPress={() => toggle(item.id)} />}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No other items available" />}
      />
      <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button
          label={iAmOwner ? 'Send counter-offer' : 'Update offer'}
          disabled={selected.length === 0}
          loading={respond.isPending}
          onPress={async () => {
            setError(null);
            try {
              await respond.mutateAsync({ action: 'counter', itemIds: selected });
              router.back();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  intro: { marginBottom: spacing.md },
  bar: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
