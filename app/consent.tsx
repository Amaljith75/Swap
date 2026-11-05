import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/api/keys';
import { ConsentCheck } from '@/components/ConsentCheck';
import { MIN_AGE, TERMS_VERSION } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, radius, spacing } from '@/theme/tokens';
import { Button, Screen, Text } from '@/ui';

/** Shown once to accounts that haven't accepted the current Terms (and after any terms change). */
export default function Consent() {
  const qc = useQueryClient();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!checked) {
      setError(`Swap is only for people aged ${MIN_AGE} or over. Tick the box to continue.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await supabase.rpc('accept_terms', { p_version: TERMS_VERSION, p_age_confirmed: true });
      if (e) throw e;
      await qc.invalidateQueries({ queryKey: qk.me });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={styles.body}>
      <View style={styles.icon}>
        <Ionicons name="document-text-outline" size={28} color={colors.accent} />
      </View>
      <Text variant="display">Before you swap</Text>
      <Text muted>
        Swap is for adults. You meet people you don’t know, so please read how Swap works and how we handle your data.
      </Text>
      <View style={styles.card}>
        <Text>• You must be {MIN_AGE} or older.</Text>
        <Text>• Only list things you own. Nothing illegal, dangerous or fake.</Text>
        <Text>• Meet in busy public places. Swap doesn’t inspect items or attend meetups.</Text>
        <Text>• We store your email, profile, items, chats and an approximate (about 500 m) location.</Text>
      </View>
      <ConsentCheck checked={checked} onChange={setChecked} error={!!error} />
      {error && <Text color={colors.danger}>{error}</Text>}
      <Button label="Continue" loading={busy} onPress={() => void accept()} />
      <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingTop: spacing.xxl },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
});
