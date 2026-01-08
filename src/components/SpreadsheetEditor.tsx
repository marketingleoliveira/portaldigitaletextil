import React, { useEffect, useState, useCallback, useRef } from 'react';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Save, Download, Loader2, Plus, Trash2, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Undo, Redo, FileText, Type, Palette, Minus, Grid3X3, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type BorderStyle = 'none' | 'thin' | 'medium' | 'thick' | 'double';

interface CellBorders {
  top?: { style: BorderStyle; color: string };
  right?: { style: BorderStyle; color: string };
  bottom?: { style: BorderStyle; color: string };
  left?: { style: BorderStyle; color: string };
}

interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right' | 'fill' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
  textColor?: string;
  borders?: CellBorders;
  fontSize?: number;
  fontFamily?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
  wrapText?: boolean;
}

interface CellData {
  value: string;
  formattedValue?: string;
  formula?: string;
  style?: CellStyle;
  isMerged?: boolean;
  mergeAnchor?: boolean;
  colspan?: number;
  rowspan?: number;
}

interface SpreadsheetEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  fileId: string;
  onSave?: () => void;
}

// Helper to parse Brazilian number format (1.234,56) or standard (1234.56)
const parseNumber = (value: string): number => {
  if (value === null || value === undefined || value === '') return 0;
  
  const str = String(value).trim();
  
  // Remove currency symbols and spaces
  let cleaned = str.replace(/[R$€£¥\s]/gi, '');
  
  // Check if it's Brazilian format (has comma as decimal separator)
  if (cleaned.includes(',') && cleaned.includes('.')) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Brazilian format: 1.234,56
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Standard format: 1,234.56
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }
  
  cleaned = cleaned.replace(/[^\d.-]/g, '');
  
  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
};

// Get cell value as number
const getCellNumericValue = (data: CellData[][], rowIndex: number, colIndex: number): number => {
  const cell = data[rowIndex]?.[colIndex];
  if (!cell) return 0;
  return parseNumber(cell.value);
};

// Formula evaluation functions
const evaluateFormula = (formula: string, data: CellData[][]): string => {
  if (!formula.startsWith('=')) return formula;
  
  const cleanFormula = formula.substring(1).toUpperCase().trim();
  
  try {
    // SUM function - supports both range (A1:B5) and individual cells (A1,B2,C3)
    if (cleanFormula.startsWith('SUM(') || cleanFormula.startsWith('SOMA(')) {
      const content = cleanFormula.match(/(?:SUM|SOMA)\((.+)\)/)?.[1];
      if (content) {
        let sum = 0;
        const rangeMatch = content.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch;
          const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
          sum = values.reduce((acc, val) => acc + parseNumber(val), 0);
        } else {
          const cells = content.split(/[,;]/);
          cells.forEach(cellRef => {
            const match = cellRef.trim().match(/([A-Z]+)(\d+)/);
            if (match) {
              const colIndex = columnLetterToIndex(match[1]);
              const rowIndex = parseInt(match[2]) - 1;
              sum += getCellNumericValue(data, rowIndex, colIndex);
            }
          });
        }
        return formatResult(sum);
      }
    }
    
    // AVERAGE function
    if (cleanFormula.startsWith('AVERAGE(') || cleanFormula.startsWith('MEDIA(') || cleanFormula.startsWith('MÉDIA(')) {
      const content = cleanFormula.match(/(?:AVERAGE|MEDIA|MÉDIA)\((.+)\)/)?.[1];
      if (content) {
        const rangeMatch = content.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch;
          const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
          const nums = values.filter(v => v.trim() !== '').map(v => parseNumber(v));
          const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
          return formatResult(avg);
        }
      }
    }
    
    // COUNT function
    if (cleanFormula.startsWith('COUNT(') || cleanFormula.startsWith('CONT(') || cleanFormula.startsWith('CONTAR(')) {
      const content = cleanFormula.match(/(?:COUNT|CONT|CONTAR)\((.+)\)/)?.[1];
      if (content) {
        const rangeMatch = content.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch;
          const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
          const count = values.filter(v => v.trim() !== '' && !isNaN(parseNumber(v))).length;
          return count.toString();
        }
      }
    }
    
    // MAX function
    if (cleanFormula.startsWith('MAX(') || cleanFormula.startsWith('MAXIMO(') || cleanFormula.startsWith('MÁXIMO(')) {
      const content = cleanFormula.match(/(?:MAX|MAXIMO|MÁXIMO)\((.+)\)/)?.[1];
      if (content) {
        const rangeMatch = content.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch;
          const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
          const nums = values.filter(v => v.trim() !== '').map(v => parseNumber(v));
          return nums.length > 0 ? formatResult(Math.max(...nums)) : '0';
        }
      }
    }
    
    // MIN function
    if (cleanFormula.startsWith('MIN(') || cleanFormula.startsWith('MINIMO(') || cleanFormula.startsWith('MÍNIMO(')) {
      const content = cleanFormula.match(/(?:MIN|MINIMO|MÍNIMO)\((.+)\)/)?.[1];
      if (content) {
        const rangeMatch = content.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (rangeMatch) {
          const [, startCol, startRow, endCol, endRow] = rangeMatch;
          const values = getCellRange(data, startCol, parseInt(startRow), endCol, parseInt(endRow));
          const nums = values.filter(v => v.trim() !== '').map(v => parseNumber(v));
          return nums.length > 0 ? formatResult(Math.min(...nums)) : '0';
        }
      }
    }
    
    // ROUND function
    if (cleanFormula.startsWith('ROUND(') || cleanFormula.startsWith('ARRED(') || cleanFormula.startsWith('ARREDONDAR(')) {
      const content = cleanFormula.match(/(?:ROUND|ARRED|ARREDONDAR)\((.+)\)/)?.[1];
      if (content) {
        const parts = splitFormulaArgs(content);
        if (parts.length >= 1) {
          const value = evaluateExpression(parts[0].trim(), data);
          const decimals = parts.length > 1 ? parseInt(parts[1].trim()) : 0;
          const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
          return formatResult(rounded, decimals);
        }
      }
    }
    
    // ABS function
    if (cleanFormula.startsWith('ABS(')) {
      const content = cleanFormula.match(/ABS\((.+)\)/)?.[1];
      if (content) {
        const value = evaluateExpression(content.trim(), data);
        return formatResult(Math.abs(value));
      }
    }
    
    // IF function
    if (cleanFormula.startsWith('IF(') || cleanFormula.startsWith('SE(')) {
      const content = cleanFormula.match(/(?:IF|SE)\((.+)\)/)?.[1];
      if (content) {
        const parts = splitFormulaArgs(content);
        if (parts.length >= 2) {
          const condition = evaluateCondition(parts[0].trim(), data);
          const trueValue = parts[1]?.trim() || '';
          const falseValue = parts[2]?.trim() || '';
          
          const resultPart = condition ? trueValue : falseValue;
          
          if (resultPart.startsWith('"') && resultPart.endsWith('"')) {
            return resultPart.slice(1, -1);
          }
          
          return formatResult(evaluateExpression(resultPart, data));
        }
      }
    }
    
    // POWER function
    if (cleanFormula.startsWith('POWER(') || cleanFormula.startsWith('POTENCIA(') || cleanFormula.startsWith('POTÊNCIA(')) {
      const content = cleanFormula.match(/(?:POWER|POTENCIA|POTÊNCIA)\((.+)\)/)?.[1];
      if (content) {
        const parts = splitFormulaArgs(content);
        if (parts.length >= 2) {
          const base = evaluateExpression(parts[0].trim(), data);
          const exp = evaluateExpression(parts[1].trim(), data);
          return formatResult(Math.pow(base, exp));
        }
      }
    }
    
    // SQRT function
    if (cleanFormula.startsWith('SQRT(') || cleanFormula.startsWith('RAIZ(')) {
      const content = cleanFormula.match(/(?:SQRT|RAIZ)\((.+)\)/)?.[1];
      if (content) {
        const value = evaluateExpression(content.trim(), data);
        return formatResult(Math.sqrt(value));
      }
    }
    
    // Simple arithmetic with cell references
    return formatResult(evaluateExpression(cleanFormula, data));
    
  } catch (e) {
    console.error('Formula error:', e, formula);
    return '#ERROR';
  }
};

