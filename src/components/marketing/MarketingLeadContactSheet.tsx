import { useState, useEffect, useCallback, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Phone, MessageCircle, Plus, Clock, HelpCircle, Keyboard } from "lucide-react";
import { useMarketingContacts, useCreateMarketingContact, type MarketingContact } from "@/hooks/useMarketingContacts";
import { type MarketingLead } from "@/hooks/useMarketingLeads";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const QUICK_RESPONSES_CALL = [
  { key: "1", label: "Número de telefone inexistente" },
  { key: "2", label: "Telefone fora de área / sem alcance" },
  { key: "3", label: "Telefone chama, mas não atende" },
  { key: "4", label: "Chamada encaminhada para caixa postal" },
  { key: "5", label: "Tentativa de contato sem sucesso" },
  { key: "6", label: "Nova tentativa de contato sem sucesso" },
];

const QUICK_RESPONSES_WHATSAPP = [
  { key: "7", label: "Mensagem de primeiro contato enviada" },
  { key: "8", label: "Nova tentativa de mensagem enviada" },
];

const ALL_RESPONSES = [...QUICK_RESPONSES_CALL, ...QUICK_RESPONSES_WHATSAPP];

interface Props {
  lead: MarketingLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingLeadContactSheet({ lead, open, onOpenChange }: Props) {
  const { data: contacts = [] } = useMarketingContacts(lead?.id);
  const createContact = useCreateMarketingContact();
  const [tab, setTab] = useState<"ligacao" | "whatsapp">("ligacao");
  const [result, setResult] = useState("");
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const resultRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const calls = contacts.filter((c) => c.contact_type === "ligacao");
  const whatsapps = contacts.filter((c) => c.contact_type === "whatsapp");

  const currentResponses = tab === "ligacao" ? QUICK_RESPONSES_CALL : QUICK_RESPONSES_WHATSAPP;

  // Autocomplete suggestions
  useEffect(() => {
    const currentValue = tab === "ligacao" ? result : message;
    if (currentValue.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = currentValue.toLowerCase();
    const matches = currentResponses
      .map((r) => r.label)
      .filter((l) => l.toLowerCase().includes(lower) && l.toLowerCase() !== lower);
    setSuggestions(matches);
  }, [result, message, tab, currentResponses]);

  const applyQuickResponse = useCallback(
    (label: string) => {
      if (tab === "ligacao") {
        setResult(label);
        setSuggestions([]);
        resultRef.current?.focus();
      } else {
        setMessage(label);
        setSuggestions([]);
        messageRef.current?.focus();
      }
    },
    [tab]
  );

  // Keyboard shortcuts (Alt+number)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const match = ALL_RESPONSES.find((r) => r.key === e.key);
      if (match) {
        e.preventDefault();
        // Switch tab if needed
        const isCallResponse = QUICK_RESPONSES_CALL.some((r) => r.key === e.key);
        if (isCallResponse && tab !== "ligacao") setTab("ligacao");
        if (!isCallResponse && tab !== "whatsapp") setTab("whatsapp");

        if (isCallResponse) {
          setResult(match.label);
          setSuggestions([]);
        } else {
          setMessage(match.label);
          setSuggestions([]);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, tab]);

  const handleSubmit = () => {
    if (!lead) return;
    if (tab === "ligacao" && !result.trim()) return;
    if (tab === "whatsapp" && !message.trim()) return;
    createContact.mutate(
      {
        lead_id: lead.id,
        contact_type: tab,
        result: tab === "ligacao" ? result.trim() : undefined,
        message: tab === "whatsapp" ? message.trim() : undefined,
      },
      {
        onSuccess: () => {
          setResult("");
          setMessage("");
          setSuggestions([]);
        },
      }
    );
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle className="text-left">Contatos - {lead.company_name}</SheetTitle>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted"
                  title="Tutorial de respostas"
                >
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
                    Use <kbd className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">Alt</kbd> + número para inserir rapidamente
                  </p>
                </div>
                <div className="p-2 space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-1">Ligações</p>
                  {QUICK_RESPONSES_CALL.map((r) => (
                    <div key={r.key} className="flex items-center gap-2 px-1.5 py-1 text-xs rounded hover:bg-muted/50">
                      <kbd className="min-w-[28px] text-center px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-bold">
                        Alt+{r.key}
                      </kbd>
                      <span className="text-muted-foreground">{r.label}</span>
                    </div>
                  ))}
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2">WhatsApp</p>
                  {QUICK_RESPONSES_WHATSAPP.map((r) => (
                    <div key={r.key} className="flex items-center gap-2 px-1.5 py-1 text-xs rounded hover:bg-muted/50">
                      <kbd className="min-w-[28px] text-center px-1.5 py-0.5 bg-muted rounded font-mono text-[10px] font-bold">
                        Alt+{r.key}
                      </kbd>
                      <span className="text-muted-foreground">{r.label}</span>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="ligacao" className="flex-1 gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              Ligações ({calls.length})
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1 gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              WhatsApp ({whatsapps.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ligacao" className="space-y-4 mt-4">
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <Label className="text-sm font-medium">Registrar nova ligação</Label>

              {/* Quick responses */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_RESPONSES_CALL.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => applyQuickResponse(r.label)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <kbd className="text-[9px] font-mono opacity-60">{r.key}</kbd>
                    <span className="truncate max-w-[140px]">{r.label}</span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Input
                  ref={resultRef}
                  placeholder="Resultado da ligação (ex: Atendeu, Não atendeu...)"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                />
                {suggestions.length > 0 && tab === "ligacao" && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => applyQuickResponse(s)}
                        className="w-full text-left text-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSubmit} disabled={createContact.isPending} size="sm" className="w-full gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Registrar Ligação
              </Button>
            </div>

            <div className="space-y-2">
              {calls.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma ligação registrada</p>
              ) : (
                calls.map((c) => <ContactItem key={c.id} contact={c} />)
              )}
            </div>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-4 mt-4">
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <Label className="text-sm font-medium">Registrar mensagem WhatsApp</Label>

              {/* Quick responses */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_RESPONSES_WHATSAPP.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => applyQuickResponse(r.label)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <kbd className="text-[9px] font-mono opacity-60">{r.key}</kbd>
                    <span className="truncate max-w-[180px]">{r.label}</span>
                  </button>
                ))}
              </div>

              <div className="relative">
                <Textarea
                  ref={messageRef}
                  placeholder="Mensagem enviada ao cliente..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                />
                {suggestions.length > 0 && tab === "whatsapp" && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-md overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => applyQuickResponse(s)}
                        className="w-full text-left text-sm px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSubmit} disabled={createContact.isPending} size="sm" className="w-full gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Registrar Mensagem
              </Button>
            </div>

            <div className="space-y-2">
              {whatsapps.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem registrada</p>
              ) : (
                whatsapps.map((c) => <ContactItem key={c.id} contact={c} />)
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
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
