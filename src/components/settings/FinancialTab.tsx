import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import type { SessionDto } from '@/types/session';
import type { SettingsMap } from '@/types/settings';
import { Loader2, Save } from 'lucide-react';

interface FinancialTabProps {
  settings: SettingsMap;
  session: SessionDto;
  onSaved: () => void;
}

function ToggleSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? 'bg-primary' : 'bg-input'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-sm font-medium">{label}</span>
    </label>
  );
}

export function FinancialTab({ settings, session, onSaved }: FinancialTabProps) {
  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setTaxRate(settings.default_tax_rate ?? 0);
    setTaxEnabled(settings.tax_enabled_default ?? false);
    setDiscountEnabled(settings.cashier_discount_enabled ?? false);
    setCurrencySymbol(settings.currency_symbol ?? 'Rs.');
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await tauri.settings.update(session.token, {
        default_tax_rate: taxRate,
        tax_enabled_default: taxEnabled,
        cashier_discount_enabled: discountEnabled,
        currency_symbol: currencySymbol || 'Rs.',
      });
      setMessage({ type: 'success', text: 'Financial settings saved successfully' });
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
          <Label htmlFor="tax-rate">Default Tax Rate (%)</Label>
          <Input
            id="tax-rate"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={taxRate}
            onChange={(e) => setTaxRate(Number(e.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency-symbol">Currency Symbol</Label>
          <Input
            id="currency-symbol"
            value={currencySymbol}
            onChange={(e) => setCurrencySymbol(e.target.value)}
            placeholder="Rs."
            maxLength={5}
          />
        </div>
      </div>

      <div className="space-y-4">
        <ToggleSwitch
          label="Enable Tax by Default"
          checked={taxEnabled}
          onChange={setTaxEnabled}
        />
        <ToggleSwitch
          label="Enable Cashier Discount"
          checked={discountEnabled}
          onChange={setDiscountEnabled}
        />
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
