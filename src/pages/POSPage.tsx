import type { SessionDto } from '@/types/session';

interface POSPageProps {
  session: SessionDto;
}

export function POSPage({ session: _session }: POSPageProps) {
  return <div>POS Page</div>;
}
