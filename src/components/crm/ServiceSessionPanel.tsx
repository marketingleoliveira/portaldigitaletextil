import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  useLeadServiceSessions,
  useOpenServiceSession,
  useStartServiceSession,
  useEndServiceSession,
} from "@/hooks/useLeadServiceSessions";
import { MapPin, Play, Square, Loader2, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ServiceSessionPanelProps {
  leadId: string;
}

function formatDuration(startIso: string, endIso: string | null) {
  if (!endIso) return "Em andamento";
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function mapsLink(lat: number | null, lng: number | null) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function ServiceSessionPanel({ leadId }: ServiceSessionPanelProps) {
  const { data: sessions = [], isLoading } = useLeadServiceSessions(leadId);
  const { data: openSession } = useOpenServiceSession(leadId);
  const startSession = useStartServiceSession();
  const endSession = useEndServiceSession();

  const handleStart = () => startSession.mutate(leadId);
  const handleEnd = () => {
    if (openSession) endSession.mutate({ sessionId: openSession.id, leadId });
  };

  return (
    <div className="space-y-4">
      {/* Action button */}
      <Card className="p-4 bg-muted/30">
        {openSession ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                Atendimento em andamento
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Iniciado em {format(new Date(openSession.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            {openSession.start_address && (
              <p className="text-xs flex items-start gap-1.5">
                <MapPin className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{openSession.start_address}</span>
              </p>
            )}
            <Button
              onClick={handleEnd}
              disabled={endSession.isPending}
              variant="destructive"
              size="sm"
              className="w-full gap-2"
            >
              {endSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
              Encerrar Atendimento
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleStart}
            disabled={startSession.isPending}
            size="sm"
            className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {startSession.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Iniciar Atendimento
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Sua localização será registrada
        </p>
      </Card>

      <Separator />

      {/* History */}
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Histórico de Atendimentos
        </h4>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum atendimento registrado
          </p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const startLink = mapsLink(s.start_latitude, s.start_longitude);
              const endLink = mapsLink(s.end_latitude, s.end_longitude);
              return (
                <Card key={s.id} className="p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {format(new Date(s.started_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      s.ended_at ? "bg-muted text-muted-foreground" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    }`}>
                      {formatDuration(s.started_at, s.ended_at)}
                    </span>
                  </div>
                  {s.user_profile && (
                    <p className="text-[11px] text-muted-foreground">Por {s.user_profile.full_name}</p>
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <Play className="w-3 h-3 mt-0.5 text-emerald-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          Início — {format(new Date(s.started_at), "HH:mm", { locale: ptBR })}
                        </p>
                        {s.start_address && <p className="text-muted-foreground">{s.start_address}</p>}
                        {startLink && (
                          <a href={startLink} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            Ver no mapa <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {s.ended_at && (
                      <div className="flex items-start gap-1.5">
                        <Square className="w-3 h-3 mt-0.5 text-red-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            Fim — {format(new Date(s.ended_at), "HH:mm", { locale: ptBR })}
                          </p>
                          {s.end_address && <p className="text-muted-foreground">{s.end_address}</p>}
                          {endLink && (
                            <a href={endLink} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                              Ver no mapa <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
