import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import ExcelJS from "exceljs";

interface ParsedLead {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
  valid: boolean;
  errors: string[];
  raw: Record<string, string>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim()); current = "";
    } else { current += char; }
  }
  result.push(current.trim());
  return result;
}

function readCSV(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [] as string[], rows: [] as string[][] };
  const headers = parseCSVLine(lines[0].replace(/^\uFEFF/, ""));
  const rows = lines.slice(1).map((l) => parseCSVLine(l));
  return { headers, rows };
}

function getCellString(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "result" in v) return String((v as any).result ?? "");
  if (typeof v === "object" && "richText" in v) return (v as any).richText.map((rt: any) => rt.text).join("");
  if (typeof v === "object" && "hyperlink" in v) return (v as any).text || "";
  if (v instanceof Date) return v.toLocaleDateString("pt-BR");
  return String(v);
}

async function readXLSX(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount === 0) return { headers: [] as string[], rows: [] as string[][] };
  let headerRowNum = 1;
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const nonEmpty = [];
    for (let c = 1; c <= (ws.columnCount || 20); c++) { if (getCellString(row.getCell(c))) nonEmpty.push(true); }
    if (nonEmpty.length >= 3) { headerRowNum = r; break; }
  }
  const headerRow = ws.getRow(headerRowNum);
  const colCount = ws.columnCount || 20;
  const headers: string[] = [];
  for (let c = 1; c <= colCount; c++) headers.push(getCellString(headerRow.getCell(c)) || `Coluna ${c}`);
  while (headers.length > 0 && !headers[headers.length - 1].trim()) headers.pop();
  const rows: string[][] = [];
  for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals: string[] = [];
    let hasData = false;
    for (let c = 1; c <= headers.length; c++) { const v = getCellString(row.getCell(c)); vals.push(v); if (v) hasData = true; }
    if (hasData) rows.push(vals);
  }
  return { headers, rows };
}

function findCol(headers: string[], ...patterns: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  for (const p of patterns) { const idx = lower.findIndex((h) => h.includes(p)); if (idx >= 0) return idx; }
  return -1;
}

function mapRow(headers: string[], cols: string[]): ParsedLead {
  const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx]?.trim() || "" : "");
  const iNome = findCol(headers, "nome fantasia", "fantasia");
  const iRazao = findCol(headers, "razao social", "raz");
  const iEmpresa = findCol(headers, "empresa");
  const iEmail = findCol(headers, "email", "e-mail");
  const iTel = findCol(headers, "telefone", "fone", "tel");
  const iContato = findCol(headers, "contato", "responsavel");

  const companyName = get(iNome) || get(iRazao) || get(iEmpresa);
  const contactName = get(iContato) || get(iRazao) || companyName;
  const errors: string[] = [];
  if (!companyName) errors.push("Empresa obrigatória");
  if (!contactName) errors.push("Contato obrigatório");

  const raw: Record<string, string> = {};
  headers.forEach((h, i) => { const val = get(i); if (val) raw[h] = val; });
  const notesParts = headers.map((h, i) => { const val = get(i); return val ? `${h}: ${val}` : null; }).filter(Boolean) as string[];

  return { company_name: companyName, contact_name: contactName, contact_email: get(iEmail).toLowerCase(), contact_phone: get(iTel), notes: notesParts.join("\n"), valid: errors.length === 0, errors, raw };
}

export function MarketingImportDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [allHeaders, setAllHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    try {
      const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
      const { headers, rows } = isXlsx ? await readXLSX(await file.arrayBuffer()) : readCSV(await file.text());
      if (headers.length === 0) { toast.error("Arquivo vazio ou sem cabeçalhos"); setLoading(false); return; }
      setAllHeaders(headers);
      setParsed(rows.map((row) => mapRow(headers, row)));
      setStep("preview");
    } catch (err: any) { toast.error("Erro ao ler arquivo: " + err.message); }
    finally { setLoading(false); }
  };

  const validLeads = parsed.filter((l) => l.valid);
  const invalidLeads = parsed.filter((l) => !l.valid);

  const handleImport = async () => {
    if (!user || validLeads.length === 0) return;
    setImporting(true);
    try {
      const rows = validLeads.map((l) => ({
        company_name: l.company_name,
        contact_name: l.contact_name,
        contact_email: l.contact_email || null,
        contact_phone: l.contact_phone || null,
        notes: l.notes || null,
        created_by: user.id,
      }));
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("marketing_leads").insert(batch as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["marketing-leads"] });
      toast.success(`${validLeads.length} leads importados!`);
      handleClose();
    } catch (err: any) { toast.error("Erro ao importar: " + err.message); }
    finally { setImporting(false); }
  };

  const handleClose = () => { setParsed([]); setAllHeaders([]); setFileName(""); setStep("upload"); onOpenChange(false); if (fileRef.current) fileRef.current.value = ""; };
  const previewHeaders = allHeaders.slice(0, 6);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Leads de Depoimento
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed rounded-xl p-8 w-full text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
              {loading ? <Loader2 className="w-10 h-10 mx-auto mb-3 animate-spin text-muted-foreground" /> : <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />}
              <p className="text-sm font-medium">{loading ? "Lendo arquivo..." : "Clique para selecionar um arquivo CSV ou XLSX"}</p>
              <p className="text-xs text-muted-foreground mt-1">Todas as colunas serão preservadas nas observações</p>
            </div>
            <Input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="flex flex-col">
                <span className="text-muted-foreground truncate">{fileName}</span>
                <span className="text-xs text-muted-foreground">{allHeaders.length} colunas detectadas</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="outline" className="gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />{validLeads.length} válidos</Badge>
                {invalidLeads.length > 0 && <Badge variant="destructive" className="gap-1"><AlertCircle className="w-3 h-3" />{invalidLeads.length} inválidos</Badge>}
              </div>
            </div>
            <ScrollArea className="flex-1 max-h-[50vh] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    {previewHeaders.map((h) => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}
                    {allHeaders.length > 6 && <TableHead className="text-xs text-muted-foreground">+{allHeaders.length - 6} cols</TableHead>}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.slice(0, 100).map((lead, i) => (
                    <TableRow key={i} className={!lead.valid ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      {previewHeaders.map((h) => <TableCell key={h} className="text-xs max-w-[150px] truncate">{lead.raw[h] || "—"}</TableCell>)}
                      {allHeaders.length > 6 && <TableCell className="text-xs text-muted-foreground">...</TableCell>}
                      <TableCell>{lead.valid ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <span className="text-xs text-destructive">{lead.errors.join(", ")}</span>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
            {parsed.length > 100 && <p className="text-xs text-muted-foreground text-center">Mostrando 100 de {parsed.length} registros</p>}
            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); setAllHeaders([]); }}>Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                <Button onClick={handleImport} disabled={importing || validLeads.length === 0}>
                  {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importar {validLeads.length} leads
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
