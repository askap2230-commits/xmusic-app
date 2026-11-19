#!/usr/bin/env python3
# Copyright 2026 Azka Putra
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Android Build, Reproducible Packaging, R8 Optimization & Native Media Notification Setup for Tauri v2.12+.

Operations:
1. Configures AndroidManifest.xml with:
   - usesCleartextTraffic="true" and round launcher icons
   - POST_NOTIFICATIONS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, WAKE_LOCK
   - XmusicMediaService (<service android:foregroundServiceType="mediaPlayback">)
2. Injects native Kotlin XmusicMediaService.kt using standard Android Framework APIs
   (MediaSession + Notification.MediaStyle + Foreground Service) so playing audio displays a
   real Android lockscreen and notification-shade media player with Prev/Play-Pause/Next controls.
3. Injects MainActivity.kt WebView bridge (window.XmusicAndroidMedia) + Android 13+ notification
   permission request, dispatching notification actions straight back into the Svelte AudioEngine.
4. Enables R8 minification, resource shrinking, disables dependenciesInfo, and enforces
   deterministic reproducible Gradle archives (isPreserveFileTimestamps = false, isReproducibleFileOrder = true).
"""
from __future__ import annotations

import os
import re

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ANDROID_DIR = os.path.join(ROOT, "src-tauri", "gen", "android")
KOTLIN_PKG_DIR = os.path.join(ANDROID_DIR, "app", "src", "main", "java", "com", "nys", "xmusic")

MEDIA_SERVICE_KT = """// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later
package com.nys.xmusic

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder

