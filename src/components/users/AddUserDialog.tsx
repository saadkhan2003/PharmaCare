import { useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';

interface AddUserDialogProps {
  session: SessionDto;
  onUserAdded: () => void;
}

interface FormState {
  full_name: string;
  username: string;
  password: string;
  role: 'owner' | 'pharmacist';
}

interface FormErrors {
  full_name?: string;
  username?: string;
  password?: string;
}

export function AddUserDialog({ session, onUserAdded }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    full_name: '',
    username: '',
    password: '',
    role: 'pharmacist',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const validate = useCallback((): FormErrors => {
    const errs: FormErrors = {};
    if (!form.full_name.trim()) {
      errs.full_name = 'Full name is required';
    }
    if (!form.username.trim()) {
      errs.username = 'Username is required';
    }
    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }
    return errs;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await tauri.users.create(session.token, {
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
      });
      // Reset form and close
      setForm({ full_name: '', username: '', password: '', role: 'pharmacist' });
      setOpen(false);
      onUserAdded();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to create user'
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, session.token, onUserAdded, validate]);

  const handleOpenChange = useCallback((open: boolean) => {
    setOpen(open);
    if (!open) {
      // Reset form on close
      setForm({ full_name: '', username: '', password: '', role: 'pharmacist' });
      setErrors({});
      setSubmitError(null);
    }
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button>Add User</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User</DialogTitle>
          <DialogDescription>
            Create a new user account. Passwords must be at least 6 characters.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Full Name */}
          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              placeholder="John Doe"
              value={form.full_name}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, full_name: e.target.value }))
              }
            />
            {errors.full_name && (
              <p className="text-xs text-destructive">{errors.full_name}</p>
            )}
          </div>

          {/* Username */}
          <div className="grid gap-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="johndoe"
              value={form.username}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, username: e.target.value }))
              }
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username}</p>
            )}
          </div>

          {/* Password */}
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Role */}
          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(value: string | null) => {
                if (value === 'owner' || value === 'pharmacist') {
                  setForm((prev) => ({ ...prev, role: value }));
                }
              }}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pharmacist">Pharmacist</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Creating...' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
