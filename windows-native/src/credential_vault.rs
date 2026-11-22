use std::ffi::c_void;
use std::ptr::null_mut;
use uuid::Uuid;

const CRED_TYPE_GENERIC: u32 = 1;
const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;
const ERROR_NOT_FOUND: u32 = 1168;
const CRED_MAX_CREDENTIAL_BLOB_SIZE: usize = 5 * 512;
const TARGET_PREFIX: &str = "Connacri/Appointment/Supabase/refresh-token";
const ACTIVE_USER_PREFIX: &str = "Connacri/Appointment/Supabase/active-user-id";

#[repr(C)]
#[derive(Default)]
struct FileTime {
    low_date_time: u32,
    high_date_time: u32,
}

#[repr(C)]
struct CredentialW {
    flags: u32,
    credential_type: u32,
    target_name: *mut u16,
    comment: *mut u16,
    last_written: FileTime,
    credential_blob_size: u32,
    credential_blob: *mut u8,
    persist: u32,
    attribute_count: u32,
    attributes: *mut c_void,
    target_alias: *mut u16,
    user_name: *mut u16,
}

#[link(name = "Advapi32")]
unsafe extern "system" {
    fn CredWriteW(credential: *const CredentialW, flags: u32) -> i32;
    fn CredReadW(
        target_name: *const u16,
        credential_type: u32,
        flags: u32,
        credential: *mut *mut CredentialW,
    ) -> i32;
    fn CredDeleteW(target_name: *const u16, credential_type: u32, flags: u32) -> i32;
    fn CredFree(buffer: *mut c_void);
}
#[link(name = "Kernel32")]
unsafe extern "system" {
    fn GetLastError() -> u32;
}

struct CredentialGuard(*mut CredentialW);
impl Drop for CredentialGuard {
    fn drop(&mut self) {
        unsafe { CredFree(self.0.cast()) };
    }
}

pub fn store_refresh_token(
    project_scope: &str,
    user_id: &str,
    refresh_token: &str,
) -> Result<(), String> {
    let target = credential_target(project_scope, user_id)?;
    write_credential(
        &target,
        validate_blob(refresh_token.as_bytes(), "refresh token")?,
    )
}
pub fn read_refresh_token(project_scope: &str, user_id: &str) -> Result<Option<String>, String> {
    let target = credential_target(project_scope, user_id)?;
    let Some(bytes) = read_credential(&target)? else {
        return Ok(None);
    };
    let token = String::from_utf8(bytes)
        .map_err(|_| "Stored refresh token is not valid UTF-8.".to_string())?;
    validate_blob(token.as_bytes(), "refresh token")?;
    Ok(Some(token))
}
pub fn delete_refresh_token(project_scope: &str, user_id: &str) -> Result<(), String> {
    delete_credential(&credential_target(project_scope, user_id)?)
}

/// Stores only the non-secret UUID of the account selected for session restoration.
pub fn store_active_user_id(project_scope: &str, user_id: &str) -> Result<(), String> {
    let normalized = normalize_user_id(user_id)?;
    write_credential(&active_user_target(project_scope)?, normalized.as_bytes())
}
pub fn read_active_user_id(project_scope: &str) -> Result<Option<String>, String> {
    let target = active_user_target(project_scope)?;
    let Some(bytes) = read_credential(&target)? else {
        return Ok(None);
    };
    let value = String::from_utf8(bytes)
        .map_err(|_| "Stored active Supabase user id is not valid UTF-8.".to_string())?;
    normalize_user_id(&value).map(Some)
}
pub fn delete_active_user_id(project_scope: &str) -> Result<(), String> {
    delete_credential(&active_user_target(project_scope)?)
}

