import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { POSPage } from './pages/POSPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { MedicinesPage } from './pages/MedicinesPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { ExpiryReportPage } from './pages/ExpiryReportPage';
import { CustomerReturnsPage } from './pages/CustomerReturnsPage';
import { SupplierReturnsPage } from './pages/SupplierReturnsPage';
import { WriteOffPage } from './pages/WriteOffPage';
import { ReturnHistoryPage } from './pages/ReturnHistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui/toast-provider';
import { tauri } from './lib/tauri';
import type { CreateOwnerDto } from './lib/tauri';
import { useState, useCallback } from 'react';
import { useTauriCommand } from './hooks/useTauriCommand';
import './App.css';

function AuthenticatedApp({ session, onLogout }: { session: import('./types/session').SessionDto; onLogout: () => void }) {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AppShell session={session} onLogout={onLogout}>
        <Routes>
          <Route path="/pos" element={<div className="animate-in"><POSPage session={session} /></div>} />
          <Route path="/dashboard" element={<div className="animate-in"><DashboardPage session={session} /></div>} />
          <Route path="/medicines" element={<div className="animate-in"><MedicinesPage session={session} /></div>} />
          <Route path="/returns/customer" element={<div className="animate-in"><CustomerReturnsPage session={session} /></div>} />
          {session.role === 'owner' && (
            <>
              <Route path="/users" element={<div className="animate-in"><UsersPage session={session} /></div>} />
              <Route path="/audit" element={<div className="animate-in"><AuditLogPage session={session} /></div>} />
              <Route path="/suppliers" element={<div className="animate-in"><SuppliersPage session={session} /></div>} />
              <Route path="/purchases" element={<div className="animate-in"><PurchasesPage session={session} /></div>} />
              <Route path="/expiry-report" element={<div className="animate-in"><ExpiryReportPage session={session} /></div>} />
              <Route path="/returns/supplier" element={<div className="animate-in"><SupplierReturnsPage session={session} /></div>} />
              <Route path="/returns/write-off" element={<div className="animate-in"><WriteOffPage session={session} /></div>} />
              <Route path="/returns/history" element={<div className="animate-in"><ReturnHistoryPage session={session} /></div>} />
              <Route path="/reports" element={<div className="animate-in"><ReportsPage session={session} /></div>} />
              <Route path="/settings" element={<div className="animate-in"><SettingsPage session={session} /></div>} />
            </>
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
      </ToastProvider>
    </BrowserRouter>
  );
}

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

  // Authenticated: show AppShell with routing
  return <AuthenticatedApp session={session} onLogout={logout} />;
}

export default App;
