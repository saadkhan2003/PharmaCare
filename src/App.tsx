import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { SetupWizardPage } from './pages/SetupWizardPage';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui/toast-provider';
import { BackupStatusBanner } from './components/BackupStatusBanner';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { tauri } from './lib/tauri';
import type { CreateOwnerDto } from './lib/tauri';
import React, { useState, useCallback } from 'react';
import { useTauriCommand } from './hooks/useTauriCommand';
import { playSuccess } from './lib/sounds';
import './App.css';

const POSPage = React.lazy(() => import('./pages/POSPage').then(m => ({ default: m.POSPage })));
const SalesHistoryPage = React.lazy(() => import('./pages/SalesHistoryPage').then(m => ({ default: m.SalesHistoryPage })));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const MedicinesPage = React.lazy(() => import('./pages/MedicinesPage').then(m => ({ default: m.MedicinesPage })));
const UsersPage = React.lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const AuditLogPage = React.lazy(() => import('./pages/AuditLogPage').then(m => ({ default: m.AuditLogPage })));
const SuppliersPage = React.lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const PurchasesPage = React.lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const ExpiryReportPage = React.lazy(() => import('./pages/ExpiryReportPage').then(m => ({ default: m.ExpiryReportPage })));
const CustomerReturnsPage = React.lazy(() => import('./pages/CustomerReturnsPage').then(m => ({ default: m.CustomerReturnsPage })));
const SupplierReturnsPage = React.lazy(() => import('./pages/SupplierReturnsPage').then(m => ({ default: m.SupplierReturnsPage })));
const WriteOffPage = React.lazy(() => import('./pages/WriteOffPage').then(m => ({ default: m.WriteOffPage })));
const ReturnHistoryPage = React.lazy(() => import('./pages/ReturnHistoryPage').then(m => ({ default: m.ReturnHistoryPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const DebtsPage = React.lazy(() => import('./pages/DebtsPage').then(m => ({ default: m.DebtsPage })));
const SupplierDebtsPage = React.lazy(() => import('./pages/SupplierDebtsPage').then(m => ({ default: m.SupplierDebtsPage })));
const BatchesPage = React.lazy(() => import('./pages/BatchesPage').then(m => ({ default: m.BatchesPage })));

function AuthenticatedShell({ session, onLogout }: { session: import('./types/session').SessionDto; onLogout: () => void }) {
  useGlobalShortcuts(session);
  return (
    <>
      <ToastProvider>
      <AppShell session={session} onLogout={onLogout}>
        {session.role === 'owner' && <BackupStatusBanner session={session} />}
        <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>}>
          <Routes>
            <Route path="/pos" element={<div className="animate-in"><POSPage session={session} /></div>} />
            <Route path="/pos/history" element={<div className="animate-in"><SalesHistoryPage session={session} /></div>} />
            <Route path="/dashboard" element={<div className="animate-in"><DashboardPage session={session} /></div>} />
            <Route path="/medicines" element={<div className="animate-in"><MedicinesPage session={session} /></div>} />
            <Route path="/returns/customer" element={<div className="animate-in"><CustomerReturnsPage session={session} /></div>} />
            {session.role === 'owner' && (
              <>
                <Route path="/users" element={<div className="animate-in"><UsersPage session={session} /></div>} />
                <Route path="/audit" element={<div className="animate-in"><AuditLogPage session={session} /></div>} />
                <Route path="/suppliers" element={<div className="animate-in"><SuppliersPage session={session} /></div>} />
                <Route path="/purchases" element={<div className="animate-in"><PurchasesPage session={session} /></div>} />
                <Route path="/batches" element={<div className="animate-in"><BatchesPage session={session} /></div>} />
                <Route path="/expiry-report" element={<div className="animate-in"><ExpiryReportPage session={session} /></div>} />
                <Route path="/returns/supplier" element={<div className="animate-in"><SupplierReturnsPage session={session} /></div>} />
                <Route path="/returns/write-off" element={<div className="animate-in"><WriteOffPage session={session} /></div>} />
                <Route path="/returns/history" element={<div className="animate-in"><ReturnHistoryPage session={session} /></div>} />
                <Route path="/reports" element={<div className="animate-in"><ReportsPage session={session} /></div>} />
                <Route path="/settings" element={<div className="animate-in"><SettingsPage session={session} /></div>} />
                <Route path="/debts" element={<div className="animate-in"><DebtsPage session={session} /></div>} />
                <Route path="/supplier-debts" element={<div className="animate-in"><SupplierDebtsPage session={session} /></div>} />
              </>
            )}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </React.Suspense>
      </AppShell>
      </ToastProvider>
    </>
  );
}

function AuthenticatedApp({ session, onLogout }: { session: import('./types/session').SessionDto; onLogout: () => void }) {
  return (
    <BrowserRouter>
      <AuthenticatedShell session={session} onLogout={onLogout} />
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
        playSuccess();
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
    const handleLogin = async (username: string, password: string) => {
      const result = await login(username, password);
      if (result) playSuccess();
      return result;
    };
    return <LoginPage onLogin={handleLogin} error={error} loading={loginLoading} />;
  }

  // Authenticated: show AppShell with routing
  return <AuthenticatedApp session={session} onLogout={logout} />;
}

export default App;
