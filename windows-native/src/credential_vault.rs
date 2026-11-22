use std::ffi::c_void;
use std::ptr::null_mut;

use uuid::Uuid;

const CRED_TYPE_GENERIC: u32 = 1;
const CRED_PERSIST_LOCAL_MACHINE: u32 = 2;
const ERROR_NOT_FOUND: u32 = 1168;
const CRED_MAX_CREDENTIAL_BLOB_SIZE: usize = 5 * 512;
const TARGET_PREFIX: &str = "Connacri/Appointment/Supabase/refresh-token";

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

/// Stores the Supabase refresh token in the current Windows user's Credential Manager.
///
/// The account UUID is part of the credential target, so multiple Appointment accounts
/// on the same Windows profile do not overwrite each other's refresh tokens.
pub fn store_refresh_token(user_id: &str, refresh_token: &str) -> Result<(), String> {
    let target_name = credential_target(user_id)?;
    let token_bytes = validate_refresh_token(refresh_token)?;
    let target_name_wide = wide(&target_name);

    let credential = CredentialW {
        flags: 0,
        credential_type: CRED_TYPE_GENERIC,
        target_name: target_name_wide.as_ptr() as *mut u16,
        comment: null_mut(),
        last_written: FileTime::default(),
        credential_blob_size: token_bytes.len() as u32,
        credential_blob: token_bytes.as_ptr() as *mut u8,
        persist: CRED_PERSIST_LOCAL_MACHINE,
        attribute_count: 0,
        attributes: null_mut(),
        target_alias: null_mut(),
        user_name: null_mut(),
    };

    let written = unsafe { CredWriteW(&credential, 0) };
    if written == 0 {
        return Err(format!(
            "Windows Credential Manager could not store the refresh token (Win32 error {}).",
            unsafe { GetLastError() }
        ));
    }
    Ok(())
}

/// Reads a refresh token for one authenticated Supabase user.
///
/// Ok(None) means that no credential has been stored for this account.
pub fn read_refresh_token(user_id: &str) -> Result<Option<String>, String> {
    let target_name = credential_target(user_id)?;
    let target_name_wide = wide(&target_name);
    let mut raw_credential: *mut CredentialW = null_mut();

    let read = unsafe {
        CredReadW(
            target_name_wide.as_ptr(),
            CRED_TYPE_GENERIC,
            0,
            &mut raw_credential,
        )
    };

    if read == 0 {
        let error = unsafe { GetLastError() };
        if error == ERROR_NOT_FOUND {
            return Ok(None);
        }
        return Err(format!(
            "Windows Credential Manager could not read the refresh token (Win32 error {error})."
        ));
    }

    if raw_credential.is_null() {
        return Err("Windows Credential Manager returned an empty credential pointer.".into());
    }
    let _guard = CredentialGuard(raw_credential);

    let credential = unsafe { &*raw_credential };
    let blob_size = credential.credential_blob_size as usize;
    if blob_size == 0 || blob_size > CRED_MAX_CREDENTIAL_BLOB_SIZE {
        return Err("Stored refresh token has an invalid Credential Manager blob size.".into());
    }
    if credential.credential_blob.is_null() {
        return Err("Stored refresh token has no credential blob.".into());
    }

    let bytes = unsafe { std::slice::from_raw_parts(credential.credential_blob, blob_size) };
    let token = std::str::from_utf8(bytes)
        .map_err(|_| "Stored refresh token is not valid UTF-8.".to_string())?;
    validate_refresh_token(token)?;
    Ok(Some(token.to_owned()))
}

/// Deletes one account's refresh token. Deleting a missing token is idempotent.
pub fn delete_refresh_token(user_id: &str) -> Result<(), String> {
    let target_name = credential_target(user_id)?;
    let target_name_wide = wide(&target_name);
    let deleted = unsafe { CredDeleteW(target_name_wide.as_ptr(), CRED_TYPE_GENERIC, 0) };

    if deleted != 0 {
        return Ok(());
    }

    let error = unsafe { GetLastError() };
    if error == ERROR_NOT_FOUND {
        return Ok(());
    }
    Err(format!(
        "Windows Credential Manager could not delete the refresh token (Win32 error {error})."
    ))
}

fn credential_target(user_id: &str) -> Result<String, String> {
    let user_id = Uuid::parse_str(user_id).map_err(|_| {
        "A valid Supabase auth user UUID is required for credential storage.".to_string()
    })?;
    Ok(format!("{TARGET_PREFIX}/{}", user_id.hyphenated()))
}

fn validate_refresh_token(refresh_token: &str) -> Result<&[u8], String> {
    let bytes = refresh_token.as_bytes();
    if bytes.is_empty() {
        return Err("The Supabase refresh token cannot be empty.".into());
    }
    if bytes.len() > CRED_MAX_CREDENTIAL_BLOB_SIZE {
        return Err(format!(
            "The Supabase refresh token exceeds the Windows Credential Manager limit of {CRED_MAX_CREDENTIAL_BLOB_SIZE} bytes."
        ));
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
    fn credential_target_is_scoped_and_normalized_by_user_uuid() {
        let target = credential_target(USER_ID).unwrap();
        assert_eq!(
            target,
            "Connacri/Appointment/Supabase/refresh-token/a1b2c3d4-e5f6-47a8-9012-1234567890ab"
        );
    }

    #[test]
    fn credential_target_rejects_non_uuid_user_ids() {
        assert!(credential_target("not-a-user-id").is_err());
        assert!(credential_target("").is_err());
    }

    #[test]
    fn refresh_token_obeys_windows_credential_blob_limit() {
        assert!(validate_refresh_token("refresh-token").is_ok());
        assert!(validate_refresh_token("").is_err());

        let oversized = "x".repeat(CRED_MAX_CREDENTIAL_BLOB_SIZE + 1);
        assert!(validate_refresh_token(&oversized).is_err());
        assert!(validate_refresh_token(&"x".repeat(CRED_MAX_CREDENTIAL_BLOB_SIZE)).is_ok());
    }
}
