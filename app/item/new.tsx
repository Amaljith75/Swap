import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCreateListing } from '@/api/listings';
import { ItemForm } from '@/components/ItemForm';
import { useLocation } from '@/lib/location';
import { resolvePhotos } from '@/lib/uploadPhotos';
import { useUserId } from '@/store/session';
import { colors } from '@/theme/tokens';
import { Header } from '@/ui';

export default function NewItem() {
  const router = useRouter();
  const uid = useUserId();
  const create = useCreateListing();
  const location = useLocation();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="List an item" />
      <ItemForm
        submitLabel="List item"
        onSubmit={async (v) => {
          const coords = location.coords ?? (await location.request());
          if (!coords) {
            throw new Error('Swap needs your approximate location so nearby people can find this item. Turn on location and try again.');
          }
          const photos = await resolvePhotos(v.photos, uid!);
          const id = await create.mutateAsync({ ...v, photos, lat: coords.lat, lng: coords.lng });
          router.replace(`/item/${id}`);
        }}
      />
    </View>
  );
}
