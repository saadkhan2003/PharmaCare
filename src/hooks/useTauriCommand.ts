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
    setError(null);
    setLoading(true);
    try {
      const result = await command();
      setData(result);
      return result;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : typeof err === 'string' ? err : 'An error occurred';
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
