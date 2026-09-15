import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, AlertCircle, CheckCircle2, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { tauri } from '@/lib/tauri';

interface ImportMedicinesDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  sessionToken: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export function ImportMedicinesDialog({
  open,
  onClose,
  onImported,
  sessionToken,
}: ImportMedicinesDialogProps) {
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCsvToPreview = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const rows = lines.slice(0, 7).map((line) => {
      const rowResult: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
          inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
          rowResult.push(current.trim());
          current = '';
        } else {
          current += line[i];
        }
      }
      rowResult.push(current.trim());
      return rowResult;
    });
    setPreview(rows);
  };

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const generatedCsv = XLSX.utils.sheet_to_csv(worksheet);

          setCsvText(generatedCsv);
          parseCsvToPreview(generatedCsv);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to parse Excel file';
          setResult({ imported: 0, skipped: 0, errors: [msg] });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setCsvText(text);
        parseCsvToPreview(text);
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDownloadSample = (format: 'csv' | 'xlsx') => {
    const sampleHeaders = [
      'name',
      'generic_name',
      'brand_name',
      'category',
      'unit',
      'purchase_price',
      'retail_price',
      'reorder_level',
      'shelf_location',
      'notes',
    ];

    const sampleRows = [
      sampleHeaders,
      ['Panadol 500mg', 'Paracetamol', 'GSK', 'Tablet', 'Strip', '18.00', '25.00', '50', 'A1-01', 'Analgesic'],
      ['Brufen 400mg', 'Ibuprofen', 'Abbott', 'Tablet', 'Strip', '25.00', '35.00', '40', 'A1-02', 'Pain relief'],
      ['Amoxil 250mg/5ml', 'Amoxicillin', 'GSK', 'Syrup', 'Bottle', '60.00', '80.00', '20', 'B2-04', 'Antibiotic'],
      ['Augmentin 625mg', 'Co-Amoxiclav', 'GSK', 'Tablet', 'Box', '280.00', '350.00', '15', 'B1-02', 'Antibiotic'],
    ];

    if (format === 'csv') {
      const csvContent = sampleRows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pharmacare_medicines_sample.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const ws = XLSX.utils.aoa_to_sheet(sampleRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Medicines');
      XLSX.writeFile(wb, 'pharmacare_medicines_sample.xlsx');
    }
  };

  const handleImport = useCallback(async () => {
    if (!csvText.trim()) return;
    setImporting(true);
    try {
      const res = await tauri.medicines.importCsv(sessionToken, csvText);
      setResult(res);
      if (res.imported > 0) {
        onImported();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setResult({ imported: 0, skipped: 0, errors: [message] });
    } finally {
      setImporting(false);
    }
  }, [csvText, sessionToken, onImported]);

  const handleClose = useCallback(() => {
    setCsvText('');
    setPreview([]);
    setResult(null);
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Import Medicines (CSV or Excel)
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="flex flex-wrap gap-2 justify-between items-center text-xs bg-muted/40 p-2.5 rounded-lg border border-border/60">
            <span className="text-muted-foreground font-medium">Need a starting template?</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadSample('csv')}
              >
                <Download className="h-3.5 w-3.5" />
                Sample CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => handleDownloadSample('xlsx')}
              >
                <Download className="h-3.5 w-3.5" />
                Sample Excel (.xlsx)
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-dashed p-6 text-center bg-card">
            <Upload className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
            <p className="text-sm font-medium text-foreground mb-1">
              Select a CSV or Excel (.xlsx, .xls) spreadsheet
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              Columns: name, category, unit, purchase_price, retail_price (optional: generic_name, brand_name, reorder_level, shelf_location, notes)
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Choose File (.csv, .xlsx, .xls)
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.tsv,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
            {fileName && (
              <p className="mt-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 py-1 px-3 rounded-full inline-block">
                Selected: {fileName}
              </p>
            )}
          </div>

          {preview.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-1">
                Data Preview (First {preview.length - 1} rows detected):
              </p>
              <div className="overflow-x-auto rounded-md border max-h-48">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/60 sticky top-0">
                      {preview[0]?.map((col, i) => (
                        <th key={i} className="px-2.5 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(1).map((row, ri) => (
                      <tr key={ri} className="border-b last:border-0 hover:bg-muted/30">
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-2.5 py-1 text-muted-foreground whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && (
            <div className="rounded-md border p-3.5 text-sm space-y-2 bg-card">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {result.imported} medicine(s) imported successfully
                </span>
              </div>
              {result.skipped > 0 && (
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-400">
                    {result.skipped} row(s) skipped or already existing
                  </span>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2 max-h-36 overflow-y-auto rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive space-y-1">
                  <p className="font-semibold">Notice / Details:</p>
                  {result.errors.slice(0, 10).map((err, i) => (
                    <p key={i}>• {err}</p>
                  ))}
                  {result.errors.length > 10 && (
                    <p className="text-muted-foreground italic">...and {result.errors.length - 10} more rows</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleImport}
              disabled={!csvText.trim() || importing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {importing ? 'Importing...' : 'Start Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
