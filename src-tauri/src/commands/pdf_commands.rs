use std::path::PathBuf;

use tauri::State;

use crate::errors::CommandError;
use crate::guards::require_session;
use crate::state::AppState;

/// Saves raw PDF bytes to a path chosen by the user via a native save dialog.
/// Returns the chosen path on success, or `None` if the user cancelled.
#[tauri::command]
pub fn save_pdf(
    state: State<'_, AppState>,
    session_token: String,
    file_name: String,
    bytes: Vec<u8>,
) -> Result<Option<String>, CommandError> {
    let _session = require_session(&state, &session_token)?;

    if bytes.is_empty() {
        return Err(CommandError::validation("PDF bytes are empty"));
    }
    if !bytes.starts_with(b"%PDF-") {
        return Err(CommandError::validation("Data does not look like a PDF"));
    }

    let default_name = sanitize_filename(&file_name);

    let chosen: Option<PathBuf> = rfd::FileDialog::new()
        .set_title("Save PDF")
        .set_file_name(&default_name)
        .add_filter("PDF document", &["pdf"])
        .save_file();

    let Some(path) = chosen else {
        return Ok(None);
    };

    std::fs::write(&path, &bytes)
        .map_err(|e| CommandError::internal(&format!("Failed to write PDF: {}", e)))?;

    Ok(Some(path.to_string_lossy().to_string()))
}

/// Strips characters that are unsafe in file names across Windows / macOS / Linux.
fn sanitize_filename(name: &str) -> String {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return "report.pdf".to_string();
    }
    let cleaned: String = trimmed
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => '_',
            c => c,
        })
        .collect();
    if cleaned.to_lowercase().ends_with(".pdf") {
        cleaned
    } else {
        format!("{}.pdf", cleaned)
    }
}
