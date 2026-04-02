import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Phone, MessageCircle, Plus, Clock } from "lucide-react";
import { useMarketingContacts, useCreateMarketingContact, type MarketingContact } from "@/hooks/useMarketingContacts";
import { type MarketingLead } from "@/hooks/useMarketingLeads";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  const calls = contacts.filter((c) => c.contact_type === "ligacao");
  const whatsapps = contacts.filter((c) => c.contact_type === "whatsapp");

  const handleSubmit = () => {
    if (!lead) return;
    createContact.mutate(
      {
        lead_id: lead.id,
        contact_type: tab,
        result: tab === "ligacao" ? result || undefined : undefined,
        message: tab === "whatsapp" ? message || undefined : undefined,
      },
      {
        onSuccess: () => {
          setResult("");
          setMessage("");
        },
      }
    );
  };

  if (!lead) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">Contatos - {lead.company_name}</SheetTitle>
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
              <Input
                placeholder="Resultado da ligação (ex: Atendeu, Não atendeu, Caixa postal...)"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              />
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
              <Textarea
                placeholder="Mensagem enviada ao cliente..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
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
