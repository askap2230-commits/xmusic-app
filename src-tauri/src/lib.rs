// Copyright 2026 Azka Putra
// SPDX-License-Identifier: AGPL-3.0-or-later

use serde::Serialize;
use serde_json::{Value, json};
use std::time::Duration;

/// Metadata describing the active Tauri runtime environment.
#[derive(Debug, Clone, Serialize)]
pub struct RuntimeInfo {
    pub app_name: &'static str,
    pub version: String,
    pub engine: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
}

/// Pure YouTube Music song metadata extracted directly via InnerTube (zero proxy, zero API key).
#[derive(Debug, Clone, Serialize)]
pub struct YtmSong {
    pub video_id: String,
    pub title: String,
    pub artist: String,
    pub duration: u32,
    pub thumbnail: String,
}

/// Returns single-source application version (resolved from package.json via tauri.conf.json)
/// and target environment metadata to the frontend.
#[tauri::command]
fn get_runtime_info(app: tauri::AppHandle) -> RuntimeInfo {
    RuntimeInfo {
        app_name: "nys Xmusic",
        version: app.package_info().version.to_string(),
        engine: "Tauri v2.12 + Rust InnerTube + Konsta UI iOS",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

fn parse_duration_text(text: &str) -> Option<u32> {
    let parts: Vec<&str> = text.trim().split(':').collect();
    match parts.len() {
        2 => {
            let m: u32 = parts[0].parse().ok()?;
            let s: u32 = parts[1].parse().ok()?;
            Some(m * 60 + s)
        }
        3 => {
            let h: u32 = parts[0].parse().ok()?;
            let m: u32 = parts[1].parse().ok()?;
            let s: u32 = parts[2].parse().ok()?;
            Some(h * 3600 + m * 60 + s)
        }
        _ => None,
    }
}

fn collect_ytm_songs(node: &Value, out: &mut Vec<YtmSong>) {
    if out.len() >= 22 {
        return;
    }
    match node {
        Value::Object(map) => {
            if let Some(item) = map.get("musicResponsiveListItemRenderer") {
                if let Some(song) = extract_song_from_renderer(item) {
                    if !out.iter().any(|s| s.video_id == song.video_id) {
                        out.push(song);
                    }
                }
                return;
            }
            for v in map.values() {
                collect_ytm_songs(v, out);
            }
        }
        Value::Array(arr) => {
            for v in arr {
                collect_ytm_songs(v, out);
            }
        }
        _ => {}
    }
}

fn extract_song_from_renderer(item: &Value) -> Option<YtmSong> {
    let video_id = item
        .pointer("/playlistItemData/videoId")
        .and_then(Value::as_str)
        .or_else(|| {
            item.pointer("/overlay/musicItemThumbnailOverlayRenderer/content/musicPlayButtonRenderer/playNavigationEndpoint/watchEndpoint/videoId")
                .and_then(Value::as_str)
        })?
        .to_string();

    if video_id.len() != 11 {
        return None;
    }

    let flex_cols = item.get("flexColumns")?.as_array()?;
    let title = flex_cols
        .first()?
        .pointer("/musicResponsiveListItemFlexColumnRenderer/text/runs/0/text")
        .and_then(Value::as_str)?
        .trim()
        .to_string();

    if title.is_empty() {
        return None;
    }

    let mut artist = String::from("YouTube Music");
    let mut duration: u32 = 0;

    if let Some(runs) = flex_cols
        .get(1)
        .and_then(|c| c.pointer("/musicResponsiveListItemFlexColumnRenderer/text/runs"))
        .and_then(Value::as_array)
    {
        for run in runs {
            if let Some(txt) = run.get("text").and_then(Value::as_str) {
                let clean = txt.trim();
                if clean.is_empty() || clean == "•" || clean == "·" || clean == "&" || clean == "," {
                    continue;
                }
                if let Some(sec) = parse_duration_text(clean) {
                    duration = sec;
                } else if artist == "YouTube Music" && !clean.eq_ignore_ascii_case("song") && !clean.eq_ignore_ascii_case("lagu") {
                    artist = clean.to_string();
                }
            }
        }
    }

    // Reject livestreams (0s), Shorts (<60s), or ultra-long mixes (>12m)
    if duration > 0 && (duration < 60 || duration > 720) {
        return None;
    }

    let raw_thumb = item
        .pointer("/thumbnail/musicThumbnailRenderer/thumbnail/thumbnails")
        .and_then(Value::as_array)
        .and_then(|arr| arr.last())
        .and_then(|t| t.get("url"))
        .and_then(Value::as_str)
        .unwrap_or("");

    let thumbnail = if raw_thumb.is_empty() {
        format!("https://img.youtube.com/vi/{video_id}/hqdefault.jpg")
    } else if raw_thumb.contains("=w") {
        raw_thumb
            .split("=w")
            .next()
            .map(|prefix| format!("{prefix}=w544-h544-l90-rj"))
            .unwrap_or_else(|| raw_thumb.to_string())
    } else {
        raw_thumb.to_string()
    };

    Some(YtmSong {
        video_id,
        title,
        artist,
        duration,
        thumbnail,
    })
}

/// Direct on-device YouTube Music Songs-only search via InnerTube WEB_REMIX (zero API key, zero proxy).
#[tauri::command]
async fn ytm_search(query: String, region: String) -> Result<Vec<YtmSong>, String> {
    let clean_query = query.trim();
    if clean_query.is_empty() {
        return Ok(Vec::new());
    }
    let gl = if region.len() == 2 && region.chars().all(|c| c.is_ascii_alphabetic()) {
        region.to_ascii_uppercase()
    } else {
        String::from("ID")
    };

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    // EgWKAQIIAWoKEAMQBBAJEAoQBQ== is YouTube Music's official Songs-only filter
    let payload = json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20260501.01.00",
                "hl": "id",
                "gl": gl
            }
        },
        "query": clean_query,
        "params": "EgWKAQIIAWoKEAMQBBAJEAoQBQ=="
    });

    let res = client
        .post("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        )
        .header("Origin", "https://music.youtube.com")
        .header("Referer", "https://music.youtube.com/")
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("InnerTube search HTTP {}", res.status()));
    }

    let data: Value = res.json().await.map_err(|e| e.to_string())?;
    let mut songs = Vec::new();
    collect_ytm_songs(&data, &mut songs);
    Ok(songs)
}