class XmusicMediaService : Service() {
    companion object {
        const val CHANNEL_ID = "xmusic_playback_channel"
        const val NOTIFICATION_ID = 4091
        const val ACTION_UPDATE = "com.nys.xmusic.ACTION_UPDATE"
        const val ACTION_CLEAR = "com.nys.xmusic.ACTION_CLEAR"
        const val ACTION_PLAY_PAUSE = "com.nys.xmusic.ACTION_PLAY_PAUSE"
        const val ACTION_NEXT = "com.nys.xmusic.ACTION_NEXT"
        const val ACTION_PREV = "com.nys.xmusic.ACTION_PREV"

        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_ALBUM = "album"
        const val EXTRA_IS_PLAYING = "is_playing"
        const val EXTRA_DURATION_MS = "duration_ms"
        const val EXTRA_POSITION_MS = "position_ms"
    }

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        mediaSession = MediaSession(this, "XmusicMediaSession").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() { MainActivity.dispatchMediaAction("play") }
                override fun onPause() { MainActivity.dispatchMediaAction("pause") }
                override fun onSkipToNext() { MainActivity.dispatchMediaAction("next") }
                override fun onSkipToPrevious() { MainActivity.dispatchMediaAction("prev") }
                override fun onStop() { MainActivity.dispatchMediaAction("stop") }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_PAUSE -> {
                MainActivity.dispatchMediaAction("togglePlay")
                return START_NOT_STICKY
            }
            ACTION_NEXT -> {
                MainActivity.dispatchMediaAction("next")
                return START_NOT_STICKY
            }
            ACTION_PREV -> {
                MainActivity.dispatchMediaAction("prev")
                return START_NOT_STICKY
            }
            ACTION_CLEAR -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "nys Xmusic"
                val artist = intent.getStringExtra(EXTRA_ARTIST) ?: "Xmusic"
                val album = intent.getStringExtra(EXTRA_ALBUM) ?: "nys Xmusic"
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false)
                val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L)
                val positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L)
                updateNotification(title, artist, album, isPlaying, durationMs, positionMs)
            }
        }
        return START_NOT_STICKY
    }

    private fun updateNotification(
        title: String,
        artist: String,
        album: String,
        isPlaying: Boolean,
        durationMs: Long,
        positionMs: Long
    ) {
        val session = mediaSession ?: return
        val metadata = MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
            .build()
        session.setMetadata(metadata)

        val stateCode = if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        val actions = PlaybackState.ACTION_PLAY or
            PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or
            PlaybackState.ACTION_SKIP_TO_NEXT or
            PlaybackState.ACTION_SKIP_TO_PREVIOUS or
            PlaybackState.ACTION_STOP
        val playbackState = PlaybackState.Builder()
            .setActions(actions)
            .setState(stateCode, positionMs, if (isPlaying) 1.0f else 0.0f)
            .build()
        session.setPlaybackState(playbackState)

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentPendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val prevIntent = serviceActionIntent(ACTION_PREV, 1)
        val playPauseIntent = serviceActionIntent(ACTION_PLAY_PAUSE, 2)
        val nextIntent = serviceActionIntent(ACTION_NEXT, 3)

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        val playPauseIcon = if (isPlaying) android.R.drawable.ic_media_pause else android.R.drawable.ic_media_play
        val playPauseLabel = if (isPlaying) "Jeda" else "Putar"

        val notification = builder
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentPendingIntent)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Sebelumnya", prevIntent)
            .addAction(playPauseIcon, playPauseLabel, playPauseIntent)
            .addAction(android.R.drawable.ic_media_next, "Berikutnya", nextIntent)
            .setStyle(
                Notification.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2)
            )
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun serviceActionIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, XmusicMediaService::class.java).apply { this.action = action }
        return PendingIntent.getService(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pemutar Musik Xmusic",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Kontrol pemutaran audio dan layar kunci untuk nys Xmusic"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
"""

MAIN_ACTIVITY_KT = """// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later
package com.nys.xmusic

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.view.WindowInsetsControllerCompat
import java.lang.ref.WeakReference

class MainActivity : TauriActivity() {
    companion object {
        private var webViewRef: WeakReference<WebView>? = null

        fun dispatchMediaAction(action: String) {
            val webView = webViewRef?.get() ?: return
            webView.post {
                webView.evaluateJavascript(
                    "window.__xmusicMediaAction && window.__xmusicMediaAction('$action');",
                    null
                )
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        applySystemBarTheme(isNight)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
            }
        }
    }

    private fun applySystemBarTheme(isDark: Boolean) {
        val barColor = if (isDark) Color.BLACK else Color.parseColor("#F2F2F7")
        @Suppress("DEPRECATION")
        window.statusBarColor = barColor
        @Suppress("DEPRECATION")
        window.navigationBarColor = barColor
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.isAppearanceLightStatusBars = !isDark
        controller.isAppearanceLightNavigationBars = !isDark
    }

    override fun onWebViewCreate(webView: WebView) {
        super.onWebViewCreate(webView)
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webViewRef = WeakReference(webView)
        webView.addJavascriptInterface(AndroidMediaBridge(), "XmusicAndroidMedia")
    }

    inner class AndroidMediaBridge {
        @JavascriptInterface
        fun updateNowPlaying(
            title: String,
            artist: String,
            album: String,
            isPlaying: Boolean,
            durationMs: Long,
            positionMs: Long
        ) {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_UPDATE
                putExtra(XmusicMediaService.EXTRA_TITLE, title)
                putExtra(XmusicMediaService.EXTRA_ARTIST, artist)
                putExtra(XmusicMediaService.EXTRA_ALBUM, album)
                putExtra(XmusicMediaService.EXTRA_IS_PLAYING, isPlaying)
                putExtra(XmusicMediaService.EXTRA_DURATION_MS, durationMs)
                putExtra(XmusicMediaService.EXTRA_POSITION_MS, positionMs)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        }

        @JavascriptInterface
        fun clearNotification() {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_CLEAR
            }
            startService(intent)
        }

        @JavascriptInterface
        fun setSystemBarTheme(isDark: Boolean) {
            runOnUiThread {
                applySystemBarTheme(isDark)
            }
        }
    }
}
"""


def patch_manifest() -> None:
    manifest_path = os.path.join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml")
    if not os.path.exists(manifest_path):
        print(f"[Android Optimize] Manifest not found yet: {manifest_path}")
        return

    with open(manifest_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    permissions = [
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.WAKE_LOCK",
    ]
    for perm in permissions:
        tag = f'<uses-permission android:name="{perm}" />'
        if perm not in content:
            content = content.replace("<application", f"    {tag}\n    <application", 1)

    content = content.replace(
        'android:usesCleartextTraffic="${usesCleartextTraffic}"',
        'android:usesCleartextTraffic="true"',
    )
    if "android:usesCleartextTraffic" not in content:
        content = content.replace("<application", '<application android:usesCleartextTraffic="true"', 1)

    if "android:roundIcon=" not in content:
        content = content.replace(
            'android:icon="@mipmap/ic_launcher"',
            'android:icon="@mipmap/ic_launcher"\n        android:roundIcon="@mipmap/ic_launcher_round"',
        )

    service_decl = """        <service
            android:name=".XmusicMediaService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback" />"""
    if "XmusicMediaService" not in content:
        content = content.replace("</application>", f"{service_decl}\n    </application>", 1)

    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Patched AndroidManifest.xml with Media Playback Service & permissions.")


def inject_native_media_kotlin() -> None:
    if not os.path.exists(ANDROID_DIR):
        return
    os.makedirs(KOTLIN_PKG_DIR, exist_ok=True)
    with open(os.path.join(KOTLIN_PKG_DIR, "XmusicMediaService.kt"), "w", encoding="utf-8") as fh:
        fh.write(MEDIA_SERVICE_KT)
    with open(os.path.join(KOTLIN_PKG_DIR, "MainActivity.kt"), "w", encoding="utf-8") as fh:
        fh.write(MAIN_ACTIVITY_KT)
    print("[Android Optimize] Injected native Kotlin XmusicMediaService & MainActivity JS bridge.")


def patch_build_gradle() -> None:
    gradle_kts = os.path.join(ANDROID_DIR, "app", "build.gradle.kts")
    if not os.path.exists(gradle_kts):
        print(f"[Android Optimize] build.gradle.kts not found yet: {gradle_kts}")
        return

    with open(gradle_kts, "r", encoding="utf-8") as fh:
        content = fh.read()

    if "isShrinkResources = true" not in content:
        content = re.sub(
            r"isMinifyEnabled\s*=\s*false",
            "isMinifyEnabled = true\n            isShrinkResources = true",
            content,
        )

    if "dependenciesInfo" not in content:
        content = re.sub(
            r"(android\s*\{)",
            r"\1\n    dependenciesInfo {\n        includeInApk = false\n        includeInBundle = false\n    }",
            content,
            count=1,
        )

    reproducible_block = """
