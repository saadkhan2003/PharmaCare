import { CheckCircle, Printer, PlusCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useSettings } from '@/hooks/useSettings';
import { formatDateTime } from '@/lib/formatDate';
import type { SaleReceiptDto } from '@/types/sale';
import type { SessionDto } from '@/types/session';

import { printThermalReceipt } from '@/lib/thermalPrint';

interface POSReceiptDialogProps {
  receipt: SaleReceiptDto | null;
  open: boolean;
  onClose: () => void;
  session?: SessionDto;
}

export function POSReceiptDialog({ receipt, open, onClose, session }: POSReceiptDialogProps) {
  const { settings } = useSettings(session?.token ?? '');
  const currencySymbol = settings?.currency_symbol || 'Rs.';
  const pharmacyName = settings?.pharmacy_name || 'PharmaCare';
  const phone = settings?.phone || '';
  const address = settings?.address || '';

  if (!receipt) return null;

  const handlePrint = () => {
    printThermalReceipt('printable-receipt');
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-500 shrink-0" />
            <div>
              <DialogTitle className="text-2xl">Sale Complete</DialogTitle>
              <DialogDescription className="text-base">
                Sale #{receipt.sale_id} recorded successfully
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Visual on-screen receipt summary */}
        <div className="space-y-4">
          <div className="bg-muted/60 border rounded-lg p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt Number</p>
            <p className="text-3xl font-extrabold text-primary">#{receipt.sale_id}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatDateTime(new Date().toISOString())}</p>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm text-foreground flex items-center justify-between">
              <span>Items ({receipt.item_count})</span>
              <span className="text-xs text-muted-foreground">Qty × Price</span>
            </h3>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {receipt.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start text-sm py-1 border-b border-border/50 last:border-b-0">
                  <div className="flex-1 min-w-0 mr-2">
                    <span className="font-medium truncate block">{item.medicine_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {item.quantity} × {currencySymbol} {item.unit_price.toFixed(2)}
                      {item.item_discount > 0 && ` (-${currencySymbol} ${item.item_discount.toFixed(2)})`}
                    </span>
                  </div>
                  <span className="font-semibold shrink-0">{currencySymbol} {item.line_total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{currencySymbol} {receipt.subtotal.toFixed(2)}</span>
            </div>
            {receipt.bill_discount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Bill Discount</span>
                <span className="text-destructive">-{currencySymbol} {receipt.bill_discount.toFixed(2)}</span>
              </div>
            )}
            {receipt.tax_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({(receipt.tax_rate * 100).toFixed(0)}%)
                </span>
                <span>{currencySymbol} {receipt.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-2xl font-bold pt-2 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{currencySymbol} {receipt.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment info */}
          <div className="bg-muted/40 border rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Method</span>
              <span className="font-semibold">{receipt.payment_method}</span>
            </div>
            {receipt.customer_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-semibold">{receipt.customer_name}</span>
              </div>
            )}
            {session && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
                <span>Cashier</span>
                <span>{session.full_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hidden thermal print slip container — visible only via @media print */}
        <div id="printable-receipt" className="print-only">
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{pharmacyName}</div>
            {address && <div style={{ fontSize: '10px' }}>{address}</div>}
            {phone && <div style={{ fontSize: '10px' }}>Tel: {phone}</div>}
            <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }}></div>
            <div style={{ fontSize: '11px', fontWeight: 'bold' }}>SALE RECEIPT</div>
            <div style={{ fontSize: '10px' }}>Invoice #{receipt.sale_id}</div>
            <div style={{ fontSize: '9px' }}>{formatDateTime(new Date().toISOString())}</div>
            {session && <div style={{ fontSize: '9px' }}>Cashier: {session.full_name}</div>}
            {receipt.customer_name && <div style={{ fontSize: '10px', fontWeight: 'bold' }}>Customer: {receipt.customer_name}</div>}
            <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }}></div>
          </div>

          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', textAlign: 'left' }}>
                <th style={{ padding: '2px 0' }}>Item</th>
                <th style={{ textAlign: 'center', padding: '2px 0' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '2px 0' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '3px 0' }}>
                    <div>{item.medicine_name}</div>
                    <div style={{ fontSize: '8px', color: '#555' }}>@{currencySymbol}{item.unit_price.toFixed(2)}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '3px 0' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right', padding: '3px 0' }}>{currencySymbol}{item.line_total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ margin: '6px 0', borderBottom: '1px dashed #000' }}></div>

          <div style={{ fontSize: '10px', lineHeight: '1.4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>{currencySymbol} {receipt.subtotal.toFixed(2)}</span>
            </div>
            {receipt.bill_discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Discount:</span>
                <span>-{currencySymbol} {receipt.bill_discount.toFixed(2)}</span>
              </div>
            )}
            {receipt.tax_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Tax:</span>
                <span>{currencySymbol} {receipt.tax_amount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '12px', marginTop: '4px', borderTop: '1px solid #000', paddingTop: '4px' }}>
              <span>TOTAL:</span>
              <span>{currencySymbol} {receipt.total.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
              <span>Paid Via:</span>
              <span>{receipt.payment_method}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '9px', borderTop: '1px dashed #000', paddingTop: '8px' }}>
            <div>Thank you for your visit!</div>
            <div>Medicines once sold can only be returned with receipt within 3 days.</div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrint}
            className="flex-1 h-12 text-base font-semibold gap-2 border-primary text-primary hover:bg-primary/10"
          >
            <Printer className="size-4" />
            Print Receipt
          </Button>
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 h-12 text-base font-semibold gap-2"
            autoFocus
          >
            <PlusCircle className="size-4" />
            New Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

