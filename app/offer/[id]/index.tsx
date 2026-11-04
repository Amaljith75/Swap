import { useEffect, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useConfirmTrade,
  useMessages,
  useMyRating,
  useOffer,
  useOfferRealtime,
  useRespondOffer,
  useSendMessage,
  type OfferAction,
} from '@/api/offers';
import { useBlockUser } from '@/api/safety';
import { MessageBubble } from '@/components/MessageBubble';
import { StatusBadge } from '@/components/StatusBadge';
import { errorMessage } from '@/lib/errors';
import { countdown } from '@/lib/format';
import { useActiveChat } from '@/lib/notifications';
import { describeOffer } from '@/lib/offerState';
import { useUserId } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ListingLite, Offer } from '@/types/db';
import { Button, EmptyState, ErrorView, Header, HeaderIcon, Loading, Photo, Text } from '@/ui';

const quickReplies = ["I'm here", 'Running 5 min late', 'Where exactly are you?', 'See you there'];

export default function OfferScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useUserId();
  const offer = useOffer(id);
  const messages = useMessages(id);
  const send = useSendMessage(id!);
  const block = useBlockUser();
  const listRef = useRef<FlatList>(null);
  const [draft, setDraft] = useState('');
  const now = useNow(offer.data?.status === 'completed');
  useOfferRealtime(id);
  const setActiveChat = useActiveChat((s) => s.set);
  useEffect(() => {
    setActiveChat(id ?? null);
    return () => setActiveChat(null);
  }, [id, setActiveChat]);

  if (offer.isLoading) return <Loading />;
  if (offer.isError)
    return (
      <View style={styles.root}>
        <Header />
        <ErrorView error={offer.error} onRetry={() => void offer.refetch()} />
      </View>
    );
  const o = offer.data;
  if (!o || !me)
    return (
      <View style={styles.root}>
        <Header />
        <EmptyState icon="alert-circle-outline" title="Offer not found" />
      </View>
    );

  const d = describeOffer(o, me);
  const closesAt = o.chat_closes_at ? new Date(o.chat_closes_at).getTime() : null;
  const chatOpen = d.isOpen || (o.status === 'completed' && closesAt !== null && now < closesAt);
  const closedReason =
    o.status === 'completed' ? 'Chat closed. The swap is complete.' : 'Chat closed. This offer is no longer open.';

  const sendText = async (text: string) => {
    const body = text.trim();
    if (!body) return;
    setDraft('');
    try {
      await send.mutateAsync(body);
    } catch (e) {
      setDraft(body);
      Alert.alert('Message not sent', errorMessage(e));
    }
  };

  const openMenu = () =>
    Alert.alert(d.other.display_name, undefined, [
      { text: 'View profile', onPress: () => router.push(`/user/${d.other.id}`) },
      {
        text: 'Report',
        onPress: () => router.push({ pathname: '/report', params: { user: d.other.id, offer: o.id } }),
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Block ${d.other.display_name}?`, 'This closes your offers with them and hides each other’s items.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: () =>
                block.mutate(
                  { userId: d.other.id, block: true },
                  { onError: (e) => Alert.alert('Could not block', errorMessage(e)) },
                ),
            },
          ]),
      },
      { text: 'Close', style: 'cancel' },
    ]);

  return (
    <View style={styles.root}>
      <Header title={d.other.display_name} right={<HeaderIcon icon="ellipsis-horizontal" label="More options" onPress={openMenu} />} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={listRef}
          data={messages.data ?? []}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={<TradeCard offer={o} me={me} />}
          renderItem={({ item }) => <MessageBubble message={item} mine={item.sender_id === me} />}
          ListEmptyComponent={messages.isLoading ? <Loading /> : null}
        />

        {o.status === 'completed' && chatOpen && closesAt && (
          <View style={styles.countdown}>
            <Ionicons name="time-outline" size={14} color={colors.warning} />
            <Text variant="caption" color={colors.warning}>
              Chat closes in {countdown(closesAt - now)}
            </Text>
          </View>
        )}

        {chatOpen ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.sm }]}>
            {o.status === 'accepted' && (
              <FlatList
                horizontal
                data={quickReplies}
                keyExtractor={(q) => q}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quick}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable accessibilityRole="button" onPress={() => void sendText(item)} style={styles.quickChip}>
                    <Text variant="caption">{item}</Text>
                  </Pressable>
                )}
              />
            )}
            <View style={styles.inputRow}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                multiline
                maxLength={500}
                accessibilityLabel="Message"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                disabled={!draft.trim() || send.isPending}
                onPress={() => void sendText(draft)}
                style={[styles.send, (!draft.trim() || send.isPending) && { opacity: 0.4 }]}
              >
                <Ionicons name="arrow-up" size={20} color={colors.accentText} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.closed, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text variant="caption" muted style={{ textAlign: 'center' }}>
              {closedReason}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Ticks every second while needed (for the chat-close countdown). */
function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

function TradeCard({ offer: o, me }: { offer: Offer; me: string }) {
  const router = useRouter();
  const d = describeOffer(o, me);
  const respond = useRespondOffer(o.id);
  const confirm = useConfirmTrade(o.id);
  const myRating = useMyRating(o.status === 'completed' ? o.id : undefined);
  const busy = respond.isPending || confirm.isPending;

  const act = (action: OfferAction, title: string, body: string, cta: string, destructive = false) =>
    Alert.alert(title, body, [
      { text: 'Not now', style: 'cancel' },
      {
        text: cta,
        style: destructive ? 'destructive' : 'default',
        onPress: () =>
          respond.mutate({ action }, { onError: (e) => Alert.alert('Could not update the offer', errorMessage(e)) }),
      },
    ]);

  return (
    <View style={styles.card}>
      <StatusBadge label={d.label} tone={d.tone} />
      <View style={styles.sides}>
        <Side title="You give" items={d.myItems} onOpen={(id) => router.push(`/item/${id}`)} />
        <View style={styles.swapIcon}>
          <Ionicons name="swap-horizontal" size={18} color={colors.accent} />
        </View>
        <Side title="You get" items={d.theirItems} onOpen={(id) => router.push(`/item/${id}`)} />
      </View>

      {(o.status === 'pending' || o.status === 'countered') && d.awaitingMe && (
        <View style={styles.actions}>
          <Button
            label="Accept swap"
            loading={respond.isPending && respond.variables?.action === 'accept'}
            disabled={busy}
            onPress={() =>
              act(
                'accept',
                'Accept this swap?',
                'These items will be held for this trade until you both confirm the swap or one of you cancels.',
                'Accept',
              )
            }
          />
          <View style={styles.row}>
            <Button
              label={d.iAmOfferer ? 'Change offer' : 'Ask for other items'}
              variant="secondary"
              size="sm"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() => router.push(`/offer/${o.id}/counter`)}
            />
            <Button
              label="Decline"
              variant="danger"
              size="sm"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() => act('decline', 'Decline this offer?', 'The chat will close.', 'Decline', true)}
            />
          </View>
        </View>
      )}

      {(o.status === 'pending' || o.status === 'countered') && !d.awaitingMe && d.iAmOfferer && (
        <Button
          label="Withdraw offer"
          variant="danger"
          size="sm"
          disabled={busy}
          onPress={() => act('cancel', 'Withdraw your offer?', 'The chat will close.', 'Withdraw', true)}
        />
      )}

      {o.status === 'accepted' && (
        <View style={styles.actions}>
          <View style={styles.tip}>
            <Ionicons name="shield-checkmark-outline" size={16} color={colors.accent} />
            <Text variant="caption" muted style={{ flex: 1 }}>
              Meet in a busy public place. Check the item before you hand yours over. Confirm only after you both have the
              items.
            </Text>
          </View>
          {d.iConfirmed ? (
            <Text variant="caption" muted>
              You confirmed. Waiting for {d.other.display_name}.
            </Text>
          ) : (
            <Button
              label="We swapped"
              icon="checkmark-done"
              loading={confirm.isPending}
              disabled={busy}
              onPress={() =>
                Alert.alert('Confirm the swap?', 'Only confirm once you have the item and have checked it.', [
                  { text: 'Not yet', style: 'cancel' },
                  {
                    text: 'Yes, we swapped',
                    onPress: () =>
                      confirm.mutate(undefined, { onError: (e) => Alert.alert('Could not confirm', errorMessage(e)) }),
                  },
                ])
              }
            />
          )}
          <Button
            label="Cancel trade"
            variant="danger"
            size="sm"
            disabled={busy}
            onPress={() => act('cancel', 'Cancel this trade?', 'Both items become available again.', 'Cancel trade', true)}
          />
        </View>
      )}

      {o.status === 'completed' &&
        (myRating.data ? (
          <Text variant="caption" muted>
            You rated this swap {myRating.data.stars}★. Thanks!
          </Text>
        ) : (
          <Button
            label={`Rate ${d.other.display_name}`}
            icon="star-outline"
            variant="secondary"
            onPress={() => router.push(`/rate/${o.id}`)}
          />
        ))}
    </View>
  );
}

function Side({ title, items, onOpen }: { title: string; items: ListingLite[]; onOpen: (id: string) => void }) {
  return (
    <View style={styles.side}>
      <Text variant="caption" muted>
        {title}
      </Text>
      {items.map((it) => (
        <Pressable key={it.id} accessibilityRole="button" accessibilityLabel={it.title} onPress={() => onOpen(it.id)} style={styles.sideItem}>
          <Photo path={it.photos[0]} style={styles.sideThumb} radius={radius.sm} />
          <Text variant="caption" numberOfLines={2} style={{ flex: 1 }}>
            {it.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, marginBottom: spacing.lg },
  sides: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  side: { flex: 1, gap: spacing.sm },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sideThumb: { width: 44, height: 44 },
  swapIcon: { paddingTop: 30 },
  actions: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  countdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  quick: { gap: spacing.sm },
  quickChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closed: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
