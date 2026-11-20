/**
 * Configuración dinámica sobre app.json:
 * - versionCode: Google Play exige que suba en cada versión. El workflow "AAB para Google Play" lo pasa en
 *   ANDROID_VERSION_CODE (número de ejecución + 100); en local queda el de app.json.
 * - La firma de release con la clave de subida (plugins/withReleaseSigning.js).
 * - La pantalla vertical como función opcional para Google Play (plugins/withOptionalPortrait.js).
 */
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || config.android.versionCode,
  },
  plugins: [...(config.plugins ?? []), './plugins/withReleaseSigning', './plugins/withOptionalPortrait'],
});
