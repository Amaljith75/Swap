import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * How this build was distributed (set at build time by APP_CHANNEL, see app.config.js).
 *   sideload - APK from GitHub Releases; updates itself in the app.
 *   play     - Google Play build; Play handles updates.
 */
export type Channel = 'sideload' | 'play';

export const channel: Channel = Constants.expoConfig?.extra?.channel === 'play' ? 'play' : 'sideload';

/** Only the Android sideload build downloads and installs its own updates. */
export const selfUpdates = Platform.OS === 'android' && channel === 'sideload';

/** Channel sent with the push token, so update notices only reach sideload installs. */
export const pushChannel = (): 'sideload' | 'play' | 'ios' => (Platform.OS === 'ios' ? 'ios' : channel);

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.swap.barter';
