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

interface ParsedLead {
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  notes: string;
  valid: boolean;
  errors: string[];
}

interface CRMImportDialogProps {
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
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text: string): ParsedLead[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Remove BOM
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

  // Map CSV column indices
  const colMap = {
    razaoSocial: headers.findIndex((h) => h.includes("raz") && h.includes("social")),
    nomeFantasia: headers.findIndex((h) => h.includes("nome") && h.includes("fantasia")),
    cnpj: headers.findIndex((h) => h === "cnpj"),
    email: headers.findIndex((h) => h === "email"),
    telefone: headers.findIndex((h) => h.includes("telefone")),
    whatsapp: headers.findIndex((h) => h.includes("whatsapp")),
    socios: headers.findIndex((h) => h.includes("sócio") || h.includes("socio") || h.includes("sócios") || h.includes("socios")),
    cidade: headers.findIndex((h) => h.includes("cidade")),
    uf: headers.findIndex((h) => h === "uf"),
    abertura: headers.findIndex((h) => h.includes("abertura")),
    porte: headers.findIndex((h) => h.includes("porte")),
    capitalSocial: headers.findIndex((h) => h.includes("capital")),
  };

  return lines.slice(1).map((line) => {
    const cols = parseCSVLine(line);
    const get = (idx: number) => (idx >= 0 && idx < cols.length ? cols[idx]?.trim() || "" : "");

    const razaoSocial = get(colMap.razaoSocial);
    const nomeFantasia = get(colMap.nomeFantasia);
    const cnpj = get(colMap.cnpj);
    const email = get(colMap.email);
    const telefone = get(colMap.telefone);
    const whatsapp = get(colMap.whatsapp);
    const socios = get(colMap.socios);
    const cidade = get(colMap.cidade);
    const uf = get(colMap.uf);
    const abertura = get(colMap.abertura);
    const porte = get(colMap.porte);
    const capitalSocial = get(colMap.capitalSocial);

    const companyName = nomeFantasia || razaoSocial;
    const contactName = socios ? socios.split(",")[0]?.trim() : razaoSocial;

    const errors: string[] = [];
    if (!companyName) errors.push("Empresa obrigatória");
    if (!contactName) errors.push("Contato obrigatório");

    // Build notes with extra info
    const notesParts: string[] = [];
    if (razaoSocial && nomeFantasia) notesParts.push(`Razão Social: ${razaoSocial}`);
    if (cnpj) notesParts.push(`CNPJ: ${cnpj}`);
    if (whatsapp) notesParts.push(`WhatsApp: ${whatsapp}`);
    if (socios) notesParts.push(`Sócios: ${socios}`);
    if (cidade || uf) notesParts.push(`Localização: ${[cidade, uf].filter(Boolean).join("/")}`);
    if (abertura) {
      const d = new Date(abertura);
      if (!isNaN(d.getTime())) notesParts.push(`Abertura: ${d.toLocaleDateString("pt-BR")}`);
    }
    if (porte) notesParts.push(`Porte: ${porte}`);
    if (capitalSocial) notesParts.push(`Capital Social: ${capitalSocial}`);

    return {
      company_name: companyName,
      contact_name: contactName,
      contact_email: email.toLowerCase(),
      contact_phone: telefone,
      notes: notesParts.join("\n"),
      valid: errors.length === 0,
      errors,
    };
  });
}

export function CRMImportDialog({ open, onOpenChange }: CRMImportDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedLead[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const leads = parseCSV(text);
      setParsed(leads);
      setStep("preview");
    };
    reader.readAsText(file, "utf-8");
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
        source: "outro" as const,
        created_by: user.id,
      }));

      // Insert in batches of 50
      const batchSize = 50;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await supabase.from("leads").insert(batch);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${validLeads.length} leads importados com sucesso!`);
      handleClose();
    } catch (err: any) {
      toast.error("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setParsed([]);
    setFileName("");
    setStep("upload");
    onOpenChange(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Importar Leads via CSV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="border-2 border-dashed rounded-xl p-8 w-full text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}>
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Clique para selecionar um arquivo CSV</p>
              <p className="text-xs text-muted-foreground mt-1">
                Colunas esperadas: Razão Social, Nome Fantasia, CNPJ, Email, Telefone, WhatsApp, Sócios, Cidade, UF, etc.
              </p>
            </div>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {step === "preview" && (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground truncate">{fileName}</span>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  {validLeads.length} válidos
                </Badge>
                {invalidLeads.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {invalidLeads.length} inválidos
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[50vh] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((lead, i) => (
                    <TableRow key={i} className={!lead.valid ? "bg-destructive/5" : ""}>
                      <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{lead.company_name || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{lead.contact_name || "—"}</TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate">{lead.contact_email || "—"}</TableCell>
                      <TableCell className="text-sm">{lead.contact_phone || "—"}</TableCell>
                      <TableCell>
                        {lead.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <span className="text-xs text-destructive">{lead.errors.join(", ")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); }}>
                Voltar
              </Button>
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
