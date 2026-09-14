import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import { Loader2, Save } from 'lucide-react';

interface InventoryTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

export function InventoryTab({ settings, session, onSaved }: InventoryTabProps) {
  const [reorderLevel, setReorderLevel] = useState(10);
  const [expiryWarningDays, setExpiryWarningDays] = useState(60);
  const [expiryCriticalDays, setExpiryCriticalDays] = useState(30);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setReorderLevel(settings.default_reorder_level ?? 10);
    setExpiryWarningDays(settings.expiry_warning_days ?? 60);
    setExpiryCriticalDays(settings.expiry_critical_days ?? 30);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        default_reorder_level: reorderLevel,
        expiry_warning_days: expiryWarningDays,
        expiry_critical_days: expiryCriticalDays,
      });
      setMessage({ type: 'success', text: 'Inventory thresholds saved successfully' });
      dispatchEvent('settings-changed');
      onSaved();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setMessage({ type: 'error', text: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="reorder-level">Default Reorder Level</Label>
          <Input
            id="reorder-level"
            type="number"
            min={0}
            value={reorderLevel}
            onChange={(e) => setReorderLevel(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            When stock falls below this level, it appears as low stock
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiry-warning">Expiry Warning (days)</Label>
          <Input
            id="expiry-warning"
            type="number"
            min={1}
            value={expiryWarningDays}
            onChange={(e) => setExpiryWarningDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Medicines expiring within this many days get a warning badge
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="expiry-critical">Expiry Critical (days)</Label>
          <Input
            id="expiry-critical"
            type="number"
            min={1}
            value={expiryCriticalDays}
            onChange={(e) => setExpiryCriticalDays(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">
            Medicines expiring within this many days get a critical badge
          </p>
        </div>
      </div>

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

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        Save
      </Button>
    </div>
  );
}
