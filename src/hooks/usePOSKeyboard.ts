import { useRef, useCallback } from 'react';
import type { MedicinePosDto } from '../types/sale';

/** Tab order constants for keyboard navigation through POS fields */
export const TAB_ORDER = {
  SEARCH: 1,
  SEARCH_RESULTS: 2,
  QUANTITY: 3,
  ITEM_DISCOUNT: 4,
  BILL_DISCOUNT: 5,
  TAX_TOGGLE: 6,
  PAYMENT_METHOD: 7,
  CUSTOMER_NAME: 8,
  CONFIRM: 9,
} as const;

export function usePOSKeyboard() {
  const searchRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const itemDiscountRef = useRef<HTMLInputElement>(null);
  const billDiscountRef = useRef<HTMLInputElement>(null);
  const taxToggleRef = useRef<HTMLButtonElement>(null);
  const paymentRef = useRef<HTMLButtonElement>(null);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  /** Focus management for search input — ArrowUp/Down to navigate results, Enter to select */
  const handleSearchKeyDown = useCallback(
    (
      e: React.KeyboardEvent,
      results: MedicinePosDto[],
      selectedIndex: number,
      onSelect: (m: MedicinePosDto) => void
    ) => {
      if (results.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        // Parent updates selectedResultIndex via setSelectedResultIndex prop
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        // Parent updates selectedResultIndex via setSelectedResultIndex prop
      }

      if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < results.length) {
        e.preventDefault();
        onSelect(results[selectedIndex]);
      }
    },
    []
  );

  /** Focus management for quantity input — Enter adds item */
  const handleQuantityKeyDown = useCallback(
    (e: React.KeyboardEvent, onAdd: () => void) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onAdd();
      }
    },
    []
  );

  return {
    searchRef,
    quantityRef,
    itemDiscountRef,
    billDiscountRef,
    taxToggleRef,
    paymentRef,
    customerNameRef,
    confirmRef,
    handleSearchKeyDown,
    handleQuantityKeyDown,
  };
}
