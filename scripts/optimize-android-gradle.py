#!/usr/bin/env python3
# Copyright 2026 Azka Putra
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Android Build, Reproducible Packaging, R8 Optimization & Native Background Media Playback Setup for Tauri v2.12+.

Operations:
1. Configures AndroidManifest.xml with:
   - usesCleartextTraffic="true", round launcher icons, and android:launchMode="singleTask"
   - POST_NOTIFICATIONS, FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, WAKE_LOCK, ACCESS_WIFI_STATE
   - XmusicMediaService (<service android:foregroundServiceType="mediaPlayback" android:stopWithTask="false">)
2. Injects native Kotlin XmusicMediaService.kt using standard Android Framework APIs:
   - MediaSession + Notification.MediaStyle + Foreground Service (Android 14-16 compliant)
   - PowerManager.PARTIAL_WAKE_LOCK + WifiManager.WifiLock while playing (keeps audio alive with screen off)
   - Single-owner AudioFocus: WebView's internal Chromium AudioFocusDelegate owns AUDIOFOCUS_GAIN (eliminates self-steal pause/play loop)
   - ACTION_AUDIO_BECOMING_NOISY receiver (auto-pauses when headphones/Bluetooth disconnect)
3. Injects MainActivity.kt with:
   - WebView RENDERER_PRIORITY_IMPORTANT (waivedWhenNotVisible = false) + onPause/onStop WebView audio keep-alive
   - OnBackPressedCallback: moves task to background (moveTaskToBack) when pressing Back at root while music plays
   - Crash-proof AndroidMediaBridge (uses startService when FGS is already running to prevent ForegroundServiceStartNotAllowedException)
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
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioManager
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import org.json.JSONObject
import java.lang.ref.WeakReference

