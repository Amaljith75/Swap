import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearby } from '@/api/listings';
import { ListingCard } from '@/components/ListingCard';
import { useTabBarSpace } from '@/components/TabBar';
import { categories, limits } from '@/lib/config';
import { useLocation } from '@/lib/location';
import { colors, radius, spacing } from '@/theme/tokens';
import { Chip, EmptyState, ErrorView, Loading, Text } from '@/ui';

export default function Explore() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { status, coords, request } = useLocation();
  const [radiusKm, setRadiusKm] = useState<number>(limits.defaultRadiusKm);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (status === 'idle') void request();
  }, [status, request]);

  // Debounce typing before querying.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const params = useMemo(
    () => (coords ? { lat: coords.lat, lng: coords.lng, radiusKm, category, query } : null),
    [coords, radiusKm, category, query],
  );
  const nearby = useNearby(params);
  const items = useMemo(() => nearby.data?.pages.flat() ?? [], [nearby.data]);
  // Keep the last card half-width when the count is odd.
  const cells = useMemo(() => (items.length % 2 ? [...items, null] : items), [items]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text variant="display">Swap</Text>
          <Text muted>Things to trade near you</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="List an item"
          onPress={() => router.push('/item/new')}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={26} color={colors.accentText} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search items"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          accessibilityLabel="Search items"
        />
        {search.length > 0 && (
          <Pressable accessibilityLabel="Clear search" hitSlop={8} onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip
            key={c.slug}
            label={c.label}
            icon={c.icon}
            selected={category === c.slug}
            onPress={() => setCategory(category === c.slug ? null : c.slug)}
          />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.radiusRow}>
        <Ionicons name="location-outline" size={16} color={colors.textMuted} />
        <Text variant="caption" muted>
          Within
        </Text>
        {limits.radiusOptionsKm.map((r) => (
          <Chip key={r} label={`${r} km`} selected={radiusKm === r} onPress={() => setRadiusKm(r)} />
        ))}
      </ScrollView>
    </View>
  );

  let empty: React.ReactNode;
  if (status === 'loading' || status === 'idle') empty = <Loading label="Finding your area…" />;
  else if (status === 'denied')
    empty = (
      <EmptyState
        icon="location-outline"
        title="Location is off"
        body="Swap needs your approximate location to show items near you. It is never shown to anyone."
        action={{ label: 'Open settings', onPress: () => void Linking.openSettings() }}
      />
    );
  else if (status === 'error')
    empty = (
      <EmptyState
        icon="location-outline"
        title="Location unavailable"
        body="Turn on location (GPS) and try again."
        action={{ label: 'Try again', onPress: () => void request() }}
      />
    );
  else if (nearby.isLoading) empty = <Loading />;
  else if (nearby.isError) empty = <ErrorView error={nearby.error} onRetry={() => void nearby.refetch()} />;
  else
    empty = (
      <EmptyState
        icon="cube-outline"
        title={query || category ? 'No matches nearby' : 'Nothing listed nearby yet'}
        body={
          query || category
            ? 'Try a wider distance or another category.'
            : 'Be the first. List something you no longer use and see what people offer.'
        }
        action={{ label: 'List an item', onPress: () => router.push('/item/new') }}
      />
    );

  return (
    <FlatList
      style={styles.root}
      data={cells}
      keyExtractor={(i, idx) => i?.id ?? `spacer-${idx}`}
      numColumns={2}
      columnWrapperStyle={styles.col}
      contentContainerStyle={[styles.list, { paddingBottom: tabSpace }]}
      ListHeaderComponent={header}
      ListEmptyComponent={empty as React.ReactElement}
      renderItem={({ item }) =>
        item ? (
          <ListingCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
        ) : (
          <View style={{ flex: 1 }} />
        )
      }
      onEndReachedThreshold={0.4}
      onEndReached={() => {
        if (nearby.hasNextPage && !nearby.isFetchingNextPage) void nearby.fetchNextPage();
      }}
      ListFooterComponent={nearby.isFetchingNextPage ? <Loading /> : null}
      refreshControl={
        <RefreshControl
          refreshing={nearby.isRefetching && !nearby.isFetchingNextPage}
          tintColor={colors.accent}
          colors={[colors.accentText]}
          progressBackgroundColor={colors.accent}
          onRefresh={() => {
            void request().then(() => nearby.refetch());
          }}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  col: { gap: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  chips: { gap: spacing.sm },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
