// Android manifest tweaks for Google Play (Android 16 / API 36 targets).
//
// 1. Tablets and foldables: Android 16 ignores the portrait lock on screens 600 dp
//    and wider. Until Swap has a proper large-screen layout, keep the phone layout
//    there with Android's temporary opt-out. It stops working once the app has to
//    target API 37 (about August 2027), so plan the tablet layout before then.
// 2. Removes expo-location's background location service. Swap only reads location
//    while it is open, and an unused location foreground service invites questions
//    in Play Console's foreground-service declaration.
const { withAndroidManifest } = require('expo/config-plugins');

const RESIZE_OPT_OUT = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';
const LOCATION_SERVICE = 'expo.modules.location.services.LocationTaskService';

module.exports = function withAndroidPlayTweaks(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$ = { ...manifest.$, 'xmlns:tools': 'http://schemas.android.com/tools' };
    const app = manifest.application?.[0];
    if (!app) throw new Error('withAndroidPlayTweaks: <application> not found');

    app.property = (app.property || []).filter((p) => p.$['android:name'] !== RESIZE_OPT_OUT);
    app.property.push({ $: { 'android:name': RESIZE_OPT_OUT, 'android:value': 'true' } });

    app.service = (app.service || []).filter((s) => s.$['android:name'] !== LOCATION_SERVICE);
    app.service.push({ $: { 'android:name': LOCATION_SERVICE, 'tools:node': 'remove' } });
    return cfg;
  });
};
