use bcrypt::{hash, verify, DEFAULT_COST};
use rusqlite::Connection;

use crate::errors::CommandError;
use crate::models::{CreateUserDto, UserDto};
use crate::repository::user_repo;

/// Creates a new user account with validated password and bcrypt hashing.
///
/// Validation:
/// - Password must be at least 6 characters (D-06)
/// - Username uniqueness enforced by SQL UNIQUE constraint
pub fn create_user(
    db: &Connection,
    payload: &CreateUserDto,
) -> Result<UserDto, CommandError> {
    // Validate password minimum length (D-06)
    if payload.password.len() < 6 {
        return Err(CommandError::validation(
            "Password must be at least 6 characters",
        ));
    }

    // Validate role is one of the allowed values (D-12)
    if payload.role != "owner" && payload.role != "pharmacist" {
        return Err(CommandError::validation(
            "Role must be 'owner' or 'pharmacist'",
        ));
    }

    // Hash password with bcrypt (cost = DEFAULT_COST = 12)
    let password_hash = hash(&payload.password, DEFAULT_COST).map_err(|e| {
        CommandError::internal(&format!("Failed to hash password: {}", e))
    })?;

    // Insert user — username UNIQUE constraint catches duplicates
    let result = user_repo::insert(
        db,
        &payload.full_name,
        &payload.username,
        &password_hash,
        &payload.role,
    );

    match result {
        Ok(user_dto) => Ok(user_dto),
        Err(e) => {
            // Check for UNIQUE constraint violation on username
            if let rusqlite::Error::SqliteFailure(err, _) = &e {
                if err.code == rusqlite::ErrorCode::ConstraintViolation {
                    return Err(CommandError::validation(
                        "Username already exists",
                    ));
                }
            }
            Err(CommandError::from(e))
        }
    }
}

/// Deactivates a user by setting is_active = 0.
///
/// Business rules (D-11, USER-03, USER-04):
/// - Cannot deactivate your own account
/// - Cannot deactivate if it would leave 0 active owner accounts
pub fn deactivate_user(
    db: &Connection,
    target_user_id: i64,
    current_user_id: i64,
) -> Result<(), CommandError> {
    // R1: Cannot deactivate your own account (D-11, USER-03)
    if target_user_id == current_user_id {
        return Err(CommandError::validation(
            "Cannot deactivate your own account",
        ));
    }

    // Look up the target user to check if they're an owner
    let target_user = user_repo::find_by_id(db, target_user_id)?
        .ok_or_else(|| CommandError::not_found("User"))?;

    // R2: If deactivating an owner, ensure at least one active owner remains (USER-04)
    if target_user.role == "owner" && target_user.is_active {
        let active_owners = user_repo::count_active_owners(db)?;
        // The target user is included in COUNT, so if count is 1, deactivation
        // would leave 0 active owners
        if active_owners <= 1 {
            return Err(CommandError::validation(
                "Cannot deactivate the last active owner account",
            ));
        }
    }

    // Perform the deactivation
    let updated = user_repo::deactivate(db, target_user_id)?;
    if !updated {
        return Err(CommandError::not_found("User"));
    }

    Ok(())
}

/// Lists all users (active and inactive).
pub fn list_users(db: &Connection) -> Result<Vec<UserDto>, CommandError> {
    let users = user_repo::list_all(db)?;
    Ok(users)
}

/// Changes the current user's password.
/// Verifies current_password, hashes new_password (bcrypt cost 12), updates DB.
/// Minimum 6 char validation on new_password.
pub fn change_password(
    db: &Connection,
    user_id: i64,
    current_password: &str,
    new_password: &str,
) -> Result<(), CommandError> {
    // Validate new password minimum length (D-06)
    if new_password.len() < 6 {
        return Err(CommandError::validation(
            "New password must be at least 6 characters",
        ));
    }

    // Get stored password hash
    let stored_hash = user_repo::get_password_hash(db, user_id)?
        .ok_or_else(|| CommandError::not_found("User"))?;

    // Verify current password
    let is_valid = verify(current_password, &stored_hash)
        .map_err(|e| CommandError::internal(&format!("Failed to verify password: {}", e)))?;

    if !is_valid {
        return Err(CommandError::validation("Current password is incorrect"));
    }

    // Hash new password
    let new_hash = hash(new_password, DEFAULT_COST)
        .map_err(|e| CommandError::internal(&format!("Failed to hash password: {}", e)))?;

    // Update in database
    user_repo::update_password_hash(db, user_id, &new_hash)?;

    Ok(())
}
