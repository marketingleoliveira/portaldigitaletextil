import { useState, useMemo } from "react";
import { useMarketingLeads, MARKETING_STATUS_CONFIG, type MarketingLead } from "@/hooks/useMarketingLeads";
import { useAllMarketingContacts, type MarketingContact } from "@/hooks/useMarketingContacts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, FileText, Loader2 } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isWithinInterval, getYear, getMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import logoDark from "@/assets/logo-dark.png";

type ViewMode = "month" | "week";

interface GroupedData {
  label: string;
  contacts: MarketingContact[];
  calls: number;
  whatsapps: number;
}

export function MarketingReport() {
  const { data: leads = [], isLoading: leadsLoading } = useMarketingLeads();
  const { data: contacts = [], isLoading: contactsLoading } = useAllMarketingContacts();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [generating, setGenerating] = useState(false);

  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const grouped = useMemo(() => {
    if (viewMode === "month") {
      const map = new Map<string, MarketingContact[]>();
      contacts.forEach((c) => {
        const d = parseISO(c.created_at);
        const key = `${getYear(d)}-${String(getMonth(d) + 1).padStart(2, "0")}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
      const result: GroupedData[] = [];
      const sortedKeys = [...map.keys()].sort().reverse();
      for (const key of sortedKeys) {
        const items = map.get(key)!;
        const [y, m] = key.split("-");
        const date = new Date(Number(y), Number(m) - 1, 1);
        result.push({
          label: format(date, "MMMM yyyy", { locale: ptBR }),
          contacts: items,
          calls: items.filter((c) => c.contact_type === "ligacao").length,
          whatsapps: items.filter((c) => c.contact_type === "whatsapp").length,
        });
      }
      return result;
    } else {
      const map = new Map<string, MarketingContact[]>();
      contacts.forEach((c) => {
        const d = parseISO(c.created_at);
        const ws = startOfWeek(d, { weekStartsOn: 0 });
        const key = format(ws, "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
      const result: GroupedData[] = [];
      const sortedKeys = [...map.keys()].sort().reverse();
      for (const key of sortedKeys) {
        const items = map.get(key)!;
        const ws = parseISO(key);
        const we = endOfWeek(ws, { weekStartsOn: 0 });
        result.push({
          label: `${format(ws, "dd/MM", { locale: ptBR })} - ${format(we, "dd/MM/yyyy", { locale: ptBR })}`,
          contacts: items,
          calls: items.filter((c) => c.contact_type === "ligacao").length,
          whatsapps: items.filter((c) => c.contact_type === "whatsapp").length,
        });
      }
      return result;
    }
  }, [contacts, viewMode]);

  // Status summary
  const statusSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
    });
    return counts;
  }, [leads]);

  const handleExportPDF = async () => {
    setGenerating(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;
      let y = margin;

      // Load logo
      const logoImg = new Image();
      logoImg.src = logoDark;
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });

      const drawHeader = () => {
        // Header bar
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(0, 0, pageW, 28, "F");
        
        // Logo
        try {
          doc.addImage(logoImg, "PNG", margin, 4, 40, 20);
        } catch {
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text("Digitale Têxtil", margin, 16);
        }
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Relatório de Marketing", pageW - margin, 12, { align: "right" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - margin, 18, { align: "right" });
        doc.text(`Visualização: ${viewMode === "month" ? "Mensal" : "Semanal"}`, pageW - margin, 23, { align: "right" });
        
        y = 36;
      };

      const checkPage = (needed: number) => {
        if (y + needed > pageH - 15) {
          doc.addPage();
          drawHeader();
        }
      };

      drawHeader();

      // Status summary section
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Estado Atual dos Leads", margin, y);
      y += 6;

      const statusEntries = Object.entries(MARKETING_STATUS_CONFIG);
      const colW = (pageW - margin * 2) / statusEntries.length;
      
      // Status boxes
      statusEntries.forEach(([key, config], i) => {
        const x = margin + i * colW;
        const count = statusSummary[key] || 0;
        
        doc.setFillColor(241, 245, 249); // slate-100
        doc.roundedRect(x + 1, y, colW - 2, 18, 2, 2, "F");
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text(String(count), x + colW / 2, y + 9, { align: "center" });
        
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(config.label, x + colW / 2, y + 15, { align: "center" });
      });
      y += 24;

      // Totals bar
      doc.setFillColor(30, 41, 59);
      doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Total de Leads: ${leads.length}`, margin + 5, y + 6.5);
      doc.text(`Total de Contatos: ${contacts.length}`, pageW / 2, y + 6.5, { align: "center" });
      const totalCalls = contacts.filter(c => c.contact_type === "ligacao").length;
      const totalWA = contacts.filter(c => c.contact_type === "whatsapp").length;
      doc.text(`Ligações: ${totalCalls} | WhatsApp: ${totalWA}`, pageW - margin - 5, y + 6.5, { align: "right" });
      y += 16;

      // Grouped data
      for (const group of grouped) {
        checkPage(30);

        // Group header
        doc.setFillColor(241, 245, 249);
        doc.roundedRect(margin, y, pageW - margin * 2, 10, 2, 2, "F");
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const label = group.label.charAt(0).toUpperCase() + group.label.slice(1);
        doc.text(label, margin + 4, y + 6.5);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`📞 ${group.calls}  💬 ${group.whatsapps}  |  Total: ${group.contacts.length}`, pageW - margin - 4, y + 6.5, { align: "right" });
        y += 14;

        // Contact rows
        for (const contact of group.contacts.slice(0, 20)) {
          checkPage(8);
          const lead = leadMap.get(contact.lead_id);
          const isCall = contact.contact_type === "ligacao";

          doc.setFillColor(isCall ? 239 : 236, isCall ? 246 : 253, isCall ? 255 : 245);
          doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, "F");

          doc.setTextColor(30, 41, 59);
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          doc.text(lead?.company_name ?? "—", margin + 3, y + 4.5);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          const detail = isCall ? (contact.result || "") : (contact.message || "");
          const truncated = detail.length > 50 ? detail.slice(0, 50) + "..." : detail;
          doc.text(truncated, margin + 55, y + 4.5);

          doc.setFontSize(6);
          doc.text(isCall ? "Ligação" : "WhatsApp", pageW - margin - 30, y + 4.5);
          doc.text(format(parseISO(contact.created_at), "dd/MM HH:mm"), pageW - margin - 4, y + 4.5, { align: "right" });

          y += 8;
        }

        if (group.contacts.length > 20) {
          doc.setTextColor(100, 116, 139);
          doc.setFontSize(7);
          doc.text(`... e mais ${group.contacts.length - 20} registros`, margin + 4, y + 3);
          y += 6;
        }

        y += 4;
      }

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(241, 245, 249);
        doc.rect(0, pageH - 10, pageW, 10, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFontSize(7);
        doc.text("Digitale Têxtil — Relatório de Marketing", margin, pageH - 4);
        doc.text(`Página ${i} de ${totalPages}`, pageW - margin, pageH - 4, { align: "right" });
      }

      doc.save(`relatorio-marketing-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setGenerating(false);
    }
  };

  if (leadsLoading || contactsLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Por Mês</SelectItem>
              <SelectItem value="week">Por Semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleExportPDF} disabled={generating} className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
          Exportar PDF
        </Button>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(MARKETING_STATUS_CONFIG).map(([key, config]) => (
          <Card key={key}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{config.label}</p>
              <p className="text-2xl font-bold mt-1">{statusSummary[key] || 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Grouped sections */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum registro de contato encontrado
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.label}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base capitalize">{group.label}</CardTitle>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> {group.calls}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> {group.whatsapps}
                  </span>
                  <Badge variant="secondary">{group.contacts.length} total</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {group.contacts.slice(0, 15).map((c) => {
                  const lead = leadMap.get(c.lead_id);
                  const isCall = c.contact_type === "ligacao";
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 p-2 rounded-md bg-muted/40 text-sm">
                      <div className={cn("p-1 rounded shrink-0", isCall ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600")}>
                        {isCall ? <Phone className="w-3 h-3" /> : <MessageCircle className="w-3 h-3" />}
                      </div>
                      <span className="font-medium truncate min-w-[120px] max-w-[180px]">{lead?.company_name ?? "—"}</span>
                      <span className="text-muted-foreground truncate flex-1">{isCall ? c.result : c.message}</span>
                      {lead && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {MARKETING_STATUS_CONFIG[lead.status]?.label ?? lead.status}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(parseISO(c.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  );
                })}
                {group.contacts.length > 15 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    ... e mais {group.contacts.length - 15} registros
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
