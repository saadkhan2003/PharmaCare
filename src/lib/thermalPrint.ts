/**
 * Robust thermal receipt printing utility for 80mm receipt printers.
 * Uses an isolated hidden iframe to guarantee clean, unclipped print output
 * that is completely immune to modal dialog overlays, portals, and CSS cascades.
 */
export function printThermalReceipt(elementId = 'printable-receipt'): void {
  const contentEl = document.getElementById(elementId);
  if (!contentEl) {
    window.print();
    return;
  }

  // Create an isolated hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const receiptHtml = contentEl.innerHTML;

  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
          }
          * {
            box-sizing: border-box;
          }
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 4mm 2mm 10mm 2mm;
            font-family: 'Courier New', Courier, monospace, sans-serif;
            color: #000000;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            color: #000000;
          }
          div, span, p {
            color: #000000;
          }
        </style>
      </head>
      <body>
        ${receiptHtml}
      </body>
    </html>
  `);
  doc.close();

  // Trigger print after iframe renders
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Iframe print error:', e);
      window.print();
    } finally {
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 1500);
    }
  }, 150);
}
