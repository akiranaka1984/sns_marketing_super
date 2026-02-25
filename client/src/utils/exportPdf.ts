import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface PdfColumn {
  header: string;
  dataKey: string;
}

/**
 * Export data to a PDF file and trigger download.
 *
 * @param title    - Title text displayed at the top of the PDF
 * @param columns  - Column definitions with header labels and data keys
 * @param data     - Array of objects representing rows
 * @param filename - Download filename (without extension)
 */
export function exportToPdf(
  title: string,
  columns: PdfColumn[],
  data: Record<string, unknown>[],
  filename: string,
): void {
  if (!data || data.length === 0) {
    return;
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Add title
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  // Add generation date
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  const dateStr = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Generated: ${dateStr}`, 14, 27);

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Build the table using autoTable
  // Note: Japanese text will render with Helvetica fallback (characters that
  // cannot be rendered will appear as placeholders). For full Japanese support,
  // a custom font would need to be embedded.
  autoTable(doc, {
    startY: 32,
    head: [columns.map((col) => col.header)],
    body: data.map((row) =>
      columns.map((col) => {
        const value = row[col.dataKey];
        return value != null ? String(value) : "";
      }),
    ),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [6, 182, 212], // cyan-500
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    margin: { top: 32, right: 14, bottom: 14, left: 14 },
  });

  doc.save(`${filename}.pdf`);
}
