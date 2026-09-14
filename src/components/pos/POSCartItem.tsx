import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { playClick } from '@/lib/sounds';
import type { CartItem } from '@/pages/POSPage';

interface POSCartItemProps {
  item: CartItem;
  onUpdateQuantity: (medicineId: number, qty: number) => void;
  onUpdateDiscount: (medicineId: number, discount: number) => void;
  onRemove: (medicineId: number) => void;
  quantityRef?: React.RefObject<HTMLInputElement>;
}

export function POSCartItem({
  item,
  onUpdateQuantity,
  onUpdateDiscount,
  onRemove,
  quantityRef,
}: POSCartItemProps) {
  const lineTotal = item.quantity * item.medicine.retail_price - item.item_discount;

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0 mr-2">
          <p className="text-base font-semibold truncate">{item.medicine.name}</p>
          <p className="text-sm text-muted-foreground">
            Rs. {item.medicine.retail_price} / {item.medicine.unit}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive"
          onClick={() => onRemove(item.medicine.id)}
          aria-label="Remove item from cart"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        {/* Quantity */}
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">Qty</label>
          <Input
            ref={quantityRef}
            type="number"
            min={1}
            max={item.medicine.current_stock}
            value={item.quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val)) { playClick(); onUpdateQuantity(item.medicine.id, val); }
            }}
            className="h-9 text-base"
          />
        </div>

        {/* Item discount */}
        <div className="flex-1">
          <label className="text-xs text-muted-foreground block mb-1">Disc. (Rs.)</label>
          <Input
            type="number"
            min={0}
            value={item.item_discount || ''}
            placeholder="0"
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onUpdateDiscount(item.medicine.id, isNaN(val) ? 0 : val);
            }}
            className="h-9 text-base"
          />
        </div>

        {/* Line total */}
        <div className="w-24 text-right shrink-0">
          <label className="text-xs text-muted-foreground block mb-1">Total</label>
          <p className="text-base font-bold">Rs. {lineTotal.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
