import { useState, useCallback } from 'react';
import { UserList } from '@/components/users/UserList';
import { AddUserDialog } from '@/components/users/AddUserDialog';
import type { SessionDto } from '@/types/session';

interface UsersPageProps {
  session: SessionDto;
}

export function UsersPage({ session }: UsersPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUserChanged = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <AddUserDialog session={session} onUserAdded={handleUserChanged} />
      </div>

      <div className="rounded-lg border bg-card">
        <UserList
          session={session}
          refreshKey={refreshKey}
          onUserChanged={handleUserChanged}
        />
      </div>
    </div>
  );
}
