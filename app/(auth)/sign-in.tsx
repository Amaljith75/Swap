import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ConsentCheck } from '@/components/ConsentCheck';
import { MIN_AGE, MIN_PASSWORD, TERMS_VERSION, links } from '@/lib/config';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';
import { Button, Header, Input, Screen, Text } from '@/ui';

type Mode = 'signin' | 'signup' | 'reset';

// Sign-in accepts older 6-character passwords; new passwords need MIN_PASSWORD.
const makeSchema = (mode: Mode) =>
  z.object({
    email: z.string().trim().email('Enter a valid email'),
    password:
      mode === 'reset'
        ? z.string()
        : mode === 'signup'
          ? z.string().min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters`).max(72, 'At most 72 characters')
          : z.string().min(6, 'At least 6 characters'),
  });
type Form = { email: string; password: string };

const TITLES: Record<Mode, [string, string]> = {
  signin: ['Welcome back', 'Sign in to keep swapping.'],
  signup: ['Create account', 'Use your email. Nobody else sees it.'],
  reset: ['Reset password', 'We’ll email you a link to choose a new password.'],
};

export default function SignIn() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [mode, setModeState] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const { control, handleSubmit, formState, clearErrors } = useForm<Form>({
    resolver: (values, ctx, opts) => zodResolver(makeSchema(mode))(values, ctx, opts),
    defaultValues: { email: '', password: '' },
  });

  const setMode = (m: Mode) => {
    setError(null);
    setNotice(null);
    clearErrors();
    setModeState(m);
  };

  const submit = handleSubmit(async ({ email, password }) => {
    setError(null);
    setNotice(null);
    try {
      if (mode === 'reset') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: links.resetPassword });
        if (e) throw e;
        setNotice('If that email has a Swap account, a reset link is on its way. Open it, choose a new password, then sign in here.');
        setModeState('signin');
        return;
      }
      if (mode === 'signup') {
        if (!consent) {
          setConsentError(true);
          setError(`Swap is only for people aged ${MIN_AGE} or over. Tick the box to continue.`);
          return;
        }
        const { data, error: e } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Recorded on the profile when the account is created (see handle_new_user).
          options: { data: { terms_version: TERMS_VERSION, age_confirmed: true }, emailRedirectTo: links.site },
        });
        if (e) throw e;
        if (!data.session) {
          setNotice('Account created. Open the link we emailed you to confirm it, then sign in here.');
          setModeState('signin');
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

  const [title, subtitle] = TITLES[mode];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header onBack={() => (mode === 'reset' ? setMode('signin') : router.replace('/(auth)/welcome'))} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen style={styles.body}>
          <Text variant="display">{title}</Text>
          <Text muted>{subtitle}</Text>
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
            {mode !== 'reset' && (
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
                    hint={mode === 'signup' ? `At least ${MIN_PASSWORD} characters.` : undefined}
                    error={fieldState.error?.message}
                    onSubmitEditing={() => void submit()}
                  />
                )}
              />
            )}
            {mode === 'signup' && (
              <ConsentCheck
                checked={consent}
                error={consentError}
                onChange={(v) => {
                  setConsent(v);
                  if (v) {
                    setConsentError(false);
                    setError(null);
                  }
                }}
              />
            )}
            {error && <Text color={colors.danger}>{error}</Text>}
            {notice && <Text color={colors.accent}>{notice}</Text>}
            <Button
              label={mode === 'signup' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}
              loading={formState.isSubmitting}
              onPress={() => void submit()}
            />
            {mode === 'signin' && <Button variant="ghost" label="Forgot password?" onPress={() => setMode('reset')} />}
            {mode !== 'reset' && (
              <Button
                variant="ghost"
                label={mode === 'signup' ? 'I already have an account' : 'New here? Create an account'}
                onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
              />
            )}
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
