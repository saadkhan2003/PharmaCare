import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { ExpiryReportDetailRow } from '../../types/report';

interface ExpiryPDFProps {
  data: ExpiryReportDetailRow[];
  warningDays?: number;
  criticalDays?: number;
  pharmacyName?: string;
  currencySymbol?: string;
}

function getStatusStyle(status: string) {
  if (status === 'critical' || status === 'expired') return pdfStyles.criticalText;
  if (status === 'warning') return pdfStyles.warningText;
  return pdfStyles.okText;
}

export function ExpiryPDF({
  data,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: ExpiryPDFProps) {
  const totalLoss = data.reduce((s, r) => s + r.potential_loss, 0);
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>Expiry Report (Current Snapshot)</Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Batch</Text>
            <Text style={pdfStyles.tableCell}>Medicine</Text>
            <Text style={pdfStyles.tableCell}>Original Qty</Text>
            <Text style={pdfStyles.tableCell}>Remaining</Text>
            <Text style={pdfStyles.tableCell}>Unit Cost</Text>
            <Text style={pdfStyles.tableCell}>Expiry</Text>
            <Text style={pdfStyles.tableCell}>Days Left</Text>
            <Text style={pdfStyles.tableCell}>Potential Loss</Text>
            <Text style={pdfStyles.tableCellLast}>Status</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.batch_code ?? `#${row.batch_id}`}</Text>
              <Text style={pdfStyles.tableCell}>{row.medicine_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.original_qty}</Text>
              <Text style={pdfStyles.tableCell}>{row.remaining_qty}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.unit_cost, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{row.expiry_date}</Text>
              <Text style={[pdfStyles.tableCell, getStatusStyle(row.status)]}>{row.days_remaining}d</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.potential_loss, currencySymbol)}</Text>
              <Text style={[pdfStyles.tableCellLast, getStatusStyle(row.status)]}>{row.status}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Potential Loss:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalLoss, currencySymbol)}</Text>
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
