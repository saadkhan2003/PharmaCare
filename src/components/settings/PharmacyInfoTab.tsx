import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import { Loader2, Save } from 'lucide-react';

interface PharmacyInfoTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

export function PharmacyInfoTab({ settings, session, onSaved }: PharmacyInfoTabProps) {
  const [pharmacyName, setPharmacyName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setPharmacyName(settings.pharmacy_name ?? '');
    setOwnerName(settings.owner_name ?? '');
    setPhone(settings.phone ?? '');
    setAddress(settings.address ?? '');
    setLogoPath(settings.logo_path ?? '');
    setOwnerEmail(settings.owner_email ?? '');
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        pharmacy_name: pharmacyName || null,
        owner_name: ownerName || null,
        phone: phone || null,
        address: address || null,
        logo_path: logoPath || null,
        owner_email: ownerEmail || null,
      });
      setMessage({ type: 'success', text: 'Pharmacy info saved successfully' });
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="pharmacy-name">Pharmacy Name</Label>
          <Input
            id="pharmacy-name"
            value={pharmacyName}
            onChange={(e) => setPharmacyName(e.target.value)}
            placeholder="PharmaCare"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner-name">Owner Name</Label>
          <Input
            id="owner-name"
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92-300-1234567"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main Street"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="owner-email">Owner Recovery Email</Label>
          <Input
            id="owner-email"
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@pharmacare.org"
          />
          <p className="text-xs text-muted-foreground">
            Used for OTP password resets.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo-path">Logo Path (optional)</Label>
          <Input
            id="logo-path"
            value={logoPath}
            onChange={(e) => setLogoPath(e.target.value)}
            placeholder="/path/to/logo.png"
          />
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
