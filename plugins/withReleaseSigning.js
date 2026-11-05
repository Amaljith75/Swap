// Signs release builds with your own upload key when the build provides one.
//
// The CI workflow for Google Play decodes the keystore from GitHub secrets and
// sets these environment variables before running Gradle:
//   SWAP_UPLOAD_STORE_FILE      absolute path to the .jks / .keystore file
//   SWAP_UPLOAD_STORE_PASSWORD  keystore password
//   SWAP_UPLOAD_KEY_ALIAS       key alias
//   SWAP_UPLOAD_KEY_PASSWORD    key password
// Without them, release builds keep using the debug key (fine for the sideload APK,
// never accepted by Play).
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            if (System.getenv('SWAP_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('SWAP_UPLOAD_STORE_FILE'))
                storePassword System.getenv('SWAP_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('SWAP_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('SWAP_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (src.includes('SWAP_UPLOAD_STORE_FILE')) return cfg;

    // 1. Add a "release" signing config next to the debug one.
    const signingBlock = /signingConfigs\s*\{/;
    if (!signingBlock.test(src)) throw new Error('withReleaseSigning: signingConfigs block not found in app/build.gradle');
    src = src.replace(signingBlock, (m) => `${m}${RELEASE_SIGNING}`);

    // 2. Make the release build type use it when the key is provided.
    const releaseType = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!releaseType.test(src)) throw new Error('withReleaseSigning: release signingConfig not found in app/build.gradle');
    src = src.replace(
      releaseType,
      `$1signingConfig(System.getenv('SWAP_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug)`,
    );

    cfg.modResults.contents = src;
    return cfg;
  });
};
