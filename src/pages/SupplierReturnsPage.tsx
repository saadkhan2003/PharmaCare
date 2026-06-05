import { SupplierReturnForm } from '@/components/returns/SupplierReturnForm';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function SupplierReturnsPage({ session }: Props) {
  return (
    <div className="p-6">
      <SupplierReturnForm
        sessionToken={session.token}
        currencySymbol="Rs."
        onReturnComplete={() => {}}
      />
    </div>
  );
}
