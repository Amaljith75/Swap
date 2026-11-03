import { create } from 'zustand';
import * as Location from 'expo-location';

type Status = 'idle' | 'loading' | 'ready' | 'denied' | 'error';

interface LocationState {
  status: Status;
  coords: { lat: number; lng: number } | null;
  /** Ask for permission (if needed) and read an approximate position. */
  request: () => Promise<{ lat: number; lng: number } | null>;
}

// Position is used for searching and for listing an item. The server snaps it
// to a ~500 m grid before storing anything, and never stores where you search from.
export const useLocation = create<LocationState>((set, get) => ({
  status: 'idle',
  coords: null,
  request: async () => {
    if (get().status === 'loading') return get().coords;
    set({ status: 'loading' });
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        set({ status: 'denied' });
        return null;
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 });
      const pos =
        last ??
        (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000)),
        ]));
      if (!pos) {
        set({ status: 'error' });
        return null;
      }
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      set({ status: 'ready', coords });
      return coords;
    } catch {
      set({ status: 'error' });
      return null;
    }
  },
}));
