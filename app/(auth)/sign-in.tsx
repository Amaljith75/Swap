import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { Button, Header, Input, Screen, Text } from '@/ui';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(6, 'At least 6 characters'),
});
type Form = z.infer<typeof schema>;

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.mode === 'signup' ? 'signup' : 'signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { control, handleSubmit, formState } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email: email.trim(), password });
        if (e) throw e;
        if (!data.session) {
          setNotice('Account created. Open the link we emailed you to confirm it, then sign in here.');
          setMode('signin');
        }
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      }
      // On success the auth gate in _layout moves on to onboarding or the app.
    } catch (e) {
      setError(errorMessage(e));
    }
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header onBack={() => router.replace('/(auth)/welcome')} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen style={styles.body}>
          <Text variant="display">{mode === 'signup' ? 'Create account' : 'Welcome back'}</Text>
          <Text muted>{mode === 'signup' ? 'Use your email. Nobody else sees it.' : 'Sign in to keep swapping.'}</Text>
          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field, fieldState }) => (
                <Input
                  label="Email"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  error={fieldState.error?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field, fieldState }) => (
                <Input
                  label="Password"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  secureTextEntry
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  error={fieldState.error?.message}
                  onSubmitEditing={() => void submit()}
                />
              )}
            />
            {error && <Text color={colors.danger}>{error}</Text>}
            {notice && <Text color={colors.accent}>{notice}</Text>}
            <Button
              label={mode === 'signup' ? 'Create account' : 'Sign in'}
              loading={formState.isSubmitting}
              onPress={() => void submit()}
            />
            <Button
              variant="ghost"
              label={mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
              onPress={() => {
                setError(null);
                setMode(mode === 'signup' ? 'signin' : 'signup');
              }}
            />
          </View>
        </Screen>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.sm, paddingTop: spacing.lg },
  form: { gap: spacing.lg, marginTop: spacing.xl },
});
