import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useListing, useRemoveListing, useUpdateListing } from '@/api/listings';
import { ItemForm } from '@/components/ItemForm';
import { errorMessage } from '@/lib/errors';
import { resolvePhotos } from '@/lib/uploadPhotos';
import { useUserId } from '@/store/session';
import { colors } from '@/theme/tokens';
import { Button, EmptyState, ErrorView, Header, Loading, Text } from '@/ui';

export default function EditItem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const uid = useUserId();
  const listing = useListing(id);
  const update = useUpdateListing();
  const remove = useRemoveListing();

  const l = listing.data;
  let body: React.ReactNode;
  if (listing.isLoading) body = <Loading />;
  else if (listing.isError) body = <ErrorView error={listing.error} onRetry={() => void listing.refetch()} />;
  else if (!l || l.owner_id !== uid) body = <EmptyState icon="alert-circle-outline" title="Item not found" />;
  else if (l.status !== 'available')
    body = <EmptyState icon="lock-closed-outline" title="This item can't be edited" body="Items in a trade or already swapped stay as they are." />;
  else
    body = (
      <ItemForm
        submitLabel="Save changes"
        initial={{
          photos: l.photos,
          title: l.title,
          category: l.category,
          condition: l.condition,
          description: l.description,
          looking_for: l.looking_for,
        }}
        onSubmit={async (v) => {
          const photos = await resolvePhotos(v.photos, uid!);
          await update.mutateAsync({ ...v, photos, id: l.id });
          router.back();
        }}
        footer={
          <>
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            Saving changes closes any open offers on this item, so nobody accepts a version they didn't see.
          </Text>
          <Button
            label="Remove item"
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              Alert.alert('Remove this item?', 'Open offers on it will be closed.', [
                { text: 'Keep', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () =>
                    remove.mutate(l.id, {
                      onSuccess: () => router.navigate('/(tabs)/items'),
                      onError: (e) => Alert.alert('Could not remove', errorMessage(e)),
                    }),
                },
              ])
            }
          />
          </>
        }
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Edit item" />
      {body}
    </View>
  );
}
