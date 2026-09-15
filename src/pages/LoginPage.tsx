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
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
        <div className="bg-card/95 backdrop-blur rounded-2xl shadow-xl p-8 w-full max-w-md border border-border/70">
          <LoginForm onLogin={onLogin} error={error} loading={loading} />
          <div className="mt-5 text-center">
            <button
              onClick={() => setForgotOpen(true)}
              className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors font-medium"
            >
              Forgot Password or Recovery Code?
            </button>
          </div>
          <ForgotPasswordDialog open={forgotOpen} onClose={() => setForgotOpen(false)} />
        </div>
      </div>
    </ToastProvider>
  );
}
