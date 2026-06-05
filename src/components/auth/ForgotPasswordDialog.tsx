import { useState } from 'react';
import { tauri } from '@/lib/tauri';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

type Step = 'request' | 'verify' | 'reset' | 'done';

export function ForgotPasswordDialog({ open, onClose }: ForgotPasswordDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('request');
  const [code, setCode] = useState('');
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [expiresMinutes, setExpiresMinutes] = useState(15);
  const [ownerIds, setOwnerIds] = useState<number[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await tauri.setup.requestRecoveryCode();
      setMaskedEmail(result.masked_email);
      setExpiresMinutes(result.expires_minutes);
      setStep('verify');
      toast('success', 'Recovery code sent', `Check ${result.masked_email} for the code`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setLoading(true);
    setError(null);
    try {
      const ids = await tauri.setup.verifyRecoveryCode(code);
      setOwnerIds(ids);
      if (ids.length === 1) {
        setSelectedUserId(ids[0]);
      }
      setStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!selectedUserId) { setError('Select a user'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError(null);
    try {
      await tauri.setup.resetWithRecoveryCode(selectedUserId, code, newPassword);
      toast('success', 'Password reset successful', 'You can now log in with your new password');
      setStep('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('request');
    setCode('');
    setError(null);
    setMaskedEmail(null);
    setExpiresMinutes(15);
    setOwnerIds([]);
    setSelectedUserId(null);
    setNewPassword('');
    setConfirmPassword('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        {step === 'request' && (
          <>
            <DialogHeader>
              <DialogTitle>Recover Account Access</DialogTitle>
              <DialogDescription>
                Send a one-time recovery code to the configured Owner email address.
              </DialogDescription>
            </DialogHeader>
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRequestCode} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Recovery Code
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'verify' && (
          <>
            <DialogHeader>
              <DialogTitle>Enter Recovery Code</DialogTitle>
              <DialogDescription>
                Enter the 6-digit code sent to {maskedEmail}. It expires in {expiresMinutes} minutes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="recovery-code">Recovery Code</Label>
              <Input id="recovery-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="000000" maxLength={6} className="text-center text-lg tracking-widest" />
            </div>
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleVerifyCode} disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Verify
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'reset' && (
          <>
            <DialogHeader>
              <DialogTitle>Set New Password</DialogTitle>
              <DialogDescription>
                {ownerIds.length > 1
                  ? 'Select an owner account and set a new password.'
                  : 'Set a new password for the owner account.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {ownerIds.length > 1 && (
                <div className="space-y-2">
                  <Label>Select Owner</Label>
                  <select
                    className="w-full px-3 py-2 border rounded-md text-sm"
                    value={selectedUserId ?? ''}
                    onChange={(e) => setSelectedUserId(Number(e.target.value))}
                  >
                    <option value="">Select...</option>
                    {ownerIds.map((id) => (
                      <option key={id} value={id}>Owner #{id}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="new-pw">New Password</Label>
                <Input id="new-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm Password</Label>
                <Input id="confirm-pw" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" minLength={6} />
              </div>
            </div>
            {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleReset} disabled={loading || !selectedUserId}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Reset Password
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>Password Reset Successful</DialogTitle>
              <DialogDescription>
                You can now log in with your new password.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleClose}>Return to Login</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
