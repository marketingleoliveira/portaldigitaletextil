import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, Paperclip, FileText, MessageSquare } from "lucide-react";

const SACDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sac-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sac-proxy", {
        body: undefined,
        // pass id via query string
        // @ts-expect-error - options.query is supported by supabase-js
        query: { id },
      });
      if (error) throw error;
      return data;
    },
  });

  // Fallback: some responses may nest { sac: {...} } or return an array
  const sac: any = data?.sac || (Array.isArray(data) ? data[0] : data) || {};
  const customer = sac.customer || sac.cliente || {};
  const tickets: any[] = sac.tickets || sac.comments || [];
  const attachments: any[] = sac.attachments || [];
  const laudos: any[] = sac.laudos || [];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/sac")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6 text-sm text-destructive">
            Erro: {(error as Error).message}
          </Card>
        ) : (
          <>
            <Card className="p-4 md:p-6 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold">
                  Protocolo {sac.protocol || sac.protocolo || sac.id?.slice(0, 8)}
                </h1>
                {sac.status && <Badge variant="secondary">{sac.status}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {sac.complaint_type || sac.type || sac.tipo || "—"}
              </p>
            </Card>

            <Card className="p-4 md:p-6 space-y-3">
              <h2 className="font-semibold">Cliente</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> {customer.name || sac.client_name || "—"}</div>
                <div><span className="text-muted-foreground">Email:</span> {customer.email || "—"}</div>
                <div><span className="text-muted-foreground">Telefone:</span> {customer.phone || "—"}</div>
                <div><span className="text-muted-foreground">Documento:</span> {customer.document || customer.cnpj || "—"}</div>
              </div>
            </Card>

            <Card className="p-4 md:p-6 space-y-2">
              <h2 className="font-semibold">Mensagem Original</h2>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">
                {sac.message || sac.mensagem || sac.description || "—"}
              </p>
            </Card>

            <Card className="p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Timeline de Comentários Internos</h2>
              </div>
              {tickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem comentários.</p>
              ) : (
                <div className="space-y-3">
                  {tickets.map((t: any, i: number) => (
                    <div key={t.id || i} className="border-l-2 border-primary/30 pl-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{t.author || t.user_name || "—"}</span>
                        {t.created_at && <span>· {new Date(t.created_at).toLocaleString("pt-BR")}</span>}
                      </div>
                      <p className="text-sm whitespace-pre-wrap mt-1">{t.message || t.comment || t.body}</p>
                      {i < tickets.length - 1 && <Separator className="mt-3" />}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Anexos</h2>
              </div>
              {attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem anexos.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {attachments.map((a: any, i: number) => (
                    <li key={a.id || i}>
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {a.name || a.filename || a.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-4 md:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Laudos</h2>
              </div>
              {laudos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem laudos.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {laudos.map((l: any, i: number) => (
                    <li key={l.id || i}>
                      <a href={l.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {l.name || l.filename || l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SACDetails;
