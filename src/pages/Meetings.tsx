import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Video, Plus, Users, Clock, Calendar, Link2, Copy, Settings, Keyboard, History } from "lucide-react";
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
  const [newMeeting, setNewMeeting] = useState({
    title: "",
    description: "",
    allow_participants_video: true,
    allow_participants_audio: true,
    allow_screen_share: true,
    allow_chat: true,
    waiting_room_enabled: false,
  });

  useEffect(() => {
    fetchMeetings();
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

  const createInstantMeeting = async () => {
    if (!user) return;

    try {
      const meetingCode = generateMeetingCode();
      
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: "Reunião Instantânea",
          meeting_code: meetingCode,
          host_user_id: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Reunião criada!");
      navigate(`/reuniao/${data.meeting_code}`);
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Erro ao criar reunião");
    }
  };

  const createScheduledMeeting = async () => {
    if (!user || !newMeeting.title.trim()) {
      toast.error("Informe o título da reunião");
      return;
    }

    try {
      const meetingCode = generateMeetingCode();
      
      const { data, error } = await supabase
        .from("meetings")
        .insert({
          title: newMeeting.title,
          description: newMeeting.description || null,
          meeting_code: meetingCode,
          host_user_id: user.id,
          allow_participants_video: newMeeting.allow_participants_video,
          allow_participants_audio: newMeeting.allow_participants_audio,
          allow_screen_share: newMeeting.allow_screen_share,
          allow_chat: newMeeting.allow_chat,
          waiting_room_enabled: newMeeting.waiting_room_enabled,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Reunião criada com sucesso!");
      setCreateDialogOpen(false);
      setNewMeeting({
        title: "",
        description: "",
        allow_participants_video: true,
        allow_participants_audio: true,
        allow_screen_share: true,
        allow_chat: true,
        waiting_room_enabled: false,
      });
      fetchMeetings();
    } catch (error) {
      console.error("Error creating meeting:", error);
      toast.error("Erro ao criar reunião");
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

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header Section - Google Meet Style */}
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
                  onClick={createInstantMeeting}
                  className="gap-2"
                  size="lg"
                >
                  <Video className="w-5 h-5" />
                  Nova reunião
                </Button>
                
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="lg" className="gap-2">
                      <Calendar className="w-5 h-5" />
                      Agendar
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Criar Reunião</DialogTitle>
                      <DialogDescription>
                        Configure as opções da sua reunião
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Título da reunião</Label>
                        <Input
                          id="title"
                          value={newMeeting.title}
                          onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
                          placeholder="Ex: Reunião de equipe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrição (opcional)</Label>
                        <Input
                          id="description"
                          value={newMeeting.description}
                          onChange={(e) => setNewMeeting({ ...newMeeting, description: e.target.value })}
                          placeholder="Pauta da reunião..."
                        />
                      </div>
                      
                      <div className="space-y-3 pt-2">
                        <Label className="text-sm font-medium">Opções do anfitrião</Label>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Permitir vídeo dos participantes</span>
                          <Switch
                            checked={newMeeting.allow_participants_video}
                            onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, allow_participants_video: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Permitir áudio dos participantes</span>
                          <Switch
                            checked={newMeeting.allow_participants_audio}
                            onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, allow_participants_audio: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Permitir compartilhamento de tela</span>
                          <Switch
                            checked={newMeeting.allow_screen_share}
                            onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, allow_screen_share: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Permitir chat</span>
                          <Switch
                            checked={newMeeting.allow_chat}
                            onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, allow_chat: checked })}
                          />
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Sala de espera</span>
                          <Switch
                            checked={newMeeting.waiting_room_enabled}
                            onCheckedChange={(checked) => setNewMeeting({ ...newMeeting, waiting_room_enabled: checked })}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={createScheduledMeeting}>
                        Criar reunião
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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

          {/* Right Side - Quick Info */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Suas Reuniões
              </CardTitle>
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
                        <p className="font-medium truncate">{meeting.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{meeting.meeting_code}</span>
                          <span>•</span>
                          <span>{format(new Date(meeting.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyMeetingLink(meeting.meeting_code)}
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
    </DashboardLayout>
  );
}
