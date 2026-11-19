use serde::Serialize;

/// Metadata describing the active Tauri runtime environment.
#[derive(Debug, Clone, Serialize)]
pub struct RuntimeInfo {
    pub app_name: &'static str,
    pub version: &'static str,
    pub engine: &'static str,
    pub platform: &'static str,
    pub arch: &'static str,
}

/// Returns compile-time and target environment metadata to the frontend.
#[tauri::command]
fn get_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        app_name: "nys Xmusic",
        version: env!("CARGO_PKG_VERSION"),
        engine: "Tauri v2.12 + SvelteKit 3.2 (Svelte 5 Runes)",
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
    }
}

/// Shared application entry point for both Desktop and Mobile targets.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_runtime_info])
        .run(tauri::generate_context!())
        .expect("Failed to start nys Xmusic Tauri runtime");
}
