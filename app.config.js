// Extends app.json with values that depend on the build environment.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  // CI passes the GitHub run number, so every APK has a higher version code
  // (installs over the previous one, and the app can tell when it's out of date).
  const build = Number(process.env.BUILD_NUMBER || config.android?.versionCode || 1);
  const firebaseFile = path.join(__dirname, 'google-services.json');
  const hasFirebase = fs.existsSync(firebaseFile);
  // Google Maps (Android) key: GOOGLE_MAPS_API_KEY if set, otherwise the Firebase
  // project's Android key. Either way "Maps SDK for Android" must be enabled for it.
  let mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!mapsKey && hasFirebase) {
    try {
      mapsKey = JSON.parse(fs.readFileSync(firebaseFile, 'utf8')).client?.[0]?.api_key?.[0]?.current_key || '';
    } catch {
      mapsKey = '';
    }
  }
  return {
    ...config,
    android: {
      ...config.android,
      versionCode: build,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    ios: { ...config.ios, buildNumber: String(build) },
    plugins: [...(config.plugins || []), ['react-native-maps', { androidGoogleMapsApiKey: mapsKey || undefined }]],
    extra: { ...config.extra, build, pushConfigured: hasFirebase },
  };
};
