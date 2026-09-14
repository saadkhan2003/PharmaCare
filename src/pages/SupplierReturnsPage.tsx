import { useState } from 'react';
import { SupplierReturnForm } from '@/components/returns/SupplierReturnForm';
import { useSettings } from '@/hooks/useSettings';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function SupplierReturnsPage({ session }: Props) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Supplier Return</h1>
          <p className="text-sm text-muted-foreground">Process medicine returns to suppliers.</p>
        </div>
      </div>
      <SupplierReturnForm
        key={refreshKey}
        sessionToken={session.token}
        currencySymbol={currencySymbol}
        onReturnComplete={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
