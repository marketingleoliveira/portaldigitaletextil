import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, 
  ScreenShare, ScreenShareOff, Hand, MoreVertical, Settings,
  Copy, Shield, UserX, Volume2, VolumeX, Maximize, Minimize,
  Send, ChevronLeft
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

interface Participant {
  id: string;
  user_id: string;
  is_host: boolean;
  is_co_host: boolean;
  is_muted: boolean;
  is_video_on: boolean;
  is_screen_sharing: boolean;
  is_hand_raised: boolean;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  };
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

export default function MeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const isHost = meeting?.host_user_id === user?.id;

  useEffect(() => {
    if (code && user) {
      initializeMeeting();
    }
    
    return () => {
      leaveMeeting();
    };
  }, [code, user]);

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

      // Join meeting
      const { error: joinError } = await supabase
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

      if (joinError) throw joinError;

      // Start media
      await startMedia();

      // Fetch participants
      await fetchParticipants(meetingData.id);

      // Fetch chat messages
      await fetchMessages(meetingData.id);

      // Subscribe to realtime updates
      subscribeToUpdates(meetingData.id);

    } catch (err) {
      console.error("Error initializing meeting:", err);
      setError("Erro ao entrar na reunião");
    } finally {
      setLoading(false);
    }
  };

  const startMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      mediaStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      toast.error("Não foi possível acessar câmera/microfone");
    }
  };

  const fetchParticipants = async (meetingId: string) => {
    const { data, error } = await supabase
      .from("meeting_participants")
      .select(`
        *,
        profile:profiles!meeting_participants_user_id_fkey(full_name, avatar_url)
      `)
      .eq("meeting_id", meetingId)
      .is("left_at", null);

    if (!error && data) {
      setParticipants(data);
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

  const subscribeToUpdates = (meetingId: string) => {
    // Subscribe to participants changes
    supabase
      .channel(`meeting-${meetingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "meeting_participants",
          filter: `meeting_id=eq.${meetingId}`
        },
        () => {
          fetchParticipants(meetingId);
        }
      )
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
    if (!meeting || !user) return;
    
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }

    await supabase
      .from("meeting_participants")
      .update({ is_muted: newMuted })
      .eq("meeting_id", meeting.id)
      .eq("user_id", user.id);
  }, [isMuted, meeting, user]);

  const toggleVideo = useCallback(async () => {
    if (!meeting || !user) return;
    
    const newVideoOn = !isVideoOn;
    setIsVideoOn(newVideoOn);
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = newVideoOn;
      });
    }

    await supabase
      .from("meeting_participants")
      .update({ is_video_on: newVideoOn })
      .eq("meeting_id", meeting.id)
      .eq("user_id", user.id);
  }, [isVideoOn, meeting, user]);

  const toggleScreenShare = async () => {
    if (!meeting || !user || !meeting.allow_screen_share) return;

    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        screenStreamRef.current = stream;
        
        if (screenRef.current) {
          screenRef.current.srcObject = stream;
        }
        
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
        };
        
        setIsScreenSharing(true);
      } catch (err) {
        console.error("Error sharing screen:", err);
      }
    }

    await supabase
      .from("meeting_participants")
      .update({ is_screen_sharing: !isScreenSharing })
      .eq("meeting_id", meeting.id)
      .eq("user_id", user.id);
  };

  const toggleHandRaise = async () => {
    if (!meeting || !user) return;
    
    const newHandRaised = !isHandRaised;
    setIsHandRaised(newHandRaised);

    await supabase
      .from("meeting_participants")
      .update({ is_hand_raised: newHandRaised })
      .eq("meeting_id", meeting.id)
      .eq("user_id", user.id);

    if (newHandRaised) {
      toast.info("Mão levantada!");
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
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if (meeting && user) {
      await supabase
        .from("meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meeting.id)
        .eq("user_id", user.id);
    }
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

    toast.success("Reunião encerrada");
    navigate("/reunioes");
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

  const muteParticipant = async (participantId: string) => {
    if (!isHost) return;
    
    await supabase
      .from("meeting_participants")
      .update({ is_muted: true })
      .eq("id", participantId);
    
    toast.success("Participante mutado");
  };

  const removeParticipant = async (participantId: string, participantUserId: string) => {
    if (!isHost || participantUserId === user?.id) return;
    
    await supabase
      .from("meeting_participants")
      .update({ left_at: new Date().toISOString() })
      .eq("id", participantId);
    
    toast.success("Participante removido");
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Entrando na reunião...</p>
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
            participants.length <= 1 && "grid-cols-1",
            participants.length === 2 && "grid-cols-2",
            participants.length <= 4 && participants.length > 2 && "grid-cols-2",
            participants.length > 4 && "grid-cols-3"
          )}>
            {/* Local video (self) */}
            <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={cn(
                  "w-full h-full object-cover",
                  !isVideoOn && "hidden"
                )}
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
                {isHandRaised && <Hand className="w-4 h-4 text-yellow-500" />}
              </div>
            </div>

            {/* Screen share */}
            {isScreenSharing && (
              <div className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video col-span-full">
                <video
                  ref={screenRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-1 bg-black/60 rounded text-white text-sm">
                    Compartilhando tela
                  </span>
                </div>
              </div>
            )}

            {/* Other participants (placeholders for now) */}
            {participants.filter(p => p.user_id !== user?.id).map((participant) => (
              <div
                key={participant.id}
                className="relative bg-gray-800 rounded-xl overflow-hidden aspect-video"
              >
                {!participant.is_video_on ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="w-20 h-20">
                      <AvatarImage src={participant.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl bg-primary">
                        {participant.profile?.full_name?.charAt(0) || "P"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    <Video className="w-12 h-12 opacity-30" />
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-center gap-2">
                  <span className="px-2 py-1 bg-black/60 rounded text-white text-sm">
                    {participant.profile?.full_name}
                    {participant.is_host && " (Anfitrião)"}
                  </span>
                  {participant.is_muted && <MicOff className="w-4 h-4 text-red-500" />}
                  {participant.is_hand_raised && <Hand className="w-4 h-4 text-yellow-500" />}
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
              <SheetTitle>Participantes ({participants.length})</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-60px)] mt-4">
              <div className="space-y-2">
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={participant.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {participant.profile?.full_name?.charAt(0) || "P"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {participant.profile?.full_name}
                          {participant.user_id === user?.id && " (Você)"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {participant.is_host && (
                            <span className="text-primary">Anfitrião</span>
                          )}
                          {participant.is_co_host && (
                            <span className="text-blue-500">Co-anfitrião</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {participant.is_muted && (
                        <MicOff className="w-4 h-4 text-red-500" />
                      )}
                      {participant.is_hand_raised && (
                        <Hand className="w-4 h-4 text-yellow-500" />
                      )}
                      {isHost && participant.user_id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => muteParticipant(participant.id)}>
                              <VolumeX className="w-4 h-4 mr-2" />
                              Mutar participante
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => removeParticipant(participant.id, participant.user_id)}
                              className="text-destructive"
                            >
                              <UserX className="w-4 h-4 mr-2" />
                              Remover da reunião
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                >
                  {isScreenSharing ? <ScreenShareOff className="w-5 h-5" /> : <ScreenShare className="w-5 h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}</TooltipContent>
            </Tooltip>
          )}

          {/* Hand raise */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isHandRaised ? "default" : "secondary"}
                size="lg"
                className="rounded-full w-12 h-12"
                onClick={toggleHandRaise}
              >
                <Hand className={cn("w-5 h-5", isHandRaised && "text-yellow-500")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isHandRaised ? "Baixar mão" : "Levantar mão"}</TooltipContent>
          </Tooltip>

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
                  {participants.length}
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

          {/* Leave/End call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                className="rounded-full px-6"
                onClick={() => {
                  leaveMeeting();
                  navigate("/reunioes");
                }}
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