fn write_credential(target: &str, bytes: &[u8]) -> Result<(), String> {
    validate_blob(bytes, "credential")?;
    let target_wide = wide(target);
    let credential = CredentialW {
        flags: 0,
        credential_type: CRED_TYPE_GENERIC,
        target_name: target_wide.as_ptr() as *mut u16,
        comment: null_mut(),
        last_written: FileTime::default(),
        credential_blob_size: bytes.len() as u32,
        credential_blob: bytes.as_ptr() as *mut u8,
        persist: CRED_PERSIST_LOCAL_MACHINE,
        attribute_count: 0,
        attributes: null_mut(),
        target_alias: null_mut(),
        user_name: null_mut(),
    };
    if unsafe { CredWriteW(&credential, 0) } == 0 {
        return Err(format!(
            "Windows Credential Manager could not store the credential (Win32 error {}).",
            unsafe { GetLastError() }
        ));
    }
    Ok(())
}
fn read_credential(target: &str) -> Result<Option<Vec<u8>>, String> {
    let target_wide = wide(target);
    let mut raw: *mut CredentialW = null_mut();
    if unsafe { CredReadW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0, &mut raw) } == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_NOT_FOUND {
            return Ok(None);
        }
        return Err(format!(
            "Windows Credential Manager could not read the credential (Win32 error {error})."
        ));
    }
    if raw.is_null() {
        return Err("Windows Credential Manager returned an empty credential pointer.".into());
    }
    let _guard = CredentialGuard(raw);
    let credential = unsafe { &*raw };
    let size = credential.credential_blob_size as usize;
    if size == 0 || size > CRED_MAX_CREDENTIAL_BLOB_SIZE {
        return Err("Stored credential has an invalid Credential Manager blob size.".into());
    }
    if credential.credential_blob.is_null() {
        return Err("Stored credential has no credential blob.".into());
    }
    let bytes = unsafe { std::slice::from_raw_parts(credential.credential_blob, size) };
    Ok(Some(bytes.to_vec()))
}
fn delete_credential(target: &str) -> Result<(), String> {
    let target_wide = wide(target);
    if unsafe { CredDeleteW(target_wide.as_ptr(), CRED_TYPE_GENERIC, 0) } != 0 {
        return Ok(());
    }
    let error = unsafe { GetLastError() };
    if error == ERROR_NOT_FOUND {
        return Ok(());
    }
    Err(format!(
        "Windows Credential Manager could not delete the credential (Win32 error {error})."
    ))
}
fn credential_target(project_scope: &str, user_id: &str) -> Result<String, String> {
    validate_project_scope(project_scope)?;
    Ok(format!(
        "{TARGET_PREFIX}/{project_scope}/{}",
        normalize_user_id(user_id)?
    ))
}
fn active_user_target(project_scope: &str) -> Result<String, String> {
    validate_project_scope(project_scope)?;
    Ok(format!("{ACTIVE_USER_PREFIX}/{project_scope}"))
}
fn validate_project_scope(project_scope: &str) -> Result<(), String> {
    if project_scope.len() != 16
        || !project_scope
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
    {
        return Err("A normalized 16-character Supabase project scope is required.".into());
    }
    Ok(())
}
fn normalize_user_id(user_id: &str) -> Result<String, String> {
    Uuid::parse_str(user_id)
        .map(|id| id.hyphenated().to_string())
        .map_err(|_| "A valid Supabase auth user UUID is required for credential storage.".into())
}
fn validate_blob<'a>(bytes: &'a [u8], label: &str) -> Result<&'a [u8], String> {
    if bytes.is_empty() {
        return Err(format!("The {label} cannot be empty."));
    }
    if bytes.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE {
        return Err(format!("The {label} exceeds the Windows Credential Manager limit of {CRED_MAX_CREDENTIAL_BLOB_SIZE} bytes."));
    }
    Ok(bytes)
}
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(std::iter::once(0)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    const USER_ID: &str = "A1B2C3D4-E5F6-47A8-9012-1234567890AB";
    #[test]
    fn credential_target_is_scoped_by_project_and_user_uuid() {
        assert_eq!(
            credential_target("0123456789abcdef", USER_ID).unwrap(),
            "Connacri/Appointment/Supabase/refresh-token/0123456789abcdef/a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        );
        assert_ne!(
            credential_target("fedcba9876543210", USER_ID).unwrap(),
            credential_target("0123456789abcdef", USER_ID).unwrap()
        );
    }
    #[test]
    fn project_scope_must_be_normalized_hex() {
        assert!(validate_project_scope("0123456789abcdef").is_ok());
        assert!(validate_project_scope("not-a-project").is_err());
        assert!(validate_project_scope("ABCDEF0123456789").is_err());
    }
    #[test]
    fn active_user_id_is_normalized_without_exposing_a_secret() {
        assert_eq!(
            normalize_user_id(USER_ID).unwrap(),
            "a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        );
        assert!(normalize_user_id("not-a-user-id").is_err());
    }
    #[test]
    fn credential_blob_obeys_windows_size_limit() {
        assert!(validate_blob(b"refresh-token", "refresh token").is_ok());
        assert!(validate_blob(b"", "refresh token").is_err());
        assert!(validate_blob(
            &vec![b'x'; CRED_MAX_CREDENTIAL_BLOB_SIZE + 1],
            "refresh token"
        )
        .is_err());
        assert!(validate_blob(&vec![b'x'; CRED_MAX_CREDENTIAL_BLOB_SIZE], "refresh token").is_ok());
    }
}
