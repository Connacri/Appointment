use std::ffi::c_void;
use std::ptr::{null, null_mut};

const WINHTTP_ACCESS_TYPE_DEFAULT_PROXY: u32 = 0;
const WINHTTP_FLAG_SECURE: u32 = 0x0080_0000;
const WINHTTP_QUERY_STATUS_CODE: u32 = 19;
const WINHTTP_QUERY_FLAG_NUMBER: u32 = 0x2000_0000;
const MAX_RESPONSE_BYTES: usize = 1024 * 1024;
type HInternet = *mut c_void;

#[link(name = "winhttp")]
unsafe extern "system" {
    fn WinHttpOpen(
        user_agent: *const u16,
        access_type: u32,
        proxy_name: *const u16,
        proxy_bypass: *const u16,
        flags: u32,
    ) -> HInternet;
    fn WinHttpConnect(
        session: HInternet,
        server_name: *const u16,
        server_port: u16,
        reserved: u32,
    ) -> HInternet;
    fn WinHttpOpenRequest(
        connect: HInternet,
        verb: *const u16,
        object_name: *const u16,
        version: *const u16,
        referrer: *const u16,
        accept_types: *const *const u16,
        flags: u32,
    ) -> HInternet;
    fn WinHttpSendRequest(
        request: HInternet,
        headers: *const u16,
        headers_length: u32,
        optional: *const c_void,
        optional_length: u32,
        total_length: u32,
        context: usize,
    ) -> i32;
    fn WinHttpReceiveResponse(request: HInternet, reserved: *mut c_void) -> i32;
    fn WinHttpQueryHeaders(
        request: HInternet,
        info_level: u32,
        name: *const u16,
        buffer: *mut c_void,
        buffer_length: *mut u32,
        index: *mut u32,
    ) -> i32;
    fn WinHttpQueryDataAvailable(request: HInternet, available: *mut u32) -> i32;
    fn WinHttpReadData(
        request: HInternet,
        buffer: *mut c_void,
        bytes_to_read: u32,
        bytes_read: *mut u32,
    ) -> i32;
    fn WinHttpCloseHandle(handle: HInternet) -> i32;
    fn WinHttpSetTimeouts(
        handle: HInternet,
        resolve_timeout: i32,
        connect_timeout: i32,
        send_timeout: i32,
        receive_timeout: i32,
    ) -> i32;
}
#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetLastError() -> u32;
}

struct Handle(HInternet);
impl Handle {
    fn new(raw: HInternet, label: &str) -> Result<Self, String> {
        if raw.is_null() {
            return Err(format!("{label} failed (Win32 error {}).", unsafe {
                GetLastError()
            }));
        }
        Ok(Self(raw))
    }
}
impl Drop for Handle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { WinHttpCloseHandle(self.0) };
        }
    }
}

#[derive(Debug, Clone)]
pub struct HttpsEndpoint {
    host: String,
    port: u16,
    base_path: String,
}
impl HttpsEndpoint {
    pub fn parse(base_url: &str) -> Result<Self, String> {
        let remainder = base_url
            .trim()
            .strip_prefix("https://")
            .ok_or_else(|| "Supabase URL must use HTTPS.".to_string())?;
        if remainder.contains('?') || remainder.contains('#') || remainder.contains('@') {
            return Err(
                "Supabase URL must not contain credentials, query parameters or fragments.".into(),
            );
        }
        let (authority, path) = match remainder.split_once('/') {
            Some((authority, path)) => (authority, format!("/{path}")),
            None => (remainder, String::new()),
        };
        if authority.is_empty() || authority.contains(' ') {
            return Err("Supabase URL has an invalid host.".into());
        }
        let (host, port) = match authority.rsplit_once(':') {
            Some((host, port)) if !host.contains(':') => {
                let port = port
                    .parse::<u16>()
                    .map_err(|_| "Supabase URL has an invalid port.".to_string())?;
                (host, port)
            }
            _ => (authority, 443),
        };
        if host.is_empty()
            || !host.is_ascii()
            || host
                .bytes()
                .any(|b| !(b.is_ascii_alphanumeric() || b == b'.' || b == b'-'))
        {
            return Err("Supabase URL host must be a valid ASCII DNS name.".into());
        }
        if port == 0 {
            return Err("Supabase URL port must be between 1 and 65535.".into());
        }
        if path.contains('\\') || path.split('/').any(|part| part == "." || part == "..") {
            return Err("Supabase URL contains an invalid base path.".into());
        }
        Ok(Self {
            host: host.to_ascii_lowercase(),
            port,
            base_path: path.trim_end_matches('/').to_string(),
        })
    }
    fn request_path(&self, path: &str) -> Result<String, String> {
        if !path.starts_with('/')
            || path.starts_with("//")
            || path.contains('\r')
            || path.contains('\n')
        {
            return Err("Invalid Supabase API request path.".into());
        }
        Ok(format!("{}{path}", self.base_path))
    }
}

