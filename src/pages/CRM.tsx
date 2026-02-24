import { useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useLeads, type Lead, type LeadStatus, LEAD_STATUS_CONFIG } from "@/hooks/useCRM";
import { useAuth } from "@/contexts/AuthContext";
import { CRMStats } from "@/components/crm/CRMStats";
import { CRMKanban } from "@/components/crm/CRMKanban";
import { CRMTable } from "@/components/crm/CRMTable";
import { LeadFormDialog } from "@/components/crm/LeadFormDialog";
import { CRMImportDialog } from "@/components/crm/CRMImportDialog";
import { LeadDetailSheet } from "@/components/crm/LeadDetailSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, LayoutGrid, List, Loader2, Upload } from "lucide-react";

const CRM = () => {
  const { user } = useAuth();
  const isDev = user?.role === "dev";
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: leads = [], isLoading } = useLeads(statusFilter === "all" ? null : statusFilter);

  const filteredLeads = leads.filter((lead) => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (
      lead.company_name.toLowerCase().includes(q) ||
      lead.contact_name.toLowerCase().includes(q) ||
      lead.contact_email?.toLowerCase().includes(q) ||
      lead.contact_phone?.includes(q)
    );
  });

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    setShowDetail(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-muted-foreground">
              {isDev ? "Gerencie leads e atribua vendedores" : "Acompanhe seus leads"}
            </p>
          </div>
          {isDev && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowImport(true)} className="gap-2">
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Lead
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <CRMStats leads={leads} />

        {/* Filters & View Toggle */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "kanban" | "table")}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-1.5">
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Tabela</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : viewMode === "kanban" ? (
          <CRMKanban leads={filteredLeads} onSelectLead={handleSelectLead} />
        ) : (
          <CRMTable leads={filteredLeads} onSelectLead={handleSelectLead} />
        )}
      </div>

      {/* Dialogs */}
      <LeadFormDialog open={showForm} onOpenChange={setShowForm} />
      <CRMImportDialog open={showImport} onOpenChange={setShowImport} />
      <LeadDetailSheet lead={selectedLead} open={showDetail} onOpenChange={setShowDetail} />
    </DashboardLayout>
  );
};

export default CRM;
