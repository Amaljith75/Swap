import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { supabase } from './supabase';

/** Which conversation is on screen, so its own message alerts aren't shown on top of it. */
export const useActiveChat = create<{ offerId: string | null; set: (id: string | null) => void }>((set) => ({
  offerId: null,
  set: (offerId) => set({ offerId }),
}));

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const data = n.request.content.data as { type?: string; offer_id?: string } | undefined;
      const onThatChat = !!data?.offer_id && data.offer_id === useActiveChat.getState().offerId;
      return {
        shouldShowBanner: !onThatChat,
        shouldShowList: !onThatChat,
        shouldPlaySound: !onThatChat,
        shouldSetBadge: false,
      };
    },
  });
}

let registeredToken: string | null = null;

/**
 * Ask for permission and register this device for pushes. Fails quietly when the
 * build has no Firebase config yet, or permission is refused: the app works without pushes.
 */
export async function registerForPush(): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Offers and messages',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#B7F34A',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const token = (await Notifications.getDevicePushTokenAsync()).data as string;
    if (!token || token === registeredToken) return;
    const { error } = await supabase.rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    if (!error) registeredToken = token;
  } catch {
    // No FCM config in this build, or no network. Try again next launch.
  }
}

/** Call before signing out so the next person on this phone doesn't get your alerts. */
export async function unregisterForPush(): Promise<void> {
  if (!registeredToken) return;
  try {
    await supabase.rpc('unregister_push_token', { p_token: registeredToken });
  } catch {
    // ignore
  }
  registeredToken = null;
}

/** Opens the right screen when someone taps a notification (also on a cold start). */
export function useNotificationRouting(enabled: boolean) {
  const router = useRouter();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r || handled.current === r.notification.request.identifier) return;
      handled.current = r.notification.request.identifier;
      const data = r.notification.request.content.data as { type?: string; offer_id?: string; url?: string };
      if (data?.offer_id) router.push(`/offer/${data.offer_id}`);
      else if (data?.type === 'update') router.push('/settings/update');
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled, router]);
}
