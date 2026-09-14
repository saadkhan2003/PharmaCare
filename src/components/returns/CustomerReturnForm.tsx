import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search as SearchIcon, Undo2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type {
  SaleForReturnDto, SaleItemForReturnDto,
  CustomerReturnItemDto, ReturnReceiptDto,
} from '@/types/return';

interface CustomerReturnFormProps {
  sessionToken: string;
  currencySymbol: string;
  onReturnComplete: () => void;
}

interface ReturnItemEntry {
  sale_item_id: number;
  medicine_id: number;
  medicine_name: string;
  batch_id: number;
  quantity: string;
  condition: 'resellable' | 'damaged' | 'expired';
  reason: string;
  refund_amount: string;
}

export function CustomerReturnForm({
  sessionToken,
  currencySymbol,
  onReturnComplete,
}: CustomerReturnFormProps) {
  const [saleId, setSaleId] = useState('');
  const [sale, setSale] = useState<SaleForReturnDto | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);
  const [returnItems, setReturnItems] = useState<Record<string, ReturnItemEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReturnReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSale = useCallback(async () => {
    const id = parseInt(saleId);
    if (isNaN(id) || id <= 0) {
      setError('Please enter a valid sale ID');
      return;
    }

    setLoadingSale(true);
    setError(null);
    setSale(null);
    setReturnItems({});
    setSuccess(null);

    try {
      const result = await tauri.returns.searchSaleForReturn(sessionToken, id);
      setSale(result);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to load sale'
      );
    } finally {
      setLoadingSale(false);
    }
  }, [saleId, sessionToken]);

  const updateReturnItem = useCallback(
    (itemId: string, updates: Partial<ReturnItemEntry>) => {
      setReturnItems((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], ...updates },
      }));
    },
    []
  );

  const getItemKey = (item: SaleItemForReturnDto): string => {
    return `${item.medicine_id}-${item.batch_id}`;
  };

  const handleQuantityChange = useCallback(
    (item: SaleItemForReturnDto, value: string) => {
      const key = getItemKey(item);
      const numVal = parseInt(value) || 0;
      const clamped = Math.min(numVal, item.returnable_qty).toString();

      if (numVal > 0) {
        const existing = returnItems[key];
        updateReturnItem(key, {
          quantity: clamped,
          refund_amount: existing?.refund_amount || (clamped ? (parseFloat(clamped) * item.unit_price).toFixed(2) : ''),
        });
      } else {
        // Remove from return items if qty is 0 or empty
        const newItems = { ...returnItems };
        delete newItems[key];
        setReturnItems(newItems);
      }
    },
    [returnItems, updateReturnItem]
  );

  const handleItemFocus = useCallback(
    (item: SaleItemForReturnDto) => {
      const key = getItemKey(item);
      if (!returnItems[key]) {
        updateReturnItem(key, {
          sale_item_id: item.sale_item_id,
          medicine_id: item.medicine_id,
          medicine_name: item.medicine_name,
          batch_id: item.batch_id,
          quantity: '0',
          condition: 'resellable',
          reason: '',
          refund_amount: '',
        });
      }
    },
    [returnItems, updateReturnItem]
  );

  // Validation
  const selectedItems = Object.values(returnItems).filter(
    (entry) => parseInt(entry.quantity) > 0
  );
  const totalRefund = selectedItems.reduce(
    (sum, entry) => sum + (parseFloat(entry.refund_amount) || 0),
    0
  );
  const isFormValid =
    sale !== null &&
    selectedItems.length > 0 &&
    selectedItems.every((entry) => {
      const qty = parseInt(entry.quantity);
      return qty > 0 && (parseFloat(entry.refund_amount) || 0) >= 0;
    });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !sale) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const items: CustomerReturnItemDto[] = selectedItems.map((entry) => ({
        sale_item_id: entry.sale_item_id,
        medicine_id: entry.medicine_id,
        batch_id: entry.batch_id,
        quantity: parseInt(entry.quantity),
        condition: entry.condition,
        reason: entry.reason.trim() || null,
        refund_amount: parseFloat(entry.refund_amount) || 0,
      }));

      const payload = {
        sale_id: sale.id,
        items,
      };

      const receipt = await tauri.returns.processCustomerReturn(
        sessionToken,
        payload
      );

      setSale(null);
      setReturnItems({});
      setSaleId('');

      setSuccess(receipt);
      dispatchEvent('sales-changed');
      dispatchEvent('medicines-changed');
      onReturnComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to process return'
      );
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, sale, selectedItems, sessionToken, onReturnComplete]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && saleId.trim()) {
      handleSearchSale();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer Return</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success message */}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium">Return processed successfully!</p>
            <p>
              Return IDs: {success.return_ids.join(', ')} —{' '}
              {success.item_count} item(s), total refund:{' '}
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

        {/* Section 1: Sale Search */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="saleId">Sale ID *</Label>
            <div className="flex gap-2">
              <Input
                id="saleId"
                ref={searchInputRef}
                type="number"
                min="1"
                placeholder="Enter sale ID..."
                value={saleId}
                onChange={(e) => setSaleId(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loadingSale}
              />
              <Button
                variant="secondary"
                onClick={handleSearchSale}
                disabled={!saleId.trim() || loadingSale}
              >
                <SearchIcon className="mr-1 h-4 w-4" />
                {loadingSale ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </div>
        </div>

        {/* Section 2: Sale Header Info */}
        {sale && (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="text-sm">
                <span className="font-medium">Sale #{sale.id}</span>
                <span className="text-muted-foreground ml-2">
                  — {formatDate(sale.created_at)}
                </span>
              </div>
              <div className="text-sm sm:text-right">
                <span className="text-muted-foreground">
                  {sale.payment_method}
                  {sale.customer_name ? ` — ${sale.customer_name}` : ''}
                </span>
              </div>
            </div>
            <div className="text-sm mt-1">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-medium">
                {currencySymbol}{sale.total.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Section 3: Items Table */}
        {sale && sale.items.length > 0 && (
          <div>
            <Label className="mb-3 block text-base font-medium">
              Sale Items — Select items to return
            </Label>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Medicine</TableHead>
                    <TableHead className="w-[60px]">Sold</TableHead>
                    <TableHead className="w-[60px]">Returned</TableHead>
                    <TableHead className="w-[60px]">Max</TableHead>
                    <TableHead className="w-[80px]">Unit Price</TableHead>
                    <TableHead className="w-[80px]">Return Qty</TableHead>
                    <TableHead className="w-[110px]">Condition</TableHead>
                    <TableHead className="min-w-[100px]">Reason</TableHead>
                    <TableHead className="w-[100px]">Refund Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => {
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
                        <TableCell>{item.already_returned_qty}</TableCell>
                        <TableCell>{item.returnable_qty}</TableCell>
                        <TableCell>
                          {currencySymbol}{item.unit_price.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={item.returnable_qty}
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
                          <Select
                            value={entry?.condition || 'resellable'}
                            onValueChange={(value: 'resellable' | 'damaged' | 'expired' | null) => {
                              handleItemFocus(item);
                              if (value) updateReturnItem(key, { condition: value });
                            }}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="resellable">Resellable</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                              <SelectItem value="expired">Expired</SelectItem>
                            </SelectContent>
                          </Select>
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
                            value={entry?.refund_amount || ''}
                            onFocus={() => {
                              if (!entry) {
                                updateReturnItem(key, {
                                  sale_item_id: item.sale_item_id,
                                  medicine_id: item.medicine_id,
                                  medicine_name: item.medicine_name,
                                  batch_id: item.batch_id,
                                  quantity: '0',
                                  condition: 'resellable',
                                  reason: '',
                                  refund_amount: '',
                                });
                              }
                            }}
                            onChange={(e) =>
                              updateReturnItem(key, {
                                refund_amount: e.target.value,
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
              {selectedItems.length} item(s) selected for return
            </div>
            <div className="text-lg font-bold">
              Refund: {currencySymbol}
              {totalRefund.toFixed(2)}
            </div>
          </div>
        )}

        {/* Section 5: Submit */}
        {sale && (
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              {submitting ? 'Processing...' : 'Process Return'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
