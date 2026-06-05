import { invoke } from '@tauri-apps/api/core';
import type { SessionDto, SetupStatus } from '../types/session';
import type { UserDto, CreateUserDto, LoginAttemptDto } from '../types/user';
import type { LoginDto } from '../types/session';

// SessionInfo returned by check_session — matches Rust SessionInfo struct
export interface SessionInfo {
  user_id: number;
  username: string;
  role: 'owner' | 'pharmacist';
  full_name: string;
}

// Payload for creating the initial owner (matches Rust CreateOwnerPayload)
export interface CreateOwnerDto {
  full_name: string;
  username: string;
  password: string;
}

/** Typed wrappers for all Tauri commands.
 *
 * Each method encapsulates invoke() with correct types,
 * so callers don't need to specify the generic parameter.
 */
export const tauri = {
  auth: {
    login: (payload: LoginDto) =>
      invoke<SessionDto>('auth_login', { payload }),
    logout: (sessionToken: string) =>
      invoke<void>('auth_logout', { sessionToken }),
    checkSession: (sessionToken: string) =>
      invoke<SessionInfo>('check_session', { sessionToken }),
  },
  setup: {
    checkStatus: () =>
      invoke<SetupStatus>('check_setup_status'),
    createOwner: (payload: CreateOwnerDto) =>
      invoke<SessionDto>('create_initial_owner', { payload }),
  },
  users: {
    list: (sessionToken: string) =>
      invoke<UserDto[]>('list_users', { sessionToken }),
    create: (sessionToken: string, payload: CreateUserDto) =>
      invoke<UserDto>('create_user', { sessionToken, payload }),
    deactivate: (sessionToken: string, targetUserId: number) =>
      invoke<void>('deactivate_user', { sessionToken, targetUserId }),
  },
  audit: {
    getLoginAttempts: (sessionToken: string) =>
      invoke<LoginAttemptDto[]>('get_login_attempts', { sessionToken }),
  },
};
