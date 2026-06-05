import { useState } from 'react';
import { LoginForm } from '../components/auth/LoginForm';
import { ForgotPasswordDialog } from '../components/auth/ForgotPasswordDialog';
import { ToastProvider } from '../components/ui/toast-provider';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
}

export function LoginPage({ onLogin, error, loading }: LoginPageProps) {
  const [forgotOpen, setForgotOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
          <LoginForm onLogin={onLogin} error={error} loading={loading} />
          <div className="mt-4 text-center">
            <button
              onClick={() => setForgotOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Forgot Password?
            </button>
          </div>
          <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
        </div>
      </div>
    </ToastProvider>
  );
}
