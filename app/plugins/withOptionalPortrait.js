const { withAndroidManifest } = require('expo/config-plugins');

/**
 * La app va solo en vertical (orientation: portrait). Google Play deduce de eso que el dispositivo DEBE tener
 * pantalla vertical (android.hardware.screen.portrait obligatorio) y lo marca como problema que restringe la
 * disponibilidad. Lo declaramos como opcional para que nadie quede fuera; la app sigue fija en vertical.
 */
const FEATURE = 'android.hardware.screen.portrait';

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const features = (manifest['uses-feature'] = manifest['uses-feature'] ?? []);
    const existing = features.find((f) => f.$?.['android:name'] === FEATURE);
    if (existing) existing.$['android:required'] = 'false';
    else features.push({ $: { 'android:name': FEATURE, 'android:required': 'false' } });
    return cfg;
  });
};
