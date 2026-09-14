import { useState, useCallback } from 'react';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { PurchaseList } from '@/components/purchases/PurchaseList';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast-provider';
import { useAutoRefresh } from '@/lib/eventBus';
import { playSuccess } from '@/lib/sounds';
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

  const handlePurchaseComplete = useCallback(() => {
    playSuccess();
    toast('success', 'Purchase recorded successfully');
    setInternalRefreshKey((prev) => prev + 1);
  }, [toast]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Purchases</h1>
          <p className="text-sm text-muted-foreground">Record new purchases and view purchase history.</p>
        </div>
      </div>

      <div>
        <PurchaseForm
          sessionToken={session.token}
          currencySymbol={currencySymbol}
          onPurchaseComplete={handlePurchaseComplete}
        />
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Purchase History</h2>
        <div className="rounded-lg border bg-card">
          <PurchaseList
            sessionToken={session.token}
            refreshKey={refreshKey}
          />
        </div>
      </div>
    </div>
  );
}
