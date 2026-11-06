import { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, Platform, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments, type ErrorBoundaryProps } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInboxRealtime } from '@/api/offers';
import { useMe } from '@/api/profiles';
import { OfflineBanner } from '@/components/OfflineBanner';
import { IntroAnimation } from '@/components/IntroAnimation';
import { UpdatePrompt } from '@/components/UpdatePrompt';
import { registerForPush, useNotificationRouting, usePushTokenRefresh } from '@/lib/notifications';
import { TERMS_VERSION, isSupabaseConfigured } from '@/lib/config';
import { installGlobalErrorHandler, logError, setErrorRoute } from '@/lib/errorLog';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { colors, spacing } from '@/theme/tokens';
import { Button, Text } from '@/ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

installGlobalErrorHandler();

// Only refresh the sign-in token while the app is on screen (Supabase's recommended
// setup for React Native); it resumes, and refreshes if needed, when the app comes back.
if (Platform.OS !== 'web' && isSupabaseConfigured) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void supabase.auth.startAutoRefresh();
    else void supabase.auth.stopAutoRefresh();
  });
}

/** Shown instead of a blank or frozen screen if a screen crashes. The error is reported. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    void logError(error);
  }, [error]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.warning} />
      <Text variant="title">Something went wrong</Text>
      <Text muted>This screen hit a problem. We've been sent a report. Try again, and if it keeps happening, restart Swap.</Text>
      <Button label="Try again" onPress={() => void retry()} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <UpdatePrompt />
          <OfflineBanner />
          <IntroAnimation />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { session, ready, setSession, setReady } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => setErrorRoute(pathname), [pathname]);
  const me = useMe();
  useInboxRealtime();
  const signedIn = !!session && !!me.data?.onboarded && (me.data?.terms_version ?? 0) >= TERMS_VERSION;
  useNotificationRouting(signedIn);
  usePushTokenRefresh(signedIn);
  useEffect(() => {
    if (signedIn) void registerForPush();
  }, [signedIn]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) queryClient.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession, setReady]);

  const first = segments[0] as string | undefined;
  const inAuth = first === '(auth)';
  const inOnboarding = first === 'onboarding';
  const inConsent = first === 'consent';
  const atIndex = !first;
  const needsConsent = !!session && me.data !== undefined && (me.data.terms_version ?? 0) < TERMS_VERSION;
  const needsOnboarding = !!session && me.data !== undefined && !me.data.onboarded;

  // A shared item link opened before sign-in: show that item once the person is in.
  const pendingItem = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      if (!inAuth) {
        if (/^\/item\/[0-9a-f-]{36}$/i.test(pathname)) pendingItem.current = pathname;
        router.replace('/(auth)/welcome');
      }
    } else if (needsConsent) {
      if (!inConsent) router.replace('/consent');
    } else if (needsOnboarding) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if ((me.data || me.isError) && (inAuth || inOnboarding || inConsent || atIndex)) {
      router.replace('/(tabs)');
      if (pendingItem.current) {
        const target = pendingItem.current;
        pendingItem.current = null;
        router.push(target as `/item/${string}`);
      }
    }
  }, [ready, session, needsConsent, needsOnboarding, me.data, me.isError, inAuth, inOnboarding, inConsent, atIndex, router, pathname]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}
    />
  );
}
