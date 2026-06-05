import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { SlowMovingRow } from '../../types/report';

interface SlowMovingPDFProps {
  data: SlowMovingRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function SlowMovingPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: SlowMovingPDFProps) {
  const totalInvestment = data.reduce((s, r) => s + r.total_investment, 0);
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Slow-Moving Stock {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Medicine</Text>
            <Text style={pdfStyles.tableCell}>Category</Text>
            <Text style={pdfStyles.tableCell}>Current Stock</Text>
            <Text style={pdfStyles.tableCell}>Unit Cost</Text>
            <Text style={pdfStyles.tableCellLast}>Total Investment</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.medicine_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.category ?? '—'}</Text>
              <Text style={pdfStyles.tableCell}>{row.current_stock}</Text>
              <Text style={pdfStyles.tableCell}>
                {row.current_stock > 0
                  ? formatCurrency(row.total_investment / row.current_stock, currencySymbol)
                  : '—'}
              </Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.total_investment, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Total Investment:</Text>
          <Text style={pdfStyles.summaryValue}>{formatCurrency(totalInvestment, currencySymbol)}</Text>
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
