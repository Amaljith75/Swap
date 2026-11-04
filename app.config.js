// Extends app.json with values that depend on the build environment.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  // CI passes the GitHub run number, so every APK has a higher version code
  // (installs over the previous one, and the app can tell when it's out of date).
  const build = Number(process.env.BUILD_NUMBER || config.android?.versionCode || 1);
  const hasFirebase = fs.existsSync(path.join(__dirname, 'google-services.json'));
  return {
    ...config,
    android: {
      ...config.android,
      versionCode: build,
      ...(hasFirebase ? { googleServicesFile: './google-services.json' } : {}),
    },
    ios: { ...config.ios, buildNumber: String(build) },
    extra: { ...config.extra, build, pushConfigured: hasFirebase },
  };
};
