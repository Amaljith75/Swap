import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/lib/errors';
import { unregisterForPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, Header, Input, Screen, Text } from '@/ui';

const POINTS = [
  'Your profile, items and photos are deleted.',
  'Open offers and accepted swaps are cancelled, and the other person is told.',
  'Past chats and ratings stay for the other person, shown as "Deleted user".',
  'You can’t undo this. You can make a new account later with the same email.',
];

export default function DeleteAccount() {
  const qc = useQueryClient();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = typed.trim().toUpperCase() === 'DELETE';

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
      if (e) {
        // FunctionsHttpError carries the server's message in the response body.
        const ctx = (e as { context?: Response }).context;
        const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null;
        throw new Error(msg || e.message);
      }
      if (!(data as { deleted?: boolean } | null)?.deleted) throw new Error('Could not delete the account. Try again.');
      await unregisterForPush().catch(() => undefined);
      qc.clear();
      // The account is gone on the server; this just clears the session on this phone.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Delete account" />
      <Screen style={{ gap: spacing.lg }}>
        <View style={styles.icon}>
          <Ionicons name="trash-outline" size={28} color={colors.danger} />
        </View>
        <Text variant="title">Delete your Swap account?</Text>
        <View style={styles.list}>
          {POINTS.map((p) => (
            <View key={p} style={styles.point}>
              <Text color={colors.textMuted}>•</Text>
              <Text muted style={{ flex: 1 }}>
                {p}
              </Text>
            </View>
          ))}
        </View>
        <Input
          label='Type DELETE to confirm'
          value={typed}
          onChangeText={setTyped}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
        />
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button label="Delete my account" variant="danger" icon="trash-outline" disabled={!ready} loading={busy} onPress={() => void remove()} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm },
});
