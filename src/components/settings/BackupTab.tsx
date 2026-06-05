import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import type { BackupStatus } from '@/types/report';
import {
  Loader2,
  Save,
  Cloud,
  CloudOff,
  Play,
  Download,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface BackupTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

export function BackupTab({ settings, session, onSaved }: BackupTabProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Google Drive OAuth
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showDriveForm, setShowDriveForm] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [waitingForAuth, setWaitingForAuth] = useState(false);

  // Auto-backup time & local path
  const [autoBackupTime, setAutoBackupTime] = useState('');
  const [localBackupPath, setLocalBackupPath] = useState('');

  // Actions
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch backup status on mount
  const fetchStatus = useCallback(async () => {
    try {
      const status = await tauri.backup.getStatus(session.token);
      setBackupStatus(status);
    } catch {
      // ignore errors on status poll
    } finally {
      setStatusLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Initialize form fields from settings
  useEffect(() => {
    setAutoBackupTime(settings.auto_backup_time ?? '23:00');
    setLocalBackupPath(settings.local_backup_path ?? '');
  }, [settings]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Start polling for Drive connect completion
  const startPolling = useCallback(() => {
    setWaitingForAuth(true);
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max

    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const status = await tauri.backup.getStatus(session.token);
        setBackupStatus(status);
        if (status.google_drive_connected) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setWaitingForAuth(false);
          setMessage({ type: 'success', text: 'Google Drive connected successfully' });
          onSaved();
        } else if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setWaitingForAuth(false);
          setMessage({ type: 'error', text: 'Authentication timed out. Please try again.' });
        }
      } catch {
        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setWaitingForAuth(false);
        }
      }
    }, 2000);
  }, [session.token, onSaved]);

  const handleConnectDrive = async () => {
    if (!clientId || !clientSecret) {
      setMessage({ type: 'error', text: 'Please enter Google Drive Client ID and Client Secret' });
      return;
    }
    setConnecting(true);
    setMessage(null);
    try {
      const url = await tauri.backup.connectDrive(session.token, clientId, clientSecret);
      // Open the OAuth URL in browser
      window.open(url, '_blank');
      // Start polling for completion
      startPolling();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to initiate Drive connection';
      setMessage({ type: 'error', text: msg });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectDrive = async () => {
    setMessage(null);
    try {
      await tauri.backup.disconnectDrive(session.token);
      setBackupStatus((prev) => prev ? { ...prev, google_drive_connected: false } : null);
      setMessage({ type: 'success', text: 'Google Drive disconnected' });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect Drive';
      setMessage({ type: 'error', text: msg });
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setMessage(null);
    try {
      const result = await tauri.backup.trigger(session.token);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message });
      await fetchStatus();
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backup failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const backups = await tauri.backup.listDriveBackups(session.token);
      if (backups.length === 0) {
        setMessage({ type: 'error', text: 'No backups found in Google Drive' });
        setRestoring(false);
        return;
      }
      // Pick the most recent backup
      const latest = backups.sort(
        (a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
      )[0];
      const confirmed = window.confirm(
        `Restore backup "${latest.name}" from ${latest.created_time}?\n\n` +
        'A pre-restore backup will be created automatically. ' +
        'The app will restart after restoration.\n\n' +
        'Are you sure?'
      );
      if (!confirmed) {
        setRestoring(false);
        return;
      }
      const result = await tauri.backup.restore(session.token, latest.id, 'drive');
      setMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        // App will restart — nothing more to do
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Restore failed';
      setMessage({ type: 'error', text: msg });
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        auto_backup_time: autoBackupTime || null,
        local_backup_path: localBackupPath || null,
      });
      setMessage({ type: 'success', text: 'Backup settings saved' });
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  const hoursSinceLastBackup = (() => {
    if (!backupStatus?.last_backup_time) return null;
    const lastBackup = new Date(backupStatus.last_backup_time);
    const now = new Date();
    return Math.floor((now.getTime() - lastBackup.getTime()) / (1000 * 60 * 60));
  })();

  return (
    <div className="space-y-6">
      {/* Google Drive Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Google Drive</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading status...
            </div>
          ) : backupStatus?.google_drive_connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Cloud className="h-4 w-4 text-green-600" />
                <span className="text-green-700 font-medium">Google Drive Connected</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnectDrive}>
                <CloudOff className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CloudOff className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Google Drive Not Connected</span>
              </div>
              {waitingForAuth ? (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Waiting for authentication to complete...
                </div>
              ) : showDriveForm ? (
                <div className="space-y-3 border rounded-md p-4 bg-muted/30">
                  <div className="space-y-2">
                    <Label htmlFor="client-id">Google Drive Client ID</Label>
                    <Input
                      id="client-id"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="123456789-xxxx.apps.googleusercontent.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret</Label>
                    <Input
                      id="client-secret"
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="GOCSPX-xxxxxxxxxxxx"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleConnectDrive} disabled={connecting}>
                      {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                      Connect
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowDriveForm(false)}>
                      Cancel
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    After clicking Connect, a browser window will open for Google authentication.
                  </p>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowDriveForm(true)}>
                  <Cloud className="h-4 w-4 mr-2" />
                  Connect Google Drive
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-backup & Local Folder */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Backup Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="auto-backup-time">Auto-backup Time</Label>
              <Input
                id="auto-backup-time"
                type="time"
                value={autoBackupTime}
                onChange={(e) => setAutoBackupTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Backup runs automatically at this time when the app is open
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local-path">Local Backup Folder</Label>
              <Input
                id="local-path"
                value={localBackupPath}
                onChange={(e) => setLocalBackupPath(e.target.value)}
                placeholder="/path/to/usb/drive"
              />
              <p className="text-xs text-muted-foreground">
                Path to a local folder or USB drive for backup copies
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSaveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Backup Settings
          </Button>
        </CardContent>
      </Card>

      {/* Manual Backup & Restore */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual Backup & Restore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBackupNow} disabled={backingUp}>
              {backingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Backup Now
            </Button>
            <Button variant="outline" onClick={handleRestore} disabled={restoring}>
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Restore from Backup
            </Button>
          </div>

          {/* Status Display */}
          {backupStatus && (
            <div className="border rounded-md p-4 bg-muted/20 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Last backup:</span>
                <span>
                  {backupStatus.last_backup_time
                    ? new Date(backupStatus.last_backup_time).toLocaleString()
                    : 'Never'}
                </span>
              </div>
              {backupStatus.last_backup_time && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Status:</span>
                  <span
                    className={
                      backupStatus.last_backup_status === 'Success'
                        ? 'text-green-600'
                        : backupStatus.last_backup_status
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                    }
                  >
                    {backupStatus.last_backup_status ?? 'Unknown'}
                  </span>
                </div>
              )}
              {hoursSinceLastBackup !== null && hoursSinceLastBackup > 72 && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <span>⚠ No backup in {Math.floor(hoursSinceLastBackup / 24)} days</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <div
          className={`p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}
