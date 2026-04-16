import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, Plus, Clock, HelpCircle, Keyboard, Settings, Trash2 } from "lucide-react";
import { useMarketingContacts, useCreateMarketingContact, type MarketingContact } from "@/hooks/useMarketingContacts";
import { useMarketingQuickResponses, useCreateQuickResponse, useDeleteQuickResponse } from "@/hooks/useMarketingQuickResponses";
import { type MarketingLead } from "@/hooks/useMarketingLeads";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DEFAULT_CALL = [
  { key: "1", label: "Número de telefone inexistente" },
  { key: "2", label: "Telefone fora de área / sem alcance" },
  { key: "3", label: "Telefone chama, mas não atende" },
  { key: "4", label: "Chamada encaminhada para caixa postal" },
  { key: "5", label: "Tentativa de contato sem sucesso" },
  { key: "6", label: "Nova tentativa de contato sem sucesso" },
];

const DEFAULT_WA = [
  { key: "7", label: "Mensagem de primeiro contato enviada" },
  { key: "8", label: "Nova tentativa de mensagem enviada" },
];

interface Props {
  lead: MarketingLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingLeadContactSheet({ lead, open, onOpenChange }: Props) {
  const { data: contacts = [] } = useMarketingContacts(lead?.id);
  const createContact = useCreateMarketingContact();
  const { data: customResponses = [] } = useMarketingQuickResponses();
  const createCustom = useCreateQuickResponse();
  const deleteCustom = useDeleteQuickResponse();

  const [tab, setTab] = useState<"ligacao" | "whatsapp">("ligacao");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showNewCommand, setShowNewCommand] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newType, setNewType] = useState<"ligacao" | "whatsapp">("ligacao");
  const resultRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const calls = contacts.filter((c) => c.contact_type === "ligacao");
  const whatsapps = contacts.filter((c) => c.contact_type === "whatsapp");

  const customCall = useMemo(
    () => customResponses.filter((r) => r.response_type === "ligacao").map((r) => ({ key: r.shortcut_key || "", label: r.label, id: r.id })),
    [customResponses]
  );
  const customWa = useMemo(
    () => customResponses.filter((r) => r.response_type === "whatsapp").map((r) => ({ key: r.shortcut_key || "", label: r.label, id: r.id })),
    [customResponses]
  );

  const allCallResponses = useMemo(() => [...DEFAULT_CALL, ...customCall], [customCall]);
  const allWaResponses = useMemo(() => [...DEFAULT_WA, ...customWa], [customWa]);
  const allResponses = useMemo(() => [...allCallResponses, ...allWaResponses], [allCallResponses, allWaResponses]);

  const currentResponses = tab === "ligacao" ? allCallResponses : allWaResponses;

  // Autocomplete suggestions
  useEffect(() => {
    const currentValue = tab === "ligacao" ? result : message;
    if (currentValue.trim().length < 2) { setSuggestions([]); return; }
    const lower = currentValue.toLowerCase();
    const matches = currentResponses.map((r) => r.label).filter((l) => l.toLowerCase().includes(lower) && l.toLowerCase() !== lower);
    setSuggestions(matches);
  }, [result, message, tab, currentResponses]);

  const applyQuickResponse = useCallback(
    (label: string) => {
      if (tab === "ligacao") { setResult(label); setSuggestions([]); resultRef.current?.focus(); }
      else { setMessage(label); setSuggestions([]); messageRef.current?.focus(); }
    },
    [tab]
  );

  // Keyboard shortcuts (Alt+key)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const match = allResponses.find((r) => r.key === e.key);
      if (match) {
        e.preventDefault();
        const isCall = allCallResponses.some((r) => r.key === e.key && r.label === match.label);
        if (isCall && tab !== "ligacao") setTab("ligacao");
        if (!isCall && tab !== "whatsapp") setTab("whatsapp");
        if (isCall) { setResult(match.label); setSuggestions([]); }
        else { setMessage(match.label); setSuggestions([]); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, tab, allResponses, allCallResponses]);

  const handleSubmit = () => {
    if (!lead) return;
    if (tab === "ligacao" && !result.trim()) return;
    if (tab === "whatsapp" && !message.trim()) return;
    createContact.mutate(
      { lead_id: lead.id, contact_type: tab, result: tab === "ligacao" ? result.trim() : undefined, message: tab === "whatsapp" ? message.trim() : undefined },
      { onSuccess: () => { setResult(""); setMessage(""); setSuggestions([]); } }
    );
  };

  const handleCreateCommand = () => {
    if (!newLabel.trim()) return;
    createCustom.mutate(
      { label: newLabel.trim(), shortcut_key: newKey.trim() || undefined, response_type: newType },
      { onSuccess: () => { setNewLabel(""); setNewKey(""); setShowNewCommand(false); } }
    );
  };

  if (!lead) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <SheetTitle className="text-left">Contatos - {lead.company_name}</SheetTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted" title="Tutorial de respostas">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                      <Keyboard className="w-4 h-4" />
                      Tutorial de Respostas Rápidas
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Alt</kbd> + tecla para inserir rapidamente
                    </p>
                  </div>
                  <div className="p-2 space-y-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Ligações</p>
                    {allCallResponses.map((r) => (
                      <div key={r.key + r.label} className="flex items-center gap-2 px-1.5 py-1 text-xs rounded hover:bg-muted/50">
                        {r.key ? (
                          <kbd className="min-w-[28px] text-center px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-bold">Alt+{r.key}</kbd>
                        ) : (
                          <span className="min-w-[28px] text-center text-[10px] text-muted-foreground">—</span>
                        )}
                        <span className="text-muted-foreground">{r.label}</span>
                      </div>
                    ))}
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">WhatsApp</p>
                    {allWaResponses.map((r) => (
                      <div key={r.key + r.label} className="flex items-center gap-2 px-1.5 py-1 text-xs rounded hover:bg-muted/50">
                        {r.key ? (
                          <kbd className="min-w-[28px] text-center px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-bold">Alt+{r.key}</kbd>
                        ) : (
                          <span className="min-w-[28px] text-center text-[10px] text-muted-foreground">—</span>
                        )}
                        <span className="text-muted-foreground">{r.label}</span>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <button
                type="button"
                onClick={() => setShowNewCommand(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted"
                title="Gerenciar comandos"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </SheetHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger value="ligacao" className="flex-1 gap-1.5"><Phone className="w-3.5 h-3.5" />Ligações ({calls.length})</TabsTrigger>
              <TabsTrigger value="whatsapp" className="flex-1 gap-1.5"><MessageCircle className="w-3.5 h-3.5" />WhatsApp ({whatsapps.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="ligacao" className="space-y-4 mt-4">
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Registrar nova ligação</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allCallResponses.map((r) => (
                    <button key={r.key + r.label} type="button" onClick={() => applyQuickResponse(r.label)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                      {r.key && <kbd className="text-[9px] font-mono opacity-60">{r.key}</kbd>}
                      <span className="truncate max-w-[140px]">{r.label}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Input ref={resultRef} placeholder="Resultado da ligação..." value={result} onChange={(e) => setResult(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} />
                  {suggestions.length > 0 && tab === "ligacao" && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => applyQuickResponse(s)} className="w-full text-left text-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleSubmit} disabled={createContact.isPending} size="sm" className="w-full gap-1.5"><Plus className="w-3.5 h-3.5" />Registrar Ligação</Button>
              </div>
              <div className="space-y-2">
                {calls.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ligação registrada</p> : calls.map((c) => <ContactItem key={c.id} contact={c} />)}
              </div>
            </TabsContent>

            <TabsContent value="whatsapp" className="space-y-4 mt-4">
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Registrar mensagem WhatsApp</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allWaResponses.map((r) => (
                    <button key={r.key + r.label} type="button" onClick={() => applyQuickResponse(r.label)} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors">
                      {r.key && <kbd className="text-[9px] font-mono opacity-60">{r.key}</kbd>}
                      <span className="truncate max-w-[180px]">{r.label}</span>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Textarea ref={messageRef} placeholder="Mensagem enviada ao cliente..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                  {suggestions.length > 0 && tab === "whatsapp" && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                      {suggestions.map((s) => (
                        <button key={s} type="button" onClick={() => applyQuickResponse(s)} className="w-full text-left text-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                <Button onClick={handleSubmit} disabled={createContact.isPending} size="sm" className="w-full gap-1.5"><Plus className="w-3.5 h-3.5" />Registrar Mensagem</Button>
              </div>
              <div className="space-y-2">
                {whatsapps.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem registrada</p> : whatsapps.map((c) => <ContactItem key={c.id} contact={c} />)}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Dialog para criar/gerenciar comandos */}
      <Dialog open={showNewCommand} onOpenChange={setShowNewCommand}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Comandos Rápidos</DialogTitle>
          </DialogHeader>

          {customResponses.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <Label className="text-xs text-muted-foreground">Comandos personalizados</Label>
              {customResponses.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    {r.shortcut_key && <kbd className="px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-bold shrink-0">Alt+{r.shortcut_key}</kbd>}
                    <span className="truncate">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">({r.response_type === "ligacao" ? "Ligação" : "WhatsApp"})</span>
                  </div>
                  <button type="button" onClick={() => deleteCustom.mutate(r.id)} className="text-destructive hover:text-destructive/80 shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 border-t pt-3">
            <Label className="text-sm font-medium">Novo comando</Label>
            <Input placeholder="Texto do comando (ex: Cliente em reunião)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Atalho (opcional)</Label>
                <Input placeholder="Ex: a, b, 9..." maxLength={1} value={newKey} onChange={(e) => setNewKey(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ligacao">Ligação</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCommand(false)}>Fechar</Button>
            <Button onClick={handleCreateCommand} disabled={createCustom.isPending || !newLabel.trim()} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />Criar Comando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContactItem({ contact }: { contact: MarketingContact }) {
  const isCall = contact.contact_type === "ligacao";
  return (
    <div className="flex items-start gap-2.5 p-3 border rounded-lg bg-background">
      <div className={cn("mt-0.5 p-1.5 rounded-md", isCall ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600")}>
        {isCall ? <Phone className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
      </div>
      <div className="flex-1 min-w-0">
        {isCall && contact.result && <p className="text-sm font-medium">{contact.result}</p>}
        {!isCall && contact.message && <p className="text-sm">{contact.message}</p>}
        {!contact.result && !contact.message && <p className="text-sm text-muted-foreground italic">Sem detalhes</p>}
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          {format(parseISO(contact.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </div>
      </div>
    </div>
  );
}
