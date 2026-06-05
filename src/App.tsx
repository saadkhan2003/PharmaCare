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
import { AppShell } from './components/layout/AppShell';
import { tauri } from './lib/tauri';
import type { CreateOwnerDto } from './lib/tauri';
import { useState, useCallback } from 'react';
import { useTauriCommand } from './hooks/useTauriCommand';
import './App.css';

function AuthenticatedApp({ session, onLogout }: { session: import('./types/session').SessionDto; onLogout: () => void }) {
  return (
    <BrowserRouter>
      <AppShell session={session} onLogout={onLogout}>
        <Routes>
          <Route path="/pos" element={<POSPage session={session} />} />
          <Route path="/dashboard" element={<DashboardPage session={session} />} />
          <Route path="/medicines" element={<MedicinesPage session={session} />} />
          {/* Both roles */}
          <Route path="/returns/customer" element={<CustomerReturnsPage session={session} />} />
          {session.role === 'owner' && (
            <>
              <Route path="/users" element={<UsersPage session={session} />} />
              <Route path="/audit" element={<AuditLogPage session={session} />} />
              <Route path="/suppliers" element={<SuppliersPage session={session} />} />
              <Route path="/purchases" element={<PurchasesPage session={session} />} />
              <Route path="/expiry-report" element={<ExpiryReportPage session={session} />} />
              <Route path="/returns/supplier" element={<SupplierReturnsPage session={session} />} />
              <Route path="/returns/write-off" element={<WriteOffPage session={session} />} />
              <Route path="/returns/history" element={<ReturnHistoryPage session={session} />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppShell>
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
