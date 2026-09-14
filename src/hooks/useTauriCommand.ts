import { useState, useCallback } from 'react';

/**
 * Generic hook wrapping a Tauri invoke call with loading/error state management.
 *
 * Returns a stable `execute` function that resets error, sets loading,
 * runs the command, and captures either data or error.
 */
export function useTauriCommand<T>() {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async (command: () => Promise<T>) => {
    setData(null); // L-1 fix: clear stale data before new request
    setError(null);
    setLoading(true);
    try {
      const result = await command();
      setData(result);
      return result;
    } catch (err: unknown) {
      let message = 'An error occurred';
      if (err instanceof Error) {
        message = err.message || message;
      } else if (typeof err === 'string') {
        message = err;
      } else if (typeof err === 'object' && err !== null) {
        const e = err as { message?: unknown; code?: unknown };
        if (typeof e.message === 'string' && e.message.length > 0) {
          message = e.message;
        } else if (typeof e.code === 'string' && e.code.length > 0) {
          message = `Error (${e.code})`;
        } else {
          try {
            message = JSON.stringify(err);
          } catch {
            message = 'An error occurred';
          }
        }
      }
      console.error('[useTauriCommand] command failed:', err);
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, execute, reset };
}
