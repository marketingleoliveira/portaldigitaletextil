import React from 'react';
import { useSpreadsheetPreviewData } from '@/hooks/useSpreadsheetPreviewData';
import { Loader2 } from 'lucide-react';

interface SpreadsheetMiniPreviewProps {
  fileUrl: string;
}

const SpreadsheetMiniPreview: React.FC<SpreadsheetMiniPreviewProps> = ({ fileUrl }) => {
  const { rows, isLoading, error } = useSpreadsheetPreviewData(fileUrl);

  if (isLoading) {
    return (
      <div className="h-24 flex items-center justify-center bg-muted/30 rounded">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || rows.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center bg-muted/30 rounded">
        <span className="text-xs text-muted-foreground">Preview indisponível</span>
      </div>
    );
  }

  return (
    <div className="h-24 overflow-hidden rounded border bg-white">
      <table className="w-full text-[8px] leading-tight border-collapse">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-0.5 py-0.5 border-r border-b border-muted/50 truncate max-w-[60px]"
                  style={{
                    backgroundColor: cell.backgroundColor || 'transparent',
                    color: cell.textColor || 'inherit',
                    fontWeight: cell.bold ? 'bold' : 'normal',
                  }}
                  title={cell.value}
                >
                  {cell.value || '\u00A0'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SpreadsheetMiniPreview;
