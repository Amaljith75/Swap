// Extends app.json with values that depend on the build environment.
//
// APP_CHANNEL decides how this build gets updates:
//   sideload (default) - the APK on GitHub Releases. Can download and install
//                        its own updates, so it asks for REQUEST_INSTALL_PACKAGES.
//   play               - the Google Play build. Play delivers updates, so the
//                        self-updater is switched off and the permission removed.
const fs = require('fs');
const path = require('path');

const INSTALL_PERMISSION = 'android.permission.REQUEST_INSTALL_PACKAGES';

module.exports = ({ config }) => {
  const channel = process.env.APP_CHANNEL === 'play' ? 'play' : 'sideload';
  // CI passes the run number, so every build has a higher version code
  // (installs over the previous one, and the app can tell when it's out of date).
  const build = Number(process.env.BUILD_NUMBER || config.android?.versionCode || 1);
  const firebaseFile = path.join(__dirname, 'google-services.json');
  const hasFirebase = fs.existsSync(firebaseFile);
  // Google Maps (Android) key. Prefer a dedicated key (GitHub secret GOOGLE_MAPS_API_KEY)
  // restricted to "Maps SDK for Android" + this app's package and signing certificates.
  // Falls back to the Firebase project's Android key so older setups keep working.
  let mapsKey = process.env.GOOGLE_MAPS_API_KEY || '';
  if (!mapsKey && hasFirebase) {
    try {
      mapsKey = JSON.parse(fs.readFileSync(firebaseFile, 'utf8')).client?.[0]?.api_key?.[0]?.current_key || '';
    } catch {
      mapsKey = '';
    }
  }

  const permissions = [...(config.android?.permissions || [])];
  const blocked = [...(config.android?.blockedPermissions || [])];
  if (channel === 'sideload') permissions.push(INSTALL_PERMISSION);
  else blocked.push(INSTALL_PERMISSION); // also strips it if a library adds it

  return {
    ...config,
    android: {
      ...config.android,
      versionCode: build,
      permissions,
      blockedPermissions: blocked,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    ios: { ...config.ios, buildNumber: String(build) },
    plugins: [
      ...(config.plugins || []),
      ['react-native-maps', { androidGoogleMapsApiKey: mapsKey || undefined }],
      './plugins/withReleaseSigning',
      './plugins/withAndroidPlayTweaks',
    ],
    extra: { ...config.extra, build, channel, pushConfigured: hasFirebase },
  };
};
