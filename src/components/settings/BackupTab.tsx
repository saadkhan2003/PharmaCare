import { dispatchEvent } from '@/lib/eventBus';
import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tauri } from '@/lib/tauri';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import type { BackupStatus, BackupFileInfo } from '@/types/report';
import { Loader2, Save, Play, Download, FolderOpen, Cloud, CloudOff, CheckCircle2, ExternalLink } from 'lucide-react';
import { formatDateTime } from '@/lib/formatDate';

interface BackupTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

export function BackupTab({ settings, session, onSaved }: BackupTabProps) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // Local backup
  const [localPath, setLocalPath] = useState('');

  // Drive
  const [driveConnected, setDriveConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    setLocalPath(settings.local_backup_path || '');
  }, [settings]);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await tauri.backup.getStatus(session.token);
      setBackupStatus(status);
      setDriveConnected(status.google_drive_connected);
    } catch {
      // Ignore
    } finally {
      setStatusLoading(false);
    }
  }, [session.token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        local_backup_path: localPath || null,
      });
      setMessage({ type: 'success', text: 'Backup settings saved' });
      onSaved();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackupNow = async () => {
    setBackingUp(true);
    setMessage(null);
    try {
      const result = await tauri.backup.trigger(session.token);
      setMessage({ type: result.success ? 'success' : 'error', text: result.message || 'Backup created successfully' });
      if (result.success) {
        dispatchEvent('backup-completed');
        dispatchEvent('settings-changed');
      }
      await fetchStatus();
      onSaved();
    } catch (err: unknown) {
      const errMsg = typeof err === 'string' ? err : (err instanceof Error ? err.message : (err as { message?: string })?.message || 'Backup failed');
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      // 1. First look for local backups (default and recommended)
      let backups: BackupFileInfo[] = [];
      let source: 'local' | 'drive' = 'local';

      try {
        backups = await tauri.backup.listLocalBackups(session.token);
      } catch (localErr) {
        console.warn('Failed to query local backups:', localErr);
      }

      // 2. If no local backups found and Google Drive is connected, query Google Drive
      if (backups.length === 0 && backupStatus?.google_drive_connected) {
        try {
          backups = await tauri.backup.listDriveBackups(session.token);
          source = 'drive';
        } catch (driveErr) {
          console.warn('Failed to query drive backups:', driveErr);
        }
      }

      if (backups.length === 0) {
        setMessage({
          type: 'error',
          text: 'No backup files found. Click "Backup Now" first to create a snapshot.',
        });
        setRestoring(false);
        return;
      }

      // Sort newest first
      const latest = backups.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime())[0];
      const locationLabel = source === 'local' ? 'Local storage' : 'Google Drive';

      const confirmed = window.confirm(
        `Restore backup from ${formatDateTime(latest.created_time)}?\n\n` +
        `File: ${latest.name}\n` +
        `Source: ${locationLabel}\n\n` +
        `⚠ This will restore all database records to this snapshot.\nA safety copy of your current database will be saved automatically before restoring.`
      );
      if (!confirmed) {
        setRestoring(false);
        return;
      }

      const res = await tauri.backup.restore(session.token, latest.id, source);
      setMessage({
        type: 'success',
        text: res.message || 'Restore completed successfully! Please reload or restart the app.',
      });
      dispatchEvent('settings-changed');
      await fetchStatus();
      onSaved();
    } catch (err: unknown) {
      const errMsg = typeof err === 'string' ? err : (err instanceof Error ? err.message : (err as { message?: string })?.message || 'Restore failed');
      setMessage({ type: 'error', text: errMsg });
    } finally {
      setRestoring(false);
    }
  };

  const handleConnectDrive = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      await tauri.backup.connectDrive(session.token);
      setMessage({ type: 'success', text: 'Connected to Google Drive. Future backups will upload automatically.' });
      await fetchStatus();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Drive connect failed' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectDrive = async () => {
    if (!window.confirm('Disconnect Google Drive? Future backups will not be uploaded to Drive.')) return;
    setConnecting(true);
    setMessage(null);
    try {
      await tauri.backup.disconnectDrive(session.token);
      setMessage({ type: 'success', text: 'Google Drive disconnected.' });
      await fetchStatus();
    } catch (err: unknown) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Disconnect failed' });
    } finally {
      setConnecting(false);
    }
  };

  const lastBackup = backupStatus?.last_backup_time
    ? formatDateTime(backupStatus.last_backup_time)
    : null;
  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(backupStatus!.last_backup_time!).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  return (
    <div className="space-y-6">
      {/* Status card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Backup Status</CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading status...
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              {lastBackup ? (
                <p className="text-green-700">✅ Last backup: {lastBackup}</p>
              ) : (
                <p className="text-muted-foreground">No backups yet</p>
              )}
              {daysSinceBackup > 3 && (
                <p className="text-amber-700">⚠ No backup in {daysSinceBackup} days</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Backup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Backup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Creates a snapshot of your database. It will be saved to the local folder if configured.
          </p>
          <div className="flex gap-2">
            <Button onClick={handleBackupNow} disabled={backingUp} size="sm">
              {backingUp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Backup Now
            </Button>
            <Button onClick={handleRestore} disabled={restoring} variant="outline" size="sm">
              {restoring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Restore Latest
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Local Folder Backup — PRIMARY method */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Local Folder Backup <span className="text-xs font-normal text-muted-foreground">(Recommended)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Backups are saved as <code>pharmaCare_backup_YYYY-MM-DD.db.gz</code> files.
            You can use a USB drive path like <code>D:\Backups</code> (Windows) or <code>/mnt/usb/pharmacy-backups</code> (Linux).
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="local-path">Folder Path</Label>
              <Input
                id="local-path"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="e.g. D:\Backups or /mnt/usb/backups"
              />
            </div>
            <Button variant="outline" size="sm" className="mb-0.5" onClick={handleSaveSettings} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Leave empty to skip local folder backup. Backups are always created in the app data directory.
          </p>
        </CardContent>
      </Card>

      {/* Google Drive — Auto Connect */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {driveConnected ? <Cloud className="h-4 w-4 text-green-600" /> : <CloudOff className="h-4 w-4" />}
            Google Drive Backup {driveConnected && <span className="text-xs font-normal text-green-700">(Connected)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Backups uploaded to your Google Drive are accessible from any device where you sign in with the same Google account.
          </p>
          {driveConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Connected. Backups will be uploaded automatically.
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnectDrive} disabled={connecting}>
                {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CloudOff className="h-4 w-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <Button onClick={handleConnectDrive} disabled={connecting} size="sm">
              {connecting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Connect Google Drive
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Clicking Connect will open your browser to sign in with your Google account. PharmaCare does not see your Google password.
          </p>
        </CardContent>
      </Card>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
