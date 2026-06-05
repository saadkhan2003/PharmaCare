import { WriteOffForm } from '@/components/returns/WriteOffForm';
import type { SessionDto } from '@/types/session';

interface Props {
  session: SessionDto;
}

export function WriteOffPage({ session }: Props) {
  return (
    <div className="p-6">
      <WriteOffForm
        sessionToken={session.token}
        currencySymbol="Rs."
        onComplete={() => {}}
      />
    </div>
  );
}
