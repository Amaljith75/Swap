import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarSpace } from '@/components/TabBar';
import { useMyListings } from '@/api/listings';
import { ItemRow } from '@/components/ItemRow';
import { conditionLabel } from '@/lib/config';
import { colors, spacing } from '@/theme/tokens';
import type { ListingStatus } from '@/types/db';
import { EmptyState, ErrorView, Loading, Text } from '@/ui';

const statusText: Record<ListingStatus, string> = {
  available: 'Available',
  reserved: 'In an accepted trade',
  traded: 'Swapped',
  removed: 'Removed',
};

export default function MyItems() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const items = useMyListings();

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={{ flex: 1 }}>
          <Text variant="display">My items</Text>
          <Text muted>What you are offering to swap</Text>
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
      {items.isLoading ? (
        <Loading />
      ) : items.isError ? (
        <ErrorView error={items.error} onRetry={() => void items.refetch()} />
      ) : (
        <FlatList
          data={items.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, { paddingBottom: tabSpace }]}
          renderItem={({ item }) => (
            <ItemRow
              item={item}
              trailing={`${statusText[item.status]} · ${conditionLabel(item.condition)}`}
              onPress={() => router.push(`/item/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="camera-outline"
              title="List your first item"
              body="Books, gadgets, clothes, games: anything you no longer use can become something you want."
              action={{ label: 'List an item', onPress: () => router.push('/item/new') }}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={items.isRefetching}
              onRefresh={() => void items.refetch()}
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
