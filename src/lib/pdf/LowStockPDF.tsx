import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles } from './CommonStyles';
import type { LowStockRow } from '../../types/report';

interface LowStockPDFProps {
  data: LowStockRow[];
  pharmacyName?: string;
  currencySymbol?: string;
}

export function LowStockPDF({
  data,
  pharmacyName = 'PharmaCare',
}: LowStockPDFProps) {
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>Low Stock Report (Current Snapshot)</Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Medicine</Text>
            <Text style={pdfStyles.tableCell}>Category</Text>
            <Text style={pdfStyles.tableCell}>Reorder Level</Text>
            <Text style={pdfStyles.tableCell}>Current Stock</Text>
            <Text style={pdfStyles.tableCell}>Unit</Text>
            <Text style={pdfStyles.tableCell}>Deficit</Text>
            <Text style={pdfStyles.tableCellLast}>Status</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.medicine_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.category ?? '—'}</Text>
              <Text style={pdfStyles.tableCell}>{row.reorder_level}</Text>
              <Text style={pdfStyles.tableCell}>
                <Text style={row.current_stock === 0 ? pdfStyles.criticalText : row.current_stock < row.reorder_level ? pdfStyles.warningText : {}}>
                  {row.current_stock}
                </Text>
              </Text>
              <Text style={pdfStyles.tableCell}>{row.unit}</Text>
              <Text style={pdfStyles.tableCell}>{row.deficit}</Text>
              <Text style={pdfStyles.tableCellLast}>
                {row.current_stock === 0 ? 'Out of Stock' : 'Below Reorder'}
              </Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.footer}>Generated on {today} — PharmaCare</Text>
      </Page>
    </Document>
  );
}
