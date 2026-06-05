import { useState } from 'react';
import { PurchaseForm } from '@/components/purchases/PurchaseForm';
import { PurchaseList } from '@/components/purchases/PurchaseList';
import { useSettings } from '@/hooks/useSettings';
import type { SessionDto } from '@/types/session';

interface PurchasesPageProps {
  session: SessionDto;
}

export function PurchasesPage({ session }: PurchasesPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { settings } = useSettings();
  const currencySymbol = settings?.currency_symbol || 'Rs.';

  const handlePurchaseComplete = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">Purchases</h1>

      <div className="space-y-6">
        <PurchaseForm
          sessionToken={session.token}
          currencySymbol={currencySymbol}
          onPurchaseComplete={handlePurchaseComplete}
        />

        <div>
          <h2 className="mb-4 text-lg font-semibold">Purchase History</h2>
          <div className="rounded-lg border bg-card">
            <PurchaseList
              sessionToken={session.token}
              refreshKey={refreshKey}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
