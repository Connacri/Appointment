use serde::Deserialize;
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

use crate::credential_vault;
use crate::winhttp::{HttpResponse, WinHttpTransport};

pub const DEFAULT_SUPABASE_URL: &str = "https://vkmgakmujipnpjlawjqm.supabase.co";
pub const DEFAULT_SUPABASE_PUBLISHABLE_KEY: &str = "sb_publishable_yIVkxXo_x--f6FWt5zua1w_GzqI5XNv";

pub struct AuthSession {
    pub user_id: String,
    pub email: Option<String>,
    pub access_token: String,
    pub expires_at: u64,
}
impl AuthSession {
    pub fn is_expiring(&self, now_unix: u64, skew_seconds: u64) -> bool {
        self.expires_at <= now_unix.saturating_add(skew_seconds)
    }
}
pub enum AuthOutcome {
    Authenticated {
        user_id: String,
        email: Option<String>,
    },
    EmailConfirmationRequired {
        user_id: Option<String>,
    },
}

pub struct SupabaseAuthClient {
    transport: WinHttpTransport,
    project_scope: String,
    publishable_key: String,
    session: Option<AuthSession>,
}
impl SupabaseAuthClient {
    pub fn new(base_url: &str, publishable_key: &str) -> Result<Self, String> {
        if publishable_key.trim().is_empty()
            || publishable_key.contains('\r')
            || publishable_key.contains('\n')
        {
            return Err("A Supabase publishable key is required.".into());
        }
        let transport = WinHttpTransport::new(base_url)?;
        let project_scope = transport.project_scope();
        Ok(Self {
            transport,
            project_scope,
            publishable_key: publishable_key.trim().to_string(),
            session: None,
        })
    }
    pub fn from_environment() -> Result<Self, String> {
        let custom_url = std::env::var("APPOINTMENT_SUPABASE_URL").ok();
        let custom_key = std::env::var("APPOINTMENT_SUPABASE_PUBLISHABLE_KEY").ok();
        let (url, key) = match (custom_url, custom_key) {
            (Some(url), Some(key)) => (url, key),
            (Some(_), None) => return Err(
                "APPOINTMENT_SUPABASE_URL requires its matching APPOINTMENT_SUPABASE_PUBLISHABLE_KEY.".into()
            ),
            (None, Some(key)) => (DEFAULT_SUPABASE_URL.to_string(), key),
            (None, None) => (DEFAULT_SUPABASE_URL.to_string(), DEFAULT_SUPABASE_PUBLISHABLE_KEY.to_string()),
        };
        Self::new(&url, &key)
    }
    pub fn session(&self) -> Option<&AuthSession> {
        self.session.as_ref()
    }

    pub fn sign_in(&mut self, email: &str, password: &str) -> Result<AuthOutcome, String> {
        let email = validate_email(email)?;
        validate_password(password)?;
        let body = json!({ "email": email, "password": password });
        let response = self.post("/auth/v1/token?grant_type=password", &body, None)?;
        self.install_token_response(response, None)
    }
    pub fn sign_up(&mut self, email: &str, password: &str) -> Result<AuthOutcome, String> {
        let email = validate_email(email)?;
        validate_password(password)?;
        let body = json!({ "email": email, "password": password });
        let response = self.post("/auth/v1/signup", &body, None)?;
        self.install_token_response(response, None)
    }
    pub fn restore_session(&mut self) -> Result<Option<&AuthSession>, String> {
        let Some(user_id) = credential_vault::read_active_user_id(&self.project_scope)? else {
            self.session = None;
            return Ok(None);
        };
        let Some(refresh_token) =
            credential_vault::read_refresh_token(&self.project_scope, &user_id)?
        else {
            credential_vault::delete_active_user_id(&self.project_scope)?;
            self.session = None;
            return Ok(None);
        };
        let body = json!({ "refresh_token": refresh_token });
        let response = self.post("/auth/v1/token?grant_type=refresh_token", &body, None)?;
        match self.install_token_response(response, Some(&user_id))? {
            AuthOutcome::Authenticated { .. } => Ok(self.session.as_ref()),
            AuthOutcome::EmailConfirmationRequired { .. } => {
                Err("Supabase refresh returned no authenticated session.".into())
            }
        }
    }
    pub fn refresh_if_expiring(&mut self, now_unix: u64) -> Result<bool, String> {
        let should_refresh = self
            .session
            .as_ref()
            .map(|session| session.is_expiring(now_unix, 60))
            .unwrap_or(false);
        if !should_refresh {
            return Ok(false);
        }
        let user_id = self
            .session
            .as_ref()
            .map(|session| session.user_id.clone())
            .ok_or_else(|| "No authenticated session is available.".to_string())?;
        let refresh_token = credential_vault::read_refresh_token(&self.project_scope, &user_id)?
            .ok_or_else(|| "The active Supabase refresh token is missing.".to_string())?;
        let body = json!({ "refresh_token": refresh_token });
        let response = self.post("/auth/v1/token?grant_type=refresh_token", &body, None)?;
        match self.install_token_response(response, Some(&user_id))? {
            AuthOutcome::Authenticated { .. } => Ok(true),
            AuthOutcome::EmailConfirmationRequired { .. } => {
                Err("Supabase refresh returned no authenticated session.".into())
            }
        }
    }
    pub fn sign_out(&mut self) -> Result<(), String> {
        let user_id = match self.session.as_ref() {
            Some(session) => Some(session.user_id.clone()),
            None => credential_vault::read_active_user_id(&self.project_scope)?,
        };
        let remote_result = if let Some(session) = self.session.as_ref() {
            self.post_empty("/auth/v1/logout", Some(&session.access_token))
                .map(|_| ())
        } else {
            Ok(())
        };
        let local_result = (|| -> Result<(), String> {
            if let Some(id) = user_id {
                credential_vault::delete_refresh_token(&self.project_scope, &id)?;
            }
            credential_vault::delete_active_user_id(&self.project_scope)?;
            Ok(())
        })();
        self.session = None;
        remote_result.and(local_result)
    }

