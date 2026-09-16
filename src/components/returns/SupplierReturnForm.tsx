import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search as SearchIcon, RotateCcw } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type {
  PurchaseForReturnDto, PurchaseItemForReturnDto,
  SupplierReturnItemDto, ReturnReceiptDto,
} from '@/types/return';

interface SupplierReturnFormProps {
  sessionToken: string;
  currencySymbol: string;
  onReturnComplete: () => void;
}

interface ReturnItemEntry {
  medicine_id: number;
  batch_id: number;
  quantity: string;
  reason: string;
  credit_amount: string;
}

export function SupplierReturnForm({
  sessionToken,
  currencySymbol,
  onReturnComplete,
}: SupplierReturnFormProps) {
  const [purchaseId, setPurchaseId] = useState('');
  const [purchase, setPurchase] = useState<PurchaseForReturnDto | null>(null);
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [returnItems, setReturnItems] = useState<Record<string, ReturnItemEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReturnReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearchPurchase = useCallback(async (queryOverride?: string) => {
    const q = (queryOverride !== undefined ? queryOverride : purchaseId).trim();
    if (!q) {
      setError("Please enter a valid purchase ID or invoice number");
      return;
    }

    setLoadingPurchase(true);
    setError(null);
    setPurchase(null);
    setReturnItems({});
    setSuccess(null);

    try {
      const result = await tauri.returns.searchPurchaseForReturn(
        sessionToken,
        q
      );
      setPurchase(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to load purchase"
      );
    } finally {
      setLoadingPurchase(false);
    }
  }, [purchaseId, sessionToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("search") || params.get("purchaseId") || params.get("purchase");
    if (initialQuery) {
      setPurchaseId(initialQuery);
      handleSearchPurchase(initialQuery);
    }
  }, [handleSearchPurchase]);

  const updateReturnItem = useCallback(
    (itemId: string, updates: Partial<ReturnItemEntry>) => {
      setReturnItems((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], ...updates },
      }));
    },
    []
  );

  const getItemKey = (item: PurchaseItemForReturnDto): string => {
    return `${item.medicine_id}-${item.batch_id}`;
  };

  const handleQuantityChange = useCallback(
    (item: PurchaseItemForReturnDto, value: string) => {
      const key = getItemKey(item);
      const numVal = parseInt(value) || 0;
      const clamped = Math.min(numVal, item.remaining_qty);

      const existing = returnItems[key];
      if (numVal > 0) {
        updateReturnItem(key, {
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          quantity: clamped.toString(),
          reason: existing?.reason || '',
          credit_amount:
            existing?.credit_amount ||
            (clamped * item.purchase_price).toFixed(2),
        });
      } else {
        const newItems = { ...returnItems };
        delete newItems[key];
        setReturnItems(newItems);
      }
    },
    [returnItems, updateReturnItem]
  );

  const handleItemFocus = useCallback(
    (item: PurchaseItemForReturnDto) => {
      const key = getItemKey(item);
      if (!returnItems[key]) {
        updateReturnItem(key, {
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          quantity: '0',
          reason: '',
          credit_amount: '',
        });
      }
    },
    [returnItems, updateReturnItem]
  );

  // Validation
  const selectedItems = Object.values(returnItems).filter(
    (entry) => parseInt(entry.quantity) > 0
  );
  const totalCredit = selectedItems.reduce(
    (sum, entry) => sum + (parseFloat(entry.credit_amount) || 0),
    0
  );
  const isFormValid =
    purchase !== null &&
    selectedItems.length > 0 &&
    selectedItems.every((entry) => {
      const qty = parseInt(entry.quantity);
      return qty > 0 && (parseFloat(entry.credit_amount) || 0) >= 0;
    });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !purchase) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const items: SupplierReturnItemDto[] = selectedItems.map((entry) => ({
        medicine_id: entry.medicine_id,
        batch_id: entry.batch_id,
        quantity: parseInt(entry.quantity),
        reason: entry.reason.trim() || null,
        credit_amount: parseFloat(entry.credit_amount) || 0,
      }));

      const payload = {
        purchase_id: purchase.id,
        items,
      };

      const receipt = await tauri.returns.processSupplierReturn(
        sessionToken,
        payload
      );

      setPurchase(null);
      setReturnItems({});
      setPurchaseId('');

      setSuccess(receipt);
      dispatchEvent('purchases-changed');
      dispatchEvent('medicines-changed');
      onReturnComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to process supplier return'
      );
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, purchase, selectedItems, sessionToken, onReturnComplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && purchaseId.trim()) {
      handleSearchPurchase();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Supplier Return</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success message */}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium">Supplier return processed successfully!</p>
            <p>
              Return IDs: {success.return_ids.join(', ')} —{' '}
              {success.item_count} item(s), total credit:{' '}
              {currencySymbol}{success.total_refund.toFixed(2)}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Section 1: Purchase Search */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="purchaseId">Purchase ID or Invoice # *</Label>
            <div className="flex gap-2">
              <Input
                id="purchaseId"
                type="text"
                placeholder="Enter purchase ID or invoice number (e.g. INV-101)..."
                value={purchaseId}
                onChange={(e) => setPurchaseId(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loadingPurchase}
              />
              <Button
                variant="secondary"
                onClick={() => handleSearchPurchase()}
                disabled={!purchaseId.trim() || loadingPurchase}
              >
                <SearchIcon className="mr-1 h-4 w-4" />
                {loadingPurchase ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 2: Purchase Header Info */}
        {purchase && (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="text-sm">
                <span className="font-medium">Purchase #{purchase.id}</span>
                <span className="text-muted-foreground ml-2">
                  — {formatDate(purchase.purchase_date)}
                </span>
              </div>
              <div className="text-sm sm:text-right">
                <span className="text-muted-foreground">
                  {purchase.supplier_name}
                  {purchase.invoice_number
                    ? ` — Invoice: ${purchase.invoice_number}`
                    : ''}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* No items notice */}
        {purchase && purchase.items.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground bg-muted/20">
            <p className="font-semibold text-foreground mb-1">No Returnable Stock Available</p>
            <p>This purchase has no items eligible for return (it either has no recorded items or all batches have 0 remaining stock in inventory).</p>
          </div>
        )}

        {/* Section 3: Batch Selection Table */}
        {purchase && purchase.items.length > 0 && (
          <div>
            <Label className="mb-3 block text-base font-medium">
              Purchase Items — Select batches to return
            </Label>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Medicine</TableHead>
                    <TableHead className="w-[60px]">Purchased</TableHead>
                    <TableHead className="w-[60px]">Remaining</TableHead>
                    <TableHead className="w-[80px]">Purchase Price</TableHead>
                    <TableHead className="w-[100px]">Expiry</TableHead>
                    <TableHead className="w-[80px]">Return Qty</TableHead>
                    <TableHead className="min-w-[100px]">Reason</TableHead>
                    <TableHead className="w-[110px]">Credit Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => {
                    const key = getItemKey(item);
                    const entry = returnItems[key];
                    const qty = entry ? parseInt(entry.quantity) : 0;
                    const isSelected = qty > 0;

                    return (
                      <TableRow
                        key={key}
                        className={isSelected ? 'bg-muted/30' : ''}
                      >
                        <TableCell className="font-medium">
                          {item.medicine_name}
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.remaining_qty}</TableCell>
                        <TableCell>
                          {currencySymbol}{item.purchase_price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(item.expiry_date)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={item.remaining_qty}
                            step="1"
                            placeholder="0"
                            value={entry?.quantity || '0'}
                            onFocus={() => handleItemFocus(item)}
                            onChange={(e) =>
                              handleQuantityChange(item, e.target.value)
                            }
                            className="w-20 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Reason"
                            value={entry?.reason || ''}
                            onFocus={() => handleItemFocus(item)}
                            onChange={(e) =>
                              updateReturnItem(key, { reason: e.target.value })
                            }
                            className="text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={isSelected ? '0.00' : '—'}
                            value={entry?.credit_amount || ''}
                            onFocus={() => handleItemFocus(item)}
                            onChange={(e) =>
                              updateReturnItem(key, {
                                credit_amount: e.target.value,
                              })
                            }
                            className="w-24 text-sm"
                            disabled={!isSelected}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Section 4: Summary */}
        {selectedItems.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="text-sm text-muted-foreground">
              {selectedItems.length} batch(es) selected for return
            </div>
            <div className="text-lg font-bold">
              Total Credit: {currencySymbol}
              {totalCredit.toFixed(2)}
            </div>
          </div>
        )}

        {/* Section 5: Submit */}
        {purchase && purchase.items.length > 0 && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
              {submitting ? 'Processing...' : 'Process Supplier Return'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
