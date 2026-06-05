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

impl SmtpConfig {
    pub fn from_env() -> Option<Self> {
        let host = env::var("SMTP_HOST").ok()?;
        let port = env::var("SMTP_PORT").ok()?.parse().ok()?;
        let username = env::var("SMTP_USERNAME").ok()?;
        let password = env::var("SMTP_PASSWORD").ok()?;
        let from_email = env::var("SMTP_FROM_EMAIL").unwrap_or_else(|_| username.clone());
        let from_name = env::var("SMTP_FROM_NAME").unwrap_or_else(|_| "PharmaCare".to_string());
        let secure = env::var("SMTP_SECURE").ok().and_then(|s| s.parse().ok()).unwrap_or(true);

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
        
        let builder = if self.secure {
            SmtpTransport::relay(&self.host)?
                .port(self.port)
                .credentials(creds)
        } else {
            SmtpTransport::builder_dangerous(&self.host)
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
