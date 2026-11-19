#!/usr/bin/env bash
# Crea la clave de subida de Google Play para CheckHome y deja listos los 4 secretos del workflow "AAB para Google Play".
# Correr UNA vez en el Mac de Hernan (necesita keytool: viene con Java, p. ej. `brew install --cask temurin`).
#
# Uso: bash infra/android-upload-key.sh
#
# Qué hace:
#   1. Crea ~/checkhome-keys/checkhome-upload.jks con una clave aleatoria (la misma para el almacén y la llave).
#   2. Va copiando al portapapeles cada valor, uno por uno, para pegarlo en GitHub → Settings → Secrets and
#      variables → Actions → New repository secret. Nada se imprime en pantalla.
#
# MUY IMPORTANTE: guarda ~/checkhome-keys/ (el .jks y el archivo de la clave) en un lugar seguro y con respaldo
# (p. ej. tu gestor de contraseñas). Con Play App Signing, si la pierdes Google puede cambiarla, pero toma días.
# Nunca la subas al repo.
set -euo pipefail
command -v keytool >/dev/null || { echo "Falta keytool (Java). Instala con: brew install --cask temurin"; exit 1; }

DIR="$HOME/checkhome-keys"; KS="$DIR/checkhome-upload.jks"; ALIAS=checkhome-upload
mkdir -p "$DIR"; chmod 700 "$DIR"
if [ -e "$KS" ]; then echo "Ya existe $KS: no la reemplazo."; exit 1; fi

PASS="$(openssl rand -base64 24 | tr -d '/+=')"
keytool -genkeypair -v -storetype PKCS12 -keystore "$KS" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=CheckHome, O=CheckHome, C=CL" >/dev/null 2>&1
printf '%s\n' "$PASS" > "$DIR/clave.txt"; chmod 600 "$DIR/clave.txt" "$KS"
echo "Clave creada en $KS (la contraseña quedó en $DIR/clave.txt)."
echo

copy() { printf '%s' "$2" | pbcopy; read -r -p "Copiado $1 al portapapeles. Pégalo en GitHub como secreto '$1' y presiona Enter… " _; }
copy ANDROID_UPLOAD_KEYSTORE_BASE64 "$(base64 < "$KS" | tr -d '\n')"
copy ANDROID_UPLOAD_STORE_PASSWORD "$PASS"
copy ANDROID_UPLOAD_KEY_ALIAS "$ALIAS"
copy ANDROID_UPLOAD_KEY_PASSWORD "$PASS"
printf '' | pbcopy
echo "Listo. Ahora en GitHub: Actions → \"AAB para Google Play\" → Run workflow."
