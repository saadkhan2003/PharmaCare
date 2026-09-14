import { useState, useCallback, useEffect, useRef } from 'react';
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
import { Search as SearchIcon, Trash2 } from 'lucide-react';
import { tauri } from '@/lib/tauri';
import { dispatchEvent } from '@/lib/eventBus';
import { formatDate } from '@/lib/formatDate';
import type { MedicineListItem } from '@/types/medicine';
import type { ReturnReceiptDto, WriteOffItemDto } from '@/types/return';
import type { ExpiryReportRow } from '@/lib/tauri';

interface WriteOffFormProps {
  sessionToken: string;
  currencySymbol: string;
  onComplete: () => void;
}

interface WriteOffEntry {
  medicine_id: number;
  batch_id: number;
  quantity: string;
  condition: 'expired' | 'damaged';
  reason: string;
}

export function WriteOffForm({
  sessionToken,
  currencySymbol,
  onComplete,
}: WriteOffFormProps) {
  const [medicineSearchTerm, setMedicineSearchTerm] = useState('');
  const [medicineResults, setMedicineResults] = useState<MedicineListItem[]>([]);
  const [searchingMedicine, setSearchingMedicine] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineListItem | null>(null);
  const [batches, setBatches] = useState<ExpiryReportRow[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [writeOffItems, setWriteOffItems] = useState<Record<string, WriteOffEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<ReturnReceiptDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced medicine search
  useEffect(() => {
    if (!medicineSearchTerm.trim()) {
      setMedicineResults([]);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      setSearchingMedicine(true);
      try {
        const result = await tauri.medicines.search(
          sessionToken,
          medicineSearchTerm,
          1,
          200
        );
        setMedicineResults(result.items.filter((m) => m.is_active));
      } catch {
        setMedicineResults([]);
      } finally {
        setSearchingMedicine(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [medicineSearchTerm, sessionToken]);

  // Load batches when a medicine is selected
  useEffect(() => {
    if (!selectedMedicine) {
      setBatches([]);
      return;
    }

    setLoadingBatches(true);
    tauri.expiry
      .getReport(sessionToken)
      .then((report) => {
        // Write-off must include expired batches too; the POS stock count excludes them.
        const medicineBatches = report.filter(
          (row) =>
            row.medicine_id === selectedMedicine.id && row.remaining_qty > 0
        );
        setBatches(medicineBatches);
      })
      .catch(() => {
        setBatches([]);
      })
      .finally(() => {
        setLoadingBatches(false);
      });
  }, [selectedMedicine, sessionToken]);

  const handleSelectMedicine = useCallback(
    (medicine: MedicineListItem) => {
      setSelectedMedicine(medicine);
      setMedicineSearchTerm('');
      setMedicineResults([]);
      setWriteOffItems({});
      setSuccess(null);
      setError(null);
    },
    []
  );

  const updateWriteOffItem = useCallback(
    (itemId: string, updates: Partial<WriteOffEntry>) => {
      setWriteOffItems((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], ...updates },
      }));
    },
    []
  );

  const getItemKey = (batch: ExpiryReportRow): string => {
    return `${batch.medicine_id}-${batch.batch_id}`;
  };

  const handleQuantityChange = useCallback(
    (batch: ExpiryReportRow, value: string) => {
      const key = getItemKey(batch);
      const numVal = parseInt(value) || 0;
      const clamped = Math.min(numVal, batch.remaining_qty);

      const existing = writeOffItems[key];
      if (numVal > 0) {
        updateWriteOffItem(key, {
          medicine_id: batch.medicine_id,
          batch_id: batch.batch_id,
          quantity: clamped.toString(),
          condition: existing?.condition || 'expired',
          reason: existing?.reason || '',
        });
      } else {
        const newItems = { ...writeOffItems };
        delete newItems[key];
        setWriteOffItems(newItems);
      }
    },
    [writeOffItems, updateWriteOffItem]
  );

  const handleItemFocus = useCallback(
    (batch: ExpiryReportRow) => {
      const key = getItemKey(batch);
      if (!writeOffItems[key]) {
        updateWriteOffItem(key, {
          medicine_id: batch.medicine_id,
          batch_id: batch.batch_id,
          quantity: '0',
          condition: 'expired',
          reason: '',
        });
      }
    },
    [writeOffItems, updateWriteOffItem]
  );

  // Validation
  const selectedItems = Object.values(writeOffItems).filter(
    (entry) => parseInt(entry.quantity) > 0
  );
  const totalQty = selectedItems.reduce(
    (sum, entry) => sum + (parseInt(entry.quantity) || 0),
    0
  );
  const isFormValid =
    selectedMedicine !== null &&
    selectedItems.length > 0 &&
    selectedItems.every((entry) => {
      const qty = parseInt(entry.quantity);
      return qty > 0;
    });

  const handleSubmit = useCallback(async () => {
    if (!isFormValid) return;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const items: WriteOffItemDto[] = selectedItems.map((entry) => ({
        medicine_id: entry.medicine_id,
        batch_id: entry.batch_id,
        quantity: parseInt(entry.quantity),
        condition: entry.condition,
        reason: entry.reason.trim() || null,
      }));

      const payload = { items };

      const receipt = await tauri.returns.processWriteOff(
        sessionToken,
        payload
      );

      setSelectedMedicine(null);
      setBatches([]);
      setWriteOffItems({});
      setMedicineSearchTerm('');

      setSuccess(receipt);
      dispatchEvent('medicines-changed');
      onComplete();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to process write-off'
      );
    } finally {
      setSubmitting(false);
    }
  }, [isFormValid, selectedItems, sessionToken, onComplete]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Write Off Stock</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success message */}
        {success && (
          <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
            <p className="font-medium">Write-off processed successfully!</p>
            <p>
              Return IDs: {success.return_ids.join(', ')} —{' '}
              {success.item_count} item(s) written off
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Section 1: Medicine Search */}
        <div className="grid gap-4 sm:grid-cols-1">
          <div className="grid gap-2">
            <Label htmlFor="medicineSearch">
              {selectedMedicine ? 'Selected Medicine' : 'Search Medicine *'}
            </Label>
            {selectedMedicine ? (
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-3">
                <span className="font-medium">{selectedMedicine.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {currencySymbol}
                  {selectedMedicine.retail_price?.toFixed(2) || '0.00'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setSelectedMedicine(null);
                    setBatches([]);
                    setWriteOffItems({});
                  }}
                >
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="medicineSearch"
                  placeholder="Search medicine..."
                  value={medicineSearchTerm}
                  onChange={(e) => setMedicineSearchTerm(e.target.value)}
                  className="pl-8"
                />
                {medicineResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {searchingMedicine ? (
                      <div className="p-2 text-xs text-muted-foreground">
                        Searching...
                      </div>
                    ) : (
                      medicineResults.map((med) => (
                        <button
                          key={med.id}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-accent"
                          onClick={() => handleSelectMedicine(med)}
                        >
                          <span>{med.name}</span>
                          {med.retail_price != null && (
                            <span className="text-xs text-muted-foreground">
                              {currencySymbol}
                              {med.retail_price.toFixed(2)}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Batch Selection */}
        {selectedMedicine && !loadingBatches && batches.length > 0 && (
          <div>
            <Label className="mb-3 block text-base font-medium">
              Available Batches — Select stock to write off
            </Label>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Batch ID</TableHead>
                    <TableHead className="w-[100px]">Expiry</TableHead>
                    <TableHead className="w-[80px]">Days Left</TableHead>
                    <TableHead className="w-[80px]">Remaining</TableHead>
                    <TableHead className="w-[80px]">Write-Off Qty</TableHead>
                    <TableHead className="w-[110px]">Condition</TableHead>
                    <TableHead className="min-w-[120px]">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const key = getItemKey(batch);
                    const entry = writeOffItems[key];
                    const qty = entry ? parseInt(entry.quantity) : 0;
                    const isSelected = qty > 0;

                    return (
                      <TableRow
                        key={key}
                        className={isSelected ? 'bg-muted/30' : ''}
                      >
                        <TableCell className="font-mono text-sm">
                          #{batch.batch_id}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(batch.expiry_date)}
                        </TableCell>
                        <TableCell
                          className={`text-sm ${
                            batch.days_remaining <= 30
                              ? 'text-destructive font-medium'
                              : batch.days_remaining <= 90
                              ? 'text-amber-600'
                              : ''
                          }`}
                        >
                          {batch.days_remaining}d
                        </TableCell>
                        <TableCell>{batch.remaining_qty}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            max={batch.remaining_qty}
                            step="1"
                            placeholder="0"
                            value={entry?.quantity || '0'}
                            onFocus={() => handleItemFocus(batch)}
                            onChange={(e) =>
                              handleQuantityChange(batch, e.target.value)
                            }
                            className="w-20 text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry?.condition || 'expired'}
                            onValueChange={(
                              value: 'expired' | 'damaged' | null
                            ) => {
                              handleItemFocus(batch);
                              if (value)
                                updateWriteOffItem(key, {
                                  condition: value,
                                });
                            }}
                          >
                            <SelectTrigger className="w-[110px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="expired">Expired</SelectItem>
                              <SelectItem value="damaged">Damaged</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="Reason for write-off"
                            value={entry?.reason || ''}
                            onFocus={() => handleItemFocus(batch)}
                            onChange={(e) =>
                              updateWriteOffItem(key, {
                                reason: e.target.value,
                              })
                            }
                            className="text-sm"
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

        {/* No batches available */}
        {selectedMedicine && !loadingBatches && batches.length === 0 && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            No batches with remaining stock found for this medicine. Expired batches should appear here if they still have remaining quantity.
          </div>
        )}

        {/* Loading batches */}
        {selectedMedicine && loadingBatches && (
          <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
            Loading batches...
          </div>
        )}

        {/* Section 3: Summary */}
        {selectedItems.length > 0 && (
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="text-sm text-muted-foreground">
              {selectedItems.length} batch(es) selected — {totalQty} total
              units
            </div>
            <div className="text-lg font-bold text-destructive">
              <Trash2 className="mr-1 inline-block h-5 w-5" />
              Write off {totalQty} units
            </div>
          </div>
        )}

        {/* Section 4: Submit */}
        {selectedMedicine && (
          <div className="flex justify-end">
            <Button
              size="lg"
              variant="destructive"
              onClick={handleSubmit}
              disabled={!isFormValid || submitting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {submitting ? 'Processing...' : 'Confirm Write-Off'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
