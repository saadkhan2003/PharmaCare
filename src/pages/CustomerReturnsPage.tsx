import { useState } from 'react';
import { CustomerReturnForm } from '@/components/returns/CustomerReturnForm';
import { useSettings } from '@/hooks/useSettings';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function CustomerReturnsPage({ session }: Props) {
  const { settings } = useSettings(session.token);
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customer Return</h1>
          <p className="text-sm text-muted-foreground">Process medicine returns from customers.</p>
        </div>
      </div>
      <CustomerReturnForm
        key={refreshKey}
        sessionToken={session.token}
        currencySymbol={currencySymbol}
        onReturnComplete={() => setRefreshKey(k => k + 1)}
      />
    </div>
  );
}
