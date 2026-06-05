import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { DashboardPage } from './pages/DashboardPage';
import { tauri } from './lib/tauri';
import type { CreateOwnerDto } from './lib/tauri';
import { useState, useCallback } from 'react';
import { useTauriCommand } from './hooks/useTauriCommand';
import './App.css';

function App() {
  const { session, isSetupNeeded, loading, error, login, logout, loginLoading, onSetupComplete } = useAuth();
  const { execute: createOwner, loading: setupLoading } = useTauriCommand<import('./types/session').SessionDto>();
  const [setupErrorState, setSetupError] = useState<string | null>(null);

  const handleCreateOwner = useCallback(async (payload: CreateOwnerDto) => {
    setSetupError(null);
    try {
      const result = await createOwner(() => tauri.setup.createOwner(payload));
      if (result) {
        onSetupComplete(result);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to create owner account';
      setSetupError(message);
    }
  }, [createOwner, onSetupComplete]);

  // Loading state: checking setup status
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Setup wizard: shown on first launch (0 users)
  if (isSetupNeeded) {
    return (
      <SetupWizardPage
        onComplete={handleCreateOwner}
        error={setupErrorState}
        loading={setupLoading}
      />
    );
  }

  // Not authenticated: show login screen
  if (!session) {
    return <LoginPage onLogin={login} error={error} loading={loginLoading} />;
  }

  // Authenticated: show dashboard with logout
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-gray-900">PharmaCare</h1>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded capitalize">
            {session.role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {session.full_name}
          </span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Page content */}
      <main>
        <DashboardPage session={session} />
      </main>
    </div>
  );
}

export default App;
