import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMe, useUpdateProfile } from '@/api/profiles';
import { errorMessage } from '@/lib/errors';
import { deleteStoredPhotos, pickImages, uploadImage } from '@/lib/media';
import { useUserId } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';
import { Avatar, Button, Header, Input, Loading, Screen, Text } from '@/ui';

export default function EditProfile() {
  const router = useRouter();
  const uid = useUserId();
  const me = useMe();
  const update = useUpdateProfile();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) {
      setName(me.data.display_name);
      setCity(me.data.city ?? '');
      setBio(me.data.bio ?? '');
      setAvatar(me.data.avatar_url);
    }
  }, [me.data]);

  if (me.isLoading || !me.data) return <Loading />;

  const changePhoto = async () => {
    try {
      const [uri] = await pickImages(1);
      if (!uri) return;
      setUploading(true);
      setAvatar(await uploadImage(uri, uid!, 'avatar'));
    } catch (e) {
      Alert.alert('Photo', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Edit profile" />
      <Screen style={styles.body}>
        <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={() => void changePhoto()} style={styles.avatar}>
          <Avatar name={name || '?'} path={avatar} size={96} />
          <Text variant="caption" color={colors.accent}>
            {uploading ? 'Uploading…' : 'Change photo'}
          </Text>
        </Pressable>
        <Input label="Name" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
        <Input label="Area or city" value={city} onChangeText={setCity} maxLength={60} />
        <Input label="About you" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="What you like to swap, when you are free to meet" />
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button
          label="Save"
          disabled={uploading || name.trim().length < 2}
          loading={update.isPending}
          onPress={async () => {
            setError(null);
            try {
              await update.mutateAsync({
                display_name: name.trim(),
                city: city.trim() || null,
                bio: bio.trim() || null,
                avatar_url: avatar,
              });
              if (me.data?.avatar_url && me.data.avatar_url !== avatar) void deleteStoredPhotos([me.data.avatar_url]);
              router.back();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  avatar: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
});
