import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Helvetica' },
  header: { fontSize: 16, marginBottom: 6, textAlign: 'center', fontWeight: 'bold' },
  subtitle: { fontSize: 9, marginBottom: 12, textAlign: 'center', color: '#555' },
  section: { marginBottom: 10 },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#ccc' },
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: '#f0f0f0', fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  tableCell: { flex: 1, padding: 3, borderRightWidth: 1, borderRightColor: '#eee', fontSize: 8 },
  tableCellLast: { flex: 1, padding: 3, fontSize: 8 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#999' },
  summaryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, paddingHorizontal: 4 },
  summaryLabel: { fontSize: 9, fontWeight: 'bold', marginRight: 8 },
  summaryValue: { fontSize: 9 },
  criticalText: { color: '#dc2626' },
  warningText: { color: '#d97706' },
  okText: { color: '#16a34a' },
});

export const formatCurrency = (amount: number, symbol = 'Rs.'): string =>
  `${symbol} ${amount.toFixed(2)}`;

export const formatNumber = (n: number): string =>
  n.toLocaleString('en-IN');
