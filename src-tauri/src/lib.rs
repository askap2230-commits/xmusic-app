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
        engine: "Tauri v2.12 + Rust Native HTTP/InnerTube + Konsta UI iOS",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

fn is_allowed_music_host(url: &str) -> bool {
    if !url.starts_with("https://") {
        return false;
    }
    let rest = &url["https://".len()..];
    let host = rest.split('/').next().unwrap_or("").to_ascii_lowercase();
    let host_no_port = host.split(':').next().unwrap_or("");
    let allowed_suffixes = [
        "audius.co",
        "itunes.apple.com",
        "api.deezer.com",
        "archive.org",
        "lrclib.net",
        "piped.yt",
        "kavin.rocks",
        "adminforge.de",
        "privacy.com.de",
        "leptons.xyz",
        "invidious.io",
        "googleapis.com",
        "open.spotify.com",
        "youtube.com",
    ];
    allowed_suffixes
        .iter()
        .any(|s| host_no_port == *s || host_no_port.ends_with(&format!(".{s}")))
        || host_no_port.contains("audius")
        || host_no_port.contains("piped")
        || host_no_port.contains("invidious")
}

/// Zero-CORS native HTTPS JSON fetcher for public music APIs (Audius, Deezer, iTunes, Archive.org, LRCLIB).
/// Eliminates Android WebView CORS/origin failures and enforces a strict 5-second timeout.
#[tauri::command]
async fn http_get_json(url: String) -> Result<Value, String> {
    let clean = url.trim();
    if !is_allowed_music_host(clean) {
        return Err(String::from("Blocked non-allowlisted URL"));
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Mobile Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .get(clean)
        .header("Accept", "application/json, text/plain, */*")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    res.json::<Value>().await.map_err(|e| e.to_string())
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

fn collect_video_renderers(node: &Value, out: &mut Vec<YtmSong>) {
    if out.len() >= 20 {
        return;
    }
    match node {
        Value::Object(map) => {
            if let Some(item) = map.get("videoRenderer") {
                if let Some(song) = extract_song_from_video_renderer(item) {
                    if !out.iter().any(|s| s.video_id == song.video_id) {
                        out.push(song);
                    }
                }
                return;
            }
            for v in map.values() {
                collect_video_renderers(v, out);
            }
        }
        Value::Array(arr) => {
            for v in arr {
                collect_video_renderers(v, out);
            }
        }
        _ => {}
    }
}

fn extract_song_from_video_renderer(item: &Value) -> Option<YtmSong> {
    let video_id = item.get("videoId").and_then(Value::as_str)?.to_string();
    if video_id.len() != 11 {
        return None;
    }
    let title = item
        .pointer("/title/runs/0/text")
        .and_then(Value::as_str)
        .or_else(|| item.pointer("/title/simpleText").and_then(Value::as_str))?
        .trim()
        .to_string();
    if title.is_empty() {
        return None;
    }
    let length_txt = item
        .pointer("/lengthText/simpleText")
        .and_then(Value::as_str)
        .unwrap_or("");
    let duration = parse_duration_text(length_txt).unwrap_or(0);
    // Reject livestreams (0s), Shorts (<60s), or ultra-long mixes (>12m)
    if duration < 60 || duration > 720 {
        return None;
    }
    let artist = item
        .pointer("/ownerText/runs/0/text")
        .and_then(Value::as_str)
        .or_else(|| item.pointer("/longBylineText/runs/0/text").and_then(Value::as_str))
        .unwrap_or("YouTube Music")
        .trim()
        .trim_end_matches(" - Topic")
        .to_string();
    let thumbnail = format!("https://img.youtube.com/vi/{video_id}/hqdefault.jpg");
    Some(YtmSong {
        video_id,
        title,
        artist,
        duration,
        thumbnail,
    })
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

fn url_encode_query(input: &str) -> String {
    let mut out = String::with_capacity(input.len() * 2);
    for b in input.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

/// 3-Layer direct on-device YouTube Music search (zero API key, zero proxy):
/// 1. InnerTube WEB_REMIX Songs-only (`music.youtube.com`)
/// 2. InnerTube WEB (`www.youtube.com`) with strict 60s-720s song filter
/// 3. Direct HTML `ytInitialData` extraction (immune to InnerTube clientVersion changes)
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
        .timeout(Duration::from_secs(5))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    // Layer 1: YouTube Music WEB_REMIX (Songs-only filter)
    let ytm_payload = json!({
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20261101.01.00",
                "hl": "id",
                "gl": gl
            }
        },
        "query": clean_query,
        "params": "EgWKAQIIAWoKEAMQBBAJEAoQBQ=="
    });

    if let Ok(res) = client
        .post("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Origin", "https://music.youtube.com")
        .header("Referer", "https://music.youtube.com/")
        .header("X-YouTube-Client-Name", "67")
        .header("X-YouTube-Client-Version", "1.20261101.01.00")
        .json(&ytm_payload)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(data) = res.json::<Value>().await {
                let mut songs = Vec::new();
                collect_ytm_songs(&data, &mut songs);
                if !songs.is_empty() {
                    return Ok(songs);
                }
            }
        }
    }

    // Layer 2: Standard YouTube WEB InnerTube search ("<query> official audio")
    let web_payload = json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20261101.01.00",
                "hl": "id",
                "gl": gl
            }
        },
        "query": format!("{clean_query} official audio")
    });

    if let Ok(res) = client
        .post("https://www.youtube.com/youtubei/v1/search?prettyPrint=false")
        .header("Origin", "https://www.youtube.com")
        .header("Referer", "https://www.youtube.com/")
        .json(&web_payload)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(data) = res.json::<Value>().await {
                let mut songs = Vec::new();
                collect_video_renderers(&data, &mut songs);
                if !songs.is_empty() {
                    return Ok(songs);
                }
            }
        }
    }

    // Layer 3: Direct HTML ytInitialData extraction (immune to clientVersion changes)
    let encoded = url_encode_query(&format!("{clean_query} official audio"));
    let html_url = format!("https://www.youtube.com/results?search_query={encoded}");
    if let Ok(res) = client
        .get(&html_url)
        .header("Accept-Language", "id-ID,id;q=0.9,en;q=0.8")
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(html) = res.text().await {
                let marker = "var ytInitialData = ";
                if let Some(start) = html.find(marker) {
                    let after = &html[start + marker.len()..];
                    if let Some(end) = after.find(";</script>") {
                        if let Ok(data) = serde_json::from_str::<Value>(&after[..end]) {
                            let mut songs = Vec::new();
                            collect_video_renderers(&data, &mut songs);
                            if !songs.is_empty() {
                                return Ok(songs);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(Vec::new())
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
                "clientVersion": "1.20261101.01.00",
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

/// Resolves a direct HTTPS audio stream directly from the user's own device IP using mobile InnerTube clients.
#[tauri::command]
async fn ytm_resolve_audio(video_id: String) -> Result<Option<String>, String> {
    let vid = video_id.trim();
    if vid.len() != 11 {
        return Ok(None);
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
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
            http_get_json,
            ytm_search,
            ytm_resolve_audio
        ])
        .run(tauri::generate_context!())
        .expect("Failed to start nys Xmusic Tauri runtime");
}
