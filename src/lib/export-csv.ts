/**
 * Utility to export data to CSV format
 */

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | boolean | null | undefined;
}

/**
 * Convert data array to CSV string
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string = 'export.csv'
): void {
  // Build CSV header
  const headers = columns.map(col => col.header);
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.map(h => escapeCSV(h)).join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = columns.map(col => {
      const value = col.accessor(row);
      return escapeCSV(formatValue(value));
    });
    csvRows.push(values.join(','));
  });
  
  // Create CSV string
  const csvString = csvRows.join('\n');
  
  // Create blob and download
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Escape CSV special characters
 */
function escapeCSV(value: string): string {
  // If value contains comma, quote, or newline, wrap in quotes
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format value for CSV export
 */
function formatValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}
