import { CheckCircle } from 'lucide-react';
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
import type { SaleReceiptDto } from '@/types/sale';

interface POSReceiptDialogProps {
  receipt: SaleReceiptDto | null;
  open: boolean;
  onClose: () => void;
}

export function POSReceiptDialog({ receipt, open, onClose }: POSReceiptDialogProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <DialogTitle className="text-2xl">Sale Complete</DialogTitle>
              <DialogDescription className="text-base">
                Sale has been recorded successfully
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Sale ID */}
        <div className="bg-muted rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Sale ID</p>
          <p className="text-3xl font-bold text-primary">#{receipt.sale_id}</p>
        </div>

        {/* Items */}
        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Items ({receipt.item_count})</h3>
          <div className="space-y-1">
            {receipt.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm py-1">
                <div className="flex-1 min-w-0 mr-2">
                  <span className="font-medium truncate block">{item.medicine_name}</span>
                  <span className="text-muted-foreground text-xs">
                    {item.quantity} × Rs. {item.unit_price.toFixed(2)}
                    {item.item_discount > 0 && ` - Rs. ${item.item_discount.toFixed(2)}`}
                  </span>
                </div>
                <span className="font-semibold shrink-0">Rs. {item.line_total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Totals */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>Rs. {receipt.subtotal.toFixed(2)}</span>
          </div>
          {receipt.bill_discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Bill Discount</span>
              <span className="text-destructive">-Rs. {receipt.bill_discount.toFixed(2)}</span>
            </div>
          )}
          {receipt.tax_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Tax ({(receipt.tax_rate * 100).toFixed(0)}%)
              </span>
              <span>Rs. {receipt.tax_amount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-2xl font-bold pt-2 border-t border-border">
            <span>Total</span>
            <span>Rs. {receipt.total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment info */}
        <div className="bg-muted rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment Method</span>
            <span className="font-medium">{receipt.payment_method}</span>
          </div>
          {receipt.customer_name && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{receipt.customer_name}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose} className="w-full h-12 text-lg font-semibold" autoFocus>
            New Sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
