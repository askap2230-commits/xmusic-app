#!/usr/bin/env bash
set -euo pipefail

echo "=== [1/5] Memeriksa dependensi NPM ==="
npm install

echo "=== [2/5] Membuat ikon aplikasi (RGBA) ==="
npx tauri icon app-icon.png

echo "=== [3/5] Inisialisasi proyek Android Tauri v2 ==="
if [ ! -d "src-tauri/gen/android" ]; then
  npx tauri android init --ci
fi

MANIFEST="src-tauri/gen/android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ]; then
  sed -i 's/android:usesCleartextTraffic="${usesCleartextTraffic}"/android:usesCleartextTraffic="true" android:extractNativeLibs="true"/g' "$MANIFEST" || true
fi

MAIN_KT=$(find src-tauri/gen/android -name "MainActivity.kt" | head -n 1 || true)
if [ -n "$MAIN_KT" ] && [ -f "$MAIN_KT" ]; then
  cat << 'EOF' > "$MAIN_KT"
package com.nys.xmusic

import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    webView.settings.mediaPlaybackRequiresUserGesture = false
    webView.settings.javaScriptCanOpenWindowsAutomatically = true
    webView.settings.domStorageEnabled = true
  }
}
EOF
fi

echo "=== [4/5] Kompilasi APK Release Universal ==="
npx tauri android build --apk true

echo "=== [5/5] Zipalign & Sign APK ==="
APK=$(find src-tauri/gen/android -name "*.apk" -path "*release*" | head -n 1)
BT=$(ls -d "$ANDROID_HOME/build-tools/"* | sort -V | tail -n 1)
PASS="xmusic123"

if [ ! -f "ks.jks" ]; then
  keytool -genkeypair -v -keystore ks.jks -alias xmusic -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Xmusic, OU=Mobile, O=Nys, L=Jakarta, S=DKI, C=ID"
fi

"$BT/zipalign" -v -f -p 4 "$APK" aligned.apk
"$BT/apksigner" sign --ks ks.jks --ks-key-alias xmusic --ks-pass pass:"$PASS" --key-pass pass:"$PASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out Xmusic.apk aligned.apk
"$BT/apksigner" verify -v Xmusic.apk

echo "Selesai! File siap diinstal: $(pwd)/Xmusic.apk"
