import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { reportReasons, useReport } from '@/api/safety';
import { errorMessage } from '@/lib/errors';
import { colors, radius, spacing } from '@/theme/tokens';
import type { ReportReason } from '@/types/db';
import { Button, Header, Input, Screen, Text } from '@/ui';

export default function Report() {
  const { user, offer, listing } = useLocalSearchParams<{ user: string; offer?: string; listing?: string }>();
  const router = useRouter();
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Report" />
      <Screen style={styles.body}>
        {sent ? (
          <View style={styles.done}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accent} />
            <Text variant="title">Report sent</Text>
            <Text muted style={{ textAlign: 'center' }}>
              We review every report. If you feel unsafe, leave and contact local police (112).
            </Text>
            <Button label="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
          </View>
        ) : (
          <>
            <Text muted>What happened? The person is not told who reported them.</Text>
            <View style={styles.reasons}>
              {reportReasons.map((r) => (
                <Pressable
                  key={r.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reason === r.value }}
                  onPress={() => setReason(r.value)}
                  style={[styles.reason, reason === r.value && styles.reasonOn]}
                >
                  <Ionicons
                    name={reason === r.value ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={reason === r.value ? colors.accent : colors.textMuted}
                  />
                  <Text>{r.label}</Text>
                </Pressable>
              ))}
            </View>
            <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
            {error && <Text color={colors.danger}>{error}</Text>}
            <Button
              label="Send report"
              disabled={!reason || !user}
              loading={report.isPending}
              onPress={async () => {
                setError(null);
                try {
                  await report.mutateAsync({ userId: user!, reason: reason!, details: details.trim(), offerId: offer, listingId: listing });
                  setSent(true);
                } catch (e) {
                  setError(errorMessage(e));
                }
              }}
            />
          </>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },
  reasons: { gap: spacing.sm },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reasonOn: { borderColor: colors.accent },
  done: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
});
