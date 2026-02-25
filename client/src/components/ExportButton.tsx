import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportToExcel } from "@/utils/exportExcel";
import { exportToPdf } from "@/utils/exportPdf";

interface ExportColumn {
  header: string;
  dataKey: string;
}

interface ExportButtonProps {
  data: Record<string, unknown>[];
  filename: string;
  columns?: ExportColumn[];
  title?: string;
}

export function ExportButton({
  data,
  filename,
  columns,
  title,
}: ExportButtonProps) {
  const handleExcelExport = () => {
    if (!data || data.length === 0) return;

    // If columns are provided, remap data to use header labels as keys
    if (columns && columns.length > 0) {
      const remappedData = data.map((row) => {
        const newRow: Record<string, unknown> = {};
        for (const col of columns) {
          newRow[col.header] = row[col.dataKey];
        }
        return newRow;
      });
      exportToExcel(remappedData, filename);
    } else {
      exportToExcel(data, filename);
    }
  };

  const handlePdfExport = () => {
    if (!data || data.length === 0) return;

    const pdfColumns =
      columns && columns.length > 0
        ? columns
        : Object.keys(data[0]).map((key) => ({
            header: key,
            dataKey: key,
          }));

    exportToPdf(title || filename, pdfColumns, data, filename);
  };

  const isDisabled = !data || data.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isDisabled}>
          <Download className="h-4 w-4" />
          <span>エクスポート</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExcelExport}>
          <FileSpreadsheet className="h-4 w-4" />
          <span>Excel (.xlsx)</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdfExport}>
          <FileText className="h-4 w-4" />
          <span>PDF (.pdf)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