@OptIn(UnstableApi::class)
class XmusicMediaService : Service() {
    companion object {
        const val CHANNEL_ID = "xmusic_playback_channel"
        const val NOTIFICATION_ID = 4091
        const val ACTION_UPDATE = "com.nys.xmusic.ACTION_UPDATE"
        const val ACTION_CLEAR = "com.nys.xmusic.ACTION_CLEAR"
        const val ACTION_PLAY_PAUSE = "com.nys.xmusic.ACTION_PLAY_PAUSE"
        const val ACTION_NEXT = "com.nys.xmusic.ACTION_NEXT"
        const val ACTION_PREV = "com.nys.xmusic.ACTION_PREV"

        const val ACTION_PLAY_URL = "com.nys.xmusic.ACTION_PLAY_URL"
        const val ACTION_NATIVE_PAUSE = "com.nys.xmusic.ACTION_NATIVE_PAUSE"
        const val ACTION_NATIVE_RESUME = "com.nys.xmusic.ACTION_NATIVE_RESUME"
        const val ACTION_NATIVE_STOP = "com.nys.xmusic.ACTION_NATIVE_STOP"
        const val ACTION_NATIVE_SEEK = "com.nys.xmusic.ACTION_NATIVE_SEEK"
        const val ACTION_NATIVE_VOLUME = "com.nys.xmusic.ACTION_NATIVE_VOLUME"

        const val EXTRA_TRACK_ID = "track_id"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_ALBUM = "album"
        const val EXTRA_IS_PLAYING = "is_playing"
        const val EXTRA_DURATION_MS = "duration_ms"
        const val EXTRA_POSITION_MS = "position_ms"
        const val EXTRA_URL = "url"
        const val EXTRA_USER_AGENT = "user_agent"
        const val EXTRA_VOLUME = "volume"

        @Volatile
        var isRunning: Boolean = false

        @Volatile
        var isPlayingNow: Boolean = false

        @Volatile
        var isNativeActive: Boolean = false

        @Volatile
        var isNativePlaying: Boolean = false

        @Volatile
        var nativeTrackId: String = ""

        @Volatile
        var nativePositionMs: Long = 0L

        @Volatile
        var nativeDurationMs: Long = 0L

        private var instanceRef: WeakReference<XmusicMediaService>? = null

        fun getNativeStateJson(): String {
            return JSONObject()
                .put("active", isNativeActive)
                .put("playing", isNativePlaying)
                .put("trackId", nativeTrackId)
                .put("positionMs", nativePositionMs)
                .put("durationMs", nativeDurationMs)
                .toString()
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private var mediaSession: MediaSession? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var isInForeground: Boolean = false
    private var noisyReceiverRegistered: Boolean = false

    // Production AndroidX Media3 ExoPlayer inside Foreground Service:
    // Preserves User-Agent/Origin/Referer across 302 redirects and decodes YouTube DASH fMP4, WebM Opus & HLS natively.
    private var exoPlayer: ExoPlayer? = null
    private var currentVolume: Float = 0.85f
    private var currentTitle: String = "nys Xmusic"
    private var currentArtist: String = "Xmusic"
    private var currentAlbum: String = "nys Xmusic"
    private var lastSyncedDurationMs: Long = 0L

    private val positionTicker = object : Runnable {
        override fun run() {
            val player = exoPlayer ?: return
            if (!isNativeActive) return
            try {
                val pos = player.currentPosition.coerceAtLeast(0L)
                val dur = if (player.duration != C.TIME_UNSET && player.duration > 0L) player.duration else nativeDurationMs
                nativePositionMs = pos
                if (dur > 0L) nativeDurationMs = dur
                if (dur > 0L && dur != lastSyncedDurationMs) {
                    lastSyncedDurationMs = dur
                    updateNotification(currentTitle, currentArtist, currentAlbum, isNativePlaying, dur, pos)
                }
            } catch (_: Throwable) {
            }
            if (isNativePlaying) {
                mainHandler.postDelayed(this, 500L)
            }
        }
    }

    private val becomingNoisyReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == AudioManager.ACTION_AUDIO_BECOMING_NOISY && isPlayingNow) {
                if (isNativeActive) {
                    handleNativePause()
                } else {
                    MainActivity.dispatchMediaAction("pause")
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        instanceRef = WeakReference(this)
        isRunning = true
        ensureChannel()

        val pm = getSystemService(Context.POWER_SERVICE) as? PowerManager
        wakeLock = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Xmusic:BackgroundPlaybackLock")?.apply {
            setReferenceCounted(false)
        }

        val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager
        val wifiMode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            WifiManager.WIFI_MODE_FULL_LOW_LATENCY
        } else {
            @Suppress("DEPRECATION")
            WifiManager.WIFI_MODE_FULL_HIGH_PERF
        }
        wifiLock = wm?.createWifiLock(wifiMode, "Xmusic:BackgroundWifiLock")?.apply {
            setReferenceCounted(false)
        }

        val noisyFilter = IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(becomingNoisyReceiver, noisyFilter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                registerReceiver(becomingNoisyReceiver, noisyFilter)
            }
            noisyReceiverRegistered = true
        } catch (_: Throwable) {
            noisyReceiverRegistered = false
        }

