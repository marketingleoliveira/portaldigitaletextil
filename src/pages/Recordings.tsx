import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Video,
  Download,
  RefreshCw,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";
import { Navigate } from "react-router-dom";

interface Recording {
  id: string;
  meeting_id: string | null;
  meeting_title: string;
  meeting_date: string;
  recording_id: string;
  download_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  expires_at: string;
}

const Recordings = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");

  // Only devs can access this page
  if (user?.role !== "dev") {
    return <Navigate to="/dashboard" replace />;
  }

  // Fetch recordings
  const { data: recordings, isLoading, error } = useQuery({
    queryKey: ["recordings", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_recordings")
        .select("*")
        .gte("meeting_date", startOfDay(new Date(startDate)).toISOString())
        .lte("meeting_date", endOfDay(new Date(endDate)).toISOString())
        .order("meeting_date", { ascending: false });

      if (error) throw error;
      return data as Recording[];
    },
  });

  // Sync recordings mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sync-recordings", {
        body: { action: "sync-all" },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronizado: ${data.synced} novas gravações`);
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  // Refresh link mutation
  const refreshLinkMutation = useMutation({
    mutationFn: async (recordingId: string) => {
      const { data, error } = await supabase.functions.invoke("sync-recordings", {
        body: { action: "refresh-link", recordingId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Link atualizado!");
      queryClient.invalidateQueries({ queryKey: ["recordings"] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar link: ${error.message}`);
    },
  });

  const handleDownload = (recording: Recording) => {
    if (recording.download_url) {
      window.open(recording.download_url, "_blank");
    } else {
      toast.error("Link de download não disponível. Tente atualizar.");
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDaysUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Filter recordings by search term
  const filteredRecordings = recordings?.filter((r) =>
    r.meeting_title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Video className="w-6 h-6 text-primary" />
              Gravações de Reuniões
            </h1>
            <p className="text-muted-foreground">
              Acesse e baixe as gravações das reuniões dos últimos 30 dias
            </p>
          </div>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Sincronizar
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Buscar por Nome</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Nome da reunião..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recordings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gravações</CardTitle>
            <CardDescription>
              {filteredRecordings?.length || 0} gravações encontradas
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8 text-destructive">
                <AlertCircle className="w-5 h-5 mr-2" />
                Erro ao carregar gravações
              </div>
            ) : filteredRecordings?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma gravação encontrada</p>
                <p className="text-sm">
                  Tente sincronizar ou ajustar os filtros
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reunião</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecordings?.map((recording) => {
                      const daysUntilExpiry = getDaysUntilExpiry(recording.expires_at);
                      const isExpiringSoon = daysUntilExpiry <= 7;

                      return (
                        <TableRow key={recording.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Video className="w-4 h-4 text-primary" />
                              <span className="font-medium">
                                {recording.meeting_title}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              {format(
                                new Date(recording.meeting_date),
                                "dd/MM/yyyy HH:mm",
                                { locale: ptBR }
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Clock className="w-4 h-4 text-muted-foreground" />
                              {formatDuration(recording.duration_seconds)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={isExpiringSoon ? "destructive" : "secondary"}
                            >
                              {daysUntilExpiry > 0
                                ? `${daysUntilExpiry} dias`
                                : "Expirado"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  refreshLinkMutation.mutate(recording.recording_id)
                                }
                                disabled={refreshLinkMutation.isPending}
                                title="Atualizar link"
                              >
                                <RefreshCw
                                  className={`w-4 h-4 ${
                                    refreshLinkMutation.isPending
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => handleDownload(recording)}
                                disabled={!recording.download_url}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Baixar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Recordings;
