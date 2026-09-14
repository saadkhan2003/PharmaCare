import { useState, useCallback } from 'react';
import { UserList } from '@/components/users/UserList';
import { AddUserDialog } from '@/components/users/AddUserDialog';
import { ChangePasswordDialog } from '@/components/users/ChangePasswordDialog';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage user accounts and roles.</p>
        </div>
        <div className="flex gap-2">
          <ChangePasswordDialog session={session} />
          <AddUserDialog session={session} onUserAdded={handleUserChanged} />
        </div>
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
