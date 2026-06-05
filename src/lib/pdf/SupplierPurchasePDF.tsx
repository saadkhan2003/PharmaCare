import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { SupplierPurchaseRow } from '../../types/report';

interface SupplierPurchasePDFProps {
  data: SupplierPurchaseRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function SupplierPurchasePDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: SupplierPurchasePDFProps) {
  const totalSpent = data.reduce((s, r) => s + r.total_spent, 0);
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Supplier Purchase History {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Supplier</Text>
            <Text style={pdfStyles.tableCell}>Purchases</Text>
            <Text style={pdfStyles.tableCell}>Items</Text>
            <Text style={pdfStyles.tableCell}>Total Spent</Text>
            <Text style={pdfStyles.tableCell}>Avg Order</Text>
            <Text style={pdfStyles.tableCellLast}>Last Purchase</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.company_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.purchase_count}</Text>
              <Text style={pdfStyles.tableCell}>{row.item_count}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_spent, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.avg_order_value, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCellLast}>{row.last_purchase_date ?? '—'}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Spent:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalSpent, currencySymbol)}</Text>
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