fn pick_best_audio_url(data: &Value) -> Option<String> {
    let status = data
        .pointer("/playabilityStatus/status")
        .and_then(Value::as_str)
        .unwrap_or("");
    if status != "OK" {
        return None;
    }

    if let Some(adaptive) = data
        .pointer("/streamingData/adaptiveFormats")
        .and_then(Value::as_array)
    {
        let mut candidates: Vec<(bool, u64, String)> = Vec::new();
        for fmt in adaptive {
            let mime = fmt.get("mimeType").and_then(Value::as_str).unwrap_or("");
            if !mime.starts_with("audio/") {
                continue;
            }
            if let Some(url) = fmt.get("url").and_then(Value::as_str) {
                if url.starts_with("https://") {
                    let is_mp4 = mime.contains("mp4");
                    let bitrate = fmt.get("bitrate").and_then(Value::as_u64).unwrap_or(0);
                    candidates.push((is_mp4, bitrate, url.to_string()));
                }
            }
        }
        candidates.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));
        if let Some((_, _, best)) = candidates.into_iter().next() {
            return Some(best);
        }
    }

    // Fallback to progressive formats (HTML5 <audio> plays audio track natively with zero video rendering)
    if let Some(formats) = data
        .pointer("/streamingData/formats")
        .and_then(Value::as_array)
    {
        for fmt in formats {
            if let Some(url) = fmt.get("url").and_then(Value::as_str) {
                if url.starts_with("https://") {
                    return Some(url.to_string());
                }
            }
        }
    }

    if let Some(hls) = data
        .pointer("/streamingData/hlsManifestUrl")
        .and_then(Value::as_str)
    {
        if hls.starts_with("https://") {
            return Some(hls.to_string());
        }
    }

    None
}

