import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { DailySalesRow } from '../../types/report';
import { formatDate } from '@/lib/formatDate';

interface DailySalesPDFProps {
  data: DailySalesRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function DailySalesPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: DailySalesPDFProps) {
  const totalGross = data.reduce((s, r) => s + r.gross_sales, 0);
  const totalDiscounts = data.reduce((s, r) => s + r.discounts, 0);
  const totalTax = data.reduce((s, r) => s + r.tax_amount, 0);
  const totalNet = data.reduce((s, r) => s + r.net_sales, 0);
  const totalProfit = data.reduce((s, r) => s + r.profit, 0);
  const today = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Daily Sales Summary {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          {/* Header row */}
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Date</Text>
            <Text style={pdfStyles.tableCell}>Sales</Text>
            <Text style={pdfStyles.tableCell}>Items</Text>
            <Text style={pdfStyles.tableCell}>Gross</Text>
            <Text style={pdfStyles.tableCell}>Discounts</Text>
            <Text style={pdfStyles.tableCell}>Tax</Text>
            <Text style={pdfStyles.tableCell}>Net</Text>
            <Text style={pdfStyles.tableCellLast}>Profit</Text>
          </View>

          {/* Data rows */}
          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.date}</Text>
              <Text style={pdfStyles.tableCell}>{row.sale_count}</Text>
              <Text style={pdfStyles.tableCell}>{row.item_count}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.gross_sales, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.discounts, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.tax_amount, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.net_sales, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.profit, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Gross:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalGross, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Discounts:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalDiscounts, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Tax:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalTax, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Net Sales:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalNet, currencySymbol)}</Text>
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
