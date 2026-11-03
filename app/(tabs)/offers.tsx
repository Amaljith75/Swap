import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOffers } from '@/api/offers';
import { OfferRow } from '@/components/OfferRow';
import { useUserId } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';
import { EmptyState, ErrorView, Loading, Segmented, Text } from '@/ui';

type Tab = 'active' | 'past';

export default function OffersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useUserId();
  const offers = useOffers();
  const [tab, setTab] = useState<Tab>('active');

  const rows = useMemo(() => {
    const all = offers.data ?? [];
    const open = (s: string) => s === 'pending' || s === 'countered' || s === 'accepted';
    const list = all.filter((o) => (tab === 'active' ? open(o.status) : !open(o.status)));
    // Things waiting for you first.
    if (tab === 'active') {
      list.sort((a, b) => Number(b.awaiting_user === me) - Number(a.awaiting_user === me));
    }
    return list;
  }, [offers.data, tab, me]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text variant="display">Offers</Text>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </View>
      {offers.isLoading ? (
        <Loading />
      ) : offers.isError ? (
        <ErrorView error={offers.error} onRetry={() => void offers.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: 110 + insets.bottom }]}
          renderItem={({ item }) => <OfferRow offer={item} me={me!} onPress={() => router.push(`/offer/${item.id}`)} />}
          ListEmptyComponent={
            tab === 'active' ? (
              <EmptyState
                icon="swap-horizontal"
                title="No active offers"
                body="Find something you like on Explore and offer one of your items for it."
                action={{ label: 'Explore items', onPress: () => router.navigate('/(tabs)') }}
              />
            ) : (
              <EmptyState icon="time-outline" title="No past offers yet" body="Finished, declined and cancelled offers show up here." />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={offers.isRefetching}
              onRefresh={() => void offers.refetch()}
              tintColor={colors.accent}
              colors={[colors.accentText]}
              progressBackgroundColor={colors.accent}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
});
