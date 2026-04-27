import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Download, ExternalLink, Video, Search, Loader2, FileVideo, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface RecordingRow {
  id: string;
  meeting_id: string | null;
  meeting_title: string;
  meeting_date: string;
  recording_id: string;
  download_url: string | null;
  duration_seconds: number | null;
  created_at: string;
  source: "db" | "storage";
  storage_path?: string;
  size_bytes?: number;
}

export default function Recordings() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<RecordingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const isDev = user?.role === "dev";

  const load = async () => {
    setLoading(true);
    try {
      // 1. From DB
      const { data: dbRecs, error: dbErr } = await supabase
        .from("meeting_recordings")
        .select("*")
        .order("created_at", { ascending: false });
      if (dbErr) throw dbErr;

      const fromDb: RecordingRow[] = (dbRecs || []).map((r) => ({
        id: r.id,
        meeting_id: r.meeting_id,
        meeting_title: r.meeting_title,
        meeting_date: r.meeting_date,
        recording_id: r.recording_id,
        download_url: r.download_url,
        duration_seconds: r.duration_seconds,
        created_at: r.created_at,
        source: "db" as const,
      }));

      // 2. From Storage (recursively list all user folders to catch orphans)
      const orphans: RecordingRow[] = [];
      const { data: rootEntries } = await supabase.storage
        .from("meeting-recordings")
        .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });

      const knownUrls = new Set(fromDb.map((d) => d.download_url).filter(Boolean));

      const folders = (rootEntries || []).filter((e) => e.id === null || !e.metadata);
      for (const folder of folders) {
        const { data: files } = await supabase.storage
          .from("meeting-recordings")
          .list(folder.name, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
        for (const f of files || []) {
          if (!f.name.match(/\.(webm|mp4|mkv)$/i)) continue;
          const path = `${folder.name}/${f.name}`;
          const { data: pub } = supabase.storage.from("meeting-recordings").getPublicUrl(path);
          if (knownUrls.has(pub.publicUrl)) continue;
          orphans.push({
            id: `orphan-${path}`,
            meeting_id: null,
            meeting_title: f.name.replace(/\.(webm|mp4|mkv)$/i, "").replace(/_/g, " "),
            meeting_date: f.created_at || new Date().toISOString(),
            recording_id: path,
            download_url: pub.publicUrl,
            duration_seconds: null,
            created_at: f.created_at || new Date().toISOString(),
            source: "storage",
            storage_path: path,
            size_bytes: (f.metadata as any)?.size,
          });
        }
      }
      // Also files at root
      for (const f of rootEntries || []) {
        if (!f.name.match(/\.(webm|mp4|mkv)$/i)) continue;
        const { data: pub } = supabase.storage.from("meeting-recordings").getPublicUrl(f.name);
        if (knownUrls.has(pub.publicUrl)) continue;
        orphans.push({
          id: `orphan-${f.name}`,
          meeting_id: null,
          meeting_title: f.name.replace(/\.(webm|mp4|mkv)$/i, "").replace(/_/g, " "),
          meeting_date: f.created_at || new Date().toISOString(),
          recording_id: f.name,
          download_url: pub.publicUrl,
          duration_seconds: null,
          created_at: f.created_at || new Date().toISOString(),
          source: "storage",
          storage_path: f.name,
          size_bytes: (f.metadata as any)?.size,
        });
      }

      const combined = [...fromDb, ...orphans].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setRecordings(combined);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao carregar gravações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const normalize = (s: string) => s.toLowerCase().trim();
  const filtered = recordings.filter((r) => {
    const q = normalize(search);
    if (!q) return true;
    if (normalize(r.meeting_title).includes(q)) return true;
    try {
      const d = new Date(r.meeting_date);
      const formats = [
        format(d, "dd/MM/yyyy", { locale: ptBR }),
        format(d, "dd/MM/yy", { locale: ptBR }),
        format(d, "dd-MM-yyyy", { locale: ptBR }),
        format(d, "yyyy-MM-dd", { locale: ptBR }),
        format(d, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
        format(d, "MMMM yyyy", { locale: ptBR }),
        format(d, "MMMM", { locale: ptBR }),
        format(d, "dd/MM", { locale: ptBR }),
        format(d, "HH:mm", { locale: ptBR }),
      ];
      return formats.some((f) => normalize(f).includes(q));
    } catch {
      return false;
    }
  });

  const formatDuration = (sec: number | null) => {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const formatSize = (b?: number) => {
    if (!b) return "";
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  };

  const handleDelete = async (rec: RecordingRow) => {
    if (!isDev) return;
    if (!confirm(`Excluir gravação "${rec.meeting_title}"?`)) return;
    try {
      if (rec.source === "db") {
        // Try to remove storage object too
        if (rec.download_url) {
          const match = rec.download_url.match(/meeting-recordings\/(.+)$/);
          if (match) {
            await supabase.storage.from("meeting-recordings").remove([match[1]]);
          }
        }
        await supabase.from("meeting_recordings").delete().eq("id", rec.id);
      } else if (rec.storage_path) {
        await supabase.storage.from("meeting-recordings").remove([rec.storage_path]);
      }
      toast.success("Gravação excluída");
      load();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <FileVideo className="w-7 h-7 text-primary" />
              Gravações
            </h1>
            <p className="text-muted-foreground mt-1">
              Todas as gravações de reuniões e depoimentos disponíveis na plataforma
            </p>
          </div>
          <Button onClick={load} variant="outline" disabled={loading}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Atualizar
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="w-4 h-4" />
              Buscar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Buscar por título da reunião..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Video className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhuma gravação encontrada</p>
              <p className="text-xs text-muted-foreground mt-2">
                As gravações feitas a partir de agora serão automaticamente enviadas para a nuvem
                ao parar a gravação.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((rec) => (
              <Card key={rec.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm truncate">{rec.meeting_title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(rec.meeting_date), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    {rec.source === "storage" && (
                      <Badge variant="outline" className="text-[10px]">
                        Órfã
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>⏱ {formatDuration(rec.duration_seconds)}</span>
                    {rec.size_bytes && <span>💾 {formatSize(rec.size_bytes)}</span>}
                  </div>

                  {rec.download_url ? (
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline" className="flex-1">
                        <a href={rec.download_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          Ver
                        </a>
                      </Button>
                      <Button asChild size="sm" className="flex-1">
                        <a href={rec.download_url} download>
                          <Download className="w-3.5 h-3.5 mr-1" />
                          Baixar
                        </a>
                      </Button>
                      {isDev && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(rec)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-destructive">Arquivo indisponível</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