    fn install_token_response(
        &mut self,
        response: HttpResponse,
        expected_user_id: Option<&str>,
    ) -> Result<AuthOutcome, String> {
        let payload: TokenResponse = parse_response(response)?;
        let Some(access_token) = payload.access_token else {
            // Confirmation-only signup must not discard an existing authenticated session.
            return Ok(AuthOutcome::EmailConfirmationRequired {
                user_id: payload.user.map(|user| user.id),
            });
        };
        let refresh_token = payload.refresh_token.ok_or_else(|| {
            "Supabase returned an access token without a refresh token.".to_string()
        })?;
        let user = payload
            .user
            .ok_or_else(|| "Supabase returned tokens without an authenticated user.".to_string())?;
        let user_id = normalize_user_id(&user.id)?;
        if let Some(expected) = expected_user_id {
            if normalize_user_id(expected)? != user_id {
                return Err("Supabase refresh returned a different user identity; session was not replaced.".into());
            }
        }
        let expires_in = payload.expires_in.unwrap_or(3600).min(31_536_000);
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|_| "System clock is before the Unix epoch.".to_string())?
            .as_secs();
        let expires_at = payload
            .expires_at
            .unwrap_or_else(|| now.saturating_add(expires_in));
        credential_vault::store_refresh_token(&self.project_scope, &user_id, &refresh_token)?;
        credential_vault::store_active_user_id(&self.project_scope, &user_id)?;
        let session = AuthSession {
            user_id,
            email: user.email,
            access_token,
            expires_at,
        };
        let outcome = AuthOutcome::Authenticated {
            user_id: session.user_id.clone(),
            email: session.email.clone(),
        };
        self.session = Some(session);
        Ok(outcome)
    }
    fn post(
        &self,
        path: &str,
        body: &serde_json::Value,
        bearer: Option<&str>,
    ) -> Result<HttpResponse, String> {
        let bytes = serde_json::to_vec(body)
            .map_err(|error| format!("Could not serialize Supabase request: {error}"))?;
        let response = self
            .transport
            .post(path, &self.publishable_key, bearer, &bytes)?;
        ensure_success(response)
    }
    fn post_empty(&self, path: &str, bearer: Option<&str>) -> Result<HttpResponse, String> {
        ensure_success(
            self.transport
                .post(path, &self.publishable_key, bearer, b"{}")?,
        )
    }
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    expires_in: Option<u64>,
    expires_at: Option<u64>,
    user: Option<UserResponse>,
}
#[derive(Deserialize)]
struct UserResponse {
    id: String,
    email: Option<String>,
}
#[derive(Deserialize)]
struct ErrorResponse {
    message: Option<String>,
    error_description: Option<String>,
    msg: Option<String>,
    error: Option<String>,
}
fn ensure_success(response: HttpResponse) -> Result<HttpResponse, String> {
    if (200..300).contains(&response.status) {
        return Ok(response);
    }
    let detail = serde_json::from_slice::<ErrorResponse>(&response.body)
        .ok()
        .and_then(|e| e.message.or(e.error_description).or(e.msg).or(e.error))
        .unwrap_or_else(|| format!("HTTP {}", response.status));
    Err(format!("Supabase authentication failed: {detail}"))
}
fn parse_response(response: HttpResponse) -> Result<TokenResponse, String> {
    serde_json::from_slice(&ensure_success(response)?.body)
        .map_err(|_| "Supabase returned an invalid authentication response.".into())
}
fn validate_email(email: &str) -> Result<&str, String> {
    let email = email.trim();
    if email.is_empty()
        || email.len() > 254
        || !email.contains('@')
        || email.contains('\r')
        || email.contains('\n')
    {
        return Err("A valid email address is required.".into());
    }
    Ok(email)
}
fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 || password.len() > 1024 {
        return Err("Password must contain between 8 and 1024 bytes.".into());
    }
    Ok(())
}
fn normalize_user_id(user_id: &str) -> Result<String, String> {
    Uuid::parse_str(user_id)
        .map(|id| id.hyphenated().to_string())
        .map_err(|_| "Supabase returned an invalid user UUID.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn credentials_are_validated_before_network_access() {
        assert!(validate_email(" user@example.com ").is_ok());
        assert!(validate_email("invalid").is_err());
        assert!(validate_password("12345678").is_ok());
        assert!(validate_password("short").is_err());
    }
    #[test]
    fn session_expiry_uses_a_refresh_skew() {
        let session = AuthSession {
            user_id: "a1b2c3d4-e5f6-47a8-9012-1234567890ab".into(),
            email: None,
            access_token: "ephemeral".into(),
            expires_at: 1000,
        };
        assert!(session.is_expiring(950, 60));
        assert!(!session.is_expiring(900, 60));
    }
    #[test]
    fn error_response_prefers_supabase_message_without_echoing_request_data() {
        let response = HttpResponse {
            status: 400,
            body: br#"{"message":"Invalid login credentials"}"#.to_vec(),
        };
        assert_eq!(
            ensure_success(response).unwrap_err(),
            "Supabase authentication failed: Invalid login credentials"
        );
    }
    #[test]
    fn token_response_requires_a_valid_user_uuid() {
        assert!(normalize_user_id("not-a-uuid").is_err());
        assert_eq!(
            normalize_user_id("A1B2C3D4-E5F6-47A8-9012-1234567890AB").unwrap(),
            "a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        );
    }
}
