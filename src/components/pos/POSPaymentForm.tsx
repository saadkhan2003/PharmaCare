import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
}: POSPaymentFormProps) {
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

  return (
    <div className="space-y-4">
      {/* Bill discount */}
      <div>
        <Label htmlFor="bill-discount" className="text-sm font-medium">
          Bill Discount (Rs.)
        </Label>
        <Input
          ref={billDiscountRef}
          id="bill-discount"
          type="number"
          min={0}
          value={billDiscount || ''}
          placeholder="0"
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            onBillDiscountChange(isNaN(val) ? 0 : val);
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
            if (value) onPaymentMethodChange(value);
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
          <span>Rs. {subtotal.toFixed(2)}</span>
        </div>
        {totalItemDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Item Discounts</span>
            <span className="text-destructive">-Rs. {totalItemDiscount.toFixed(2)}</span>
          </div>
        )}
        {billDiscount > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Bill Discount</span>
            <span className="text-destructive">-Rs. {billDiscount.toFixed(2)}</span>
          </div>
        )}
        {taxEnabled && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Tax ({taxRatePercent.toFixed(0)}%)
            </span>
            <span>Rs. {taxAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-2xl font-bold pt-2 border-t border-border">
          <span>Total</span>
          <span>Rs. {estimatedTotal.toFixed(2)}</span>
        </div>
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
