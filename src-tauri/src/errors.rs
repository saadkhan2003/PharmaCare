use serde::Serialize;

/// Structured error returned from Tauri commands to the frontend.
///
/// Implements `From` conversions for common error types so that
/// service code can use the `?` operator for error propagation.
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
}

// -- Standard error codes used across commands --

impl CommandError {
    pub fn unauthorized() -> Self {
        CommandError {
            code: "UNAUTHORIZED".into(),
            message: "Invalid or expired session".into(),
        }
    }

    pub fn forbidden() -> Self {
        CommandError {
            code: "FORBIDDEN".into(),
            message: "Insufficient permissions".into(),
        }
    }

    pub fn not_found(resource: &str) -> Self {
        CommandError {
            code: "NOT_FOUND".into(),
            message: format!("{} not found", resource),
        }
    }

    pub fn validation(msg: &str) -> Self {
        CommandError {
            code: "VALIDATION".into(),
            message: msg.into(),
        }
    }

    pub fn internal(msg: &str) -> Self {
        CommandError {
            code: "INTERNAL".into(),
            message: msg.into(),
        }
    }
}

// Note: Tauri 2.0 provides a blanket `From<T: Serialize>` impl for InvokeError,
// so no explicit From<CommandError> conversion is needed.
// Command handlers return `Result<T, CommandError>` and Tauri serializes
// the error automatically via the Serialize derive.

// -- From impls for ? operator in services/commands --

impl From<rusqlite::Error> for CommandError {
    fn from(e: rusqlite::Error) -> Self {
        CommandError {
            code: "DATABASE".into(),
            message: format!("Database error: {}", e),
        }
    }
}

impl<T> From<std::sync::PoisonError<T>> for CommandError {
    fn from(e: std::sync::PoisonError<T>) -> Self {
        CommandError {
            code: "INTERNAL".into(),
            message: format!("Lock poisoned: {}", e),
        }
    }
}

impl From<Box<dyn std::error::Error>> for CommandError {
    fn from(e: Box<dyn std::error::Error>) -> Self {
        CommandError {
            code: "INTERNAL".into(),
            message: format!("Internal error: {}", e),
        }
    }
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError {
            code: "IO".into(),
            message: format!("IO error: {}", e),
        }
    }
}

impl From<reqwest::Error> for CommandError {
    fn from(e: reqwest::Error) -> Self {
        CommandError {
            code: "HTTP".into(),
            message: format!("HTTP request error: {}", e),
        }
    }
}
