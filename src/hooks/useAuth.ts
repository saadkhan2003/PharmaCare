import { useState, useEffect, useCallback } from 'react';
import type { SessionDto } from '../types/session';
import { tauri } from '../lib/tauri';

/**
 * React hook for session state management.
 *
 * On mount:
 * 1. Calls check_setup_status to determine if first-run setup is needed
 * 2. If setup not needed, tries to restore session from stored_token (session persists
 *    in Rust memory; frontend checks validity on app start per D-04)
 * 3. Provides login/logout functions that call Tauri commands
 *
 * Session state is held in React component state only — NOT in localStorage (D-04).
 */
export function useAuth() {
  const [session, setSession] = useState<SessionDto | null>(null);
  const [isSetupNeeded, setIsSetupNeeded] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // On mount: check setup status, then try to restore session
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        // Step 1: Check if setup is needed
        const status = await tauri.setup.checkStatus();
        if (cancelled) return;

        if (status.needs_setup) {
          setIsSetupNeeded(true);
          setLoading(false);
          return;
        }

        // Step 2: Setup not needed — check for existing session.
        // Sessions are loaded from SQLite on app startup (crash recovery, D-04).
        // Try to find a session token — since we can't store it in localStorage (D-04),
        // the session is checked on every app start via check_session.
        // For v1, we start without a session and require login.
        // Future enhancement: Tauri plugin for secure storage could persist a token hint.
        setIsSetupNeeded(false);
        setLoading(false);

        // Note: We don't try to auto-restore a session from frontend storage
        // because D-04 prohibits localStorage. Sessions in Rust memory are
        // checked on each command call via require_session guard.
      } catch (err: unknown) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to check setup status';
          setError(message);
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  /** Login with username and password. Calls tauri.auth.login(). */
  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    setLoginLoading(true);
    try {
      const result = await tauri.auth.login({ username, password });
      setSession(result);
      return result;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Invalid credentials';
      setError(message);
      throw err;
    } finally {
      setLoginLoading(false);
    }
  }, []);

  /** Logout — clears session on Rust side and local state. */
  const logout = useCallback(async () => {
    if (!session) return;
    try {
      await tauri.auth.logout(session.token);
    } catch {
      // Even if the Tauri call fails, clear local state
    }
    setSession(null);
  }, [session]);

  /** Handle setup completion — stores the auto-created session. */
  const onSetupComplete = useCallback((newSession: SessionDto) => {
    setIsSetupNeeded(false);
    setSession(newSession);
  }, []);

  return { session, isSetupNeeded, loading, error, login, logout, loginLoading, onSetupComplete };
}
