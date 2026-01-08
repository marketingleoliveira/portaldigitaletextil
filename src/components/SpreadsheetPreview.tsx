import React, { useEffect, useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, FileText, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface SpreadsheetPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
}

interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'fill' | 'justify';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  borderTop?: string;
  borderBottom?: string;
  borderLeft?: string;
  borderRight?: string;
  wrapText?: boolean;
  indent?: number;
  rotation?: number;
}

interface CellData {
  value: string;
  formattedValue: string;
  style: CellStyle;
  isMerged?: boolean;
  mergeAnchor?: boolean;
  colspan?: number;
  rowspan?: number;
}

interface SheetData {
  name: string;
  data: CellData[][];
  columnWidths: number[];
  rowHeights: number[];
  mergedCells: { startRow: number; startCol: number; endRow: number; endCol: number }[];
  frozenRows?: number;
  frozenCols?: number;
}

const SpreadsheetPreview: React.FC<SpreadsheetPreviewProps> = ({
  open,
  onOpenChange,
  fileUrl,
  fileName
}) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState('0');
  const [zoom, setZoom] = useState(100);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && fileUrl) {
      loadSpreadsheet();
      setZoom(100);
    }
  }, [open, fileUrl]);

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
      // Handle theme colors with basic mapping
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
    
    // Font styles
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
    
    // Alignment
    if (cell.alignment) {
      if (cell.alignment.horizontal) {
        style.textAlign = cell.alignment.horizontal as any;
      }
      if (cell.alignment.vertical) {
        style.verticalAlign = cell.alignment.vertical as 'top' | 'middle' | 'bottom';
      }
      if (cell.alignment.wrapText) {
        style.wrapText = true;
      }
      if (cell.alignment.indent) {
        style.indent = cell.alignment.indent;
      }
      if (cell.alignment.textRotation && typeof cell.alignment.textRotation === 'number') {
        style.rotation = cell.alignment.textRotation;
      }
    }
    
    // Fill/Background
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
        // Handle gradient fills with first stop color
        const gradientFill = cell.fill as any; // Use any for gradient fills
        if (gradientFill.stops && gradientFill.stops.length > 0) {
          const bgColor = argbToHex(gradientFill.stops[0].color?.argb);
          if (bgColor) {
            style.backgroundColor = bgColor;
          }
        }
      }
    }
    
    // Borders
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
    
    // Handle formula results
    if (typeof value === 'object' && 'result' in value) {
      const result = (value as ExcelJS.CellFormulaValue).result;
      if (result !== undefined) {
        return formatValue(result, cell.numFmt);
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
    
    // Handle errors
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
        
        // Currency formats
        if (fmt.includes('r$') || fmt.includes('"r$"') || fmt.includes('[$r$')) {
          return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }
        if (fmt.includes('$') || fmt.includes('usd') || fmt.includes('[$$')) {
          return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        }
        if (fmt.includes('€') || fmt.includes('eur')) {
          return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
        }
        
        // Percentage
        if (fmt.includes('%')) {
          return (value * 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
        }
        
        // Date formats
        if (fmt.includes('d') && fmt.includes('m') && fmt.includes('y')) {
          const date = new Date((value - 25569) * 86400 * 1000);
          return date.toLocaleDateString('pt-BR');
        }
        
        // Time formats
        if (fmt.includes('h') && fmt.includes('m') && !fmt.includes('d')) {
          const totalMinutes = value * 24 * 60;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);
          return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        // Accounting format
        if (fmt.includes('(') || fmt.includes('_')) {
          if (value < 0) {
            return `(${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
          }
        }
        
        // Check for decimal places in format
        const decimalMatch = fmt.match(/\.([0#]+)/);
        if (decimalMatch) {
          const decimals = decimalMatch[1].length;
          return value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        }
        
        // Thousands separator
        if (fmt.includes(',') || fmt.includes('#')) {
          return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
      }
      
      // Default number formatting
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

  const loadSpreadsheet = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('Erro ao carregar arquivo');
      
      const arrayBuffer = await response.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);
      
      const sheetsData: SheetData[] = [];
      
      workbook.eachSheet((worksheet) => {
        const cellData: CellData[][] = [];
        const rowCount = worksheet.rowCount || 0;
        const colCount = worksheet.columnCount || 0;
        
        // Get column widths (Excel width to pixels: multiply by ~7-8)
        const columnWidths: number[] = [];
        for (let colNum = 1; colNum <= colCount; colNum++) {
          const col = worksheet.getColumn(colNum);
          const width = col.width || 8.43; // Default Excel width
          columnWidths.push(Math.round(width * 7.5));
        }
        
        // Get row heights
        const rowHeights: number[] = [];
        for (let rowNum = 1; rowNum <= rowCount; rowNum++) {
          const row = worksheet.getRow(rowNum);
          const height = row.height || 15; // Default Excel row height
          rowHeights.push(Math.round(height * 1.33)); // Convert to pixels
        }
        
        // Get merged cells
        const mergedCells: { startRow: number; startCol: number; endRow: number; endCol: number }[] = [];
        const mergedMap = new Map<string, { colspan: number; rowspan: number; isAnchor: boolean }>();
        
        // Process merged cell ranges
        if (worksheet.model && (worksheet.model as any).merges) {
          const merges = (worksheet.model as any).merges as string[];
          merges.forEach((range: string) => {
            const match = range.match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
            if (match) {
              const startCol = colLetterToIndex(match[1]);
              const startRow = parseInt(match[2]) - 1;
              const endCol = colLetterToIndex(match[3]);
              const endRow = parseInt(match[4]) - 1;
              
              const colspan = endCol - startCol + 1;
              const rowspan = endRow - startRow + 1;
              
              mergedCells.push({ startRow, startCol, endRow, endCol });
              
              // Mark anchor cell
              mergedMap.set(`${startRow}-${startCol}`, { colspan, rowspan, isAnchor: true });
              
              // Mark merged (hidden) cells
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
            
            const cellInfo: CellData = { 
              value, 
              formattedValue, 
              style,
              isMerged: mergeInfo && !mergeInfo.isAnchor,
              mergeAnchor: mergeInfo?.isAnchor,
              colspan: mergeInfo?.isAnchor ? mergeInfo.colspan : undefined,
              rowspan: mergeInfo?.isAnchor ? mergeInfo.rowspan : undefined
            };
            
            rowData.push(cellInfo);
          }
          
          cellData.push(rowData);
        }
        
        // Get frozen panes
        const views = worksheet.views || [];
        const firstView = views[0] || {};
        
        sheetsData.push({
          name: worksheet.name,
          data: cellData,
          columnWidths,
          rowHeights,
          mergedCells,
          frozenRows: (firstView as any).ySplit || 0,
          frozenCols: (firstView as any).xSplit || 0
        });
      });
      
      setSheets(sheetsData);
      setActiveSheet('0');
    } catch (err) {
      console.error('Error loading spreadsheet:', err);
      setError('Não foi possível carregar a planilha. Verifique se o arquivo é válido.');
    } finally {
      setLoading(false);
    }
  };

  const colLetterToIndex = (letter: string): number => {
    let index = 0;
    for (let i = 0; i < letter.length; i++) {
      index = index * 26 + (letter.charCodeAt(i) - 64);
    }
    return index - 1;
  };

  const getCellStyle = (cellStyle: CellStyle, colWidth: number, rowHeight: number): React.CSSProperties => {
    const style: React.CSSProperties = {
      minWidth: colWidth,
      maxWidth: colWidth,
      height: rowHeight,
      minHeight: rowHeight
    };
    
    if (cellStyle.bold) style.fontWeight = 'bold';
    if (cellStyle.italic) style.fontStyle = 'italic';
    if (cellStyle.underline) style.textDecoration = 'underline';
    if (cellStyle.strike) style.textDecoration = (style.textDecoration || '') + ' line-through';
    if (cellStyle.textAlign) style.textAlign = cellStyle.textAlign === 'fill' ? 'left' : cellStyle.textAlign;
    if (cellStyle.verticalAlign) style.verticalAlign = cellStyle.verticalAlign;
    if (cellStyle.backgroundColor) style.backgroundColor = cellStyle.backgroundColor;
    if (cellStyle.textColor) style.color = cellStyle.textColor;
    if (cellStyle.fontSize) style.fontSize = `${cellStyle.fontSize}pt`;
    if (cellStyle.fontFamily) style.fontFamily = `"${cellStyle.fontFamily}", Arial, sans-serif`;
    if (cellStyle.borderTop) style.borderTop = cellStyle.borderTop;
    if (cellStyle.borderBottom) style.borderBottom = cellStyle.borderBottom;
    if (cellStyle.borderLeft) style.borderLeft = cellStyle.borderLeft;
    if (cellStyle.borderRight) style.borderRight = cellStyle.borderRight;
    if (cellStyle.wrapText) {
      style.whiteSpace = 'pre-wrap';
      style.wordBreak = 'break-word';
    } else {
      style.whiteSpace = 'nowrap';
      style.overflow = 'hidden';
      style.textOverflow = 'ellipsis';
    }
    if (cellStyle.indent) {
      style.paddingLeft = `${cellStyle.indent * 8}px`;
    }
    if (cellStyle.rotation) {
      style.writingMode = cellStyle.rotation === 90 ? 'vertical-rl' : undefined;
      style.transform = cellStyle.rotation !== 90 ? `rotate(-${cellStyle.rotation}deg)` : undefined;
    }
    
    return style;
  };

  const handleDownloadSummaryPDF = async () => {
    if (sheets.length === 0) return;
    
    try {
      const pdf = new jsPDF();
      const currentSheet = sheets[parseInt(activeSheet)];
      
      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Resumo: ${fileName}`, 15, 20);
      
      // Date and sheet info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Aba: ${currentSheet.name}`, 15, 28);
      pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 15, 35);
      
      // Separator
      pdf.setDrawColor(200);
      pdf.line(15, 42, 195, 42);
      
      // Statistics
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Estatísticas do Documento', 15, 52);
      
      const nonEmptyRows = currentSheet.data.filter(row => row.some(cell => cell.value.trim() !== '')).length;
      const totalCells = currentSheet.data.flat().filter(cell => cell.value.trim() !== '').length;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`• Total de linhas com dados: ${nonEmptyRows}`, 20, 62);
      pdf.text(`• Total de células preenchidas: ${totalCells}`, 20, 69);
      
      // Table preview
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Prévia dos Dados', 15, 85);
      
      const tableData = currentSheet.data
        .slice(0, 30)
        .filter(row => row.some(cell => cell.value.trim() !== '' && !cell.isMerged))
        .map(row => row.filter(cell => !cell.isMerged).slice(0, 10).map(cell => {
          const display = cell.formattedValue || cell.value;
          return display.length > 30 ? display.substring(0, 27) + '...' : display;
        }));
      
      if (tableData.length > 0) {
        autoTable(pdf, {
          startY: 90,
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
      
      // Footer
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

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-full max-h-[95vh] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <div className="flex flex-row items-center justify-between w-full gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">{fileName}</DialogTitle>
              <DialogDescription>
                Visualização fiel ao arquivo original
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Zoom controls */}
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
              <Button variant="outline" size="sm" onClick={handleDownloadSummaryPDF} disabled={loading || sheets.length === 0}>
                <FileText className="w-4 h-4 mr-2" />
                Resumo PDF
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Carregando planilha...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>{error}</p>
            </div>
          ) : sheets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="w-12 h-12 mb-4 opacity-50" />
              <p>Planilha vazia</p>
            </div>
          ) : (
            <Tabs value={activeSheet} onValueChange={setActiveSheet} className="h-full flex flex-col">
              {sheets.length > 1 && (
                <div className="border-b px-4 shrink-0">
                  <TabsList className="h-10 w-full justify-start overflow-x-auto bg-transparent">
                    {sheets.map((sheet, index) => (
                      <TabsTrigger 
                        key={index} 
                        value={index.toString()} 
                        className="min-w-fit data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        {sheet.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              )}
              
              {sheets.map((sheet, sheetIndex) => (
                <TabsContent key={sheetIndex} value={sheetIndex.toString()} className="flex-1 min-h-0 m-0">
                  <div 
                    ref={tableRef}
                    className="h-full overflow-auto bg-[#f3f3f3]"
                    style={{ 
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: 'top left',
                      width: zoom !== 100 ? `${10000 / zoom}%` : '100%',
                      height: zoom !== 100 ? `${10000 / zoom}%` : '100%'
                    }}
                  >
                    <table 
                      className="border-collapse bg-white shadow-sm" 
                      style={{ 
                        minWidth: 'max-content',
                        borderSpacing: 0,
                        tableLayout: 'fixed'
                      }}
                    >
                      <colgroup>
                        <col style={{ width: 40 }} />
                        {sheet.columnWidths.map((width, idx) => (
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
                          {sheet.data[0]?.map((_, colIndex) => (
                            <th 
                              key={colIndex} 
                              style={{
                                width: sheet.columnWidths[colIndex] || 64,
                                minWidth: sheet.columnWidths[colIndex] || 64,
                                height: 22,
                                backgroundColor: '#f0f0f0',
                                borderRight: '1px solid #c0c0c0',
                                borderBottom: '1px solid #c0c0c0',
                                fontSize: 11,
                                fontWeight: 500,
                                textAlign: 'center',
                                color: '#333'
                              }}
                            >
                              {getColumnLetter(colIndex)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.data.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            <td 
                              className="sticky left-0 z-10"
                              style={{
                                width: 40,
                                minWidth: 40,
                                height: sheet.rowHeights[rowIndex] || 20,
                                backgroundColor: '#f0f0f0',
                                borderRight: '1px solid #c0c0c0',
                                borderBottom: '1px solid #d0d0d0',
                                fontSize: 11,
                                fontWeight: 500,
                                textAlign: 'center',
                                color: '#333'
                              }}
                            >
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, colIndex) => {
                              // Skip merged cells (non-anchor)
                              if (cell.isMerged) return null;
                              
                              const colWidth = sheet.columnWidths[colIndex] || 64;
                              const rowHeight = sheet.rowHeights[rowIndex] || 20;
                              const cellStyles = getCellStyle(cell.style, colWidth, rowHeight);
                              const hasCustomBorder = cell.style.borderTop || cell.style.borderBottom || 
                                                      cell.style.borderLeft || cell.style.borderRight;
                              
                              // Calculate total width/height for merged cells
                              let totalWidth = colWidth;
                              let totalHeight = rowHeight;
                              if (cell.colspan && cell.colspan > 1) {
                                for (let i = 1; i < cell.colspan; i++) {
                                  totalWidth += sheet.columnWidths[colIndex + i] || 64;
                                }
                              }
                              if (cell.rowspan && cell.rowspan > 1) {
                                for (let i = 1; i < cell.rowspan; i++) {
                                  totalHeight += sheet.rowHeights[rowIndex + i] || 20;
                                }
                              }
                              
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
                                    padding: '2px 4px',
                                    border: hasCustomBorder ? undefined : '1px solid #e0e0e0',
                                    fontSize: cellStyles.fontSize || '11pt',
                                    lineHeight: 1.2,
                                    boxSizing: 'border-box'
                                  }}
                                  title={cell.value}
                                >
                                  {cell.formattedValue || cell.value}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SpreadsheetPreview;
