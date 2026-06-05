import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { SalesByUserRow } from '../../types/report';

interface SalesByUserPDFProps {
  data: SalesByUserRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function SalesByUserPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: SalesByUserPDFProps) {
  const totalSales = data.reduce((s, r) => s + r.total_sales, 0);
  const totalProfit = data.reduce((s, r) => s + r.total_profit, 0);
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Sales by User {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>User</Text>
            <Text style={pdfStyles.tableCell}>Role</Text>
            <Text style={pdfStyles.tableCell}>Sales</Text>
            <Text style={pdfStyles.tableCell}>Items</Text>
            <Text style={pdfStyles.tableCell}>Revenue</Text>
            <Text style={pdfStyles.tableCell}>Profit</Text>
            <Text style={pdfStyles.tableCellLast}>Avg/Sale</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.full_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.role}</Text>
              <Text style={pdfStyles.tableCell}>{row.sale_count}</Text>
              <Text style={pdfStyles.tableCell}>{row.item_count}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_sales, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_profit, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.avg_profit_per_sale, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Revenue:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalSales, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Profit:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalProfit, currencySymbol)}</Text>
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
