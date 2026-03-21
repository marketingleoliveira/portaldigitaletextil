import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Users, Clock, Calendar, Copy, Settings, Keyboard, History, Lock, Eye, EyeOff, Trash2, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_code: string;
  host_user_id: string;
  is_active: boolean;
  allow_participants_video: boolean;
  allow_participants_audio: boolean;
  allow_screen_share: boolean;
  allow_chat: boolean;
  waiting_room_enabled: boolean;
  max_participants: number;
  scheduled_start: string | null;
  scheduled_end: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  password?: string | null;
  host_profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

const generateMeetingCode = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  result += '-';
  for (let i = 0; i < 3; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function Meetings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [endingAll, setEndingAll] = useState(false);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    password: "",
  });

  const isDev = user?.role === 'dev';

  useEffect(() => {
    if (!user) return;
    
    fetchMeetings();

    // Subscribe to realtime changes on meetings table
    const channel = supabase
      .channel('meetings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meetings',
        },
        async (payload) => {
          console.log('Meeting INSERT:', payload);
          const newMeeting = payload.new as Meeting;
          
          // Fetch with host profile
          const { data } = await supabase
            .from("meetings")
            .select(`*, host_profile:profiles!meetings_host_user_id_fkey(full_name, avatar_url)`)
            .eq("id", newMeeting.id)
            .single();
          
          if (data) {
            setMeetings(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === data.id)) return prev;
              return [data, ...prev].slice(0, 10);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
        },
        (payload) => {
          console.log('Meeting UPDATE:', payload);
          const updatedMeeting = payload.new as Meeting;
          
          // Remove if ended
          if (updatedMeeting.ended_at || !updatedMeeting.is_active) {
            setMeetings(prev => prev.filter(m => m.id !== updatedMeeting.id));
          } else {
            setMeetings(prev => prev.map(m => 
              m.id === updatedMeeting.id ? { ...m, ...updatedMeeting } : m
            ));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'meetings',
        },
        (payload) => {
          console.log('Meeting DELETE:', payload);
          const deletedId = (payload.old as { id: string }).id;
          setMeetings(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMeetings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("meetings")
        .select(`
          *,
          host_profile:profiles!meetings_host_user_id_fkey(full_name, avatar_url)
        `)
        .or(`host_user_id.eq.${user.id},is_active.eq.true`)
        .is("ended_at", null)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error("Error fetching meetings:", error);
    } finally {
      setLoading(false);
    }
  };

  const createMeeting = async () => {
    if (!user) return;
    
    if (!newMeeting.title.trim()) {
      toast.error("Informe o nome da reunião");
      return;
    }

    setCreatingMeeting(true);
    
    try {
      const meetingCode = generateMeetingCode();
      
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: newMeeting.title.trim(),
          meeting_code: meetingCode,
          host_user_id: user.id,
          started_at: new Date().toISOString(),
          password: newMeeting.password.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Reunião criada!");
      setCreateDialogOpen(false);
      setNewMeeting({ title: "", password: "" });
      
      // Open meeting in new tab
      window.open(`/reuniao/${data.meeting_code}`, '_blank');
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Erro ao criar reunião");
    } finally {
      setCreatingMeeting(false);
    }
  };

  const joinMeeting = () => {
    const code = joinCode.trim().toLowerCase();
    if (!code) {
      toast.error("Informe o código da reunião");
      return;
    }
    navigate(`/reuniao/${code}`);
  };

  const copyMeetingLink = (code: string) => {
    const link = `${window.location.origin}/reuniao/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const copyGuestLink = (code: string) => {
    const link = `${window.location.origin}/entrar/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link para convidados copiado!");
  };

  const endSingleMeeting = async (meeting: Meeting) => {
    if (!isDev) return;
    setEndingId(meeting.id);
    try {
      // Delete Daily room
      try {
        await supabase.functions.invoke("daily-room", {
          body: { action: "delete", roomName: meeting.meeting_code },
        });
      } catch {}

      const { error } = await supabase
        .from("meetings")
        .update({ ended_at: new Date().toISOString(), is_active: false })
        .eq("id", meeting.id);

      if (error) throw error;
      setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
      toast.success(`Reunião "${meeting.title}" encerrada!`);
    } catch (error) {
      console.error("Error ending meeting:", error);
      toast.error("Erro ao encerrar reunião");
    } finally {
      setEndingId(null);
    }
  };

  const endAllMeetings = async () => {
    if (!isDev) return;
    
    setEndingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("end-all-meetings");

      if (error) throw error;
      
      toast.success(`Todas as reuniões foram encerradas! (${data?.count || 0} reuniões)`);
      setMeetings([]);
    } catch (error) {
      console.error("Error ending all meetings:", error);
      toast.error("Erro ao encerrar reuniões");
    } finally {
      setEndingAll(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Left Side - Create/Join */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Video className="w-6 h-6 text-primary" />
                </div>
                Videoconferência
              </CardTitle>
              <CardDescription>
                Crie ou participe de reuniões por vídeo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  className="gap-2"
                  size="lg"
                >
                  <Video className="w-5 h-5" />
                  Nova reunião
                </Button>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Informe o código da reunião"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="pl-10"
                    onKeyDown={(e) => e.key === "Enter" && joinMeeting()}
                  />
                </div>
                <Button variant="secondary" onClick={joinMeeting}>
                  Participar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right Side - Recent Meetings */}
          <Card className="border-0 shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Suas Reuniões
              </CardTitle>
              {isDev && meetings.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={endAllMeetings}
                  disabled={endingAll}
                  className="gap-1 text-xs"
                >
                  {endingAll ? (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                  ) : (
                    <Trash2 className="w-3 h-3" />
                  )}
                  ENCERRAR TUDO
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : meetings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma reunião ainda</p>
                  <p className="text-sm">Crie sua primeira reunião!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {meetings.slice(0, 5).map((meeting) => (
                    <div
                      key={meeting.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{meeting.title}</p>
                          {meeting.password && (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{meeting.meeting_code}</span>
                          <span>•</span>
                          <span>{format(new Date(meeting.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyGuestLink(meeting.meeting_code)}
                          title="Copiar link para convidados"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyMeetingLink(meeting.meeting_code)}
                          title="Copiar link da reunião"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => navigate(`/reuniao/${meeting.meeting_code}`)}
                        >
                          Entrar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Features Section */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="text-center p-6 border-0 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold mb-2">Vídeo HD</h3>
            <p className="text-sm text-muted-foreground">
              Videoconferência com qualidade profissional
            </p>
          </Card>
          
          <Card className="text-center p-6 border-0 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold mb-2">Até 50 pessoas</h3>
            <p className="text-sm text-muted-foreground">
              Convide toda sua equipe para a reunião
            </p>
          </Card>
          
          <Card className="text-center p-6 border-0 shadow-sm hover:shadow-md transition-shadow">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
              <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="font-semibold mb-2">Controle total</h3>
            <p className="text-sm text-muted-foreground">
              O anfitrião controla todas as opções
            </p>
          </Card>
        </div>
      </div>

      {/* Create Meeting Modal */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Nova Reunião
            </DialogTitle>
            <DialogDescription>
              Preencha as informações para criar sua reunião
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nome da reunião *</Label>
              <Input
                id="title"
                value={newMeeting.title}
                onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                placeholder="Ex: Reunião de equipe"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Senha (opcional)
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={newMeeting.password}
                  onChange={(e) => setNewMeeting({ ...newMeeting, password: e.target.value })}
                  placeholder="Deixe em branco para reunião sem senha"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Se definir uma senha, os participantes precisarão informá-la para entrar
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setCreateDialogOpen(false);
                setNewMeeting({ title: "", password: "" });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={createMeeting} disabled={creatingMeeting}>
              {creatingMeeting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : (
                "Criar reunião"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