// Deterministic reproducible archive output (required for verifiable APK builds)
tasks.withType<org.gradle.api.tasks.bundling.AbstractArchiveTask>().configureEach {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
"""
    if "isReproducibleFileOrder = true" not in content:
        content = content.rstrip() + "\n" + reproducible_block

    with open(gradle_kts, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Enabled R8 shrinking and deterministic reproducible archive settings.")


def patch_gradle_properties() -> None:
    prop_path = os.path.join(ANDROID_DIR, "gradle.properties")
    if not os.path.exists(prop_path):
        return

    with open(prop_path, "r", encoding="utf-8") as fh:
        content = fh.read()

    optimizations = """
# Xmusic Tauri v2.12 Build Speed, Size & Reproducibility Optimizations
org.gradle.parallel=true
org.gradle.caching=true
org.gradle.daemon=true
org.gradle.configureondemand=true
org.gradle.jvmargs=-Xmx4096m -XX:+UseParallelGC -Dfile.encoding=UTF-8
kotlin.incremental=true
android.enableR8.fullMode=true
"""
    if "android.enableR8.fullMode=true" not in content:
        content = content.rstrip() + "\n" + optimizations

    with open(prop_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Updated gradle.properties for fast deterministic CI builds.")



def patch_proguard_rules() -> None:
    pro_path = os.path.join(ANDROID_DIR, "app", "proguard-rules.pro")
    if not os.path.exists(ANDROID_DIR):
        return
    os.makedirs(os.path.dirname(pro_path), exist_ok=True)
    existing = open(pro_path, "r", encoding="utf-8").read() if os.path.exists(pro_path) else ""
    rules = """
# Keep native Android Media Notification WebView bridge under R8 full mode
-keepattributes *Annotation*
-keepclassmembers class com.nys.xmusic.MainActivity$AndroidMediaBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.nys.xmusic.XmusicMediaService { *; }
"""
    if "AndroidMediaBridge" not in existing:
        with open(pro_path, "w", encoding="utf-8") as fh:
            fh.write(existing.rstrip() + "\n" + rules)
    print("[Android Optimize] Added R8 keep rules for XmusicMediaService & AndroidMediaBridge.")


def patch_android_themes() -> None:
    """Replace default Material purple status bar colors with Konsta UI iOS Light/Dark surfaces."""
    if not os.path.exists(ANDROID_DIR):
        return
    res_dir = os.path.join(ANDROID_DIR, "app", "src", "main", "res")
    light_themes = os.path.join(res_dir, "values", "themes.xml")
    dark_dir = os.path.join(res_dir, "values-night")
    dark_themes = os.path.join(dark_dir, "themes.xml")

    style_name = "Theme.xmusic"
    style_parent = "Theme.MaterialComponents.DayNight.NoActionBar"
    if os.path.exists(light_themes):
        existing = open(light_themes, "r", encoding="utf-8").read()
        m_name = re.search(r'<style\s+name="([^"]+)"', existing)
        m_parent = re.search(r'parent="([^"]+)"', existing)
        if m_name:
            style_name = m_name.group(1)
        if m_parent:
            style_parent = m_parent.group(1)

    light_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="{style_name}" parent="{style_parent}">
        <item name="colorPrimary">#007AFF</item>
        <item name="colorPrimaryDark">#F2F2F7</item>
        <item name="colorAccent">#007AFF</item>
        <item name="android:statusBarColor">#F2F2F7</item>
        <item name="android:navigationBarColor">#F2F2F7</item>
        <item name="android:windowLightStatusBar" tools:targetApi="m">true</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="o_mr1">true</item>
        <item name="android:windowBackground">#F2F2F7</item>
    </style>
</resources>
"""
    dark_xml = f"""<?xml version="1.0" encoding="utf-8"?>
<resources xmlns:tools="http://schemas.android.com/tools">
    <style name="{style_name}" parent="{style_parent}">
        <item name="colorPrimary">#0A84FF</item>
        <item name="colorPrimaryDark">#000000</item>
        <item name="colorAccent">#0A84FF</item>
        <item name="android:statusBarColor">#000000</item>
        <item name="android:navigationBarColor">#000000</item>
        <item name="android:windowLightStatusBar" tools:targetApi="m">false</item>
        <item name="android:windowLightNavigationBar" tools:targetApi="o_mr1">false</item>
        <item name="android:windowBackground">#000000</item>
    </style>
</resources>
"""
    os.makedirs(os.path.dirname(light_themes), exist_ok=True)
    with open(light_themes, "w", encoding="utf-8") as fh:
        fh.write(light_xml)
    os.makedirs(dark_dir, exist_ok=True)
    with open(dark_themes, "w", encoding="utf-8") as fh:
        fh.write(dark_xml)
    print(f"[Android Optimize] Patched light/dark themes.xml ({style_name}) to Konsta iOS surfaces.")

if __name__ == "__main__":
    patch_manifest()
    patch_android_themes()
    inject_native_media_kotlin()
    patch_proguard_rules()
    patch_build_gradle()
    patch_gradle_properties()