#[derive(Debug)]
pub struct HttpResponse {
    pub status: u32,
    pub body: Vec<u8>,
}
pub struct WinHttpTransport {
    endpoint: HttpsEndpoint,
}
impl WinHttpTransport {
    pub fn new(base_url: &str) -> Result<Self, String> {
        Ok(Self {
            endpoint: HttpsEndpoint::parse(base_url)?,
        })
    }
    pub fn post(
        &self,
        path: &str,
        api_key: &str,
        bearer_token: Option<&str>,
        body: &[u8],
    ) -> Result<HttpResponse, String> {
        if api_key.is_empty() || api_key.contains('\r') || api_key.contains('\n') {
            return Err("Supabase publishable key is missing or invalid.".into());
        }
        if let Some(token) = bearer_token {
            if token.is_empty() || token.contains('\r') || token.contains('\n') {
                return Err("Supabase access token is invalid.".into());
            }
        }
        if body.len() > u32::MAX as usize {
            return Err("Supabase request body is too large.".into());
        }

        let object_name = self.endpoint.request_path(path)?;
        let user_agent = wide("Appointment PMS Native/1.2");
        let host = wide(&self.endpoint.host);
        let verb = wide("POST");
        let object_name = wide(&object_name);
        let mut header_text = format!(
            "Content-Type: application/json\r\nAccept: application/json\r\napikey: {api_key}\r\n"
        );
        if let Some(token) = bearer_token {
            header_text.push_str(&format!("Authorization: Bearer {token}\r\n"));
        }
        let headers = wide(&header_text);

        unsafe {
            let session = Handle::new(
                WinHttpOpen(
                    user_agent.as_ptr(),
                    WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
                    null(),
                    null(),
                    0,
                ),
                "WinHttpOpen",
            )?;
            if WinHttpSetTimeouts(session.0, 10_000, 10_000, 20_000, 30_000) == 0 {
                return Err(format!(
                    "WinHttpSetTimeouts failed (Win32 error {}).",
                    GetLastError()
                ));
            }
            let connect = Handle::new(
                WinHttpConnect(session.0, host.as_ptr(), self.endpoint.port, 0),
                "WinHttpConnect",
            )?;
            let request = Handle::new(
                WinHttpOpenRequest(
                    connect.0,
                    verb.as_ptr(),
                    object_name.as_ptr(),
                    null(),
                    null(),
                    null(),
                    WINHTTP_FLAG_SECURE,
                ),
                "WinHttpOpenRequest",
            )?;
            let optional = if body.is_empty() {
                null()
            } else {
                body.as_ptr().cast()
            };
            if WinHttpSendRequest(
                request.0,
                headers.as_ptr(),
                (headers.len() - 1) as u32,
                optional,
                body.len() as u32,
                body.len() as u32,
                0,
            ) == 0
            {
                return Err(format!(
                    "WinHttpSendRequest failed (Win32 error {}).",
                    GetLastError()
                ));
            }
            if WinHttpReceiveResponse(request.0, null_mut()) == 0 {
                return Err(format!(
                    "WinHttpReceiveResponse failed (Win32 error {}).",
                    GetLastError()
                ));
            }
            let mut status = 0u32;
            let mut status_size = std::mem::size_of::<u32>() as u32;
            if WinHttpQueryHeaders(
                request.0,
                WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER,
                null(),
                (&mut status as *mut u32).cast(),
                &mut status_size,
                null_mut(),
            ) == 0
            {
                return Err(format!(
                    "WinHttpQueryHeaders failed (Win32 error {}).",
                    GetLastError()
                ));
            }
            let mut response = Vec::new();
            loop {
                let mut available = 0u32;
                if WinHttpQueryDataAvailable(request.0, &mut available) == 0 {
                    return Err(format!(
                        "WinHttpQueryDataAvailable failed (Win32 error {}).",
                        GetLastError()
                    ));
                }
                if available == 0 {
                    break;
                }
                let remaining = MAX_RESPONSE_BYTES.saturating_sub(response.len());
                if remaining == 0 {
                    return Err("Supabase response exceeds the 1 MiB safety limit.".into());
                }
                let capacity = (available as usize).min(remaining);
                let start = response.len();
                response.resize(start + capacity, 0);
                let mut bytes_read = 0u32;
                if WinHttpReadData(
                    request.0,
                    response[start..].as_mut_ptr().cast(),
                    capacity as u32,
                    &mut bytes_read,
                ) == 0
                {
                    return Err(format!(
                        "WinHttpReadData failed (Win32 error {}).",
                        GetLastError()
                    ));
                }
                response.truncate(start + bytes_read as usize);
                if bytes_read == 0 {
                    break;
                }
            }
            Ok(HttpResponse {
                status,
                body: response,
            })
        }
    }
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn endpoint_requires_https_and_rejects_url_credentials() {
        assert!(HttpsEndpoint::parse("http://project.supabase.co").is_err());
        assert!(HttpsEndpoint::parse("https://user:pass@project.supabase.co").is_err());
        assert!(HttpsEndpoint::parse("https://project.supabase.co/?apikey=x").is_err());
        assert!(HttpsEndpoint::parse("https://project.supabase.co").is_ok());
    }
    #[test]
    fn endpoint_parses_custom_port_and_base_path() {
        let endpoint = HttpsEndpoint::parse("https://localhost:8443/supabase").unwrap();
        assert_eq!(endpoint.host, "localhost");
        assert_eq!(endpoint.port, 8443);
        assert_eq!(
            endpoint.request_path("/auth/v1/token").unwrap(),
            "/supabase/auth/v1/token"
        );
    }
    #[test]
    fn endpoint_rejects_path_traversal_and_invalid_ports() {
        assert!(HttpsEndpoint::parse("https://project.supabase.co/../admin").is_err());
        assert!(HttpsEndpoint::parse("https://project.supabase.co:0").is_err());
        assert!(HttpsEndpoint::parse("https://project.supabase.co:bad").is_err());
    }
}
