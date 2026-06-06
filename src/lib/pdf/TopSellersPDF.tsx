import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { TopSellerRow } from '../../types/report';
import { formatDate } from '@/lib/formatDate';

interface TopSellersPDFProps {
  data: TopSellerRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function TopSellersPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: TopSellersPDFProps) {
  const displayData = data.slice(0, 50);
  const today = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Top Selling Medicines {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Rank</Text>
            <Text style={pdfStyles.tableCell}>Medicine</Text>
            <Text style={pdfStyles.tableCell}>Quantity</Text>
            <Text style={pdfStyles.tableCell}>Revenue</Text>
            <Text style={pdfStyles.tableCellLast}>Profit</Text>
          </View>

          {displayData.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{i + 1}</Text>
              <Text style={pdfStyles.tableCell}>{row.medicine_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.total_qty}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.total_revenue, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.total_profit, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
