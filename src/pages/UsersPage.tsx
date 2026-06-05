import type { SessionDto } from '@/types/session';

interface UsersPageProps {
  session: SessionDto;
}

export function UsersPage({ session: _session }: UsersPageProps) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">User Management</h1>
      <p className="text-muted-foreground mt-2">User management coming in next task.</p>
    </div>
  );
}
