import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Coins, CheckCircle2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { playToggle } from '@/lib/sounds';
import type { CartItem } from '@/pages/POSPage';

interface POSPaymentFormProps {
  cartItems: CartItem[];
  billDiscount: number;
  onBillDiscountChange: (val: number) => void;
  taxEnabled: boolean;
  onTaxToggle: () => void;
  taxRatePercent: number;
  paymentMethod: string;
  onPaymentMethodChange: (val: string) => void;
  customerName: string;
  onCustomerNameChange: (val: string) => void;
  onConfirm: () => void;
  // Refs from usePOSKeyboard
  billDiscountRef: React.RefObject<HTMLInputElement>;
  taxToggleRef: React.RefObject<HTMLButtonElement>;
  paymentRef: React.RefObject<HTMLButtonElement>;
  customerNameRef: React.RefObject<HTMLInputElement>;
  confirmRef: React.RefObject<HTMLButtonElement>;
  loading: boolean;
  currencySymbol?: string;
}

export function POSPaymentForm({
  cartItems,
  billDiscount,
  onBillDiscountChange,
  taxEnabled,
  onTaxToggle,
  taxRatePercent,
  paymentMethod,
  onPaymentMethodChange,
  customerName,
  onCustomerNameChange,
  onConfirm,
  billDiscountRef,
  taxToggleRef,
  paymentRef,
  customerNameRef,
  confirmRef,
  loading,
  currencySymbol = 'Rs.',
}: POSPaymentFormProps) {
  const [cashTendered, setCashTendered] = useState<string>('');

  // Display-only calculations — server recomputes actual totals (D-35)
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.medicine.retail_price,
    0
  );
  const totalItemDiscount = cartItems.reduce((sum, item) => sum + item.item_discount, 0);
  const afterItemDiscount = subtotal - totalItemDiscount;
  const afterBillDiscount = Math.max(0, afterItemDiscount - billDiscount);
  // Display-only estimate; server recomputes using the same settings value (sale_service.rs).
  // taxRatePercent is in percent (e.g. 18 means 18%).
  const taxAmount = taxEnabled ? (afterBillDiscount * taxRatePercent) / 100 : 0;
  const estimatedTotal = afterBillDiscount + taxAmount;

  const tenderedNum = parseFloat(cashTendered) || 0;
  const changeDue = tenderedNum > 0 && tenderedNum >= estimatedTotal ? tenderedNum - estimatedTotal : 0;
  const shortfall = tenderedNum > 0 && tenderedNum < estimatedTotal ? estimatedTotal - tenderedNum : 0;

  return (
    <div className="space-y-4">
      {/* Bill discount */}
      <div>
        <Label htmlFor="bill-discount" className="text-sm font-medium">
          Bill Discount ({currencySymbol})
        </Label>
        <Input
          ref={billDiscountRef}
          id="bill-discount"
          type="number"
          min={0}
          max={afterItemDiscount}
          value={billDiscount || ''}
          placeholder="0"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            const clamped = isNaN(val) ? 0 : Math.min(afterItemDiscount, Math.max(0, val));
            onBillDiscountChange(clamped);
          }}
          className="h-10 text-lg mt-1"
        />
      </div>

      {/* Tax toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="tax-toggle" className="text-sm font-medium cursor-pointer">
          Apply Tax
        </Label>
        <button
          ref={taxToggleRef}
          id="tax-toggle"
          role="switch"
          aria-checked={taxEnabled}
          onClick={onTaxToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            taxEnabled ? 'bg-primary' : 'bg-input'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
              taxEnabled ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Payment method */}
      <div>
        <Label htmlFor="payment-method" className="text-sm font-medium">
          Payment Method
        </Label>
        <Select
          value={paymentMethod}
          onValueChange={(value: string | null) => {
            if (value) { playToggle(); onPaymentMethodChange(value); }
          }}
        >
          <SelectTrigger
            ref={paymentRef}
            id="payment-method"
            className="h-10 text-lg mt-1"
          >
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cash">Cash</SelectItem>
            <SelectItem value="Card">Card</SelectItem>
            <SelectItem value="Credit">Credit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Cash Tendered & Change Due Calculator */}
      {paymentMethod === 'Cash' && (
        <div className="space-y-2 rounded-lg bg-muted/40 p-3 border border-border">
          <div className="flex items-center justify-between">
            <Label htmlFor="cash-tendered" className="text-xs font-semibold flex items-center gap-1.5">
              <Coins className="size-3.5 text-primary" /> Cash Tendered ({currencySymbol})
            </Label>
            {tenderedNum >= estimatedTotal && tenderedNum > 0 && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="size-3" /> Change: {currencySymbol} {changeDue.toFixed(2)}
              </span>
            )}
          </div>
          <Input
            id="cash-tendered"
            type="number"
            min={0}
            step="any"
            value={cashTendered}
            placeholder={`Enter amount e.g. ${Math.ceil(estimatedTotal / 100) * 100 || estimatedTotal.toFixed(0)}`}
            onChange={(e) => setCashTendered(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onConfirm();
              }
            }}
            className="h-10 text-base"
          />
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => setCashTendered(estimatedTotal.toFixed(0))}
              className="text-[11px]"
            >
              Exact ({currencySymbol}{estimatedTotal.toFixed(0)})
            </Button>
            {[50, 100, 500, 1000].map((inc) => (
              <Button
                key={inc}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => setCashTendered(String(Math.ceil((tenderedNum || estimatedTotal) / inc) * inc || inc))}
                className="text-[11px]"
              >
                +{inc}
              </Button>
            ))}
            {cashTendered && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setCashTendered('')}
                className="text-[11px] ml-auto text-muted-foreground"
              >
                Clear
              </Button>
            )}
          </div>
          {shortfall > 0 && (
            <p className="text-xs text-destructive">
              Short by {currencySymbol} {shortfall.toFixed(2)}
            </p>
          )}
        </div>
      )}

      {/* Customer name (only for Credit) */}
      {paymentMethod === 'Credit' && (
        <div>
          <Label htmlFor="customer-name" className="text-sm font-medium">
            Customer Name
          </Label>
          <Input
            ref={customerNameRef}
            id="customer-name"
            type="text"
            value={customerName}
            placeholder="Enter customer name"
            onChange={(e) => onCustomerNameChange(e.target.value)}
            className="h-10 text-lg mt-1"
          />
        </div>
      )}

      {/* Totals — display-only, server recomputes (D-35) */}
      <div className="border-t border-border pt-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{currencySymbol} {subtotal.toFixed(2)}</span>
        </div>
        {totalItemDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Item Discounts</span>
            <span className="text-destructive">-{currencySymbol} {totalItemDiscount.toFixed(2)}</span>
          </div>
        )}
        {billDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bill Discount</span>
            <span className="text-destructive">-{currencySymbol} {billDiscount.toFixed(2)}</span>
          </div>
        )}
        {taxEnabled && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Tax ({taxRatePercent.toFixed(0)}%)
            </span>
            <span>{currencySymbol} {taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-2xl font-bold pt-2 border-t border-border">
          <span>Total</span>
          <span>{currencySymbol} {estimatedTotal.toFixed(2)}</span>
        </div>
        {paymentMethod === 'Cash' && tenderedNum >= estimatedTotal && tenderedNum > 0 && (
          <div className="flex justify-between text-base font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800">
            <span>Change Due</span>
            <span>{currencySymbol} {changeDue.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Confirm button */}
      <Button
        ref={confirmRef}
        type="button"
        className="w-full h-14 text-xl font-bold"
        onClick={onConfirm}
        disabled={loading || cartItems.length === 0}
      >
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {loading ? 'Processing...' : 'Confirm Sale (Enter)'}
      </Button>
    </div>
  );
}
