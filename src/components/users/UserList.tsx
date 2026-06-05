import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EyeOff, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { tauri } from '@/lib/tauri';
import type { UserDto } from '@/types/user';
import type { SessionDto } from '@/types/session';

interface UserListProps {
  session: SessionDto;
  refreshKey: number;
  onUserChanged: () => void;
}

export function UserList({ session, refreshKey, onUserChanged }: UserListProps) {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<UserDto | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDto | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.users.list(session.token);
      setUsers(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  const handleDeactivate = useCallback(async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    setDeactivateError(null);
    try {
      await tauri.users.deactivate(session.token, deactivateTarget.id);
      setDeactivateTarget(null);
      onUserChanged();
    } catch (err: unknown) {
      setDeactivateError(
        err instanceof Error ? err.message : 'Failed to deactivate user'
      );
    } finally {
      setDeactivating(false);
    }
  }, [deactivateTarget, session.token, onUserChanged]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await tauri.users.delete(session.token, deleteTarget.id);
      setDeleteTarget(null);
      onUserChanged();
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete user'
      );
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, session.token, onUserChanged]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Full Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              className={!user.is_active ? 'opacity-50' : ''}
            >
              <TableCell className="font-medium">{user.full_name}</TableCell>
              <TableCell>{user.username}</TableCell>
              <TableCell>
                <Badge
                  variant={user.role === 'owner' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge
                  variant={user.is_active ? 'outline' : 'ghost'}
                  className={
                    user.is_active
                      ? 'border-green-300 text-green-700'
                      : 'text-muted-foreground'
                  }
                >
                  {user.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {user.is_active && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={user.id === session.user_id}
                      onClick={() => setDeactivateTarget(user)}
                      title="Deactivate"
                    >
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={user.id === session.user_id}
                      onClick={() => { setDeleteError(null); setDeleteTarget(user); }}
                      title="Delete permanently"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Deactivate confirmation dialog */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeactivateTarget(null);
            setDeactivateError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate User</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <span className="font-medium text-foreground">
                {deactivateTarget?.full_name}
              </span>
              ? They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          {deactivateError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {deactivateError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeactivateTarget(null);
                setDeactivateError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivate}
              disabled={deactivating}
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Permanently delete{' '}
              <span className="font-medium text-foreground">{deleteTarget?.full_name}</span>
              ? This action cannot be undone. Only possible if the user has no sales records.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{deleteError}</div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteError(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
