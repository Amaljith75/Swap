import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { channel } from './channel';
import { supabase } from './supabase';
import { currentBuild } from './updates';

// Sends app errors to the client_errors table (see migration 0009) so problems on
// real phones can be found and fixed. Read them in Supabase: Table Editor → client_errors.
// Kept for 90 days. Never throws.

let route = '';
/** Remembered so error reports say which screen the person was on. */
export const setErrorRoute = (r: string) => {
  route = r;
};

const recent = new Map<string, number>();

export async function logError(err: unknown, opts: { fatal?: boolean } = {}): Promise<void> {
  try {
    const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
    const message = `${e.name}: ${e.message}`.slice(0, 1000);
    // The same error over and over (e.g. a re-render loop) is sent once a minute at most.
    const last = recent.get(message) ?? 0;
    if (Date.now() - last < 60_000) return;
    recent.set(message, Date.now());
    if (__DEV__) return;
    await supabase.rpc('log_client_error', {
      p_message: message,
      p_stack: (e.stack ?? '').slice(0, 4000),
      p_route: route.slice(0, 200),
      p_fatal: !!opts.fatal,
      p_build: currentBuild() || null,
      p_channel: Platform.OS === 'ios' ? 'ios' : channel,
      p_platform: Platform.OS,
      p_os_version: String(Device.osVersion ?? Platform.Version ?? '').slice(0, 40),
      p_device: (Device.modelName ?? '').slice(0, 80),
    });
  } catch {
    // never let error reporting cause another error
  }
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
interface ErrorUtilsLike {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (h: GlobalHandler) => void;
}

let installed = false;
/** Reports uncaught JS errors, then lets React Native handle them as before. */
export function installGlobalErrorHandler() {
  const eu = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (installed || !eu || Platform.OS === 'web') return;
  installed = true;
  const previous = eu.getGlobalHandler();
  eu.setGlobalHandler((error, isFatal) => {
    void logError(error, { fatal: isFatal });
    previous(error, isFatal);
  });
}
