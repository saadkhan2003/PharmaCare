import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Lock, User, Loader2, Building2 } from 'lucide-react';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<unknown>;
  error: string | null;
  loading: boolean;
}

export function LoginForm({ onLogin, error, loading }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    await onLogin(username.trim(), password);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <div className="text-center mb-6">
        <div className="mx-auto flex aspect-square size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md mb-3">
          <Building2 className="size-6" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">PharmaCare</h1>
        <p className="text-xs text-muted-foreground mt-1">Pharmacy Management System</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="username" className="text-xs font-semibold">
          Username
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-9 h-10"
            placeholder="Enter your username"
            required
            autoFocus
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-semibold">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9 pr-10 h-10"
            placeholder="Enter your password"
            required
            minLength={6}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            tabIndex={-1}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-lg p-3 font-medium">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-sm font-semibold gap-2 shadow-sm"
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : null}
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}