        mediaSession = MediaSession(this, "XmusicMediaSession").apply {
            setCallback(object : MediaSession.Callback() {
                override fun onPlay() {
                    if (isNativeActive) handleNativeResume() else MainActivity.dispatchMediaAction("play")
                }
                override fun onPause() {
                    if (isNativeActive) handleNativePause() else MainActivity.dispatchMediaAction("pause")
                }
                override fun onSkipToNext() { MainActivity.dispatchMediaAction("next") }
                override fun onSkipToPrevious() { MainActivity.dispatchMediaAction("prev") }
                override fun onSeekTo(pos: Long) {
                    val target = pos.coerceAtLeast(0L)
                    if (isNativeActive) {
                        handleNativeSeek(target)
                        MainActivity.dispatchSeekAction(target)
                    } else {
                        nativePositionMs = target
                        updateNotification(currentTitle, currentArtist, currentAlbum, isPlayingNow, nativeDurationMs, target)
                        MainActivity.dispatchSeekAction(target)
                    }
                }
                override fun onStop() {
                    if (isNativeActive) handleNativeStop(true) else MainActivity.dispatchMediaAction("stop")
                }
            })
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY_URL -> {
                val trackId = intent.getStringExtra(EXTRA_TRACK_ID) ?: ""
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "nys Xmusic"
                val artist = intent.getStringExtra(EXTRA_ARTIST) ?: "Xmusic"
                val album = intent.getStringExtra(EXTRA_ALBUM) ?: "nys Xmusic"
                val url = intent.getStringExtra(EXTRA_URL) ?: return START_NOT_STICKY
                val ua = intent.getStringExtra(EXTRA_USER_AGENT) ?: ""
                val startMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L)
                val vol = intent.getFloatExtra(EXTRA_VOLUME, 0.85f).coerceIn(0f, 1f)
                startNativeUrl(trackId, title, artist, album, url, ua, startMs, vol)
                return START_STICKY
            }
            ACTION_NATIVE_PAUSE -> {
                handleNativePause()
                return START_NOT_STICKY
            }
            ACTION_NATIVE_RESUME -> {
                handleNativeResume()
                return if (isNativePlaying) START_STICKY else START_NOT_STICKY
            }
            ACTION_NATIVE_STOP -> {
                handleNativeStop(false)
                return START_NOT_STICKY
            }
            ACTION_NATIVE_SEEK -> {
                val pos = intent.getLongExtra(EXTRA_POSITION_MS, 0L)
                handleNativeSeek(pos)
                return if (isPlayingNow) START_STICKY else START_NOT_STICKY
            }
            ACTION_NATIVE_VOLUME -> {
                val vol = intent.getFloatExtra(EXTRA_VOLUME, 0.85f).coerceIn(0f, 1f)
                currentVolume = vol
                try {
                    exoPlayer?.volume = vol
                } catch (_: Throwable) {
                }
                return if (isPlayingNow) START_STICKY else START_NOT_STICKY
            }
            ACTION_PLAY_PAUSE -> {
                if (isNativeActive) {
                    if (isNativePlaying) handleNativePause() else handleNativeResume()
                } else {
                    MainActivity.dispatchMediaAction("togglePlay")
                }
                return if (isPlayingNow) START_STICKY else START_NOT_STICKY
            }
            ACTION_NEXT -> {
                MainActivity.dispatchMediaAction("next")
                return if (isPlayingNow) START_STICKY else START_NOT_STICKY
            }
            ACTION_PREV -> {
                MainActivity.dispatchMediaAction("prev")
                return if (isPlayingNow) START_STICKY else START_NOT_STICKY
            }
            ACTION_CLEAR -> {
                handleNativeStop(true)
                return START_NOT_STICKY
            }
            ACTION_UPDATE -> {
                val title = intent.getStringExtra(EXTRA_TITLE) ?: "nys Xmusic"
                val artist = intent.getStringExtra(EXTRA_ARTIST) ?: "Xmusic"
                val album = intent.getStringExtra(EXTRA_ALBUM) ?: "nys Xmusic"
                val isPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, false)
                val durationMs = intent.getLongExtra(EXTRA_DURATION_MS, 0L)
                val positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L)
                currentTitle = title
                currentArtist = artist
                currentAlbum = album
                isPlayingNow = isPlaying
                if (durationMs > 0L) nativeDurationMs = durationMs
                if (positionMs >= 0L) nativePositionMs = positionMs
                if (isPlaying) {
                    acquireLocks()
                } else {
                    releaseLocks()
                }
                updateNotification(title, artist, album, isPlaying, durationMs, positionMs)
                return if (isPlaying) START_STICKY else START_NOT_STICKY
            }
        }
        return if (isPlayingNow) START_STICKY else START_NOT_STICKY
    }

    private fun releaseExoPlayer() {
        mainHandler.removeCallbacks(positionTicker)
        try {
            exoPlayer?.stop()
            exoPlayer?.release()
        } catch (_: Throwable) {
        }
        exoPlayer = null
    }

    private fun startNativeUrl(
        trackId: String,
        title: String,
        artist: String,
        album: String,
        url: String,
        userAgent: String,
        startMs: Long,
        volume: Float
    ) {
        releaseExoPlayer()
        currentTitle = title
        currentArtist = artist
        currentAlbum = album
        currentVolume = volume
        lastSyncedDurationMs = 0L
        nativeTrackId = trackId
        nativePositionMs = startMs.coerceAtLeast(0L)
        nativeDurationMs = 0L
        isNativeActive = true
        isNativePlaying = true
        isPlayingNow = true

        acquireLocks()
        updateNotification(title, artist, album, true, 0L, nativePositionMs)

        try {
            val headers = HashMap<String, String>()
            val effectiveUa = if (userAgent.isNotBlank()) {
                userAgent
            } else {
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
            }
            if (url.contains("googlevideo.com")) {
                headers["Origin"] = "https://www.youtube.com"
                headers["Referer"] = "https://www.youtube.com/"
            }

            val httpFactory = DefaultHttpDataSource.Factory()
                .setUserAgent(effectiveUa)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15_000)
                .setReadTimeoutMs(20_000)
                .setDefaultRequestProperties(headers)

            val audioAttrs = AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
                .build()

            val player = ExoPlayer.Builder(this)
                .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
                .setAudioAttributes(audioAttrs, false)
                .setWakeMode(C.WAKE_MODE_NETWORK)
                .build()

            player.volume = currentVolume
            player.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    val dur = if (player.duration != C.TIME_UNSET && player.duration > 0L) player.duration else nativeDurationMs
                    val pos = player.currentPosition.coerceAtLeast(0L)
                    if (dur > 0L) nativeDurationMs = dur
                    nativePositionMs = pos

                    when (playbackState) {
                        Player.STATE_READY -> {
                            lastSyncedDurationMs = nativeDurationMs
                            val playingNow = player.isPlaying || player.playWhenReady
                            isNativePlaying = playingNow
                            isPlayingNow = playingNow
                            updateNotification(currentTitle, currentArtist, currentAlbum, playingNow, nativeDurationMs, pos)
                            if (playingNow) {
                                mainHandler.removeCallbacks(positionTicker)
                                mainHandler.postDelayed(positionTicker, 500L)
                                MainActivity.dispatchMediaAction("nativePlaying")
                            }
                        }
                        Player.STATE_ENDED -> {
                            mainHandler.removeCallbacks(positionTicker)
                            isNativePlaying = false
                            isPlayingNow = false
                            nativePositionMs = nativeDurationMs
                            releaseLocks()
                            updateNotification(currentTitle, currentArtist, currentAlbum, false, nativeDurationMs, nativeDurationMs)
                            MainActivity.dispatchMediaAction("nativeEnded")
                        }
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (!isNativeActive) return
                    val pos = player.currentPosition.coerceAtLeast(0L)
                    val dur = if (player.duration != C.TIME_UNSET && player.duration > 0L) player.duration else nativeDurationMs
                    nativePositionMs = pos
                    if (dur > 0L) nativeDurationMs = dur
                    isNativePlaying = isPlaying
                    isPlayingNow = isPlaying
                    if (isPlaying) {
                        acquireLocks()
                        mainHandler.removeCallbacks(positionTicker)
                        mainHandler.postDelayed(positionTicker, 500L)
                        MainActivity.dispatchMediaAction("nativePlaying")
                    } else if (player.playbackState != Player.STATE_BUFFERING && player.playbackState != Player.STATE_ENDED) {
                        mainHandler.removeCallbacks(positionTicker)
                        releaseLocks()
                        MainActivity.dispatchMediaAction("nativePaused")
                    }
                    updateNotification(currentTitle, currentArtist, currentAlbum, isPlaying, nativeDurationMs, pos)
                }

                override fun onPlayerError(error: PlaybackException) {
                    releaseExoPlayer()
                    isNativeActive = false
                    isNativePlaying = false
                    isPlayingNow = false
                    releaseLocks()
                    updateNotification(currentTitle, currentArtist, currentAlbum, false, nativeDurationMs, nativePositionMs)
                    MainActivity.dispatchMediaAction("nativeError")
                }
            })

            exoPlayer = player
            player.setMediaItem(MediaItem.fromUri(url))
            if (startMs > 1000L) {
                player.seekTo(startMs)
            }
            player.prepare()
            player.playWhenReady = true
        } catch (_: Throwable) {
            releaseExoPlayer()
            isNativeActive = false
            isNativePlaying = false
            isPlayingNow = false
            releaseLocks()
            MainActivity.dispatchMediaAction("nativeError")
        }
    }

    private fun handleNativePause() {
        val player = exoPlayer
        if (player != null) {
            try {
                nativePositionMs = player.currentPosition.coerceAtLeast(0L)
                player.playWhenReady = false
                player.pause()
            } catch (_: Throwable) {
            }
        }
        mainHandler.removeCallbacks(positionTicker)
        isNativePlaying = false
        isPlayingNow = false
        releaseLocks()
        updateNotification(currentTitle, currentArtist, currentAlbum, false, nativeDurationMs, nativePositionMs)
        MainActivity.dispatchMediaAction("nativePaused")
    }

    private fun handleNativeResume() {
        val player = exoPlayer
        if (player != null) {
            try {
                if (player.playbackState == Player.STATE_ENDED) {
                    player.seekTo(0L)
                }
                player.volume = currentVolume
                player.playWhenReady = true
                player.play()
                isNativePlaying = true
                isPlayingNow = true
                acquireLocks()
                mainHandler.removeCallbacks(positionTicker)
                mainHandler.postDelayed(positionTicker, 500L)
                updateNotification(currentTitle, currentArtist, currentAlbum, true, nativeDurationMs, nativePositionMs)
                MainActivity.dispatchMediaAction("nativePlaying")
                return
            } catch (_: Throwable) {
            }
        }
        MainActivity.dispatchMediaAction("nativeError")
    }

    private fun handleNativeSeek(positionMs: Long) {
        val target = positionMs.coerceAtLeast(0L)
        nativePositionMs = target
        try {
            exoPlayer?.seekTo(target)
        } catch (_: Throwable) {
        }
        updateNotification(currentTitle, currentArtist, currentAlbum, isNativePlaying, nativeDurationMs, target)
    }

    private fun handleNativeStop(clearForeground: Boolean) {
        releaseExoPlayer()
        isNativeActive = false
        isNativePlaying = false
        isPlayingNow = false
        nativeTrackId = ""
        nativePositionMs = 0L
        nativeDurationMs = 0L
        lastSyncedDurationMs = 0L
        releaseLocks()
        if (clearForeground) {
            isInForeground = false
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (_: Throwable) {
            }
            stopSelf()
        }
    }

    private fun acquireLocks() {
        try {
            wakeLock?.let { if (!it.isHeld) it.acquire() }
        } catch (_: Throwable) {
        }
        try {
            wifiLock?.let { if (!it.isHeld) it.acquire() }
        } catch (_: Throwable) {
        }
    }

    private fun releaseLocks() {
        try {
            wakeLock?.let { if (it.isHeld) it.release() }
        } catch (_: Throwable) {
        }
        try {
            wifiLock?.let { if (it.isHeld) it.release() }
        } catch (_: Throwable) {
        }
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
        val safeDuration = durationMs.coerceAtLeast(0L)
        val safePos = positionMs.coerceAtLeast(0L)
        val metadata = MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, safeDuration)
            .build()
        session.setMetadata(metadata)

        val stateCode = if (isPlaying) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED
        val actions = PlaybackState.ACTION_PLAY or
            PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or
            PlaybackState.ACTION_SKIP_TO_NEXT or
            PlaybackState.ACTION_SKIP_TO_PREVIOUS or
            PlaybackState.ACTION_SEEK_TO or
            PlaybackState.ACTION_STOP
        val playbackState = PlaybackState.Builder()
            .setActions(actions)
            .setState(stateCode, safePos, if (isPlaying) 1.0f else 0.0f, SystemClock.elapsedRealtime())
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

        val nm = getSystemService(NotificationManager::class.java)
        if (!isInForeground) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }
                isInForeground = true
                return
            } catch (_: Throwable) {
                isInForeground = false
            }
        }
        nm?.notify(NOTIFICATION_ID, notification)
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
                description = "Kontrol pemutaran audio latar belakang dan layar kunci untuk nys Xmusic"
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            manager?.createNotificationChannel(channel)
        }
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        if (!isPlayingNow && !isNativePlaying) {
            handleNativeStop(true)
        }
        super.onTaskRemoved(rootIntent)
    }

    override fun onDestroy() {
        instanceRef = null
        releaseExoPlayer()
        isRunning = false
        isPlayingNow = false
        isNativeActive = false
        isNativePlaying = false
        isInForeground = false
        releaseLocks()
        if (noisyReceiverRegistered) {
            try {
                unregisterReceiver(becomingNoisyReceiver)
            } catch (_: Throwable) {
            }
            noisyReceiverRegistered = false
        }
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
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.activity.OnBackPressedCallback
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

        fun dispatchSeekAction(positionMs: Long) {
            val webView = webViewRef?.get() ?: return
            webView.post {
                webView.evaluateJavascript(
                    "window.__xmusicSeekMs && window.__xmusicSeekMs($positionMs);",
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

        // Keep music playing smoothly in background when user presses Back at root while playing
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val wv = webViewRef?.get()
                if (wv != null && wv.canGoBack()) {
                    wv.goBack()
                    return
                }
                if (XmusicMediaService.isPlayingNow || XmusicMediaService.isNativePlaying) {
                    moveTaskToBack(true)
                    return
                }
                isEnabled = false
                onBackPressedDispatcher.onBackPressed()
                isEnabled = true
            }
        })
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false)
        }
        webViewRef = WeakReference(webView)
        webView.addJavascriptInterface(AndroidMediaBridge(), "XmusicAndroidMedia")
    }

    override fun onResume() {
        super.onResume()
        val wv = webViewRef?.get()
        if (wv != null) {
            wv.post {
                try {
                    wv.onResume()
                    wv.resumeTimers()
                } catch (_: Throwable) {
                }
            }
        }
        dispatchMediaAction("appResumed")
    }

    override fun onPause() {
        super.onPause()
        keepWebViewAudioAliveIfPlaying()
    }

    override fun onStop() {
        super.onStop()
        keepWebViewAudioAliveIfPlaying()
    }

    private fun keepWebViewAudioAliveIfPlaying() {
        if (!XmusicMediaService.isPlayingNow) return
        val wv = webViewRef?.get() ?: return
        val keepAlive = Runnable {
            if (!XmusicMediaService.isPlayingNow) return@Runnable
            try {
                wv.dispatchWindowVisibilityChanged(View.VISIBLE)
                wv.onResume()
                wv.resumeTimers()
            } catch (_: Throwable) {
            }
        }
        wv.post(keepAlive)
        wv.postDelayed(keepAlive, 250L)
    }

    override fun onDestroy() {
        // NEVER kill XmusicMediaService if native Android ExoPlayer is actively playing in background!
        if (isFinishing && !isChangingConfigurations && !XmusicMediaService.isNativePlaying) {
            try {
                val intent = Intent(this, XmusicMediaService::class.java).apply {
                    action = XmusicMediaService.ACTION_CLEAR
                }
                startService(intent)
            } catch (_: Throwable) {
            }
        }
        super.onDestroy()
    }

    private fun dispatchServiceIntent(intent: Intent, requireForeground: Boolean) {
        try {
            if (XmusicMediaService.isRunning || !requireForeground) {
                startService(intent)
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(intent)
            } else {
                startService(intent)
            }
        } catch (_: Throwable) {
            try {
                startService(intent)
            } catch (_: Throwable) {
            }
        }
    }

    inner class AndroidMediaBridge {
        @JavascriptInterface
        fun playNativeUrl(
            trackId: String,
            title: String,
            artist: String,
            album: String,
            url: String,
            userAgent: String,
            startMs: Long,
            volume: Float
        ) {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_PLAY_URL
                putExtra(XmusicMediaService.EXTRA_TRACK_ID, trackId)
                putExtra(XmusicMediaService.EXTRA_TITLE, title)
                putExtra(XmusicMediaService.EXTRA_ARTIST, artist)
                putExtra(XmusicMediaService.EXTRA_ALBUM, album)
                putExtra(XmusicMediaService.EXTRA_URL, url)
                putExtra(XmusicMediaService.EXTRA_USER_AGENT, userAgent)
                putExtra(XmusicMediaService.EXTRA_POSITION_MS, startMs)
                putExtra(XmusicMediaService.EXTRA_VOLUME, volume)
            }
            dispatchServiceIntent(intent, true)
        }

        @JavascriptInterface
        fun pauseNative() {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_NATIVE_PAUSE
            }
            dispatchServiceIntent(intent, false)
        }

        @JavascriptInterface
        fun resumeNative() {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_NATIVE_RESUME
            }
            dispatchServiceIntent(intent, true)
        }

        @JavascriptInterface
        fun stopNative() {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_NATIVE_STOP
            }
            dispatchServiceIntent(intent, false)
        }

        @JavascriptInterface
        fun seekNative(positionMs: Long) {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_NATIVE_SEEK
                putExtra(XmusicMediaService.EXTRA_POSITION_MS, positionMs)
            }
            dispatchServiceIntent(intent, false)
        }

        @JavascriptInterface
        fun setNativeVolume(volume: Float) {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_NATIVE_VOLUME
                putExtra(XmusicMediaService.EXTRA_VOLUME, volume)
            }
            dispatchServiceIntent(intent, false)
        }

        @JavascriptInterface
        fun getNativeStateJson(): String {
            return XmusicMediaService.getNativeStateJson()
        }

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
            dispatchServiceIntent(intent, true)
        }

        @JavascriptInterface
        fun clearNotification() {
            val intent = Intent(this@MainActivity, XmusicMediaService::class.java).apply {
                action = XmusicMediaService.ACTION_CLEAR
            }
            dispatchServiceIntent(intent, false)
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
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
        "android.permission.WAKE_LOCK",
        "android.permission.ACCESS_WIFI_STATE",
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

    # Ensure MainActivity uses singleTask so returning from lockscreen/notification reuses the live WebView
    if "android:launchMode=" not in content:
        content = content.replace(
            'android:name=".MainActivity"',
            'android:name=".MainActivity"\n            android:launchMode="singleTask"',
            1,
        )

    service_decl = """        <service
            android:name=".XmusicMediaService"
            android:enabled="true"
            android:exported="false"
            android:stopWithTask="false"
            android:foregroundServiceType="mediaPlayback" />"""
    if "XmusicMediaService" not in content:
        content = content.replace("</application>", f"{service_decl}\n    </application>", 1)

    with open(manifest_path, "w", encoding="utf-8") as fh:
        fh.write(content)
    print("[Android Optimize] Patched AndroidManifest.xml with singleTask, Media Playback Service & Wake/Wifi permissions.")


def inject_native_media_kotlin() -> None:
    if not os.path.exists(ANDROID_DIR):
        return
    os.makedirs(KOTLIN_PKG_DIR, exist_ok=True)
    with open(os.path.join(KOTLIN_PKG_DIR, "XmusicMediaService.kt"), "w", encoding="utf-8") as fh:
        fh.write(MEDIA_SERVICE_KT)
    with open(os.path.join(KOTLIN_PKG_DIR, "MainActivity.kt"), "w", encoding="utf-8") as fh:
        fh.write(MAIN_ACTIVITY_KT)
    print("[Android Optimize] Injected native Kotlin XmusicMediaService & MainActivity background playback bridge.")


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
    if "androidx.media3:media3-exoplayer:" not in content:
        media3_deps = (
            '    implementation("androidx.media3:media3-exoplayer:1.11.1")\n'
            '    implementation("androidx.media3:media3-exoplayer-hls:1.11.1")\n'
        )
        content = re.sub(
            r"(dependencies\s*\{)",
            r"\1\n" + media3_deps,
            content,
            count=1,
        )

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
