import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useOffer, useRateTrade } from '@/api/offers';
import { errorMessage } from '@/lib/errors';
import { describeOffer } from '@/lib/offerState';
import { useUserId } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';
import { Avatar, Button, Chip, EmptyState, Header, Input, Loading, Screen, Stars, Text } from '@/ui';

const tags = ['On time', 'Item as described', 'Friendly', 'Easy to deal with'];

export default function Rate() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const me = useUserId();
  const offer = useOffer(id);
  const rate = useRateTrade(id!);
  const [stars, setStars] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (offer.isLoading) return <Loading />;
  if (!offer.data || !me || offer.data.status !== 'completed')
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Header />
        <EmptyState icon="star-outline" title="You can rate only completed swaps" />
      </View>
    );
  const other = describeOffer(offer.data, me).other;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Rate the swap" />
      <Screen style={styles.body}>
        <View style={styles.who}>
          <Avatar name={other.display_name} path={other.avatar_url} size={72} />
          <Text variant="title">How was swapping with {other.display_name}?</Text>
          <Stars value={stars} size={36} onChange={setStars} />
        </View>
        <View style={styles.tags}>
          {tags.map((t) => (
            <Chip
              key={t}
              label={t}
              selected={picked.includes(t)}
              onPress={() => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))}
            />
          ))}
        </View>
        <Input
          label="Anything to add? (optional, shown on their profile)"
          value={comment}
          onChangeText={setComment}
          multiline
          maxLength={250}
        />
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button
          label="Submit rating"
          disabled={stars === 0}
          loading={rate.isPending}
          onPress={async () => {
            setError(null);
            const text = [picked.join(', '), comment.trim()].filter(Boolean).join('. ');
            try {
              await rate.mutateAsync({ stars, comment: text.slice(0, 300) });
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
  body: { gap: spacing.xl },
  who: { alignItems: 'center', gap: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
});