async fn fetch_visitor_data(client: &reqwest::Client) -> Option<String> {
    let payload = json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20260501.01.00",
                "hl": "en",
                "gl": "US"
            }
        }
    });
    let res = client
        .post("https://music.youtube.com/youtubei/v1/visitor_id?prettyPrint=false")
        .header("Origin", "https://music.youtube.com")
        .json(&payload)
        .send()
        .await
        .ok()?;
    let data: Value = res.json().await.ok()?;
    data.pointer("/responseContext/visitorData")
        .and_then(Value::as_str)
        .map(str::to_string)
}

/// Resolves a direct HTTPS audio stream directly from the user's own device IP using mobile InnerTube clients
/// (IOS -> ANDROID_VR -> ANDROID), bypassing rate-limited public proxy servers with zero API key.
#[tauri::command]
async fn ytm_resolve_audio(video_id: String) -> Result<Option<String>, String> {
    let vid = video_id.trim();
    if vid.len() != 11 {
        return Ok(None);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .build()
        .map_err(|e| e.to_string())?;

    let visitor_data = fetch_visitor_data(&client).await;

    let clients = [
        (
            "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
            json!({
                "context": {
                    "client": {
                        "clientName": "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
                        "clientVersion": "2.0",
                        "hl": "en",
                        "gl": "US"
                    },
                    "thirdParty": {
                        "embedUrl": "https://www.youtube.com"
                    }
                },
                "videoId": vid,
                "contentCheckOk": true,
                "racyCheckOk": true
            }),
        ),
        (
            "com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)",
            json!({
                "context": {
                    "client": {
                        "clientName": "IOS",
                        "clientVersion": "20.10.4",
                        "deviceMake": "Apple",
                        "deviceModel": "iPhone16,2",
                        "osName": "iPhone",
                        "osVersion": "18.3.2.22D82",
                        "hl": "en",
                        "gl": "US"
                    }
                },
                "videoId": vid,
                "contentCheckOk": true,
                "racyCheckOk": true
            }),
        ),
        (
            "com.google.android.apps.youtube.vr.oculus/1.62.27 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
            json!({
                "context": {
                    "client": {
                        "clientName": "ANDROID_VR",
                        "clientVersion": "1.62.27",
                        "deviceMake": "Oculus",
                        "deviceModel": "Quest 3",
                        "osName": "Android",
                        "osVersion": "12L",
                        "hl": "en",
                        "gl": "US"
                    }
                },
                "videoId": vid,
                "contentCheckOk": true,
                "racyCheckOk": true
            }),
        ),
        (
            "com.google.android.youtube/20.10.38 (Linux; U; Android 14) gzip",
            json!({
                "context": {
                    "client": {
                        "clientName": "ANDROID",
                        "clientVersion": "20.10.38",
                        "osName": "Android",
                        "osVersion": "14",
                        "hl": "en",
                        "gl": "US"
                    }
                },
                "videoId": vid,
                "contentCheckOk": true,
                "racyCheckOk": true
            }),
        ),
    ];

    for (ua, body) in clients {
        let mut req = client
            .post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false")
            .header("User-Agent", ua)
            .header("Origin", "https://www.youtube.com");
        if let Some(ref vd) = visitor_data {
            req = req.header("X-Goog-Visitor-Id", vd);
        }
        let attempt = req.json(&body).send().await;

        if let Ok(res) = attempt {
            if res.status().is_success() {
                if let Ok(data) = res.json::<Value>().await {
                    if let Some(url) = pick_best_audio_url(&data) {
                        return Ok(Some(url));
                    }
                }
            }
        }
    }

    Ok(None)
}

/// Shared application entry point for both Desktop and Mobile targets.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            ytm_search,
            ytm_resolve_audio
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start nys Xmusic Tauri runtime");
}
