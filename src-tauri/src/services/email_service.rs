use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};
use rand::Rng;
use std::env;

#[derive(Clone)]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_email: String,
    pub from_name: String,
    pub secure: bool,
}

fn get_env_or_compile_time(var_name: &str, compile_val: Option<&'static str>) -> Option<String> {
    let raw = if let Ok(v) = env::var(var_name) {
        if !v.trim().is_empty() {
            Some(v)
        } else {
            None
        }
    } else {
        None
    };
    let val = raw.or_else(|| compile_val.map(|s| s.to_string()))?;
    let trimmed = val.trim().trim_matches('"').trim_matches('\'').trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

impl SmtpConfig {
    pub fn from_env() -> Option<Self> {
        let host = get_env_or_compile_time("SMTP_HOST", option_env!("SMTP_HOST"))?;
        let port_str = get_env_or_compile_time("SMTP_PORT", option_env!("SMTP_PORT"))?;
        let port: u16 = port_str.parse().ok()?;
        let username = get_env_or_compile_time("SMTP_USERNAME", option_env!("SMTP_USERNAME"))?;
        let password = get_env_or_compile_time("SMTP_PASSWORD", option_env!("SMTP_PASSWORD"))?;
        let from_email = get_env_or_compile_time("SMTP_FROM_EMAIL", option_env!("SMTP_FROM_EMAIL"))
            .unwrap_or_else(|| username.clone());
        let from_name = get_env_or_compile_time("SMTP_FROM_NAME", option_env!("SMTP_FROM_NAME"))
            .unwrap_or_else(|| "PharmaCare".to_string());
        let secure = get_env_or_compile_time("SMTP_SECURE", option_env!("SMTP_SECURE"))
            .and_then(|s| s.parse().ok())
            .unwrap_or(true);

        Some(Self {
            host,
            port,
            username,
            password,
            from_email,
            from_name,
            secure,
        })
    }

    pub fn create_transport(&self) -> Result<SmtpTransport, lettre::transport::smtp::Error> {
        let creds = Credentials::new(self.username.clone(), self.password.clone());
        
        let builder = if !self.secure {
            SmtpTransport::builder_dangerous(&self.host)
                .port(self.port)
                .credentials(creds)
        } else if self.port == 465 {
            SmtpTransport::relay(&self.host)?
                .port(self.port)
                .credentials(creds)
        } else {
            SmtpTransport::starttls_relay(&self.host)?
                .port(self.port)
                .credentials(creds)
        };

        Ok(builder.build())
    }
}

pub fn generate_otp() -> String {
    let mut rng = rand::thread_rng();
    format!("{:06}", rng.gen_range(100000..=999999))
}

pub fn send_otp_email(
    config: &SmtpConfig,
    to_email: &str,
    otp: &str,
    recipient_name: &str,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let transport = config.create_transport()?;
    
    let email = Message::builder()
        .from(format!("{} <{}>", config.from_name, config.from_email).parse()?)
        .to(to_email.parse()?)
        .subject("Your PharmaCare Password Reset Code")
        .body(format!(
            r#"Dear {recipient_name},

Your password reset code is: {otp}

This code will expire in 15 minutes.

If you didn't request this, please ignore this email.

Regards,
{from_name} Team
"#,
            recipient_name = recipient_name,
            otp = otp,
            from_name = config.from_name
        ))?;

    transport.send(&email)?;
    Ok(())
}
