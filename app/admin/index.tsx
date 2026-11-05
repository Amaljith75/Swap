import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { type AdminReport, useAdminAction, useAdminReports, useIsAdmin } from '@/api/admin';
import { errorMessage } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, EmptyState, ErrorView, Header, Loading, Photo, Segmented, Text } from '@/ui';

const reasonLabel = (r: string) => r.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Moderation queue. Only accounts in admin_users can open it. */
export default function Admin() {
  const isAdmin = useIsAdmin();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const reports = useAdminReports(tab);

  let body: React.ReactNode;
  if (isAdmin.isLoading) body = <Loading />;
  else if (!isAdmin.data) body = <EmptyState icon="lock-closed-outline" title="Admins only" />;
  else if (reports.isLoading) body = <Loading />;
  else if (reports.isError) body = <ErrorView error={reports.error} onRetry={() => void reports.refetch()} />;
  else
    body = (
      <FlatList
        data={reports.data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        refreshing={reports.isRefetching}
        onRefresh={() => void reports.refetch()}
        ListEmptyComponent={
          <EmptyState icon="checkmark-done-outline" title={tab === 'open' ? 'No open reports' : 'Nothing closed yet'} />
        }
        renderItem={({ item }) => <ReportCard r={item} closed={tab === 'closed'} />}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Reports" />
      {isAdmin.data && (
        <View style={styles.tabs}>
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </View>
      )}
      {body}
    </View>
  );
}

function ReportCard({ r, closed }: { r: AdminReport; closed: boolean }) {
  const router = useRouter();
  const act = useAdminAction();
  const run = (title: string, message: string, a: Parameters<typeof act.mutate>[0], destructive = true) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        style: destructive ? 'destructive' : 'default',
        onPress: () => act.mutate(a, { onError: (e) => Alert.alert('Could not do that', errorMessage(e)) }),
      },
    ]);
  const listingLive = r.listing_id && (r.listing_status === 'available' || r.listing_status === 'reserved');

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Text variant="heading" style={{ flex: 1 }}>
          {reasonLabel(r.reason)}
        </Text>
        <Text variant="caption" muted>
          {timeAgo(r.created_at)}
        </Text>
      </View>
      <Text muted>
        <Text onPress={() => router.push(`/user/${r.reporter_id}`)}>{r.reporter_name}</Text> reported{' '}
        <Text color={colors.accent} onPress={() => router.push(`/user/${r.reported_user_id}`)}>
          {r.reported_name}
        </Text>
        {r.reported_open_reports > 1 ? ` (${r.reported_open_reports} open reports)` : ''}
        {r.reported_suspended ? ' · suspended' : ''}
      </Text>
      {!!r.details && <Text>“{r.details}”</Text>}
      {r.listing_id && (
        <View style={styles.listing}>
          <Photo thumb path={r.listing_photo} style={styles.thumb} radius={radius.sm} />
          <Text style={{ flex: 1 }} numberOfLines={2}>
            {r.listing_title ?? 'Item'} · {r.listing_status ?? 'deleted'}
          </Text>
        </View>
      )}
      {!closed && (
        <View style={styles.actions}>
          {listingLive && (
            <Button
              size="sm"
              variant="danger"
              label="Remove item"
              onPress={() =>
                run('Remove this item?', 'Open offers close and any accepted swap is cancelled. The owner is told.', {
                  kind: 'remove-listing',
                  listingId: r.listing_id!,
                })
              }
            />
          )}
          <Button
            size="sm"
            variant={r.reported_suspended ? 'secondary' : 'danger'}
            label={r.reported_suspended ? 'Unsuspend' : 'Suspend user'}
            onPress={() =>
              run(
                r.reported_suspended ? 'Unsuspend this person?' : 'Suspend this person?',
                r.reported_suspended
                  ? 'They can use Swap again.'
                  : 'They can no longer list, offer or chat, their items disappear from search, and their open swaps close.',
                { kind: 'suspend', userId: r.reported_user_id, suspended: !r.reported_suspended },
                !r.reported_suspended,
              )
            }
          />
          <Button
            size="sm"
            variant="secondary"
            label="Resolve"
            onPress={() => act.mutate({ kind: 'resolve', reportId: r.id, status: 'resolved' })}
          />
          <Button
            size="sm"
            variant="ghost"
            label="Dismiss"
            onPress={() => act.mutate({ kind: 'resolve', reportId: r.id, status: 'dismissed' })}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: 48, height: 48 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
});
