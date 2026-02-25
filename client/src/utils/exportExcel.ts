import * as XLSX from "xlsx";

/**
 * Export data to an Excel (.xlsx) file and trigger download.
 *
 * @param data      - Array of objects representing rows
 * @param filename  - Download filename (without extension)
 * @param sheetName - Optional worksheet name (defaults to "Sheet1")
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName?: string,
): void {
  if (!data || data.length === 0) {
    return;
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-size columns based on content width
  const columnKeys = Object.keys(data[0]);
  const columnWidths = columnKeys.map((key) => {
    const headerWidth = key.length;
    const maxDataWidth = data.reduce((max, row) => {
      const value = row[key];
      const len = value != null ? String(value).length : 0;
      return Math.max(max, len);
    }, 0);
    // Use the wider of header or data, with a minimum of 10 and maximum of 40
    return { wch: Math.min(40, Math.max(10, headerWidth, maxDataWidth + 2)) };
  });
  worksheet["!cols"] = columnWidths;

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName || "Sheet1");

  // Trigger the download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
