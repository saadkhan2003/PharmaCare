import { useState, useCallback } from 'react';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { PurchaseList } from '@/components/purchases/PurchaseList';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast-provider';
import { useAutoRefresh } from '@/lib/eventBus';
import { playSuccess } from '@/lib/sounds';
import { Package, Plus, X } from 'lucide-react';
import type { SessionDto } from '@/types/session';

interface PurchasesPageProps {
  session: SessionDto;
}

export function PurchasesPage({ session }: PurchasesPageProps) {
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const [purchasesRefreshKey] = useAutoRefresh('purchases-changed');
  const [medicinesRefreshKey] = useAutoRefresh('medicines-changed');
  const refreshKey = internalRefreshKey + purchasesRefreshKey + medicinesRefreshKey;
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const handlePurchaseComplete = useCallback(() => {
    playSuccess();
    toast('success', 'Purchase recorded successfully');
    setInternalRefreshKey((prev) => prev + 1);
    setShowForm(false);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="size-6 text-emerald-600" />
            Supplier Purchases
          </h1>
          <p className="text-sm text-muted-foreground">Record supplier stock intake invoices and view past purchase orders.</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
          className="gap-2 shrink-0 font-semibold"
        >
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? 'Close Form' : 'New Purchase Invoice'}
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-md transition-all animate-in">
          <PurchaseForm
            sessionToken={session.token}
            currencySymbol={currencySymbol}
            onPurchaseComplete={handlePurchaseComplete}
          />
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-bold text-foreground">Purchase History</h2>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <PurchaseList
            sessionToken={session.token}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
