import React from 'react';
import { Document, Page, Text, View } from '@react-pdf/renderer';
import { pdfStyles, formatCurrency } from './CommonStyles';
import type { ProfitMarginRow } from '../../types/report';

interface ProfitMarginPDFProps {
  data: ProfitMarginRow[];
  startDate?: string;
  endDate?: string;
  pharmacyName?: string;
  currencySymbol?: string;
}

export function ProfitMarginPDF({
  data,
  startDate,
  endDate,
  pharmacyName = 'PharmaCare',
  currencySymbol = 'Rs.',
}: ProfitMarginPDFProps) {
  const totalProfit = data.reduce((s, r) => s + r.total_profit, 0);
  const avgMarginPct = data.length > 0
    ? data.reduce((s, r) => s + r.margin_pct, 0) / data.length
    : 0;
  const today = new Date().toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Text style={pdfStyles.header}>{pharmacyName}</Text>
        <Text style={pdfStyles.subtitle}>
          Profit Margin Analysis {startDate && endDate ? `(${startDate} to ${endDate})` : ''}
        </Text>

        <View style={pdfStyles.table}>
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={pdfStyles.tableCell}>Medicine</Text>
            <Text style={pdfStyles.tableCell}>Times Sold</Text>
            <Text style={pdfStyles.tableCell}>Qty</Text>
            <Text style={pdfStyles.tableCell}>Avg Sell</Text>
            <Text style={pdfStyles.tableCell}>Avg Cost</Text>
            <Text style={pdfStyles.tableCell}>Margin/Unit</Text>
            <Text style={pdfStyles.tableCell}>Margin %</Text>
            <Text style={pdfStyles.tableCellLast}>Total Profit</Text>
          </View>

          {data.map((row, i) => (
            <View style={pdfStyles.tableRow} key={i}>
              <Text style={pdfStyles.tableCell}>{row.medicine_name}</Text>
              <Text style={pdfStyles.tableCell}>{row.times_sold}</Text>
              <Text style={pdfStyles.tableCell}>{row.total_qty}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.avg_sell_price, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.avg_cost, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{formatCurrency(row.avg_margin_per_unit, currencySymbol)}</Text>
              <Text style={pdfStyles.tableCell}>{row.margin_pct.toFixed(1)}%</Text>
              <Text style={pdfStyles.tableCellLast}>{formatCurrency(row.total_profit, currencySymbol)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.summaryRow}>
          <Text style={pdfStyles.summaryLabel}>Average Margin:</Text>
          <Text style={pdfStyles.summaryValue}>{avgMarginPct.toFixed(1)}%</Text>
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
