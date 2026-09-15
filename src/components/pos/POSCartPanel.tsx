import { useState, useCallback, useMemo } from 'react';
import { ShoppingCart, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { POSCartItem } from '@/components/pos/POSCartItem';
import { POSPaymentForm } from '@/components/pos/POSPaymentForm';
import { useTauriCommand } from '@/hooks/useTauriCommand';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/components/ui/toast-provider';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import type { SessionDto } from '@/types/session';
import type { CartItem } from '@/pages/POSPage';
import type { SaleReceiptDto } from '@/types/sale';

interface POSCartPanelProps {
  cart: CartItem[];
  onUpdateQuantity: (medicineId: number, qty: number) => void;
  onUpdateDiscount: (medicineId: number, discount: number) => void;
  onRemoveItem: (medicineId: number) => void;
  onClearCart: () => void;
  onConfirm: (receipt: SaleReceiptDto) => void;
  session: SessionDto;
  // All refs from usePOSKeyboard
  quantityRef: React.RefObject<HTMLInputElement>;
  billDiscountRef: React.RefObject<HTMLInputElement>;
  taxToggleRef: React.RefObject<HTMLButtonElement>;
  paymentRef: React.RefObject<HTMLButtonElement>;
  customerNameRef: React.RefObject<HTMLInputElement>;
  confirmRef: React.RefObject<HTMLButtonElement>;
}

export function POSCartPanel({
  cart,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemoveItem,
  onClearCart,
  onConfirm,
  session,
  quantityRef,
  billDiscountRef,
  taxToggleRef,
  paymentRef,
  customerNameRef,
  confirmRef,
}: POSCartPanelProps) {
  const [billDiscount, setBillDiscount] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');

  const { settings } = useSettings(session.token);
  const { toast } = useToast();
  const taxRatePercent = useMemo(
    () => settings?.default_tax_rate ?? 0,
    [settings]
  );

  const { execute: confirmSale, loading: confirmLoading, error: confirmError } = useTauriCommand<SaleReceiptDto>();

  const handleConfirm = useCallback(async () => {
    if (cart.length === 0) return;

    try {
      const receipt = await confirmSale(() =>
        tauri.sales.confirmSale(session.token, {
          items: cart.map((item) => ({
            medicine_id: item.medicine.id,
            quantity: item.quantity,
            item_discount: item.item_discount,
          })),
          bill_discount: billDiscount,
          tax_enabled: taxEnabled,
          payment_method: paymentMethod,
          customer_name: paymentMethod === 'Credit' ? customerName || null : null,
        })
      );

      if (receipt) {
        toast('success', 'Sale completed successfully');
        dispatchEvent('sales-changed');
        dispatchEvent('medicines-changed');
        onConfirm(receipt);
      }
    } catch (err: unknown) {
      toast('error', 'Sale failed. Please try again.');
      console.error('Sale confirmation failed:', err);
    }
  }, [cart, billDiscount, taxEnabled, paymentMethod, customerName, confirmSale, session.token, onConfirm, toast]);

  return (
    <div className="flex flex-col h-full border rounded-lg bg-card overflow-y-auto min-h-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-card flex items-center justify-between p-4 border-b border-border shrink-0 shadow-xs">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-bold">Cart</h2>
          {cart.length > 0 && (
            <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {cart.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearCart}
          disabled={cart.length === 0}
          className="gap-1"
        >
          <RotateCcw className="h-4 w-4" />
          New Sale
        </Button>
      </div>

      {/* Cart items */}
      <div className="px-4 py-2 space-y-2 shrink-0">
        {cart.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-muted-foreground text-sm text-center">
              No items in cart. Search and add medicines from the left panel.
            </p>
          </div>
        ) : (
          cart.map((item) => (
            <POSCartItem
              key={item.medicine.id}
              item={item}
              onUpdateQuantity={onUpdateQuantity}
              onUpdateDiscount={onUpdateDiscount}
              onRemove={onRemoveItem}
              quantityRef={quantityRef}
            />
          ))
        )}
      </div>

      {/* Payment form — at bottom with proper padding */}
      {cart.length > 0 && (
        <div className="border-t border-border p-4 space-y-4 mt-auto shrink-0 bg-card pb-8">
          <POSPaymentForm
            cartItems={cart}
            billDiscount={billDiscount}
            onBillDiscountChange={setBillDiscount}
            taxEnabled={taxEnabled}
            onTaxToggle={() => setTaxEnabled((prev) => !prev)}
            taxRatePercent={taxRatePercent}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            customerName={customerName}
            onCustomerNameChange={setCustomerName}
            onConfirm={handleConfirm}
            billDiscountRef={billDiscountRef}
            taxToggleRef={taxToggleRef}
            paymentRef={paymentRef}
            customerNameRef={customerNameRef}
            confirmRef={confirmRef}
            loading={confirmLoading}
            currencySymbol={settings?.currency_symbol || 'Rs.'}
          />
          {confirmError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive break-words">
              {confirmError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
