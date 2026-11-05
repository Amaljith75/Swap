import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListing, useMyListings } from '@/api/listings';
import { useMakeOffer } from '@/api/offers';
import { ItemRow } from '@/components/ItemRow';
import { limits } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, EmptyState, ErrorView, Header, Input, Loading, Photo, Text } from '@/ui';

export default function NewOffer() {
  const { listing: listingId } = useLocalSearchParams<{ listing: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const target = useListing(listingId);
  const mine = useMyListings(true);
  const make = useMakeOffer();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= limits.maxOfferItems ? s : [...s, id]));

  const submit = async () => {
    setError(null);
    try {
      const id = await make.mutateAsync({ targetId: listingId!, itemIds: selected, message: message.trim() });
      router.replace(`/offer/${id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  let body: React.ReactNode;
  if (target.isLoading || mine.isLoading) body = <Loading />;
  else if (target.isError || mine.isError)
    body = <ErrorView error={target.error ?? mine.error} onRetry={() => void Promise.all([target.refetch(), mine.refetch()])} />;
  else if (!target.data) body = <EmptyState icon="cube-outline" title="This item is gone" />;
  else
    body = (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          data={mine.data}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.head}>
              <View style={styles.target}>
                <Photo thumb path={target.data.photos[0]} style={styles.targetPhoto} radius={radius.md} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" muted>
                    You want
                  </Text>
                  <Text variant="heading" numberOfLines={2}>
                    {target.data.title}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {target.data.looking_for ? `They'd like: ${target.data.looking_for}` : 'Open to offers'}
                  </Text>
                </View>
              </View>
              <Text variant="heading">What will you offer?</Text>
              <Text variant="caption" muted>
                Pick up to {limits.maxOfferItems} of your items.
              </Text>
            </View>
          }
          renderItem={({ item }) => <ItemRow item={item} selected={selected.includes(item.id)} onPress={() => toggle(item.id)} />}
          ListEmptyComponent={
            <EmptyState
              icon="camera-outline"
              title="You have no items to offer"
              body="List something first, then come back to make your offer."
              action={{ label: 'List an item', onPress: () => router.push('/item/new') }}
            />
          }
          ListFooterComponent={
            mine.data && mine.data.length > 0 ? (
              <View style={styles.footer}>
                <Input
                  label="Message (optional)"
                  placeholder="Say hi and why it's a good swap"
                  value={message}
                  onChangeText={setMessage}
                  maxLength={300}
                  multiline
                />
                {error && <Text color={colors.danger}>{error}</Text>}
              </View>
            ) : null
          }
        />
        {mine.data && mine.data.length > 0 && (
          <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Button
              label={selected.length ? `Send offer (${selected.length} item${selected.length > 1 ? 's' : ''})` : 'Pick an item to offer'}
              disabled={selected.length === 0}
              loading={make.isPending}
              onPress={() => void submit()}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Make an offer" />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  head: { gap: spacing.sm, marginBottom: spacing.sm },
  target: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  targetPhoto: { width: 72, height: 72 },
  footer: { gap: spacing.md, marginTop: spacing.lg },
  bar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
