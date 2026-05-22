import { useMemo, useState } from "react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useMarketingRequests,
  useMarketingRequestReminders,
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_LABELS,
  PRIORITY_COLORS,
  MarketingRequest,
  MarketingRequestStatus,
  MarketingRequestPriority,
} from "@/hooks/useMarketingRequests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ClipboardList,
  Plus,
  Paperclip,
  Trash2,
  Download,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
  GripVertical,
  X as XIcon,
} from "lucide-react";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Solicitacoes() {
  const { user } = useAuth();
  const {
    requests,
    loading,
    createRequest,
    updateStatus,
    updateRequest,
    deleteRequest,
    uploadAttachment,
    deleteAttachment,
  } = useMarketingRequests();
  useMarketingRequestReminders(requests);

  const isDev = user?.role === "dev";
  const isMarketing = user?.role === "marketing";

  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"todas" | MarketingRequestStatus>("todas");
  const [selected, setSelected] = useState<MarketingRequest | null>(null);

  const filtered = useMemo(() => {
    if (filter === "todas") return requests;
    return requests.filter((r) => r.status === filter);
  }, [requests, filter]);

  const stats = useMemo(() => {
    const now = Date.now();
    return {
      total: requests.length,
      pendentes: requests.filter((r) => r.status === "pendente").length,
      andamento: requests.filter((r) => r.status === "em_andamento").length,
      concluidas: requests.filter((r) => r.status === "concluida").length,
      atrasadas: requests.filter(
        (r) =>
          r.status !== "concluida" &&
          r.status !== "cancelada" &&
          new Date(r.due_date).getTime() < now,
      ).length,
    };
  }, [requests]);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ClipboardList className="h-8 w-8 text-primary" />
              Solicitações
            </h1>
            <p className="text-muted-foreground mt-1">
              {isDev
                ? "Crie e gerencie solicitações de tarefas para o Marketing"
                : "Acompanhe e cumpra as solicitações enviadas pelos desenvolvedores"}
            </p>
          </div>
          {isDev && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Solicitação
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={stats.total} icon={ClipboardList} />
          <StatCard label="Pendentes" value={stats.pendentes} icon={Clock} tone="amber" />
          <StatCard label="Em Andamento" value={stats.andamento} icon={Loader2} tone="blue" />
          <StatCard label="Concluídas" value={stats.concluidas} icon={CheckCircle2} tone="emerald" />
          <StatCard label="Atrasadas" value={stats.atrasadas} icon={AlertTriangle} tone="red" />
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(["todas", "pendente", "em_andamento", "concluida", "cancelada"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={filter === s ? "default" : "outline"}
              onClick={() => setFilter(s)}
            >
              {s === "todas" ? "Todas" : STATUS_LABELS[s]}
            </Button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
            Nenhuma solicitação encontrada
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((r) => (
              <RequestCard
                key={r.id}
                request={r}
                isDev={isDev}
                isMarketing={isMarketing}
                onOpen={() => setSelected(r)}
                onStatusChange={(s) => updateStatus(r.id, s)}
                onDelete={() => deleteRequest(r.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create dialog */}
      {isDev && (
        <CreateRequestDialog
          open={creating}
          onOpenChange={setCreating}
          onCreate={async (input, files) => {
            const created = await createRequest(input);
            if (created && files.length) {
              for (const f of files) await uploadAttachment(created.id, f);
            }
            setCreating(false);
          }}
        />
      )}

      {/* Detail */}
      {selected && (
        <RequestDetailDialog
          request={requests.find((x) => x.id === selected.id) ?? selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
          isDev={isDev}
          isMarketing={isMarketing}
          onUpload={(f) => uploadAttachment(selected.id, f)}
          onDeleteAttachment={(id) => deleteAttachment(id)}
          onStatusChange={(s) => updateStatus(selected.id, s)}
          onUpdate={(patch) => updateRequest(selected.id, patch)}
        />
      )}
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  tone?: "amber" | "blue" | "emerald" | "red";
}) {
  const tones: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400",
    blue: "text-blue-600 dark:text-blue-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className={cn("h-6 w-6", tone ? tones[tone] : "text-muted-foreground")} />
      </div>
    </Card>
  );
}

function RequestCard({
  request,
  isDev,
  isMarketing,
  onOpen,
  onStatusChange,
  onDelete,
}: {
  request: MarketingRequest;
  isDev: boolean;
  isMarketing: boolean;
  onOpen: () => void;
  onStatusChange: (s: MarketingRequestStatus) => void;
  onDelete: () => void;
}) {
  const due = new Date(request.due_date);
  const isOverdue =
    request.status !== "concluida" &&
    request.status !== "cancelada" &&
    isBefore(due, new Date());

  return (
    <Card
      className={cn(
        "p-4 hover:shadow-md transition-shadow cursor-pointer",
        isOverdue && "border-red-500/40 bg-red-500/5",
      )}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-lg">{request.title}</h3>
            <Badge variant="outline" className={STATUS_COLORS[request.status]}>
              {STATUS_LABELS[request.status]}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[request.priority]}>
              {PRIORITY_LABELS[request.priority]}
            </Badge>
            {isOverdue && (
              <Badge variant="destructive" className="animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" /> Atrasada
              </Badge>
            )}
          </div>
          {request.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{request.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Início: {format(new Date(request.start_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
            <span className={cn("flex items-center gap-1", isOverdue && "text-red-600 font-medium")}>
              <Clock className="h-3 w-3" />
              Prazo: {format(due, "dd/MM/yyyy HH:mm", { locale: ptBR })} (
              {formatDistanceToNow(due, { locale: ptBR, addSuffix: true })})
            </span>
            {request.attachments && request.attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {request.attachments.length} anexo(s)
              </span>
            )}
            {request.creator && <span>Por: {request.creator.full_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {(isMarketing || isDev) && (
            <Select
              value={request.status}
              onValueChange={(v) => onStatusChange(v as MarketingRequestStatus)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as MarketingRequestStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isDev && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é permanente e removerá todos os anexos.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateRequestDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  onCreate: (
    input: {
      title: string;
      description: string;
      start_date: string;
      due_date: string;
      priority: MarketingRequestPriority;
    },
    files: File[],
  ) => Promise<void>;
}) {
  const today = new Date();
  const toLocalInput = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(toLocalInput(today));
  const [dueDate, setDueDate] = useState(
    toLocalInput(new Date(today.getTime() + 7 * 24 * 3600 * 1000)),
  );
  const [priority, setPriority] = useState<MarketingRequestPriority>("media");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setTitle("");
    setDescription("");
    setFiles([]);
    setPriority("media");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Solicitação</DialogTitle>
          <DialogDescription>
            Crie uma tarefa para o time de Marketing executar dentro do prazo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={5000}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial *</Label>
              <Input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Prazo Final *</Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as MarketingRequestPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as MarketingRequestPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Anexos (sem limite)</Label>
            <Input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <div className="text-xs text-muted-foreground">
                {files.length} arquivo(s) selecionado(s) — {(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!title.trim() || !startDate || !dueDate || submitting || !isAfter(new Date(dueDate), new Date(startDate))}
            onClick={async () => {
              setSubmitting(true);
              await onCreate(
                {
                  title: title.trim(),
                  description,
                  start_date: new Date(startDate).toISOString(),
                  due_date: new Date(dueDate).toISOString(),
                  priority,
                },
                files,
              );
              setSubmitting(false);
              reset();
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Criar Solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestDetailDialog({
  request,
  open,
  onOpenChange,
  isDev,
  isMarketing,
  onUpload,
  onDeleteAttachment,
  onStatusChange,
  onUpdate,
}: {
  request: MarketingRequest;
  open: boolean;
  onOpenChange: (b: boolean) => void;
  isDev: boolean;
  isMarketing: boolean;
  onUpload: (file: File) => Promise<void>;
  onDeleteAttachment: (id: string) => void;
  onStatusChange: (s: MarketingRequestStatus) => void;
  onUpdate: (patch: Partial<MarketingRequest>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const isImage = (t?: string | null) => t?.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {request.title}
            <Badge variant="outline" className={STATUS_COLORS[request.status]}>
              {STATUS_LABELS[request.status]}
            </Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[request.priority]}>
              {PRIORITY_LABELS[request.priority]}
            </Badge>
          </DialogTitle>
          <DialogDescription className="flex flex-col gap-1 text-xs pt-2">
            <span>
              <Calendar className="h-3 w-3 inline mr-1" />
              Início: {format(new Date(request.start_date), "PPp", { locale: ptBR })}
            </span>
            <span>
              <Clock className="h-3 w-3 inline mr-1" />
              Prazo: {format(new Date(request.due_date), "PPp", { locale: ptBR })}
            </span>
            {request.creator && <span>Solicitado por: {request.creator.full_name}</span>}
          </DialogDescription>
        </DialogHeader>

        {request.description && (
          <div className="bg-muted/30 rounded-md p-3 text-sm whitespace-pre-wrap">
            {request.description}
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Anexos</Label>
            {isDev && (
              <div>
                <input
                  type="file"
                  id="att-upload"
                  className="hidden"
                  onChange={async (e) => {
                    const fs = Array.from(e.target.files ?? []);
                    if (!fs.length) return;
                    setUploading(true);
                    for (const f of fs) await onUpload(f);
                    setUploading(false);
                    e.target.value = "";
                  }}
                  multiple
                />
                <Button asChild size="sm" variant="outline" disabled={uploading}>
                  <label htmlFor="att-upload" className="cursor-pointer">
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Paperclip className="h-4 w-4 mr-2" />
                    )}
                    Adicionar
                  </label>
                </Button>
              </div>
            )}
          </div>
          {(!request.attachments || request.attachments.length === 0) && (
            <p className="text-sm text-muted-foreground">Nenhum anexo.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {request.attachments?.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-2 border rounded-md p-2 hover:bg-muted/50"
              >
                {isImage(a.file_type) ? (
                  <img
                    src={a.file_url}
                    alt={a.file_name}
                    className="h-10 w-10 object-cover rounded"
                  />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate" title={a.file_name}>
                    {a.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : ""}
                  </p>
                </div>
                <Button asChild size="icon" variant="ghost">
                  <a href={a.file_url} target="_blank" rel="noreferrer" download={a.file_name}>
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
                {isDev && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => onDeleteAttachment(a.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {(isMarketing || isDev) && (
          <div className="pt-2 border-t space-y-2">
            <Label>Atualizar status</Label>
            <Select
              value={request.status}
              onValueChange={(v) => onStatusChange(v as MarketingRequestStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as MarketingRequestStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
