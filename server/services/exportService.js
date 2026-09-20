import * as XLSX from 'xlsx';

export const ExportService = {
  /**
   * Generates an Excel (.xlsx) Buffer from an array of JSON objects
   */
  generateExcelBuffer(data, sheetName = 'Report') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  },

  /**
   * Generates a CSV string from an array of JSON objects
   */
  generateCsvString(data) {
    if (!data || data.length === 0) return '';
    const worksheet = XLSX.utils.json_to_sheet(data);
    return XLSX.utils.sheet_to_csv(worksheet);
  }
};

export default ExportService;
