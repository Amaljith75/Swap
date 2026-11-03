import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useBlockUser, useBlocks } from '@/api/safety';
import { errorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { Avatar, Button, EmptyState, ErrorView, Header, Loading, Text } from '@/ui';

export default function Blocked() {
  const blocks = useBlocks();
  const block = useBlockUser();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Blocked people" />
      {blocks.isLoading ? (
        <Loading />
      ) : blocks.isError ? (
        <ErrorView error={blocks.error} onRetry={() => void blocks.refetch()} />
      ) : (
        <FlatList
          data={blocks.data}
          keyExtractor={(b) => b.blocked_id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Avatar name={item.blocked.display_name} path={item.blocked.avatar_url} size={40} />
              <Text style={{ flex: 1 }}>{item.blocked.display_name}</Text>
              <Button
                label="Unblock"
                size="sm"
                variant="secondary"
                onPress={() =>
                  block.mutate({ userId: item.blocked_id, block: false }, { onError: (e) => Alert.alert('Could not unblock', errorMessage(e)) })
                }
              />
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="happy-outline" title="You have not blocked anyone" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
