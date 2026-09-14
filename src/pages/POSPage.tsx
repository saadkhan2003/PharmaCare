import { useState, useCallback } from 'react';
import { POSSearchPanel } from '@/components/pos/POSSearchPanel';
import { POSCartPanel } from '@/components/pos/POSCartPanel';
import { POSReceiptDialog } from '@/components/pos/POSReceiptDialog';
import { usePOSKeyboard } from '@/hooks/usePOSKeyboard';
import { playClick, playSuccess } from '@/lib/sounds';
import type { SessionDto } from '@/types/session';
import type { MedicinePosDto, SaleReceiptDto } from '@/types/sale';

export interface CartItem {
  medicine: MedicinePosDto;
  quantity: number;
  item_discount: number;
}

interface POSPageProps {
  session: SessionDto;
}

export function POSPage({ session }: POSPageProps) {
  const keyboard = usePOSKeyboard();

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [receipt, setReceipt] = useState<SaleReceiptDto | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Search state
  const [query, setQuery] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);

  // Keyboard handlers
  const handleSelectMedicine = useCallback(
    (medicine: MedicinePosDto) => {
      playClick();
      setCart((prev) => {
        const existing = prev.find((item) => item.medicine.id === medicine.id);
        if (existing) {
          return prev.map((item) =>
            item.medicine.id === medicine.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [...prev, { medicine, quantity: 1, item_discount: 0 }];
      });
      // Focus quantity after adding
      setTimeout(() => keyboard.quantityRef.current?.focus(), 50);
    },
    [keyboard.quantityRef]
  );

  const handleUpdateQuantity = useCallback((medicineId: number, qty: number) => {
    setCart((prev) => {
      if (qty <= 0) {
        return prev.filter((item) => item.medicine.id !== medicineId);
      }
      return prev.map((item) =>
        item.medicine.id === medicineId ? { ...item, quantity: qty } : item
      );
    });
  }, []);

  const handleUpdateDiscount = useCallback((medicineId: number, discount: number) => {
    setCart((prev) =>
      prev.map((item) =>
        item.medicine.id === medicineId ? { ...item, item_discount: discount } : item
      )
    );
  }, []);

  const handleRemoveItem = useCallback((medicineId: number) => {
    setCart((prev) => prev.filter((item) => item.medicine.id !== medicineId));
  }, []);

  const handleClearCart = useCallback(() => {
    setCart([]);
    setReceipt(null);
    setReceiptOpen(false);
    setTimeout(() => keyboard.searchRef.current?.focus(), 50);
  }, [keyboard.searchRef]);

  const handleConfirmSale = useCallback((saleReceipt: SaleReceiptDto) => {
    playSuccess();
    setReceipt(saleReceipt);
    setReceiptOpen(true);
  }, []);

  const handleReceiptClose = useCallback(() => {
    setReceiptOpen(false);
    setReceipt(null);
    setCart([]);
    setTimeout(() => keyboard.searchRef.current?.focus(), 50);
  }, [keyboard.searchRef]);

  // Keyboard event handler for search input
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // M-10 fix: clamp index to results bounds — passed from POSSearchPanel via results.length
        setSelectedResultIndex((prev) => prev + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedResultIndex((prev) => Math.max(-1, prev - 1));
      }
    },
    []
  );

  return (
    <div className="flex flex-row h-[calc(100vh-4rem)] p-4 gap-4">
      {/* Left panel: Search */}
      <div className="flex-1 min-w-0 flex flex-col">
        <POSSearchPanel
          session={session}
          onSelectMedicine={handleSelectMedicine}
          selectedResultIndex={selectedResultIndex}
          setSelectedResultIndex={setSelectedResultIndex}
          searchRef={keyboard.searchRef}
          onKeyDown={handleSearchKeyDown}
          debouncedQuery={query}
          setQuery={setQuery}
        />
      </div>

      {/* Right panel: Cart */}
      <div className="w-[480px] shrink-0 flex flex-col">
        <POSCartPanel
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateDiscount={handleUpdateDiscount}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onConfirm={handleConfirmSale}
          session={session}
          quantityRef={keyboard.quantityRef}
          billDiscountRef={keyboard.billDiscountRef}
          taxToggleRef={keyboard.taxToggleRef}
          paymentRef={keyboard.paymentRef}
          customerNameRef={keyboard.customerNameRef}
          confirmRef={keyboard.confirmRef}
        />
      </div>

      {/* Receipt dialog */}
      <POSReceiptDialog
        receipt={receipt}
        open={receiptOpen}
        onClose={handleReceiptClose}
      />
    </div>
  );
}
