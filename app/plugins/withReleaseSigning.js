const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Firma el build de release con la clave de subida de Google Play cuando el build la recibe por variables de
 * entorno (solo el workflow "AAB para Google Play", desde los secretos del repo). Sin esas variables queda la
 * clave de depuración de siempre, así el APK de prueba sigue igual.
 *
 * Variables: CHECKHOME_UPLOAD_STORE_FILE (ruta al .jks), CHECKHOME_UPLOAD_STORE_PASSWORD,
 * CHECKHOME_UPLOAD_KEY_ALIAS, CHECKHOME_UPLOAD_KEY_PASSWORD.
 */
const RELEASE_CONFIG = `
        release {
            if (System.getenv('CHECKHOME_UPLOAD_STORE_FILE')) {
                storeFile file(System.getenv('CHECKHOME_UPLOAD_STORE_FILE'))
                storePassword System.getenv('CHECKHOME_UPLOAD_STORE_PASSWORD')
                keyAlias System.getenv('CHECKHOME_UPLOAD_KEY_ALIAS')
                keyPassword System.getenv('CHECKHOME_UPLOAD_KEY_PASSWORD')
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes('CHECKHOME_UPLOAD_STORE_FILE')) return cfg;

    const signingStart = gradle.indexOf('signingConfigs {');
    if (signingStart < 0) throw new Error('withReleaseSigning: no encontré signingConfigs en app/build.gradle');
    gradle = gradle.slice(0, signingStart + 'signingConfigs {'.length) + RELEASE_CONFIG + gradle.slice(signingStart + 'signingConfigs {'.length);

    const releaseType = gradle.search(/buildTypes\s*\{[\s\S]*?release\s*\{/);
    if (releaseType < 0) throw new Error('withReleaseSigning: no encontré buildTypes.release en app/build.gradle');
    const at = gradle.indexOf('signingConfig signingConfigs.debug', gradle.indexOf('release {', releaseType));
    if (at < 0) throw new Error('withReleaseSigning: no encontré la firma de release en app/build.gradle');
    gradle =
      gradle.slice(0, at) +
      "signingConfig System.getenv('CHECKHOME_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug" +
      gradle.slice(at + 'signingConfig signingConfigs.debug'.length);

    cfg.modResults.contents = gradle;
    return cfg;
  });
};
