import { CustomerReturnForm } from '@/components/returns/CustomerReturnForm';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function CustomerReturnsPage({ session }: Props) {
  return (
    <div className="p-6">
      <CustomerReturnForm
        sessionToken={session.token}
        currencySymbol="Rs."
        onReturnComplete={() => {}}
      />
    </div>
  );
}
