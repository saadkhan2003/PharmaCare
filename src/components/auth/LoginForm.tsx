import { useState, type FormEvent } from 'react';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
}

export function LoginForm({ onLogin, error, loading }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await onLogin(username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">PharmaCare</h1>
        <p className="text-sm text-muted-foreground mt-1">Pharmacy Management System</p>
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-foreground mb-1">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-background text-foreground placeholder:text-muted-foreground"
          placeholder="Enter your username"
          required
          autoFocus
          disabled={loading}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-background text-foreground placeholder:text-muted-foreground"
          placeholder="Enter your password"
          required
          minLength={6}
          disabled={loading}
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2 px-4 bg-blue-600 text-white font-medium text-sm rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
