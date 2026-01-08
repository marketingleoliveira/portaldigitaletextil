import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant, DailyEventObjectParticipantLeft } from "@daily-co/daily-js";
import {
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, 
  ScreenShare, ScreenShareOff, Send, Loader2, Hand, Smile
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Meeting {
  id: string;
  title: string;
  meeting_code: string;
  host_user_id: string;
  is_active: boolean;
  allow_participants_video: boolean;
  allow_participants_audio: boolean;
  allow_screen_share: boolean;
  allow_chat: boolean;
}

interface ChatMessage {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  message: string;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface ParticipantWithExtras extends DailyParticipant {
  isSpeaking?: boolean;
  handRaised?: boolean;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  userName: string;
}

interface GuestInfo {
  guestId: string;
  guestName: string;
  meetingId: string;
}

const EMOTES = ["👍", "👎", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "🤔", "💯", "✅"];
const REACTIONS = ["👍", "❤️", "😂", "👏", "🎉", "🔥", "😮", "💯"];

export default function GuestMeetingRoom() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningDaily, setJoiningDaily] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Daily.co state
  const [dailyRoom, setDailyRoom] = useState<{ url: string; name: string } | null>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const [participants, setParticipants] = useState<Record<string, ParticipantWithExtras>>({});
  const callObjectRef = useRef<DailyCall | null>(null);
  const isInitializingRef = useRef(false);
  
  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  // Hand raise state
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  
  // Speaking detection
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  
  // Chat notification state
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Host controls state
  const [globalAudioEnabled, setGlobalAudioEnabled] = useState(true);
  const [globalVideoEnabled, setGlobalVideoEnabled] = useState(true);
  const [globalScreenShareEnabled, setGlobalScreenShareEnabled] = useState(true);
  
  // Floating reactions
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const reactionIdCounter = useRef(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const participantRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Load guest info from sessionStorage
  useEffect(() => {
    if (!code) return;
    
    const storedGuest = sessionStorage.getItem(`guest_${code}`);
    if (!storedGuest) {
      navigate(`/entrar/${code}`);
      return;
    }

    try {
      const parsed = JSON.parse(storedGuest) as GuestInfo;
      setGuestInfo(parsed);
    } catch {
      navigate(`/entrar/${code}`);
    }
  }, [code, navigate]);

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
    if (!guestInfo) return;
    
    if (isInitializingRef.current || callObjectRef.current) {
      return;
    }
    
    isInitializingRef.current = true;
    setJoiningDaily(true);
    
    try {
      const existingCalls = DailyIframe.getCallInstance();
      if (existingCalls) {
        await existingCalls.destroy();
      }

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });
      
      callObjectRef.current = call;

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
            [event.participant.session_id]: {
              ...event.participant,
              handRaised: prev[event.participant.session_id]?.handRaised,
              isSpeaking: prev[event.participant.session_id]?.isSpeaking
            }
          }));
          
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
          setRaisedHands(prev => {
            const updated = new Set(prev);
            updated.delete(event.participant.session_id);
            return updated;
          });
        }
      });

      call.on("active-speaker-change", (event) => {
        if (event?.activeSpeaker?.peerId) {
          setSpeakingParticipants(new Set([event.activeSpeaker.peerId]));
        } else {
          setSpeakingParticipants(new Set());
        }
      });

      call.on("error", (error) => {
        console.error("Daily error:", error);
        toast.error("Erro na conexão de vídeo");
        setJoiningDaily(false);
        isInitializingRef.current = false;
      });

      call.on("left-meeting", () => {
        setParticipants({});
        callObjectRef.current = null;
        isInitializingRef.current = false;
      });

      await call.join({
        url: roomUrl,
        userName: `${guestInfo.guestName} (Convidado)`,
      });

      setCallObject(call);
      
      const initialParticipants = call.participants();
      setParticipants(initialParticipants);

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
      isInitializingRef.current = false;
      callObjectRef.current = null;
    }
  }, [guestInfo]);

  // Update remote video and audio elements
  useEffect(() => {
    Object.entries(participants).forEach(([sessionId, participant]) => {
      if (!participant.local) {
        // Handle video
        const videoEl = participantRefs.current[sessionId];
        if (videoEl) {
          const screenTrack = participant.tracks?.screenVideo?.track;
          const videoTrack = participant.tracks?.video?.track;
          const trackToUse = screenTrack || videoTrack;
          
          if (trackToUse) {
            videoEl.srcObject = new MediaStream([trackToUse]);
          }
        }
        
        // Handle audio - create audio element if needed
        const audioTrack = participant.tracks?.audio?.track;
        if (audioTrack) {
          let audioEl = audioRefs.current[sessionId];
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.id = `audio-${sessionId}`;
            document.body.appendChild(audioEl);
            audioRefs.current[sessionId] = audioEl;
          }
          audioEl.srcObject = new MediaStream([audioTrack]);
        }
      }
    });
    
    // Clean up audio elements for participants who left
    Object.keys(audioRefs.current).forEach(sessionId => {
      if (!participants[sessionId]) {
        const audioEl = audioRefs.current[sessionId];
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          delete audioRefs.current[sessionId];
        }
      }
    });
  }, [participants]);

  // Initialize meeting
  useEffect(() => {
    if (code && guestInfo) {
      initializeMeeting();
    }
    
    return () => {
      cleanup();
    };
  }, [code, guestInfo]);

  // Subscribe to hand raises
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-hands-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'hand_raised' },
        (payload) => {
          const { session_id, raised } = payload.payload;
          setRaisedHands(prev => {
            const updated = new Set(prev);
            if (raised) {
              updated.add(session_id);
            } else {
              updated.delete(session_id);
            }
            return updated;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id]);

  // Subscribe to host controls
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-controls-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'host_control' },
        (payload) => {
          const { action, enabled } = payload.payload;
          
          if (action === 'toggle_all_audio') {
            if (!enabled && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O anfitrião desativou todos os microfones");
            }
            setGlobalAudioEnabled(enabled);
          } else if (action === 'toggle_all_video') {
            if (!enabled && callObject) {
              callObject.setLocalVideo(false);
              setIsVideoOn(false);
              toast.info("O anfitrião desativou todas as câmeras");
            }
            setGlobalVideoEnabled(enabled);
          } else if (action === 'toggle_screen_share') {
            if (!enabled && isScreenSharing && callObject) {
              callObject.stopScreenShare();
              setIsScreenSharing(false);
            }
            setGlobalScreenShareEnabled(enabled);
            if (!enabled) {
              toast.info("O anfitrião desativou o compartilhamento de tela");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, callObject, isScreenSharing]);

  // Subscribe to floating reactions
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-reactions-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'reaction' },
        (payload) => {
          const { emoji, userName } = payload.payload;
          const newReaction: FloatingReaction = {
            id: `${Date.now()}-${reactionIdCounter.current++}`,
            emoji,
            x: Math.random() * 60 + 20,
            userName
          };
          setFloatingReactions(prev => [...prev, newReaction]);
          
          setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id]);

  const cleanup = async () => {
    // Clean up audio elements
    Object.keys(audioRefs.current).forEach(sessionId => {
      const audioEl = audioRefs.current[sessionId];
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
      }
    });
    audioRefs.current = {};
    
    if (callObjectRef.current) {
      try {
        await callObjectRef.current.leave();
        await callObjectRef.current.destroy();
      } catch (err) {
        console.error("Error during cleanup:", err);
      }
      callObjectRef.current = null;
      isInitializingRef.current = false;
    }
    setCallObject(null);
    setParticipants({});
    
    if (meeting && guestInfo) {
      await supabase
        .from("meeting_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("meeting_id", meeting.id)
        .eq("guest_id", guestInfo.guestId);
    }
  };

  const initializeMeeting = async () => {
    if (!code || !guestInfo) return;

    try {
      setLoading(true);
      
      const { data: meetingData, error: meetingError } = await supabase
        .from("meetings")
        .select("*")
        .eq("meeting_code", code)
        .single();

      if (meetingError || !meetingData) {
        setError("Reunião não encontrada");
        return;
      }

      if (!meetingData.is_active) {
        setError("Esta reunião já foi encerrada");
        return;
      }

      setMeeting(meetingData);
      setGlobalAudioEnabled(meetingData.allow_participants_audio);
      setGlobalVideoEnabled(meetingData.allow_participants_video);
      setGlobalScreenShareEnabled(meetingData.allow_screen_share);
      
      // Create/Get Daily room
      const room = await createOrGetDailyRoom(code);
      setDailyRoom(room);

      // Join meeting in database as guest
      await supabase
        .from("meeting_participants")
        .insert({
          meeting_id: meetingData.id,
          guest_id: guestInfo.guestId,
          guest_name: guestInfo.guestName,
          is_host: false,
          is_muted: false,
          is_video_on: true,
        });

      // Fetch and subscribe to messages
      await fetchMessages(meetingData.id);
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
        profile:profiles(full_name, avatar_url)
      `)
      .eq("meeting_id", meetingId)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setMessages(data as ChatMessage[]);
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
    
    if (!globalAudioEnabled && isMuted) {
      toast.error("O anfitrião desativou os microfones");
      return;
    }
    
    const newMuted = !isMuted;
    await callObject.setLocalAudio(!newMuted);
    setIsMuted(newMuted);

    if (meeting && guestInfo) {
      await supabase
        .from("meeting_participants")
        .update({ is_muted: newMuted })
        .eq("meeting_id", meeting.id)
        .eq("guest_id", guestInfo.guestId);
    }
  }, [isMuted, callObject, meeting, guestInfo, globalAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (!callObject) return;
    
    if (!globalVideoEnabled && !isVideoOn) {
      toast.error("O anfitrião desativou as câmeras");
      return;
    }
    
    const newVideoOn = !isVideoOn;
    await callObject.setLocalVideo(newVideoOn);
    setIsVideoOn(newVideoOn);

    if (meeting && guestInfo) {
      await supabase
        .from("meeting_participants")
        .update({ is_video_on: newVideoOn })
        .eq("meeting_id", meeting.id)
        .eq("guest_id", guestInfo.guestId);
    }
  }, [isVideoOn, callObject, meeting, guestInfo, globalVideoEnabled]);

  const toggleScreenShare = async () => {
    if (!callObject) return;
    
    if (!globalScreenShareEnabled) {
      toast.error("O anfitrião desativou o compartilhamento de tela");
      return;
    }

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

  const toggleHandRaise = async () => {
    if (!meeting || !callObject) return;
    
    const localParticipant = callObject.participants().local;
    if (!localParticipant) return;
    
    const newHandRaised = !handRaised;
    setHandRaised(newHandRaised);
    
    await supabase.channel(`meeting-hands-${meeting.id}`).send({
      type: 'broadcast',
      event: 'hand_raised',
      payload: {
        session_id: localParticipant.session_id,
        raised: newHandRaised,
        user_name: `${guestInfo?.guestName} (Convidado)`
      }
    });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !meeting || !guestInfo) return;

    try {
      await supabase.from("meeting_messages").insert({
        meeting_id: meeting.id,
        guest_id: guestInfo.guestId,
        guest_name: guestInfo.guestName,
        message: newMessage.trim()
      });
      setNewMessage("");
    } catch (err) {
      console.error("Error sending message:", err);
      toast.error("Erro ao enviar mensagem");
    }
  };

  const sendEmote = async (emote: string) => {
    if (!meeting || !guestInfo) return;
    
    await supabase.from("meeting_messages").insert({
      meeting_id: meeting.id,
      guest_id: guestInfo.guestId,
      guest_name: guestInfo.guestName,
      message: emote
    });
  };

  const sendReaction = async (emoji: string) => {
    if (!meeting || !guestInfo) return;
    
    await supabase.channel(`meeting-reactions-${meeting.id}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        emoji,
        userName: `${guestInfo.guestName} (Convidado)`,
        senderId: guestInfo.guestId
      }
    });
  };

  const leaveMeeting = async () => {
    await cleanup();
    sessionStorage.removeItem(`guest_${code}`);
    navigate("/");
  };

  if (loading || !guestInfo) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando reunião...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Voltar ao início
          </Button>
        </div>
      </div>
    );
  }

  const remoteParticipants = Object.entries(participants).filter(([_, p]) => !p.local);
  const participantCount = Object.keys(participants).length;

  return (
    <TooltipProvider>
      <div className="h-screen bg-[#202124] flex flex-col overflow-hidden">
        {/* Floating Reactions Layer */}
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {floatingReactions.map((reaction) => (
            <div
              key={reaction.id}
              className="absolute bottom-20 animate-float-up"
              style={{ left: `${reaction.x}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl">{reaction.emoji}</span>
                <span className="text-xs text-white/70 mt-1 bg-black/40 px-2 py-0.5 rounded-full">
                  {reaction.userName}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="h-14 bg-[#202124] border-b border-[#3c4043] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <h1 className="text-white font-medium">{meeting?.title}</h1>
            <span className="text-xs text-gray-400 bg-[#3c4043] px-2 py-1 rounded">
              Convidado
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">
              {format(new Date(), "HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video grid */}
          <div className="flex-1 p-4 overflow-auto">
            <div className={cn(
              "grid gap-2 h-full",
              participantCount <= 1 && "grid-cols-1",
              participantCount === 2 && "grid-cols-2",
              participantCount <= 4 && participantCount > 2 && "grid-cols-2 grid-rows-2",
              participantCount <= 6 && participantCount > 4 && "grid-cols-3 grid-rows-2",
              participantCount <= 9 && participantCount > 6 && "grid-cols-3 grid-rows-3",
              participantCount > 9 && "grid-cols-4 auto-rows-fr"
            )}>
              {/* Local video */}
              <div className={cn(
                "relative bg-[#3c4043] rounded-lg overflow-hidden",
                speakingParticipants.has(participants.local?.session_id || '') && "ring-2 ring-green-500"
              )}>
                <video
                  ref={localVideoRef}
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
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-2xl bg-primary">
                        {guestInfo.guestName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 flex items-center gap-2">
                  <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                    Você (Convidado)
                  </span>
                  {isMuted && <MicOff className="h-4 w-4 text-red-500" />}
                  {handRaised && <span className="text-lg">✋</span>}
                </div>
              </div>

              {/* Remote participants */}
              {remoteParticipants.map(([sessionId, participant]) => (
                <div
                  key={sessionId}
                  className={cn(
                    "relative bg-[#3c4043] rounded-lg overflow-hidden",
                    speakingParticipants.has(sessionId) && "ring-2 ring-green-500",
                    raisedHands.has(sessionId) && "ring-2 ring-yellow-500"
                  )}
                >
                  <video
                    ref={(el) => { participantRefs.current[sessionId] = el; }}
                    autoPlay
                    playsInline
                    className={cn(
                      "w-full h-full object-cover",
                      !participant.video && "hidden"
                    )}
                  />
                  {!participant.video && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar className="h-20 w-20">
                        <AvatarFallback className="text-2xl bg-blue-600">
                          {(participant.user_name || "P").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-2">
                    <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                      {participant.user_name || "Participante"}
                    </span>
                    {!participant.audio && <MicOff className="h-4 w-4 text-red-500" />}
                    {raisedHands.has(sessionId) && <span className="text-lg">✋</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat sidebar */}
          <Sheet open={showChat} onOpenChange={setShowChat}>
            <SheetContent side="right" className="w-80 p-0 bg-[#202124] border-[#3c4043]">
              <SheetHeader className="p-4 border-b border-[#3c4043]">
                <SheetTitle className="text-white">Chat da reunião</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col h-[calc(100%-60px)]">
                <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className="flex gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(msg.guest_name || msg.profile?.full_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-sm font-medium text-white">
                              {msg.guest_name ? `${msg.guest_name} (Convidado)` : msg.profile?.full_name || "Usuário"}
                            </span>
                            <span className="text-xs text-gray-500">
                              {format(new Date(msg.created_at), "HH:mm")}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 break-words">{msg.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="p-4 border-t border-[#3c4043]">
                  <div className="flex gap-2 mb-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-white">
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-2 bg-[#3c4043] border-[#5f6368]">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {EMOTES.map((emote) => (
                            <button
                              key={emote}
                              onClick={() => sendEmote(emote)}
                              className="text-xl hover:bg-[#5f6368] p-1 rounded"
                            >
                              {emote}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                      placeholder="Envie uma mensagem"
                      className="bg-[#3c4043] border-[#5f6368] text-white placeholder:text-gray-500"
                    />
                    <Button onClick={sendMessage} size="icon" disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Participants sidebar */}
          <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
            <SheetContent side="right" className="w-80 p-0 bg-[#202124] border-[#3c4043]">
              <SheetHeader className="p-4 border-b border-[#3c4043]">
                <SheetTitle className="text-white">
                  Participantes ({participantCount})
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(100%-60px)] p-4">
                <div className="space-y-2">
                  {Object.entries(participants).map(([sessionId, participant]) => (
                    <div key={sessionId} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#3c4043]">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {(participant.user_name || "P").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white">
                            {participant.local ? "Você" : participant.user_name || "Participante"}
                          </span>
                          {raisedHands.has(sessionId) && <span className="text-sm">✋</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {!participant.audio && <MicOff className="h-4 w-4 text-gray-500" />}
                        {!participant.video && <VideoOff className="h-4 w-4 text-gray-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        </div>

        {/* Control bar */}
        <div className="h-20 bg-[#202124] border-t border-[#3c4043] flex items-center justify-center gap-3 px-4">
          {/* Left section - Info */}
          <div className="flex-1" />

          {/* Center section - Main controls */}
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    isMuted ? "bg-red-600 hover:bg-red-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleMute}
                  disabled={joiningDaily}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isMuted ? "Ativar microfone" : "Desativar microfone"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={!isVideoOn ? "destructive" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    !isVideoOn ? "bg-red-600 hover:bg-red-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleVideo}
                  disabled={joiningDaily}
                >
                  {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isVideoOn ? "Desativar câmera" : "Ativar câmera"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    isScreenSharing ? "bg-green-600 hover:bg-green-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleScreenShare}
                  disabled={joiningDaily || !globalScreenShareEnabled}
                >
                  {isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {!globalScreenShareEnabled ? "Compartilhamento desativado pelo anfitrião" : 
                  isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={handRaised ? "default" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-12 w-12",
                    handRaised ? "bg-yellow-600 hover:bg-yellow-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleHandRaise}
                  disabled={joiningDaily}
                >
                  <Hand className={cn("h-5 w-5", handRaised && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{handRaised ? "Abaixar mão" : "Levantar mão"}</TooltipContent>
            </Tooltip>

            {/* Reactions popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-12 w-12 bg-[#3c4043] hover:bg-[#5f6368]"
                  disabled={joiningDaily}
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 bg-[#3c4043] border-[#5f6368]">
                <div className="flex gap-1">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="text-2xl hover:bg-[#5f6368] p-2 rounded transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full h-12 w-12"
                  onClick={leaveMeeting}
                >
                  <Phone className="h-5 w-5 rotate-135" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sair da reunião</TooltipContent>
            </Tooltip>
          </div>

          {/* Right section - Chat and participants */}
          <div className="flex-1 flex justify-end gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 relative",
                    showChat ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "text-white hover:bg-[#3c4043]"
                  )}
                  onClick={() => {
                    setShowChat(!showChat);
                    if (!showChat) setUnreadMessages(0);
                  }}
                >
                  <MessageSquare className="h-5 w-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Chat</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10",
                    showParticipants ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "text-white hover:bg-[#3c4043]"
                  )}
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <Users className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Participantes ({participantCount})</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Joining overlay */}
        {joiningDaily && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-white">Conectando ao vídeo...</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
