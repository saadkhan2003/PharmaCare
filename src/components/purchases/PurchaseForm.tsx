import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
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
import { Plus, Trash2, Search as SearchIcon } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { PAYMENT_STATUSES } from '@/types/purchase';
import type { SupplierDto } from '@/types/supplier';
import type { MedicineListItem } from '@/types/medicine';

interface PurchaseFormProps {
  sessionToken: string;
  currencySymbol: string;
  onPurchaseComplete: () => void;
}

interface ItemRow {
  id: string;
  medicineId: number | null;
  medicineName: string;
  quantity: string;
  purchasePrice: string;
  expiryDate: string;
}

interface MedicineSearchResult {
  id: number;
  name: string;
  retail_price: number;
}

function createEmptyItem(): ItemRow {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    medicineId: null,
    medicineName: '',
    quantity: '',
    purchasePrice: '',
    expiryDate: '',
  };
}

export function PurchaseForm({
  sessionToken,
  currencySymbol,
  onPurchaseComplete,
}: PurchaseFormProps) {
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('Pending');
  const [items, setItems] = useState<ItemRow[]>([createEmptyItem()]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ purchaseId: number; totalCost: number; itemCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Medicine search state for item rows
  const [medicineSearchTerms, setMedicineSearchTerms] = useState<Record<string, string>>({});
  const [medicineResults, setMedicineResults] = useState<Record<string, MedicineSearchResult[]>>({});
  const [searchingMedicines, setSearchingMedicines] = useState<Record<string, boolean>>({});

  // Load suppliers on mount
  useEffect(() => {
    tauri.suppliers.list(sessionToken)
      .then((result) => setSuppliers(result.filter((s) => s.is_active)))
      .catch(() => {});
  }, [sessionToken]);

  // Debounced medicine search per item row
  const handleMedicineSearch = useCallback(
    async (itemId: string, query: string) => {
      if (!query.trim()) {
        setMedicineResults((prev) => ({ ...prev, [itemId]: [] }));
        return;
      }
      setSearchingMedicines((prev) => ({ ...prev, [itemId]: true }));
      try {
        const results = await tauri.medicines.search(sessionToken, query);
        setMedicineResults((prev) => ({
          ...prev,
          [itemId]: results
            .filter((m) => m.is_active)
            .map((m) => ({
              id: m.id,
              name: m.name,
              retail_price: (m as MedicineListItem).retail_price,
            })),
        }));
      } catch {
        setMedicineResults((prev) => ({ ...prev, [itemId]: [] }));
      } finally {
        setSearchingMedicines((prev) => ({ ...prev, [itemId]: false }));
      }
    },
    [sessionToken]
  );

  const updateItem = useCallback((itemId: string, updates: Partial<ItemRow>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item))
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, createEmptyItem()]);
  }, []);

  // Calculate line cost
  const getLineCost = (item: ItemRow): number => {
    const qty = parseFloat(item.quantity);
    const price = parseFloat(item.purchasePrice);
    if (isNaN(qty) || isNaN(price)) return 0;
    return qty * price;
  };

  // Calculate total
  const totalCost = items.reduce((sum, item) => sum + getLineCost(item), 0);

  // Validate form
  const isFormValid = (): boolean => {
    if (!selectedSupplierId) return false;
    if (items.length === 0) return false;
    return items.every((item) => {
      if (!item.medicineId) return false;
      const qty = parseInt(item.quantity);
      if (isNaN(qty) || qty <= 0) return false;
      const price = parseFloat(item.purchasePrice);
      if (isNaN(price) || price < 0) return false;
      if (!item.expiryDate) return false;
      return true;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        supplier_id: parseInt(selectedSupplierId),
        invoice_number: invoiceNumber.trim() || null,
        purchase_date: purchaseDate,
        payment_status: paymentStatus,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          medicine_id: item.medicineId!,
          quantity: parseInt(item.quantity),
          purchase_price: parseFloat(item.purchasePrice),
          expiry_date: item.expiryDate,
        })),
      };

      const receipt = await tauri.purchases.record(sessionToken, payload);

      // Reset form
      setSelectedSupplierId('');
      setInvoiceNumber('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setPaymentStatus('Pending');
      setItems([createEmptyItem()]);
      setMedicineSearchTerms({});
      setMedicineResults({});

      setSuccess({
        purchaseId: receipt.purchase_id,
        totalCost: receipt.total_cost,
        itemCount: receipt.item_count,
      });
      onPurchaseComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to record purchase'
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    selectedSupplierId, invoiceNumber, purchaseDate, paymentStatus, notes, items,
    sessionToken, isFormValid, onPurchaseComplete,
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New Purchase</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success message */}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium">Purchase recorded successfully!</p>
            <p>
              Purchase #{success.purchaseId} — {success.itemCount} item(s), total:{' '}
              {currencySymbol}{success.totalCost.toFixed(2)}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Section 1: Purchase Header */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="supplier">Supplier *</Label>
            <Select
              value={selectedSupplierId}
              onValueChange={(value: string | null) => {
                setSelectedSupplierId(value || '');
              }}
            >
              <SelectTrigger id="supplier">
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.company_name}
                    {s.contact_person ? ` — ${s.contact_person}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice">Invoice Number</Label>
            <Input
              id="invoice"
              placeholder="INV-001"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="purchase_date">Purchase Date *</Label>
            <Input
              id="purchase_date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payment_status">Payment Status *</Label>
            <Select
              value={paymentStatus}
              onValueChange={(value: string | null) => {
                setPaymentStatus(value || 'Pending');
              }}
            >
              <SelectTrigger id="payment_status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes about this purchase..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Section 2: Inline Items Table */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-base font-medium">Items</Label>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Medicine</TableHead>
                  <TableHead className="w-[80px]">Qty</TableHead>
                  <TableHead className="w-[100px]">Price</TableHead>
                  <TableHead className="w-[120px]">Expiry Date</TableHead>
                  <TableHead className="w-[100px] text-right">Line Cost</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const searchTerm = medicineSearchTerms[item.id] || '';
                  const results = medicineResults[item.id] || [];
                  const showResults = searchTerm.trim().length > 0 && !item.medicineId;

                  return (
                    <TableRow key={item.id}>
                      {/* Medicine Search */}
                      <TableCell>
                        <div className="relative">
                          <SearchIcon className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search medicine..."
                            value={item.medicineName || searchTerm}
                            onChange={(e) => {
                              const val = e.target.value;
                              setMedicineSearchTerms((prev) => ({
                                ...prev,
                                [item.id]: val,
                              }));
                              if (!item.medicineId) {
                                updateItem(item.id, { medicineName: val });
                              } else {
                                // Clear selection if user types
                                updateItem(item.id, {
                                  medicineId: null,
                                  medicineName: val,
                                });
                              }
                            }}
                            onFocus={() => {
                              if (!item.medicineId && searchTerm.trim()) {
                                handleMedicineSearch(item.id, searchTerm);
                              }
                            }}
                            className="pl-7 text-sm"
                          />
                          {showResults && (
                            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                              {searchingMedicines[item.id] ? (
                                <div className="p-2 text-xs text-muted-foreground">
                                  Searching...
                                </div>
                              ) : results.length === 0 ? (
                                <div className="p-2 text-xs text-muted-foreground">
                                  No medicines found
                                </div>
                              ) : (
                                results.map((med) => (
                                  <button
                                    key={med.id}
                                    type="button"
                                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent"
                                    onClick={() => {
                                      updateItem(item.id, {
                                        medicineId: med.id,
                                        medicineName: med.name,
                                      });
                                      if (!item.purchasePrice) {
                                        updateItem(item.id, {
                                          purchasePrice: med.retail_price.toString(),
                                        });
                                      }
                                      setMedicineSearchTerms((prev) => ({
                                        ...prev,
                                        [item.id]: '',
                                      }));
                                    }}
                                  >
                                    <span>{med.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {currencySymbol}{med.retail_price.toFixed(2)}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="100"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.id, { quantity: e.target.value })
                          }
                          className="text-sm"
                        />
                      </TableCell>

                      {/* Purchase Price */}
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="5.00"
                          value={item.purchasePrice}
                          onChange={(e) =>
                            updateItem(item.id, {
                              purchasePrice: e.target.value,
                            })
                          }
                          className="text-sm"
                        />
                      </TableCell>

                      {/* Expiry Date */}
                      <TableCell>
                        <Input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            updateItem(item.id, { expiryDate: e.target.value })
                          }
                          className="text-sm"
                        />
                      </TableCell>

                      {/* Line Cost */}
                      <TableCell className="text-right font-medium">
                        {currencySymbol}
                        {getLineCost(item).toFixed(2)}
                      </TableCell>

                      {/* Remove */}
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Summary */}
          <div className="mt-4 flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="text-sm text-muted-foreground">
              {items.length} item(s)
            </div>
            <div className="text-lg font-bold">
              Total: {currencySymbol}
              {totalCost.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Section 3: Confirm */}
        <div className="flex justify-end">
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={!isFormValid() || submitting}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {submitting ? 'Recording...' : 'Confirm Purchase'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
