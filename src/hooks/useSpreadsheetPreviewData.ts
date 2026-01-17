import { useState, useEffect } from 'react';
import ExcelJS from 'exceljs';

interface PreviewCell {
  value: string;
  backgroundColor?: string;
  textColor?: string;
  bold?: boolean;
}

interface SpreadsheetPreviewData {
  rows: PreviewCell[][];
  isLoading: boolean;
  error: string | null;
}

const MAX_PREVIEW_ROWS = 5;
const MAX_PREVIEW_COLS = 6;

export const useSpreadsheetPreviewData = (fileUrl: string | null): SpreadsheetPreviewData => {
  const [rows, setRows] = useState<PreviewCell[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setRows([]);
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Erro ao carregar arquivo');

        const arrayBuffer = await response.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          setRows([]);
          return;
        }

        const previewRows: PreviewCell[][] = [];
        const rowCount = Math.min(worksheet.rowCount || 0, MAX_PREVIEW_ROWS);
        const colCount = Math.min(worksheet.columnCount || 0, MAX_PREVIEW_COLS);

        for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          const rowData: PreviewCell[] = [];

          for (let colNum = 1; colNum <= colCount; colNum++) {
            const cell = row.getCell(colNum);
            const value = getCellDisplayValue(cell);
            
            let backgroundColor: string | undefined;
            let textColor: string | undefined;
            let bold = false;

            if (cell.fill && cell.fill.type === 'pattern') {
              const patternFill = cell.fill as ExcelJS.FillPattern;
              if (patternFill.fgColor?.argb) {
                backgroundColor = argbToHex(patternFill.fgColor.argb);
              }
            }

            if (cell.font) {
              if (cell.font.color?.argb) {
                textColor = argbToHex(cell.font.color.argb);
              }
              if (cell.font.bold) {
                bold = true;
              }
            }

            rowData.push({ value, backgroundColor, textColor, bold });
          }

          previewRows.push(rowData);
        }

        setRows(previewRows);
      } catch (err) {
        console.error('Error loading spreadsheet preview:', err);
        setError('Erro ao carregar preview');
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [fileUrl]);

  return { rows, isLoading, error };
};

const getCellDisplayValue = (cell: ExcelJS.Cell): string => {
  const value = cell.value;

  if (value === null || value === undefined) return '';

  // Handle formula results
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result !== undefined) {
      return formatSimpleValue(result);
    }
  }

  // Handle rich text
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
  }

  // Handle hyperlinks
  if (typeof value === 'object' && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text || '';
  }

  // Handle dates
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }

  return formatSimpleValue(value);
};

const formatSimpleValue = (value: any): string => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  if (typeof value === 'boolean') {
    return value ? 'SIM' : 'NÃO';
  }

  return String(value);
};

const argbToHex = (argb: string | undefined): string | undefined => {
  if (!argb) return undefined;

  if (argb.length === 8) {
    return `#${argb.substring(2)}`;
  }
  if (argb.length === 6) {
    return `#${argb}`;
  }
  return undefined;
};

export default useSpreadsheetPreviewData;
