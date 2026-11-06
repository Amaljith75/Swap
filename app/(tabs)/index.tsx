import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNearby } from '@/api/listings';
import { ListingCard } from '@/components/ListingCard';
import { RotatingTagline } from '@/components/RotatingTagline';
import { Wordmark } from '@/components/Wordmark';
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

  // Without a location only "Everywhere" can be searched (newest first, no distances).
  const located = !!coords;
  const effectiveRadius = located ? radiusKm : 0;
  const locating = status === 'idle' || status === 'loading';
  const params = useMemo(
    () =>
      locating && !coords
        ? null
        : { lat: coords?.lat ?? null, lng: coords?.lng ?? null, radiusKm: effectiveRadius, category, query },
    [locating, coords, effectiveRadius, category, query],
  );
  const nearby = useNearby(params);
  const items = useMemo(() => nearby.data?.pages.flat() ?? [], [nearby.data]);
  // Keep the last card half-width when the count is odd.
  const cells = useMemo(() => (items.length % 2 ? [...items, null] : items), [items]);

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1, gap: 6 }}>
          <Wordmark height={24} />
          <RotatingTagline />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="List an item"
          onPress={() => router.push('/item/new')}
          style={styles.addBtn}
        >
          <Ionicons name="add" size={22} color={colors.accentText} />
        </Pressable>
      </View>

      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search every item on Swap"
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
        {limits.radiusOptionsKm.map((r) => (
          <Chip
            key={r}
            label={r === 0 ? 'Everywhere' : `Within ${r} km`}
            selected={effectiveRadius === r}
            onPress={() => (r === 0 || located ? setRadiusKm(r) : void request())}
          />
        ))}
      </ScrollView>
      {!located && !locating && (
        <Pressable
          accessibilityRole="button"
          onPress={() => (status === 'denied' ? void Linking.openSettings() : void request())}
          style={styles.notice}
        >
          <Ionicons name="navigate-outline" size={16} color={colors.warning} />
          <Text variant="caption" style={{ flex: 1 }}>
            {status === 'denied'
              ? 'Location is off, so distances are hidden. Tap to allow it in Settings.'
              : 'Couldn\'t find your location, so distances are hidden. Tap to try again.'}
          </Text>
        </Pressable>
      )}
      {items.length > 0 && (
        <Text variant="caption" muted>
          {effectiveRadius === 0
            ? located
              ? 'Every item on Swap, nearest first'
              : 'Every item on Swap, newest first'
            : `Items within ${effectiveRadius} km, nearest first`}
        </Text>
      )}
    </View>
  );

  let empty: React.ReactNode;
  if (!params) empty = <Loading label="Finding your area…" />;
  else if (nearby.isLoading) empty = <Loading />;
  else if (nearby.isError) empty = <ErrorView error={nearby.error} onRetry={() => void nearby.refetch()} />;
  else
    empty = (
      <EmptyState
        icon="cube-outline"
        title={
          query || category
            ? effectiveRadius === 0
              ? 'No matches on Swap'
              : `No matches within ${effectiveRadius} km`
            : effectiveRadius === 0
              ? 'Nothing listed yet'
              : `Nothing within ${effectiveRadius} km yet`
        }
        body={
          effectiveRadius !== 0
            ? 'Try Everywhere to see every item on Swap.'
            : query || category
              ? 'Try other words or another category.'
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
  // Kept in from the screen's rounded corner.
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: 2,
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