// Split formula arguments respecting parentheses
const splitFormulaArgs = (content: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  
  for (const char of content) {
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === ',' || char === ';') && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) parts.push(current);
  
  return parts;
};

// Evaluate a condition (for IF function)
const evaluateCondition = (condition: string, data: CellData[][]): boolean => {
  const operators = ['>=', '<=', '<>', '!=', '=', '>', '<'];
  
  for (const op of operators) {
    if (condition.includes(op)) {
      const parts = condition.split(op);
      if (parts.length === 2) {
        const left = evaluateExpression(parts[0].trim(), data);
        const right = evaluateExpression(parts[1].trim(), data);
        
        switch (op) {
          case '>=': return left >= right;
          case '<=': return left <= right;
          case '<>': 
          case '!=': return left !== right;
          case '=': return left === right;
          case '>': return left > right;
          case '<': return left < right;
        }
      }
    }
  }
  
  return evaluateExpression(condition, data) !== 0;
};

// Evaluate arithmetic expression with cell references
const evaluateExpression = (expr: string, data: CellData[][]): number => {
  let expression = expr.toUpperCase();
  
  const cellRefs = expression.match(/[A-Z]+\d+/g);
  if (cellRefs) {
    const sortedRefs = [...new Set(cellRefs)].sort((a, b) => b.length - a.length);
    sortedRefs.forEach(ref => {
      const col = ref.match(/[A-Z]+/)?.[0] || 'A';
      const row = parseInt(ref.match(/\d+/)?.[0] || '1');
      const colIndex = columnLetterToIndex(col);
      const rowIndex = row - 1;
      const numValue = getCellNumericValue(data, rowIndex, colIndex);
      expression = expression.split(ref).join(numValue.toString());
    });
  }
  
  const sanitized = expression.replace(/[^0-9+\-*/().]/g, '');
  if (sanitized) {
    try {
      const result = Function('"use strict"; return (' + sanitized + ')')();
      return typeof result === 'number' && !isNaN(result) ? result : 0;
    } catch {
      return 0;
    }
  }
  
  return parseNumber(expression);
};

