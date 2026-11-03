import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

interface SessionState {
  session: Session | null;
  /** True once the stored session has been restored on launch. */
  ready: boolean;
  setSession: (s: Session | null) => void;
  setReady: (r: boolean) => void;
}

export const useSession = create<SessionState>((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session }),
  setReady: (ready) => set({ ready }),
}));

export const useUserId = () => useSession((s) => s.session?.user.id ?? null);
