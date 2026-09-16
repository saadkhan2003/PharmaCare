use lettre::message::{MultiPart, SinglePart};
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

        Ok(builder.timeout(Some(std::time::Duration::from_secs(10))).build())
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

    let plain_body = format!(
        "Hello {recipient_name},\n\nYour PharmaCare password reset verification code is: {otp}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this, please ignore this email.\n\nRegards,\n{from_name} Team",
        recipient_name = recipient_name,
        otp = otp,
        from_name = config.from_name
    );

    let html_body = render_otp_email_html(recipient_name, otp, &config.from_name);

    let email = Message::builder()
        .from(format!("{} <{}>", config.from_name, config.from_email).parse()?)
        .to(to_email.parse()?)
        .subject(format!("{} - Your Password Reset Code", config.from_name))
        .multipart(
            MultiPart::alternative()
                .singlepart(SinglePart::plain(plain_body))
                .singlepart(SinglePart::html(html_body)),
        )?;

    transport.send(&email)?;
    Ok(())
}

fn render_otp_email_html(recipient_name: &str, otp: &str, from_name: &str) -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);">
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 36px 20px; border-bottom: 1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <!-- Icon + Name Lockup -->
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width: 40px; height: 40px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 10px; text-align: center; vertical-align: middle;">
                          <span style="font-size: 20px; line-height: 40px; color: #ffffff; font-weight: bold;">&#x271A;</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 19px; font-weight: 700; color: #0f172a; letter-spacing: -0.3px;">PharmaCare</div>
                          <div style="font-size: 11px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 0.8px;">Account Security</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 36px 32px;">
              <h1 style="margin: 0 0 14px; font-size: 18px; font-weight: 600; color: #0f172a; letter-spacing: -0.2px;">
                Password Reset Verification
              </h1>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 22px; color: #475569;">
                Hello <strong>{recipient_name}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 22px; color: #475569;">
                We received a request to reset the password for your PharmaCare owner account. Use the one-time verification code below to authorize this change:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px;">
                <tr>
                  <td align="center" style="padding: 22px 16px;">
                    <div style="font-size: 11px; font-weight: 600; color: #059669; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 8px;">
                      Your One-Time Code
                    </div>
                    <div style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 800; color: #065f46; letter-spacing: 8px; line-height: 1.2;">
                      {otp}
                    </div>
                    <div style="margin-top: 10px; font-size: 12px; color: #047857; font-weight: 500;">
                      &#x23F1; Expires in 15 minutes &bull; Single-use only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Advice Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <tr>
                  <td style="padding: 12px 14px;">
                    <p style="margin: 0; font-size: 12px; line-height: 18px; color: #64748b;">
                      <strong>Security Tip:</strong> Never share this code with anyone. PharmaCare will never ask for your recovery code or password.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 13px; line-height: 20px; color: #64748b;">
                If you did not initiate this request, someone may have entered your username by mistake. Your account remains secure and no action is required.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 18px 36px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 12px; font-weight: 600; color: #475569;">
                {from_name} &bull; Pharmacy Management System
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #94a3b8;">
                This is an automated security transmission. Please do not reply directly to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"#,
        recipient_name = recipient_name,
        otp = otp,
        from_name = from_name
    )
}
