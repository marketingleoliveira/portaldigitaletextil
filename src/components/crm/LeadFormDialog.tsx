import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLead, useVendedores, LEAD_SOURCE_CONFIG, type LeadSource, type LeadScope } from "@/hooks/useCRM";
import { Loader2 } from "lucide-react";

interface LeadFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope?: LeadScope;
}


const initialForm = {
  // Empresa
  company_name: "",
  cnpj: "",
  razao_social: "",
  categoria: "",
  setor: "",
  responsavel: "",
  compra_tecido_mensal: "",
  source: "outro" as LeadSource,
  assigned_to: "",
  // Contato
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  rua: "",
  bairro: "",
  cep: "",
  notes: "",
};

export function LeadFormDialog({ open, onOpenChange, scope = 'atendimento' }: LeadFormDialogProps) {
  const createLead = useCreateLead();
  const { data: vendedores } = useVendedores();
  const [form, setForm] = useState(initialForm);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLead.mutateAsync({
      company_name: form.company_name.trim(),
      cnpj: form.cnpj.trim() || undefined,
      razao_social: form.razao_social.trim() || undefined,
      categoria: form.categoria.trim() || undefined,
      setor: form.setor.trim() || undefined,
      responsavel: form.responsavel.trim() || undefined,
      compra_tecido_mensal: form.compra_tecido_mensal ? Number(form.compra_tecido_mensal) : undefined,
      source: form.source,
      assigned_to: form.assigned_to || undefined,
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim() || undefined,
      contact_phone: form.contact_phone.trim() || undefined,
      rua: form.rua.trim() || undefined,
      bairro: form.bairro.trim() || undefined,
      cep: form.cep.trim() || undefined,
      notes: form.notes.trim() || undefined,
      scope,
    } as any);
    setForm(initialForm);
    onOpenChange(false);
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Empresa */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Empresa</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome da empresa *</Label>
                <Input required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="Nome fantasia" />
              </div>
              <div className="space-y-1.5">
                <Label>CNPJ *</Label>
                <Input required value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Razão Social *</Label>
                <Input required value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} placeholder="Razão social da empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Input required value={form.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex: Confecção, Indústria" />
              </div>
              <div className="space-y-1.5">
                <Label>Setor *</Label>
                <Input required value={form.setor} onChange={(e) => set("setor", e.target.value)} placeholder="Ex: Moda, Hospitalar" />
              </div>
              <div className="space-y-1.5">
                <Label>Responsável *</Label>
                <Input required value={form.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Responsável na empresa" />
              </div>
              <div className="space-y-1.5">
                <Label>Compra de tecido mensal *</Label>
                <Input required type="number" min="0" step="0.01" value={form.compra_tecido_mensal} onChange={(e) => set("compra_tecido_mensal", e.target.value)} placeholder="Metros / kg" />
              </div>
              <div className="space-y-1.5">
                <Label>Origem *</Label>
                <Select value={form.source} onValueChange={(v) => set("source", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEAD_SOURCE_CONFIG).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Vendedor Responsável</Label>
                <Select value={form.assigned_to} onValueChange={(v) => set("assigned_to", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {vendedores?.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Contato */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informações de contato</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome do Responsável *</Label>
                <Input required value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} placeholder="Nome de quem atende" />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => set("contact_email", e.target.value)} placeholder="email@empresa.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input value={form.contact_phone} onChange={(e) => set("contact_phone", e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Rua</Label>
                <Input value={form.rua} onChange={(e) => set("rua", e.target.value)} placeholder="Rua, número e complemento" />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} placeholder="Bairro" />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Informações adicionais..." rows={3} />
              </div>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createLead.isPending}>
              {createLead.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Lead
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
