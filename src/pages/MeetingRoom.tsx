import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant, DailyEventObjectParticipantLeft, DailyParticipantsObject } from "@daily-co/daily-js";
import {
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, 
  ScreenShare, ScreenShareOff, Hand, MoreVertical, Settings,
  Copy, UserX, VolumeX, Maximize, Minimize, Send, ChevronLeft, Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
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
}

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
}

// Use DailyParticipant directly from the SDK

export default function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningDaily, setJoiningDaily] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Daily.co state
  const [dailyRoom, setDailyRoom] = useState<{ url: string; name: string } | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, DailyParticipant>>({});
  
  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const participantRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  const isHost = meeting?.host_user_id === user?.id;

  // Create Daily room via edge function
  const createOrGetDailyRoom = async (meetingCode: string) => {
    const { data, error } = await supabase.functions.invoke("daily-room", {
      body: { action: "get", meetingCode }
    });
    
    if (error) throw error;
    return data as { url: string; name: string };
  };

  // Initialize Daily.co call
  const initializeDaily = useCallback(async (roomUrl: string) => {
    if (!user) return;
    
    setJoiningDaily(true);
    
    try {
      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });

      // Event handlers
      call.on("joined-meeting", () => {
        setJoiningDaily(false);
        toast.success("Conectado à reunião!");
      });

      call.on("participant-joined", (event: DailyEventObjectParticipant | undefined) => {
        if (event?.participant) {
          setParticipants(prev => ({
            ...prev,
            [event.participant.session_id]: event.participant
          }));
        }
      });

      call.on("participant-updated", (event: DailyEventObjectParticipant | undefined) => {
        if (event?.participant) {
          setParticipants(prev => ({
            ...prev,
            [event.participant.session_id]: event.participant
          }));
          
          // Update video element for local participant
          if (event.participant.local && localVideoRef.current) {
            const videoTrack = event.participant.tracks?.video?.track;
            if (videoTrack) {
              localVideoRef.current.srcObject = new MediaStream([videoTrack]);
            }
          }
        }
      });

      call.on("participant-left", (event: DailyEventObjectParticipantLeft | undefined) => {
        if (event?.participant) {
          setParticipants(prev => {
            const updated = { ...prev };
            delete updated[event.participant.session_id];
            return updated;
          });
        }
      });

      call.on("error", (error) => {
        console.error("Daily error:", error);
        toast.error("Erro na conexão de vídeo");
      });

      call.on("left-meeting", () => {
        setParticipants({});
      });

      // Join the meeting
      await call.join({
        url: roomUrl,
        userName: user.profile?.full_name || user.email || "Participante",
      });

      setCallObject(call);
      
      // Get initial participants
      const initialParticipants = call.participants();
      setParticipants(initialParticipants);

      // Set up local video
      const localParticipant = initialParticipants.local;
      if (localParticipant && localVideoRef.current) {
        const videoTrack = localParticipant.tracks?.video?.track;
        if (videoTrack) {
          localVideoRef.current.srcObject = new MediaStream([videoTrack]);
        }
      }

    } catch (err) {
      console.error("Error initializing Daily:", err);
      toast.error("Erro ao conectar ao vídeo");
      setJoiningDaily(false);
    }
  }, [user]);

  // Update remote video elements when participants change
  useEffect(() => {
    Object.entries(participants).forEach(([sessionId, participant]) => {
      if (!participant.local) {
        const videoEl = participantRefs.current[sessionId];
        if (videoEl && participant.tracks?.video?.track) {
          videoEl.srcObject = new MediaStream([participant.tracks.video.track]);
        }
      }
    });
  }, [participants]);

  useEffect(() => {
    if (code && user) {
      initializeMeeting();
    }
    
    return () => {
      cleanup();
    };
  }, [code, user]);

  const cleanup = async () => {
    if (callObject) {
      await callObject.leave();
      callObject.destroy();
    }
    
    if (meeting && user) {
      await supabase
        .from("meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id);
    }
  };

  const initializeMeeting = async () => {
    if (!code || !user) return;

    try {
      setLoading(true);
      
      // Fetch meeting details
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_code", code)
        .single();

      if (meetingError || !meetingData) {
        setError("Reunião não encontrada");
        return;
      }

      setMeeting(meetingData);

      // Create/Get Daily room
      const room = await createOrGetDailyRoom(code);
      setDailyRoom(room);

      // Join meeting in database
      await supabase
        .from("meeting_participants")
        .upsert({
          meeting_id: meetingData.id,
          user_id: user.id,
          is_host: meetingData.host_user_id === user.id,
          is_muted: false,
          is_video_on: true,
        }, {
          onConflict: "meeting_id,user_id"
        });

      // Fetch chat messages
      await fetchMessages(meetingData.id);

      // Subscribe to chat messages
      subscribeToMessages(meetingData.id);

      setLoading(false);

      // Initialize Daily.co
      await initializeDaily(room.url);

    } catch (err) {
      console.error("Error initializing meeting:", err);
      setError("Erro ao entrar na reunião");
      setLoading(false);
    }
  };

  const fetchMessages = async (meetingId: string) => {
    const { data, error } = await supabase
      .from("meeting_messages")
      .select(`
        *,
        profile:profiles!meeting_messages_user_id_fkey(full_name, avatar_url)
      `)
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const subscribeToMessages = (meetingId: string) => {
    supabase
      .channel(`meeting-messages-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "meeting_messages",
          filter: `meeting_id=eq.${meetingId}`
        },
        () => {
          fetchMessages(meetingId);
        }
      )
      .subscribe();
  };

  const toggleMute = useCallback(async () => {
    if (!callObject) return;
    
    const newMuted = !isMuted;
    await callObject.setLocalAudio(!newMuted);
    setIsMuted(newMuted);

    if (meeting && user) {
      await supabase
        .from("meeting_participants")
        .update({ is_muted: newMuted })
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id);
    }
  }, [isMuted, callObject, meeting, user]);

  const toggleVideo = useCallback(async () => {
    if (!callObject) return;
    
    const newVideoOn = !isVideoOn;
    await callObject.setLocalVideo(newVideoOn);
    setIsVideoOn(newVideoOn);

    if (meeting && user) {
      await supabase
        .from("meeting_participants")
        .update({ is_video_on: newVideoOn })
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id);
    }
  }, [isVideoOn, callObject, meeting, user]);

  const toggleScreenShare = async () => {
    if (!callObject || !meeting?.allow_screen_share) return;

    try {
      if (isScreenSharing) {
        await callObject.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await callObject.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error("Error toggling screen share:", err);
      toast.error("Erro ao compartilhar tela");
    }
  };

  const sendMessage = async () => {
    if (!meeting || !user || !newMessage.trim() || !meeting.allow_chat) return;

    const { error } = await supabase
      .from("meeting_messages")
      .insert({
        meeting_id: meeting.id,
        user_id: user.id,
        message: newMessage.trim()
      });

    if (!error) {
      setNewMessage("");
    }
  };

  const leaveMeeting = async () => {
    await cleanup();
    navigate("/reunioes");
  };

  const endMeeting = async () => {
    if (!meeting || !isHost) return;

    await supabase
      .from("meetings")
      .update({ 
        is_active: false, 
        ended_at: new Date().toISOString() 
      })
      .eq("id", meeting.id);

    // Delete Daily room
    await supabase.functions.invoke("daily-room", {
      body: { action: "delete", meetingCode: code }
    });

    toast.success("Reunião encerrada");
    await leaveMeeting();
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/reuniao/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const participantCount = Object.keys(participants).length;
  const remoteParticipants = Object.entries(participants).filter(([_, p]) => !p.local);

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Carregando reunião...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <h2 className="text-2xl font-bold mb-2">{error}</h2>
          <p className="text-gray-400 mb-4">Verifique o código e tente novamente</p>
          <Button onClick={() => navigate("/reunioes")} variant="secondary">
            Voltar para reuniões
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="h-14 bg-gray-800 flex items-center justify-between px-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-gray-700"
            onClick={() => navigate("/reunioes")}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-white font-medium">{meeting?.title}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{code}</span>
              <button onClick={copyMeetingLink} className="hover:text-white">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          {joiningDaily && (
            <span className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Conectando vídeo...
            </span>
          )}
          <span>{format(new Date(), "HH:mm", { locale: ptBR })}</span>
          {isHost && (
            <span className="px-2 py-0.5 bg-primary text-primary-foreground rounded text-xs">
              Anfitrião
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video grid */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className={cn(
            "grid gap-4 w-full max-w-6xl",
            participantCount <= 1 && "grid-cols-1",
            participantCount === 2 && "grid-cols-2",
            participantCount <= 4 && participantCount > 2 && "grid-cols-2",
            participantCount > 4 && "grid-cols-3"
          )}>
            {/* Local video (self) */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "w-full h-full object-cover mirror",
                  !isVideoOn && "hidden"
                )}
                style={{ transform: "scaleX(-1)" }}
              />
              {!isVideoOn && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Avatar className="w-24 h-24">
                    <AvatarImage src={user?.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-3xl bg-primary">
                      {user?.profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className="absolute bottom-3 left-3 flex items-center gap-2">
                <span className="px-2 py-1 bg-black/60 rounded text-white text-sm">
                  {user?.profile?.full_name} (Você)
                </span>
                {isMuted && <MicOff className="w-4 h-4 text-red-500" />}
              </div>
            </div>

            {/* Remote participants */}
            {remoteParticipants.map(([sessionId, participant]) => (
              <div
                key={sessionId}
                className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video"
              >
                <video
                  ref={el => { participantRefs.current[sessionId] = el; }}
                  autoPlay
                  playsInline
                  className={cn(
                    "w-full h-full object-cover",
                    !participant.video && "hidden"
                  )}
                />
                {!participant.video && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="w-20 h-20">
                      <AvatarFallback className="text-2xl bg-primary">
                        {participant.user_name?.charAt(0) || "P"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-black/60 rounded text-white text-sm">
                    {participant.user_name || "Participante"}
                  </span>
                  {!participant.audio && <MicOff className="w-4 h-4 text-red-500" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat sidebar */}
        <Sheet open={showChat} onOpenChange={setShowChat}>
          <SheetContent side="right" className="w-80 sm:w-96 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Chat da reunião</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-[calc(100%-60px)]">
              <ScrollArea className="flex-1 p-4">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn(
                        "flex gap-2",
                        msg.user_id === user?.id && "flex-row-reverse"
                      )}>
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={msg.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {msg.profile?.full_name?.charAt(0) || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "max-w-[70%]",
                          msg.user_id === user?.id && "text-right"
                        )}>
                          <p className="text-xs text-muted-foreground mb-1">
                            {msg.profile?.full_name}
                          </p>
                          <div className={cn(
                            "px-3 py-2 rounded-lg",
                            msg.user_id === user?.id
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}>
                            <p className="text-sm">{msg.message}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite uma mensagem..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    disabled={!meeting?.allow_chat}
                  />
                  <Button size="icon" onClick={sendMessage} disabled={!meeting?.allow_chat}>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Participants sidebar */}
        <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
          <SheetContent side="right" className="w-80 sm:w-96">
            <SheetHeader>
              <SheetTitle>Participantes ({participantCount})</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-60px)] mt-4">
              <div className="space-y-2">
                {Object.entries(participants).map(([sessionId, participant]) => (
                  <div
                    key={sessionId}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {participant.user_name?.charAt(0) || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {participant.user_name || "Participante"}
                          {participant.local && " (Você)"}
                        </p>
                        {participant.owner && (
                          <span className="text-xs text-primary">Anfitrião</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!participant.audio && (
                        <MicOff className="w-4 h-4 text-red-500" />
                      )}
                      {!participant.video && (
                        <VideoOff className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>

      {/* Controls bar */}
      <div className="h-20 bg-gray-800 flex items-center justify-center gap-2 border-t border-gray-700">
        <TooltipProvider>
          {/* Mic toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full w-12 h-12"
                onClick={toggleMute}
                disabled={!callObject}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMuted ? "Ativar microfone" : "Desativar microfone"}</TooltipContent>
          </Tooltip>

          {/* Video toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoOn ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full w-12 h-12"
                onClick={toggleVideo}
                disabled={!callObject}
              >
                {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isVideoOn ? "Desativar câmera" : "Ativar câmera"}</TooltipContent>
          </Tooltip>

          {/* Screen share */}
          {meeting?.allow_screen_share && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="lg"
                  className="rounded-full w-12 h-12"
                  onClick={toggleScreenShare}
                  disabled={!callObject}
                >
                  {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-8 bg-gray-600 mx-2" />

          {/* Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-12 h-12"
                onClick={() => setShowChat(true)}
              >
                <MessageSquare className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Chat</TooltipContent>
          </Tooltip>

          {/* Participants */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-12 h-12 relative"
                onClick={() => setShowParticipants(true)}
              >
                <Users className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {participantCount}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Participantes</TooltipContent>
          </Tooltip>

          {/* More options */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full w-12 h-12"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Mais opções</TooltipContent>
            </Tooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={copyMeetingLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar link da reunião
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleFullscreen}>
                {isFullscreen ? (
                  <>
                    <Minimize className="w-4 h-4 mr-2" />
                    Sair da tela cheia
                  </>
                ) : (
                  <>
                    <Maximize className="w-4 h-4 mr-2" />
                    Tela cheia
                  </>
                )}
              </DropdownMenuItem>
              {isHost && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    Configurações da reunião
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-8 bg-gray-600 mx-2" />

          {/* Leave call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full px-6"
                onClick={leaveMeeting}
              >
                <Phone className="w-5 h-5 rotate-[135deg]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sair da reunião</TooltipContent>
          </Tooltip>

          {isHost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-4 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={endMeeting}
                >
                  Encerrar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Encerrar reunião para todos</TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