// Format result number
const formatResult = (value: number, decimals: number = 2): string => {
  if (isNaN(value) || !isFinite(value)) return '#ERROR';
  
  if (Number.isInteger(value) && decimals === 2) {
    return value.toLocaleString('pt-BR');
  }
  
  return value.toLocaleString('pt-BR', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

// Recalculate all formulas in the data (with dependency resolution)
const recalculateAllFormulas = (data: CellData[][]): CellData[][] => {
  const newData = data.map(row => row.map(cell => ({ ...cell })));
  
  // Multiple passes to handle formula dependencies
  for (let pass = 0; pass < 3; pass++) {
    for (let rowIndex = 0; rowIndex < newData.length; rowIndex++) {
      for (let colIndex = 0; colIndex < newData[rowIndex].length; colIndex++) {
        const cell = newData[rowIndex][colIndex];
        if (cell.formula && cell.formula.startsWith('=')) {
          const result = evaluateFormula(cell.formula, newData);
          newData[rowIndex][colIndex] = {
            ...cell,
            value: result,
            formattedValue: result
          };
        }
      }
    }
  }
  
  return newData;
};

const columnLetterToIndex = (letter: string): number => {
  let index = 0;
  for (let i = 0; i < letter.length; i++) {
    index = index * 26 + (letter.charCodeAt(i) - 64);
  }
  return index - 1;
};

const getCellRange = (data: CellData[][], startCol: string, startRow: number, endCol: string, endRow: number): string[] => {
  const values: string[] = [];
  const startColIdx = columnLetterToIndex(startCol);
  const endColIdx = columnLetterToIndex(endCol);
  
  for (let row = startRow - 1; row <= endRow - 1; row++) {
    for (let col = startColIdx; col <= endColIdx; col++) {
      if (data[row]?.[col]) {
        values.push(data[row][col].value);
      }
    }
  }
  
  return values;
};

const argbToHex = (argb: string | undefined | { argb?: string; theme?: number; tint?: number }): string | undefined => {
  if (!argb) return undefined;
  
  if (typeof argb === 'object') {
    if (argb.argb) {
      const hex = argb.argb;
      if (hex.length === 8) {
        return `#${hex.substring(2)}`;
      }
      return `#${hex}`;
    }
    if (argb.theme !== undefined) {
      const themeColors = [
        '#FFFFFF', '#000000', '#E7E6E6', '#44546A',
        '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000',
        '#5B9BD5', '#70AD47'
      ];
      return themeColors[argb.theme] || undefined;
    }
    return undefined;
  }
  
  if (typeof argb === 'string') {
    if (argb.length === 8) {
      return `#${argb.substring(2)}`;
    }
    if (argb.length === 6) {
      return `#${argb}`;
    }
  }
  return undefined;
};

const getBorderStyle = (border: Partial<ExcelJS.Border> | undefined): string | undefined => {
  if (!border || !border.style) return undefined;
  
  const color = border.color ? argbToHex(border.color.argb) || '#000000' : '#000000';
  
  const styleMap: Record<string, string> = {
    thin: `1px solid ${color}`,
    medium: `2px solid ${color}`,
    thick: `3px solid ${color}`,
    double: `3px double ${color}`,
    dotted: `1px dotted ${color}`,
    dashed: `1px dashed ${color}`,
    hair: `0.5px solid ${color}`,
    dashDot: `1px dashed ${color}`,
    dashDotDot: `1px dashed ${color}`,
    slantDashDot: `1px dashed ${color}`,
    mediumDashed: `2px dashed ${color}`,
    mediumDashDot: `2px dashed ${color}`,
    mediumDashDotDot: `2px dashed ${color}`,
  };
  
  return styleMap[border.style] || `1px solid ${color}`;
};

const extractCellStyle = (cell: ExcelJS.Cell): CellStyle => {
  const style: CellStyle = {};
  
  if (cell.font) {
    if (cell.font.bold) style.bold = true;
    if (cell.font.italic) style.italic = true;
    if (cell.font.underline) style.underline = true;
    if (cell.font.strike) style.strike = true;
    if (cell.font.size) style.fontSize = cell.font.size;
    if (cell.font.name) style.fontFamily = cell.font.name;
    if (cell.font.color) {
      const color = argbToHex(cell.font.color.argb);
      if (color) style.textColor = color;
    }
  }
  
  if (cell.alignment) {
    if (cell.alignment.horizontal) {
      style.align = cell.alignment.horizontal as any;
    }
    if (cell.alignment.vertical) {
      style.verticalAlign = cell.alignment.vertical as 'top' | 'middle' | 'bottom';
    }
    if (cell.alignment.wrapText) {
      style.wrapText = true;
    }
  }
  
  if (cell.fill) {
    if (cell.fill.type === 'pattern') {
      const patternFill = cell.fill as ExcelJS.FillPattern;
      if (patternFill.fgColor) {
        const bgColor = argbToHex(patternFill.fgColor.argb);
        if (bgColor) {
          style.backgroundColor = bgColor;
        }
      }
    } else if (cell.fill.type === 'gradient') {
      const gradientFill = cell.fill as any;
      if (gradientFill.stops && gradientFill.stops.length > 0) {
        const bgColor = argbToHex(gradientFill.stops[0].color?.argb);
        if (bgColor) {
          style.backgroundColor = bgColor;
        }
      }
    }
  }
  
  if (cell.border) {
    style.borderTop = getBorderStyle(cell.border.top);
    style.borderBottom = getBorderStyle(cell.border.bottom);
    style.borderLeft = getBorderStyle(cell.border.left);
    style.borderRight = getBorderStyle(cell.border.right);
  }
  
  return style;
};

const formatCellValue = (cell: ExcelJS.Cell): string => {
  const value = cell.value;
  
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'object' && 'result' in value) {
    const result = (value as ExcelJS.CellFormulaValue).result;
    if (result !== undefined) {
      return formatValue(result, cell.numFmt);
    }
  }
  
  if (typeof value === 'object' && 'richText' in value) {
    return (value as ExcelJS.CellRichTextValue).richText.map(rt => rt.text).join('');
  }
  
  if (typeof value === 'object' && 'hyperlink' in value) {
    return (value as ExcelJS.CellHyperlinkValue).text || '';
  }
  
  if (value instanceof Date) {
    return value.toLocaleDateString('pt-BR');
  }
  
  if (typeof value === 'object' && 'error' in value) {
    return String((value as any).error);
  }
  
  return formatValue(value, cell.numFmt);
};

const formatValue = (value: any, numFmt: string | undefined): string => {
  if (value === null || value === undefined) return '';
  
  if (typeof value === 'number') {
    if (numFmt) {
      const fmt = numFmt.toLowerCase();
      
      if (fmt.includes('r$') || fmt.includes('"r$"') || fmt.includes('[$r$')) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      }
      if (fmt.includes('$') || fmt.includes('usd') || fmt.includes('[$$')) {
        return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
      }
      if (fmt.includes('€') || fmt.includes('eur')) {
        return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
      }
      
      if (fmt.includes('%')) {
        return (value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
      }
      
      if (fmt.includes('d') && fmt.includes('m') && fmt.includes('y')) {
        const date = new Date((value - 25569) * 86400 * 1000);
        return date.toLocaleDateString('pt-BR');
      }
      
      if (fmt.includes('h') && fmt.includes('m') && !fmt.includes('d')) {
        const totalMinutes = value * 24 * 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
      
      if (fmt.includes('(') || fmt.includes('_')) {
        if (value < 0) {
          return `(${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        }
      }
      
      const decimalMatch = fmt.match(/\.([0#]+)/);
      if (decimalMatch) {
        const decimals = decimalMatch[1].length;
        return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      }
      
      if (fmt.includes(',') || fmt.includes('#')) {
        return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    
    if (Number.isInteger(value)) {
      return value.toLocaleString('pt-BR');
    }
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  
  if (typeof value === 'boolean') {
    return value ? 'VERDADEIRO' : 'FALSO';
  }
  
  return String(value);
};

const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  fileId,
  onSave
}) => {
  const [data, setData] = useState<CellData[][]>([]);
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{row: number; col: number} | null>(null);
  const [selectedRange, setSelectedRange] = useState<{startRow: number; startCol: number; endRow: number; endCol: number} | null>(null);
  const [editingCell, setEditingCell] = useState<{row: number; col: number} | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [history, setHistory] = useState<CellData[][][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isSelecting, setIsSelecting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  useEffect(() => {
    if (open && fileUrl) {
      loadSpreadsheet();
      setZoom(100);
    }
  }, [open, fileUrl]);

  useEffect(() => {
    if (selectedCell && data[selectedCell.row]?.[selectedCell.col]) {
      const cell = data[selectedCell.row][selectedCell.col];
      setFormulaBarValue(cell.formula || cell.value);
    }
  }, [selectedCell, data]);

  const saveToHistory = useCallback((newData: CellData[][]) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newData)));
      return newHistory.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const loadSpreadsheet = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('Planilha vazia');
      
      const rowCount = Math.max(worksheet.rowCount || 0, 30);
      const colCount = Math.max(worksheet.columnCount || 0, 15);
      
      // Get column widths
      const colWidths: number[] = [];
      for (let colNum = 1; colNum <= colCount; colNum++) {
        const col = worksheet.getColumn(colNum);
        const width = col.width || 8.43;
        colWidths.push(Math.round(width * 7.5));
      }
      setColumnWidths(colWidths);
      
      // Get row heights
      const heights: number[] = [];
      for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const height = row.height || 15;
        heights.push(Math.round(height * 1.33));
      }
      setRowHeights(heights);
      
      // Get merged cells
      const mergedMap = new Map<string, { colspan: number; rowspan: number; isAnchor: boolean }>();
      
      if (worksheet.model && (worksheet.model as any).merges) {
        const merges = (worksheet.model as any).merges as string[];
        merges.forEach((range: string) => {
          const match = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
          if (match) {
            const startCol = columnLetterToIndex(match[1]);
            const startRow = parseInt(match[2]) - 1;
            const endCol = columnLetterToIndex(match[3]);
            const endRow = parseInt(match[4]) - 1;
            
            const colspan = endCol - startCol + 1;
            const rowspan = endRow - startRow + 1;
            
            mergedMap.set(`${startRow}-${startCol}`, { colspan, rowspan, isAnchor: true });
            
            for (let r = startRow; r <= endRow; r++) {
              for (let c = startCol; c <= endCol; c++) {
                if (r !== startRow || c !== startCol) {
                  mergedMap.set(`${r}-${c}`, { colspan: 0, rowspan: 0, isAnchor: false });
                }
              }
            }
          }
        });
      }
      
      // Build cell data
      const cellData: CellData[][] = [];
      for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
        const rowData: CellData[] = [];
        const row = worksheet.getRow(rowNum);
        
        for (let colNum = 1; colNum <= colCount; colNum++) {
          const cell = row.getCell(colNum);
          const rowIdx = rowNum - 1;
          const colIdx = colNum - 1;
          const mergeInfo = mergedMap.get(`${rowIdx}-${colIdx}`);
          
          const rawValue = cell.value;
          const value = rawValue !== null && rawValue !== undefined ? String(rawValue) : '';
          const formattedValue = formatCellValue(cell);
          const style = extractCellStyle(cell);
          
          const formula = typeof rawValue === 'object' && rawValue !== null && 'formula' in rawValue
            ? `=${(rawValue as any).formula}`
            : (value.startsWith('=') ? value : undefined);
          
          rowData.push({
            value: formattedValue || value,
            formattedValue,
            formula,
            style,
            isMerged: mergeInfo && !mergeInfo.isAnchor,
            mergeAnchor: mergeInfo?.isAnchor,
            colspan: mergeInfo?.isAnchor ? mergeInfo.colspan : undefined,
            rowspan: mergeInfo?.isAnchor ? mergeInfo.rowspan : undefined
          });
        }
        
        cellData.push(rowData);
      }
      
      setData(cellData);
      setHistory([JSON.parse(JSON.stringify(cellData))]);
      setHistoryIndex(0);
      setHasChanges(false);
    } catch (err) {
      console.error('Error loading spreadsheet:', err);
      toast.error('Erro ao carregar o arquivo');
    } finally {
      setLoading(false);
    }
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setData(prev => {
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      const isFormula = value.startsWith('=');
      
      const evaluatedValue = isFormula ? evaluateFormula(value, newData) : value;
      
      newData[rowIndex][colIndex] = {
        ...newData[rowIndex][colIndex],
        value: evaluatedValue,
        formattedValue: evaluatedValue,
        formula: isFormula ? value : undefined
      };
      
      // Recalculate all formulas that might depend on this cell
      const recalculatedData = recalculateAllFormulas(newData);
      
      saveToHistory(recalculatedData);
      return recalculatedData;
    });
    setHasChanges(true);
  };

  const handleFormulaBarChange = (value: string) => {
    setFormulaBarValue(value);
  };

  const handleFormulaBarSubmit = () => {
    if (selectedCell) {
      handleCellChange(selectedCell.row, selectedCell.col, formulaBarValue);
    }
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setData(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  const applyStyle = (styleUpdate: Partial<CellStyle>) => {
    if (!selectedCell && !selectedRange) return;
    
    setData(prev => {
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      
      const startRow = selectedRange?.startRow ?? selectedCell!.row;
      const endRow = selectedRange?.endRow ?? selectedCell!.row;
      const startCol = selectedRange?.startCol ?? selectedCell!.col;
      const endCol = selectedRange?.endCol ?? selectedCell!.col;
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          newData[r][c] = {
            ...newData[r][c],
            style: { ...newData[r][c].style, ...styleUpdate }
          };
        }
      }
      
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const applyBorder = (type: 'all' | 'outer' | 'inner' | 'top' | 'bottom' | 'left' | 'right' | 'none', style: BorderStyle = 'thin', color: string = '#000000') => {
    if (!selectedCell && !selectedRange) return;
    
    setData(prev => {
      const newData = prev.map(row => row.map(cell => ({ ...cell })));
      
      const startRow = selectedRange?.startRow ?? selectedCell!.row;
      const endRow = selectedRange?.endRow ?? selectedCell!.row;
      const startCol = selectedRange?.startCol ?? selectedCell!.col;
      const endCol = selectedRange?.endCol ?? selectedCell!.col;
      
      const borderValue = style === 'none' ? undefined : getBorderStyleValue(style, color);
      
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          const cellStyle = { ...newData[r][c].style };
          
          if (type === 'none') {
            cellStyle.borderTop = undefined;
            cellStyle.borderBottom = undefined;
            cellStyle.borderLeft = undefined;
            cellStyle.borderRight = undefined;
          } else if (type === 'all') {
            cellStyle.borderTop = borderValue;
            cellStyle.borderBottom = borderValue;
            cellStyle.borderLeft = borderValue;
            cellStyle.borderRight = borderValue;
          } else if (type === 'outer') {
            if (r === startRow) cellStyle.borderTop = borderValue;
            if (r === endRow) cellStyle.borderBottom = borderValue;
            if (c === startCol) cellStyle.borderLeft = borderValue;
            if (c === endCol) cellStyle.borderRight = borderValue;
          } else if (type === 'inner') {
            if (r > startRow) cellStyle.borderTop = borderValue;
            if (r < endRow) cellStyle.borderBottom = borderValue;
            if (c > startCol) cellStyle.borderLeft = borderValue;
            if (c < endCol) cellStyle.borderRight = borderValue;
          } else if (type === 'top') {
            cellStyle.borderTop = borderValue;
          } else if (type === 'bottom') {
            cellStyle.borderBottom = borderValue;
          } else if (type === 'left') {
            cellStyle.borderLeft = borderValue;
          } else if (type === 'right') {
            cellStyle.borderRight = borderValue;
          }
          
          newData[r][c] = { ...newData[r][c], style: cellStyle };
        }
      }
      
      saveToHistory(newData);
      return newData;
    });
    setHasChanges(true);
  };

  const getBorderStyleValue = (style: BorderStyle, color: string): string => {
    const styleMap: Record<BorderStyle, string> = {
      none: '',
      thin: `1px solid ${color}`,
      medium: `2px solid ${color}`,
      thick: `3px solid ${color}`,
      double: `3px double ${color}`
    };
    return styleMap[style];
  };

  const addRow = () => {
    setData(prev => {
      const newRow = new Array(prev[0]?.length || 15).fill(null).map(() => ({ value: '', formattedValue: '' }));
      const newData = [...prev, newRow];
      saveToHistory(newData);
      return newData;
    });
    setRowHeights(prev => [...prev, 20]);
    setHasChanges(true);
  };

  const addColumn = () => {
    setData(prev => {
      const newData = prev.map(row => [...row, { value: '', formattedValue: '' }]);
      saveToHistory(newData);
      return newData;
    });
    setColumnWidths(prev => [...prev, 64]);
    setHasChanges(true);
  };

  const deleteRow = (index: number) => {
    if (data.length <= 1) return;
    setData(prev => {
      const newData = prev.filter((_, i) => i !== index);
      saveToHistory(newData);
      return newData;
    });
    setRowHeights(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const deleteColumn = (index: number) => {
    if ((data[0]?.length || 0) <= 1) return;
    setData(prev => {
      const newData = prev.map(row => row.filter((_, i) => i !== index));
      saveToHistory(newData);
      return newData;
    });
    setColumnWidths(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const rawData = data.map(row => row.map(cell => cell.formula || cell.value));
      const worksheet = XLSX.utils.aoa_to_sheet(rawData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
      
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const newFileName = fileName.replace(/\.[^/.]+$/, '') + '.xlsx';
      const filePath = `${Date.now()}-${newFileName.replace(/\s+/g, '-')}`;
      
      const { error: uploadError } = await supabase.storage
        .from('price-files')
        .upload(filePath, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('price-files')
        .getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('price_files')
        .update({
          file_url: urlData.publicUrl,
          file_size: blob.size,
        })
        .eq('id', fileId);
      
      if (updateError) throw updateError;
      
      toast.success('Planilha salva com sucesso!');
      setHasChanges(false);
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving spreadsheet:', err);
      toast.error('Erro ao salvar planilha');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const rawData = data.map(row => row.map(cell => cell.formula || cell.value));
    const worksheet = XLSX.utils.aoa_to_sheet(rawData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, fileName.replace(/\.[^/.]+$/, '') + '.xlsx');
    toast.success('Download realizado!');
  };

  const handleDownloadSummaryPDF = async () => {
    try {
      const pdf = new jsPDF();
      
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Resumo: ${fileName}`, 15, 20);
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 28);
      
      pdf.setDrawColor(200);
      pdf.line(15, 35, 195, 35);
      
      const nonEmptyRows = data.filter(row => row.some(cell => cell.value.trim() !== '')).length;
      const totalCells = data.flat().filter(cell => cell.value.trim() !== '').length;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estatísticas do Documento', 15, 45);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`• Total de linhas com dados: ${nonEmptyRows}`, 20, 55);
      pdf.text(`• Total de células preenchidas: ${totalCells}`, 20, 62);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Prévia dos Dados', 15, 78);
      
      const tableData = data
        .slice(0, 30)
        .filter(row => row.some(cell => cell.value.trim() !== '' && !cell.isMerged))
        .map(row => row.filter(cell => !cell.isMerged).slice(0, 10).map(cell => {
          const display = cell.formattedValue || cell.value;
          return display.length > 30 ? display.substring(0, 27) + '...' : display;
        }));
      
      if (tableData.length > 0) {
        autoTable(pdf, {
          startY: 83,
          head: tableData.length > 0 ? [tableData[0]] : [],
          body: tableData.slice(1),
          theme: 'grid',
          headStyles: { 
            fillColor: [59, 130, 246],
            fontSize: 7,
            fontStyle: 'bold',
            cellPadding: 2
          },
          bodyStyles: { fontSize: 7, cellPadding: 2 },
          margin: { left: 15, right: 15 },
          tableWidth: 'auto'
        });
      }
      
      const pageHeight = pdf.internal.pageSize.height;
      pdf.setFontSize(8);
      pdf.setTextColor(128);
      pdf.text('Documento gerado automaticamente pelo Portal Digitale', 105, pageHeight - 10, { align: 'center' });
      
      pdf.save(`resumo-${fileName.replace(/\.[^/.]+$/, '')}.pdf`);
      toast.success('PDF de resumo gerado com sucesso!');
    } catch (err) {
      console.error('Error generating PDF:', err);
      toast.error('Erro ao gerar PDF');
    }
  };

  const getColumnLetter = (index: number): string => {
    let letter = '';
    let i = index;
    while (i >= 0) {
      letter = String.fromCharCode(65 + (i % 26)) + letter;
      i = Math.floor(i / 26) - 1;
    }
    return letter;
  };

  const handleMouseDown = (row: number, col: number) => {
    setIsSelecting(true);
    setSelectedCell({ row, col });
    setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isSelecting && selectedRange) {
      setSelectedRange(prev => prev ? {
        ...prev,
        endRow: row,
        endCol: col
      } : null);
    }
  };

  const handleMouseUp = () => {
    setIsSelecting(false);
    if (resizingColumn !== null) {
      setResizingColumn(null);
    }
  };

  // Column resize handlers
  const handleColumnResizeStart = (e: React.MouseEvent, colIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(colIndex);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[colIndex] || 64);
  };

  const handleColumnResizeMove = useCallback((e: MouseEvent) => {
    if (resizingColumn === null) return;
    
    const diff = e.clientX - resizeStartX;
    const newWidth = Math.max(30, resizeStartWidth + diff);
    
    setColumnWidths(prev => {
      const newWidths = [...prev];
      newWidths[resizingColumn] = newWidth;
      return newWidths;
    });
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  const handleColumnResizeEnd = useCallback(() => {
    setResizingColumn(null);
  }, []);

  // Auto-fit column width based on content
  const handleColumnAutoFit = useCallback((colIndex: number) => {
    // Create a temporary canvas to measure text width
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    let maxWidth = 30; // Minimum width
    const padding = 16; // Padding for cell content

    // Check header width
    const headerText = getColumnLetter(colIndex);
    context.font = '500 11px Arial';
    maxWidth = Math.max(maxWidth, context.measureText(headerText).width + padding);

    // Check all cells in the column
    data.forEach((row) => {
      const cell = row[colIndex];
      if (cell) {
        const displayValue = cell.formattedValue || cell.value || '';
        const fontSize = cell.style?.fontSize || 11;
        const fontWeight = cell.style?.bold ? 'bold' : 'normal';
        const fontFamily = cell.style?.fontFamily || 'Arial';
        
        context.font = `${fontWeight} ${fontSize}pt ${fontFamily}`;
        const textWidth = context.measureText(displayValue).width + padding;
        maxWidth = Math.max(maxWidth, textWidth);
      }
    });

    // Add some extra padding and cap at reasonable max
    maxWidth = Math.min(Math.max(maxWidth, 40), 500);

    setColumnWidths(prev => {
      const newWidths = [...prev];
      newWidths[colIndex] = Math.round(maxWidth);
      return newWidths;
    });
  }, [data]);

  // Add global mouse listeners for column resize
  useEffect(() => {
    if (resizingColumn !== null) {
      document.addEventListener('mousemove', handleColumnResizeMove);
      document.addEventListener('mouseup', handleColumnResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleColumnResizeMove);
        document.removeEventListener('mouseup', handleColumnResizeEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [resizingColumn, handleColumnResizeMove, handleColumnResizeEnd]);

  const isCellSelected = (row: number, col: number): boolean => {
    if (selectedCell?.row === row && selectedCell?.col === col) return true;
    if (!selectedRange) return false;
    
    const minRow = Math.min(selectedRange.startRow, selectedRange.endRow);
    const maxRow = Math.max(selectedRange.startRow, selectedRange.endRow);
    const minCol = Math.min(selectedRange.startCol, selectedRange.endCol);
    const maxCol = Math.max(selectedRange.startCol, selectedRange.endCol);
    
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  const getCellStyles = (cell: CellData, colWidth: number, rowHeight: number): React.CSSProperties => {
    const style = cell.style || {};
    const cssStyle: React.CSSProperties = {
      minWidth: colWidth,
      maxWidth: colWidth,
      height: rowHeight,
      minHeight: rowHeight
    };
    
    if (style.bold) cssStyle.fontWeight = 'bold';
    if (style.italic) cssStyle.fontStyle = 'italic';
    if (style.underline) cssStyle.textDecoration = 'underline';
    if (style.strike) cssStyle.textDecoration = (cssStyle.textDecoration || '') + ' line-through';
    if (style.align) cssStyle.textAlign = style.align === 'fill' ? 'left' : style.align;
    if (style.verticalAlign) cssStyle.verticalAlign = style.verticalAlign;
    if (style.backgroundColor) cssStyle.backgroundColor = style.backgroundColor;
    if (style.textColor) cssStyle.color = style.textColor;
    if (style.fontSize) cssStyle.fontSize = `${style.fontSize}pt`;
    if (style.fontFamily) cssStyle.fontFamily = `"${style.fontFamily}", Arial, sans-serif`;
    if (style.borderTop) cssStyle.borderTop = style.borderTop;
    if (style.borderBottom) cssStyle.borderBottom = style.borderBottom;
    if (style.borderLeft) cssStyle.borderLeft = style.borderLeft;
    if (style.borderRight) cssStyle.borderRight = style.borderRight;
    if (style.wrapText) {
      cssStyle.whiteSpace = 'pre-wrap';
      cssStyle.wordBreak = 'break-word';
    } else {
      cssStyle.whiteSpace = 'nowrap';
      cssStyle.overflow = 'hidden';
      cssStyle.textOverflow = 'ellipsis';
    }
    
    return cssStyle;
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleZoomReset = () => setZoom(100);

  const [currentBorderColor, setCurrentBorderColor] = useState('#000000');
  const [currentBorderStyle, setCurrentBorderStyle] = useState<BorderStyle>('thin');
  const currentCellStyle = selectedCell ? data[selectedCell.row]?.[selectedCell.col]?.style : undefined;

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (hasChanges && !value) {
        if (confirm('Você tem alterações não salvas. Deseja sair sem salvar?')) {
          onOpenChange(value);
        }
      } else {
        onOpenChange(value);
      }
    }}>
      <DialogContent className="max-w-[98vw] w-full max-h-[98vh] h-full flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex flex-row items-center justify-between w-full gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Editor: {fileName}</DialogTitle>
              <DialogDescription className="text-xs">
                Edite as células diretamente. Use fórmulas como =SUM(A1:A10), =AVERAGE(B1:B5)
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 50}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium w-12 text-center">{zoom}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 200}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomReset}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        {/* Toolbar */}
        <TooltipProvider>
          <div className="flex flex-wrap items-center gap-1 px-4 py-2 bg-muted/50 border-b">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0} className="h-8 w-8 p-0">
                    <Undo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Desfazer</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} className="h-8 w-8 p-0">
                    <Redo className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refazer</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.bold ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ bold: !currentCellStyle?.bold })}
                    className="h-8 w-8 p-0"
                  >
                    <Bold className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Negrito</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.italic ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ italic: !currentCellStyle?.italic })}
                    className="h-8 w-8 p-0"
                  >
                    <Italic className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Itálico</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'left' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'left' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alinhar à esquerda</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'center' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'center' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Centralizar</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={currentCellStyle?.align === 'right' ? "secondary" : "ghost"} 
                    size="sm" 
                    onClick={() => applyStyle({ align: 'right' })}
                    className="h-8 w-8 p-0"
                  >
                    <AlignRight className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Alinhar à direita</TooltipContent>
              </Tooltip>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Palette className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Cor de fundo</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: undefined })}>
                    <div className="w-4 h-4 border mr-2" /> Sem cor
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#fef3c7' })}>
                    <div className="w-4 h-4 bg-yellow-100 mr-2" /> Amarelo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#dcfce7' })}>
                    <div className="w-4 h-4 bg-green-100 mr-2" /> Verde
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#dbeafe' })}>
                    <div className="w-4 h-4 bg-blue-100 mr-2" /> Azul
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#fce7f3' })}>
                    <div className="w-4 h-4 bg-pink-100 mr-2" /> Rosa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ backgroundColor: '#f3f4f6' })}>
                    <div className="w-4 h-4 bg-gray-100 mr-2" /> Cinza
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Type className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Cor do texto</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: undefined })}>
                    <span className="text-foreground mr-2">A</span> Padrão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#dc2626' })}>
                    <span className="text-red-600 mr-2">A</span> Vermelho
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#16a34a' })}>
                    <span className="text-green-600 mr-2">A</span> Verde
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#2563eb' })}>
                    <span className="text-blue-600 mr-2">A</span> Azul
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyStyle({ textColor: '#9333ea' })}>
                    <span className="text-purple-600 mr-2">A</span> Roxo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Grid3X3 className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Bordas</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="w-56 bg-popover">
                  <DropdownMenuLabel>Tipo de Borda</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => applyBorder('all', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-2 border-current mr-2" /> Todas as Bordas
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('outer', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-2 border-current mr-2" /> Borda Externa
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => applyBorder('top', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-t-2 border-current mr-2" /> Superior
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('bottom', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-b-2 border-current mr-2" /> Inferior
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('left', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-l-2 border-current mr-2" /> Esquerda
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => applyBorder('right', currentBorderStyle, currentBorderColor)}>
                    <div className="w-5 h-5 border-r-2 border-current mr-2" /> Direita
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => applyBorder('none')}>
                    <div className="w-5 h-5 border border-dashed border-muted-foreground/50 mr-2" /> Sem Bordas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Minus className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Estilo da Borda</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-popover">
                  <DropdownMenuLabel>Espessura</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('thin')}>
                    <div className="w-8 h-0 border-t border-current mr-2" /> Fina
                    {currentBorderStyle === 'thin' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('medium')}>
                    <div className="w-8 h-0 border-t-2 border-current mr-2" /> Média
                    {currentBorderStyle === 'medium' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderStyle('thick')}>
                    <div className="w-8 h-0 border-t-[3px] border-current mr-2" /> Grossa
                    {currentBorderStyle === 'thick' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Cor</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#000000')}>
                    <div className="w-4 h-4 bg-black mr-2 rounded" /> Preto
                    {currentBorderColor === '#000000' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#6b7280')}>
                    <div className="w-4 h-4 bg-gray-500 mr-2 rounded" /> Cinza
                    {currentBorderColor === '#6b7280' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#dc2626')}>
                    <div className="w-4 h-4 bg-red-600 mr-2 rounded" /> Vermelho
                    {currentBorderColor === '#dc2626' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentBorderColor('#2563eb')}>
                    <div className="w-4 h-4 bg-blue-600 mr-2 rounded" /> Azul
                    {currentBorderColor === '#2563eb' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={addRow} className="h-8 px-2">
                    <Plus className="w-4 h-4 mr-1" />
                    Linha
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar linha</TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={addColumn} className="h-8 px-2">
                    <Plus className="w-4 h-4 mr-1" />
                    Coluna
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Adicionar coluna</TooltipContent>
              </Tooltip>
            </div>
            
            <div className="flex-1" />
            
            {selectedCell && (
              <span className="text-xs text-muted-foreground px-2 bg-background rounded border">
                {getColumnLetter(selectedCell.col)}{selectedCell.row + 1}
              </span>
            )}
          </div>
        </TooltipProvider>
        
        {/* Formula Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b">
          <span className="text-xs font-medium text-muted-foreground w-8">fx</span>
          <Input
            value={formulaBarValue}
            onChange={(e) => handleFormulaBarChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleFormulaBarSubmit();
              }
            }}
            onBlur={handleFormulaBarSubmit}
            placeholder="Digite um valor ou fórmula (ex: =SUM(A1:A10))"
            className="h-8 text-sm font-mono"
          />
        </div>
        
        {/* Spreadsheet */}
        <div className="flex-1 min-h-0 overflow-hidden" onMouseUp={handleMouseUp}>
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Carregando planilha...</span>
            </div>
          ) : (
            <div 
              className="h-full overflow-auto bg-[#f3f3f3]"
              style={{ 
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
                width: zoom !== 100 ? `${10000 / zoom}%` : '100%',
                height: zoom !== 100 ? `${10000 / zoom}%` : '100%'
              }}
            >
              <table 
                ref={tableRef} 
                className="border-collapse bg-white shadow-sm" 
                style={{ 
                  minWidth: 'max-content',
                  borderSpacing: 0,
                  tableLayout: 'fixed'
                }}
              >
                <colgroup>
                  <col style={{ width: 40 }} />
                  {columnWidths.map((width, idx) => (
                    <col key={idx} style={{ width: Math.max(width, 30) }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <th 
                      className="sticky left-0 z-20"
                      style={{
                        width: 40,
                        minWidth: 40,
                        height: 22,
                        backgroundColor: '#f0f0f0',
                        borderRight: '1px solid #c0c0c0',
                        borderBottom: '1px solid #c0c0c0',
                        fontSize: 11,
                        fontWeight: 500,
                        color: '#333'
                      }}
                    />
                    {data[0]?.map((_, colIndex) => (
                      <th 
                        key={colIndex} 
                        style={{
                          width: columnWidths[colIndex] || 64,
                          minWidth: columnWidths[colIndex] || 64,
                          height: 22,
                          backgroundColor: '#f0f0f0',
                          borderRight: '1px solid #c0c0c0',
                          borderBottom: '1px solid #c0c0c0',
                          fontSize: 11,
                          fontWeight: 500,
                          textAlign: 'center',
                          color: '#333',
                          position: 'relative'
                        }}
                      >
                        <div className="flex items-center justify-center h-full">
                          <span className="flex-1 text-center select-none">{getColumnLetter(colIndex)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 opacity-0 hover:opacity-100 absolute right-4 top-1/2 -translate-y-1/2"
                            onClick={() => deleteColumn(colIndex)}
                            title="Remover coluna"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        {/* Column resize handle */}
                        <div
                          className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-primary/30 group"
                          onMouseDown={(e) => handleColumnResizeStart(e, colIndex)}
                          onDoubleClick={() => handleColumnAutoFit(colIndex)}
                          title="Arraste para redimensionar, duplo-clique para auto-ajustar"
                          style={{ 
                            backgroundColor: resizingColumn === colIndex ? 'hsl(var(--primary) / 0.5)' : undefined 
                          }}
                        >
                          <div className="absolute right-0 top-0 h-full w-0.5 bg-transparent group-hover:bg-primary" />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td 
                        className="sticky left-0 z-10"
                        style={{
                          width: 40,
                          minWidth: 40,
                          height: rowHeights[rowIndex] || 20,
                          backgroundColor: '#f0f0f0',
                          borderRight: '1px solid #c0c0c0',
                          borderBottom: '1px solid #d0d0d0',
                          fontSize: 11,
                          fontWeight: 500,
                          textAlign: 'center',
                          color: '#333',
                          position: 'relative'
                        }}
                      >
                        <div className="flex items-center justify-between px-0.5">
                          <span className="flex-1 text-center">{rowIndex + 1}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 opacity-0 hover:opacity-100 absolute right-0"
                            onClick={() => deleteRow(rowIndex)}
                            title="Remover linha"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                      {row.map((cell, colIndex) => {
                        // Skip merged cells
                        if (cell.isMerged) return null;
                        
                        const colWidth = columnWidths[colIndex] || 64;
                        const rowHeight = rowHeights[rowIndex] || 20;
                        const cellStyles = getCellStyles(cell, colWidth, rowHeight);
                        const hasCustomBorder = cell.style?.borderTop || cell.style?.borderBottom || 
                                                cell.style?.borderLeft || cell.style?.borderRight;
                        
                        // Calculate total width/height for merged cells
                        let totalWidth = colWidth;
                        let totalHeight = rowHeight;
                        if (cell.colspan && cell.colspan > 1) {
                          for (let i = 1; i < cell.colspan; i++) {
                            totalWidth += columnWidths[colIndex + i] || 64;
                          }
                        }
                        if (cell.rowspan && cell.rowspan > 1) {
                          for (let i = 1; i < cell.rowspan; i++) {
                            totalHeight += rowHeights[rowIndex + i] || 20;
                          }
                        }
                        
                        const isSelected = isCellSelected(rowIndex, colIndex);
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                        
                        return (
                          <td 
                            key={colIndex}
                            colSpan={cell.colspan}
                            rowSpan={cell.rowspan}
                            style={{
                              ...cellStyles,
                              minWidth: totalWidth,
                              maxWidth: totalWidth,
                              height: totalHeight,
                              padding: 0,
                              border: hasCustomBorder ? undefined : '1px solid #e0e0e0',
                              fontSize: cellStyles.fontSize || '11pt',
                              lineHeight: 1.2,
                              boxSizing: 'border-box',
                              outline: isSelected ? '2px solid hsl(var(--primary))' : undefined,
                              outlineOffset: '-2px',
                              backgroundColor: isSelected && !cell.style?.backgroundColor ? 'hsl(var(--primary) / 0.05)' : cellStyles.backgroundColor
                            }}
                            onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                            onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                            onDoubleClick={() => setEditingCell({ row: rowIndex, col: colIndex })}
                            title={cell.value}
                          >
                            {isEditing ? (
                              <Input
                                value={cell.formula || cell.value}
                                onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Tab') {
                                    setEditingCell(null);
                                    if (e.key === 'Tab') {
                                      e.preventDefault();
                                      setSelectedCell({ row: rowIndex, col: colIndex + 1 });
                                    }
                                  }
                                  if (e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                }}
                                autoFocus
                                className="border-0 rounded-none h-full w-full text-sm focus-visible:ring-0 focus-visible:ring-offset-0 font-mono p-1"
                                style={{ 
                                  ...cellStyles,
                                  minHeight: totalHeight
                                }}
                              />
                            ) : (
                              <div 
                                className="px-1 py-0.5 h-full flex items-center"
                                style={{
                                  justifyContent: cellStyles.textAlign === 'center' ? 'center' : 
                                                  cellStyles.textAlign === 'right' ? 'flex-end' : 'flex-start'
                                }}
                              >
                                {cell.formattedValue || cell.value}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={handleDownloadSummaryPDF} disabled={loading}>
            <FileText className="w-4 h-4 mr-2" />
            Resumo PDF
          </Button>
          <Button variant="outline" onClick={handleDownload} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Baixar Excel
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetEditor;
