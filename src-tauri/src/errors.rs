use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("{code}: {message}")]
    App { code: String, message: String },
    #[error("{code}: {message}")]
    Http { code: String, message: String },
    #[error("{code}: {message}")]
    Unavailable { code: String, message: String },
    #[error("{code}: {message}")]
    Forbidden { code: String, message: String },
    #[error("io error: {source}")]
    Io { source: std::io::Error },
}

impl AppError {
    pub fn code(&self) -> &str {
        match self {
            AppError::App { code, .. }
            | AppError::Http { code, .. }
            | AppError::Unavailable { code, .. }
            | AppError::Forbidden { code, .. } => code,
            AppError::Io { .. } => "io_error",
        }
    }

    pub fn message(&self) -> &str {
        match self {
            AppError::App { message, .. }
            | AppError::Http { message, .. }
            | AppError::Unavailable { message, .. }
            | AppError::Forbidden { message, .. } => message,
            AppError::Io { .. } => "Operation impossible.",
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io { source: error }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", &self.code())?;
        map.serialize_entry("message", &self.message())?;
        map.end()
    }
}

impl<'de> serde::Deserialize<'de> for AppError {
    fn deserialize<D: serde::Deserializer<'de>>(
        deserializer: D,
    ) -> std::result::Result<Self, D::Error> {
        #[derive(serde::Deserialize)]
        struct Raw {
            code: String,
            message: String,
        }

        let raw: Raw = serde::Deserialize::deserialize(deserializer)?;
        Ok(AppError::App {
            code: raw.code,
            message: raw.message,
        })
    }
}

impl From<ssh_key::Error> for AppError {
    fn from(error: ssh_key::Error) -> Self {
        AppError::App {
            code: "ssh_key_error".to_string(),
            message: error.to_string(),
        }
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

pub fn app_error(code: &str, message: impl Into<String>) -> AppError {
    AppError::App {
        code: code.to_string(),
        message: message.into(),
    }
}

pub fn http_error(code: &str, message: impl Into<String>) -> AppError {
    AppError::Http {
        code: code.to_string(),
        message: message.into(),
    }
}

pub fn unavailable_error(message: impl Into<String>) -> AppError {
    AppError::Unavailable {
        code: "service_unavailable".to_string(),
        message: message.into(),
    }
}

pub fn forbidden_error(message: impl Into<String>) -> AppError {
    AppError::Forbidden {
        code: "forbidden".to_string(),
        message: message.into(),
    }
}
