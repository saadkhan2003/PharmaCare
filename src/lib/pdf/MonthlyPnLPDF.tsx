import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { MonthlyPnLRow } from '../../types/report';
import { formatDate } from '@/lib/formatDate';

interface MonthlyPnLPDFProps {
  data: MonthlyPnLRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function MonthlyPnLPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: MonthlyPnLPDFProps) {
  const totalRevenue = data.reduce((s, r) => s + r.total_revenue, 0);
  const totalCogs = data.reduce((s, r) => s + r.total_cogs, 0);
  const totalGrossProfit = data.reduce((s, r) => s + r.gross_profit, 0);
  const totalRefunds = data.reduce((s, r) => s + r.total_refunds, 0);
  const totalWriteOffs = data.reduce((s, r) => s + r.write_off_losses, 0);
  const totalNetProfit = data.reduce((s, r) => s + r.net_profit, 0);
  const today = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Monthly Profit & Loss {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Month</Text>
            <Text style={pdfStyles.tableCell}>Sales</Text>
            <Text style={pdfStyles.tableCell}>Revenue</Text>
            <Text style={pdfStyles.tableCell}>COGS</Text>
            <Text style={pdfStyles.tableCell}>Gross Profit</Text>
            <Text style={pdfStyles.tableCell}>Refunds</Text>
            <Text style={pdfStyles.tableCell}>Write-offs</Text>
            <Text style={pdfStyles.tableCellLast}>Net Profit</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.month}</Text>
              <Text style={pdfStyles.tableCell}>{row.sale_count}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_revenue, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_cogs, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.gross_profit, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_refunds, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.write_off_losses, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.net_profit, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Revenue:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalRevenue, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total COGS:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalCogs, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Gross Profit:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalGrossProfit, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Refunds:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalRefunds, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Write-offs:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalWriteOffs, currencySymbol)}</Text>
        </View>
        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Net Profit:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalNetProfit, currencySymbol)}</Text>
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
