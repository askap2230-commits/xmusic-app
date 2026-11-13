#!/usr/bin/env bash
set -euo pipefail

npm install
npx tauri icon app-icon.png
if [ ! -d "src-tauri/gen/android" ]; then
  npx tauri android init
fi
MANIFEST="src-tauri/gen/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  sed -i 's/android:usesCleartextTraffic="${usesCleartextTraffic}"/android:usesCleartextTraffic="true"/g' "$MANIFEST" || true
fi
npx tauri android build --apk

APK=$(find src-tauri/gen/android -name "*.apk" -path "*release*" | head -n 1)
BT=$(ls -d "$ANDROID_HOME/build-tools/"* | sort -V | tail -n 1)
PASS="xmusic123"
if [ ! -f "ks.jks" ]; then
  keytool -genkeypair -v -keystore ks.jks -alias xmusic -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Xmusic"
fi
"$BT/zipalign" -f -p 4 "$APK" aligned.apk
"$BT/apksigner" sign --ks ks.jks --ks-key-alias xmusic --ks-pass pass:"$PASS" --key-pass pass:"$PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out Xmusic.apk aligned.apk
"$BT/apksigner" verify -v Xmusic.apk
echo "Selesai! File siap diinstal: $(pwd)/Xmusic.apk"
