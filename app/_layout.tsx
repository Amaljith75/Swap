import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useInboxRealtime } from '@/api/offers';
import { useMe } from '@/api/profiles';
import { OfflineBanner } from '@/components/OfflineBanner';
import { isSupabaseConfigured } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { colors } from '@/theme/tokens';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" />
          <AuthGate />
          <OfflineBanner />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AuthGate() {
  const { session, ready, setSession, setReady } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const me = useMe();
  useInboxRealtime();

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
  const atIndex = !first;
  const needsOnboarding = !!session && me.data !== undefined && !me.data.onboarded;

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      if (!inAuth) router.replace('/(auth)/welcome');
    } else if (needsOnboarding) {
      if (!inOnboarding) router.replace('/onboarding');
    } else if ((me.data || me.isError) && (inAuth || inOnboarding || atIndex)) {
      router.replace('/(tabs)');
    }
  }, [ready, session, needsOnboarding, me.data, me.isError, inAuth, inOnboarding, atIndex, router]);

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
