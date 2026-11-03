import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateProfile } from '@/api/profiles';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { Button, Input, Screen, Text } from '@/ui';

const schema = z.object({
  display_name: z.string().trim().min(2, 'At least 2 characters').max(40),
  city: z.string().trim().max(60),
});
type Form = z.infer<typeof schema>;

export default function Onboarding() {
  const update = useUpdateProfile();
  const [error, setError] = useState<string | null>(null);
  const { control, handleSubmit } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { display_name: '', city: '' },
  });

  const submit = handleSubmit(async (v) => {
    setError(null);
    try {
      await update.mutateAsync({ display_name: v.display_name, city: v.city || null, onboarded: true });
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <Screen style={styles.body}>
      <Text variant="display">What should people call you?</Text>
      <Text muted>Your name and area are shown on your items and offers. Your email stays private.</Text>
      <View style={styles.form}>
        <Controller
          control={control}
          name="display_name"
          render={({ field, fieldState }) => (
            <Input
              label="Name"
              placeholder="e.g. Asha"
              value={field.value}
              onChangeText={field.onChange}
              autoCapitalize="words"
              maxLength={40}
              error={fieldState.error?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="city"
          render={({ field, fieldState }) => (
            <Input
              label="Area or city (optional)"
              placeholder="e.g. Indiranagar, Bengaluru"
              value={field.value}
              onChangeText={field.onChange}
              maxLength={60}
              error={fieldState.error?.message}
            />
          )}
        />
        {error && <Text color={colors.danger}>{error}</Text>}
        <Button label="Start swapping" loading={update.isPending} onPress={() => void submit()} />
        <Button label="Sign out" variant="ghost" onPress={() => void supabase.auth.signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingTop: spacing.xxl },
  form: { gap: spacing.lg, marginTop: spacing.xl },
});
