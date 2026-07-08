import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox } from "lucide-react";

interface SacRow {
  id: string;
  protocol?: string;
  protocolo?: string;
  client_name?: string;
  cliente?: string;
  customer?: { name?: string };
  type?: string;
  tipo?: string;
  complaint_type?: string;
  status?: string;
  created_at?: string;
  data?: string;
}

const getProtocol = (s: SacRow) => s.protocol || s.protocolo || s.id?.slice(0, 8);
const getClient = (s: SacRow) => s.client_name || s.cliente || s.customer?.name || "—";
const getType = (s: SacRow) => s.type || s.tipo || s.complaint_type || "—";
const getDate = (s: SacRow) => s.created_at || s.data;

const SAC = () => {
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["sac-list"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("sac-proxy");
      console.log("sac-proxy raw response:", JSON.stringify(data), "error:", error);
      if (error) throw error;
      return data;
    },
  });

  const items: SacRow[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.sacs)
      ? data.sacs
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Inbox className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">SAC</h1>
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="p-6 text-sm text-destructive">
              Erro ao carregar SACs: {(error as Error).message}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum SAC encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((s) => (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/sac/${s.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{getProtocol(s)}</TableCell>
                      <TableCell>{getClient(s)}</TableCell>
                      <TableCell>{getType(s)}</TableCell>
                      <TableCell>
                        {s.status ? <Badge variant="secondary">{s.status}</Badge> : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {getDate(s) ? new Date(getDate(s)!).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SAC;
