import { LoginForm } from '../components/auth/LoginForm';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
}

/**
 * Login page — renders the LoginForm centered on screen with branding.
 */
export function LoginPage({ onLogin, error, loading }: LoginPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <LoginForm onLogin={onLogin} error={error} loading={loading} />
      </div>
    </div>
  );
}
