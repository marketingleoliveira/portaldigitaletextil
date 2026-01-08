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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant, DailyEventObjectParticipantLeft, DailyParticipantsObject } from "@daily-co/daily-js";
import {
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, 
  ScreenShare, ScreenShareOff, MoreVertical, Settings,
  Copy, Maximize, Minimize, Send, ChevronLeft, Loader2,
  Circle, Square, Lock, Hand, Smile, Volume2, Shield,
  VideoIcon, MicIcon, Ban, Sparkles, UserX
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
  password: string | null;
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

// Popular emotes for chat
const EMOTES = ["👍", "👎", "❤️", "😂", "😮", "😢", "🎉", "🔥", "👏", "🤔", "💯", "✅"];

// Reactions for floating animation
const REACTIONS = ["👍", "❤️", "😂", "👏", "🎉", "🔥", "😮", "💯"];

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
  const [participants, setParticipants] = useState<Record<string, ParticipantWithExtras>>({});
  const callObjectRef = useRef<DailyCall | null>(null);
  const isInitializingRef = useRef(false);
  
  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  
  // Password state
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  
  // Hand raise state
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  
  // Speaking detection
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  
  // Chat notification state
  const [unreadMessages, setUnreadMessages] = useState(0);
  const lastReadMessageRef = useRef<string | null>(null);
  
  // Host controls state
  const [globalAudioEnabled, setGlobalAudioEnabled] = useState(true);
  const [globalVideoEnabled, setGlobalVideoEnabled] = useState(true);
  const [globalScreenShareEnabled, setGlobalScreenShareEnabled] = useState(true);
  
  // Floating reactions state
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const reactionIdCounter = useRef(0);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const participantRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const controlsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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
    
    // Prevent duplicate initialization
    if (isInitializingRef.current || callObjectRef.current) {
      console.log("Daily already initializing or initialized, skipping...");
      return;
    }
    
    isInitializingRef.current = true;
    setJoiningDaily(true);
    
    try {
      // Destroy any existing global Daily instances
      const existingCalls = DailyIframe.getCallInstance();
      if (existingCalls) {
        console.log("Destroying existing Daily instance...");
        await existingCalls.destroy();
      }

      const call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: true,
      });
      
      callObjectRef.current = call;

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
            [event.participant.session_id]: {
              ...event.participant,
              handRaised: prev[event.participant.session_id]?.handRaised,
              isSpeaking: prev[event.participant.session_id]?.isSpeaking
            }
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
          // Remove from raised hands if they leave
          setRaisedHands(prev => {
            const updated = new Set(prev);
            updated.delete(event.participant.session_id);
            return updated;
          });
        }
      });

      // Active speaker detection
      call.on("active-speaker-change", (event) => {
        if (event?.activeSpeaker?.peerId) {
          setSpeakingParticipants(new Set([event.activeSpeaker.peerId]));
        } else {
          setSpeakingParticipants(new Set());
        }
      });

      call.on("error", (error) => {
        console.error("Daily error:", error);
        const errorMsg = error?.errorMsg || "Erro na conexão de vídeo";
        if (errorMsg === "account-missing-payment-method") {
          toast.error("Conta Daily.co requer método de pagamento configurado");
        } else {
          toast.error("Erro na conexão de vídeo");
        }
        setJoiningDaily(false);
        isInitializingRef.current = false;
      });

      call.on("left-meeting", () => {
        setParticipants({});
        callObjectRef.current = null;
        isInitializingRef.current = false;
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
      isInitializingRef.current = false;
      callObjectRef.current = null;
    }
  }, [user]);

  // Update remote video elements when participants change
  // Update remote video and audio elements when participants change
  useEffect(() => {
    Object.entries(participants).forEach(([sessionId, participant]) => {
      if (!participant.local) {
        // Handle video
        const videoEl = participantRefs.current[sessionId];
        if (videoEl) {
          // Prioritize screen share track over video track
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

  useEffect(() => {
    if (code && user) {
      initializeMeeting();
    }
    
    return () => {
      cleanup();
    };
  }, [code, user]);

  // Track unread messages
  useEffect(() => {
    if (!showChat && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastReadMessageRef.current !== lastMessage.id && lastMessage.user_id !== user?.id) {
        setUnreadMessages(prev => prev + 1);
      }
    } else if (showChat) {
      setUnreadMessages(0);
      if (messages.length > 0) {
        lastReadMessageRef.current = messages[messages.length - 1].id;
      }
    }
  }, [messages, showChat, user?.id]);

  // Subscribe to hand raises via realtime
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-hands-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'hand_raised' },
        (payload) => {
          const { session_id, raised, user_name } = payload.payload;
          setRaisedHands(prev => {
            const updated = new Set(prev);
            if (raised) {
              updated.add(session_id);
              if (isHost) {
                toast.info(`${user_name} levantou a mão`, { icon: "✋" });
              }
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
  }, [meeting?.id, isHost]);

  // Subscribe to host controls via realtime
  useEffect(() => {
    if (!meeting?.id) return;

    // Get local participant session ID
    const getLocalSessionId = () => {
      if (!callObject) return null;
      const localParticipant = callObject.participants().local;
      return localParticipant?.session_id;
    };

    const channel = supabase
      .channel(`meeting-controls-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'host_control' },
        (payload) => {
          const { action, enabled, targetSessionId } = payload.payload;
          const localSessionId = getLocalSessionId();
          
          console.log('Received host control:', { action, enabled, targetSessionId, localSessionId, isHost });
          
          if (action === 'toggle_all_audio' && !isHost) {
            if (!enabled && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O anfitrião desativou todos os microfones");
            }
            setGlobalAudioEnabled(enabled);
          } else if (action === 'toggle_all_video' && !isHost) {
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
            if (!enabled && !isHost) {
              toast.info("Somente o anfitrião pode compartilhar tela");
            }
          } else if (action === 'mute_participant' && targetSessionId && !isHost) {
            // Check if this command is targeted at the current participant
            if (targetSessionId === localSessionId && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O anfitrião desativou seu microfone");
            }
          } else if (action === 'disable_camera' && targetSessionId && !isHost) {
            if (targetSessionId === localSessionId && callObject) {
              callObject.setLocalVideo(false);
              setIsVideoOn(false);
              toast.info("O anfitrião desativou sua câmera");
            }
          } else if (action === 'remove_participant' && targetSessionId && !isHost) {
            if (targetSessionId === localSessionId) {
              toast.error("Você foi removido da reunião pelo anfitrião");
              // Give time for toast to show before leaving
              setTimeout(async () => {
                await cleanup();
                navigate("/reunioes");
              }, 1500);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          controlsChannelRef.current = channel;
        }
      });

    return () => {
      controlsChannelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, isHost, callObject, isScreenSharing]);

  // Subscribe to floating reactions via realtime
  const reactionsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-reactions-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'reaction' },
        (payload) => {
          const { emoji, userName, senderId } = payload.payload;
          // Add floating reaction
          const newReaction: FloatingReaction = {
            id: `${senderId}-${Date.now()}-${reactionIdCounter.current++}`,
            emoji,
            x: Math.random() * 60 + 20, // Random position between 20% and 80%
            userName
          };
          setFloatingReactions(prev => [...prev, newReaction]);
          
          // Remove after animation completes
          setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
          }, 3000);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reactionsChannelRef.current = channel;
        }
      });

    return () => {
      reactionsChannelRef.current = null;
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
      setGlobalAudioEnabled(meetingData.allow_participants_audio);
      setGlobalVideoEnabled(meetingData.allow_participants_video);
      setGlobalScreenShareEnabled(meetingData.allow_screen_share);
      
      // Check if password is required (non-host and meeting has password)
      const isUserHost = meetingData.host_user_id === user.id;
      if (!isUserHost && meetingData.password) {
        setLoading(false);
        setShowPasswordPrompt(true);
        return;
      }

      await joinMeetingAfterPassword(meetingData);

    } catch (err) {
      console.error("Error initializing meeting:", err);
      setError("Erro ao entrar na reunião");
      setLoading(false);
    }
  };

  const joinMeetingAfterPassword = async (meetingData: Meeting) => {
    if (!code || !user) return;
    
    try {
      setLoading(true);

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
      setShowPasswordPrompt(false);

      // Initialize Daily.co
      await initializeDaily(room.url);

    } catch (err) {
      console.error("Error joining meeting:", err);
      setError("Erro ao entrar na reunião");
      setLoading(false);
    }
  };

  const handlePasswordSubmit = () => {
    if (!meeting) return;
    
    if (enteredPassword === meeting.password) {
      setPasswordError("");
      joinMeetingAfterPassword(meeting);
    } else {
      setPasswordError("Senha incorreta");
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
    
    // Check if global audio is disabled (for non-hosts)
    if (!isHost && !globalAudioEnabled && isMuted) {
      toast.error("O anfitrião desativou os microfones");
      return;
    }
    
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
  }, [isMuted, callObject, meeting, user, isHost, globalAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (!callObject) return;
    
    // Check if global video is disabled (for non-hosts)
    if (!isHost && !globalVideoEnabled && !isVideoOn) {
      toast.error("O anfitrião desativou as câmeras");
      return;
    }
    
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
  }, [isVideoOn, callObject, meeting, user, isHost, globalVideoEnabled]);

  const toggleScreenShare = async () => {
    if (!callObject) return;
    
    // Check if screen share is allowed
    if (!isHost && !globalScreenShareEnabled) {
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
    
    // Broadcast hand raise to all participants
    await supabase.channel(`meeting-hands-${meeting.id}`).send({
      type: 'broadcast',
      event: 'hand_raised',
      payload: {
        session_id: localParticipant.session_id,
        raised: newHandRaised,
        user_name: user?.profile?.full_name || "Participante"
      }
    });
  };

  // Host control functions
  const toggleAllAudio = async () => {
    if (!meeting || !isHost) return;
    
    const newEnabled = !globalAudioEnabled;
    setGlobalAudioEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_participants_audio: newEnabled })
      .eq("id", meeting.id);
    
    // Broadcast to all participants using subscribed channel
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'toggle_all_audio', enabled: newEnabled }
    });
    
    toast.success(newEnabled ? "Microfones liberados" : "Todos os microfones desativados");
  };

  const toggleAllVideo = async () => {
    if (!meeting || !isHost) return;
    
    const newEnabled = !globalVideoEnabled;
    setGlobalVideoEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_participants_video: newEnabled })
      .eq("id", meeting.id);
    
    // Broadcast to all participants using subscribed channel
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'toggle_all_video', enabled: newEnabled }
    });
    
    toast.success(newEnabled ? "Câmeras liberadas" : "Todas as câmeras desativadas");
  };

  const toggleAllScreenShare = async () => {
    if (!meeting || !isHost) return;
    
    const newEnabled = !globalScreenShareEnabled;
    setGlobalScreenShareEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_screen_share: newEnabled })
      .eq("id", meeting.id);
    
    // Broadcast to all participants using subscribed channel
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'toggle_screen_share', enabled: newEnabled }
    });
    
    toast.success(newEnabled ? "Compartilhamento de tela liberado para todos" : "Somente o anfitrião pode compartilhar tela");
  };

  // Mute a specific participant
  const muteParticipant = async (sessionId: string, participantName: string) => {
    if (!meeting || !isHost) return;
    
    console.log('Muting participant:', { sessionId, participantName });
    
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'mute_participant', targetSessionId: sessionId }
    });
    
    toast.success(`Microfone de ${participantName} desativado`);
  };

  // Disable camera of a specific participant
  const disableParticipantCamera = async (sessionId: string, participantName: string) => {
    if (!meeting || !isHost) return;
    
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'disable_camera', targetSessionId: sessionId }
    });
    
    toast.success(`Câmera de ${participantName} desativada`);
  };

  // Remove a participant from the meeting
  const removeParticipant = async (sessionId: string, participantName: string) => {
    if (!meeting || !isHost) return;
    
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    await channel.send({
      type: 'broadcast',
      event: 'host_control',
      payload: { action: 'remove_participant', targetSessionId: sessionId }
    });
    
    toast.success(`${participantName} foi removido da reunião`);
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

  const sendEmote = async (emote: string) => {
    if (!meeting || !user || !meeting.allow_chat) return;

    await supabase
      .from("meeting_messages")
      .insert({
        meeting_id: meeting.id,
        user_id: user.id,
        message: emote
      });
  };

  // Send floating reaction to all participants
  const sendReaction = async (emoji: string) => {
    if (!meeting || !user) return;

    // Use the subscribed channel or create a temporary one
    const channel = reactionsChannelRef.current || supabase.channel(`meeting-reactions-${meeting.id}`);
    
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        emoji,
        userName: user.profile?.full_name || "Participante",
        senderId: user.id
      }
    });
    
    // Also show locally immediately for the sender
    const newReaction: FloatingReaction = {
      id: `${user.id}-${Date.now()}-${reactionIdCounter.current++}`,
      emoji,
      x: Math.random() * 60 + 20,
      userName: user.profile?.full_name || "Participante"
    };
    setFloatingReactions(prev => [...prev, newReaction]);
    
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 3000);
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

  // Recording functions
  const startRecording = async () => {
    if (!callObject || !isHost) return;
    
    try {
      await callObject.startRecording();
      setIsRecording(true);
      setRecordingStartTime(new Date());
      toast.success("Gravação iniciada!");
    } catch (err) {
      console.error("Error starting recording:", err);
      toast.error("Erro ao iniciar gravação");
    }
  };

  const stopRecording = async () => {
    if (!callObject || !isHost) return;
    
    try {
      await callObject.stopRecording();
      setIsRecording(false);
      setRecordingStartTime(null);
      toast.success("Gravação finalizada! O vídeo estará disponível em breve.");
      
      // Sync recordings after stopping
      if (meeting) {
        setTimeout(async () => {
          try {
            await supabase.functions.invoke("sync-recordings", {
              body: { 
                action: "sync-meeting",
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                meetingDate: new Date().toISOString()
              }
            });
            console.log("Recording synced successfully");
          } catch (err) {
            console.error("Error syncing recording:", err);
          }
        }, 5000); // Wait 5 seconds for Daily.co to process
      }
    } catch (err) {
      console.error("Error stopping recording:", err);
      toast.error("Erro ao parar gravação");
    }
  };

  const formatRecordingTime = (startTime: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const participantCount = Object.keys(participants).length;
  const remoteParticipants = Object.entries(participants).filter(([_, p]) => !p.local);
  
  // Find who is sharing screen
  const screenSharingParticipant = Object.entries(participants).find(
    ([_, p]) => p.tracks?.screenVideo?.state === 'playable'
  );

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
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setError(null); setLoading(true); initializeMeeting(); }} variant="default">
              Tentar novamente
            </Button>
            <Button onClick={() => navigate("/reunioes")} variant="secondary">
              Voltar para reuniões
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Password prompt for non-hosts
  if (showPasswordPrompt) {
    return (
      <div className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-xl max-w-md w-full mx-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Reunião protegida</h2>
            <p className="text-gray-400">Esta reunião requer senha para entrar</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Digite a senha"
                value={enteredPassword}
                onChange={(e) => {
                  setEnteredPassword(e.target.value);
                  setPasswordError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                className="bg-gray-700 border-gray-600 text-white"
                autoFocus
              />
              {passwordError && (
                <p className="text-red-400 text-sm mt-2">{passwordError}</p>
              )}
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => navigate("/reunioes")}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handlePasswordSubmit}
                disabled={!enteredPassword.trim()}
              >
                Entrar
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header - Mobile optimized */}
      <header className="h-12 sm:h-14 bg-gray-800 flex items-center justify-between px-2 sm:px-4 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-gray-700 shrink-0 w-8 h-8 sm:w-10 sm:h-10"
            onClick={() => navigate("/reunioes")}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-white font-medium text-sm sm:text-base truncate">{meeting?.title}</h1>
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-gray-400">
              <span className="truncate max-w-[80px] sm:max-w-none">{code}</span>
              <button onClick={copyMeetingLink} className="hover:text-white shrink-0">
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 text-gray-400 text-xs sm:text-sm shrink-0">
          {isRecording && (
            <span className="flex items-center gap-1 text-red-500 animate-pulse">
              <Circle className="w-2 h-2 sm:w-3 sm:h-3 fill-red-500" />
              <span className="hidden sm:inline">REC {recordingStartTime && formatRecordingTime(recordingStartTime)}</span>
            </span>
          )}
          {joiningDaily && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
              <span className="hidden sm:inline">Conectando...</span>
            </span>
          )}
          <span className="hidden sm:inline">{format(new Date(), "HH:mm", { locale: ptBR })}</span>
          {isHost && (
            <span className="px-1.5 sm:px-2 py-0.5 bg-primary text-primary-foreground rounded text-[10px] sm:text-xs">
              Host
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0 relative">
        {/* Floating Reactions Layer */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          {floatingReactions.map((reaction) => (
            <div
              key={reaction.id}
              className="absolute bottom-20 animate-float-up"
              style={{ left: `${reaction.x}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="text-5xl drop-shadow-lg">{reaction.emoji}</span>
                <span className="text-xs text-white bg-black/50 px-2 py-0.5 rounded-full mt-1 whitespace-nowrap">
                  {reaction.userName}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Video grid */}
        <div className="flex-1 p-2 sm:p-4 flex items-center justify-center overflow-auto">
          <div className={cn(
            "grid gap-2 sm:gap-4 w-full max-w-6xl",
            // Mobile: stack vertically for 1-2 participants
            participantCount <= 1 && "grid-cols-1",
            participantCount === 2 && "grid-cols-1 sm:grid-cols-2",
            participantCount <= 4 && participantCount > 2 && "grid-cols-2",
            participantCount > 4 && "grid-cols-2 sm:grid-cols-3"
          )}>
            {/* Local video (self) */}
            <div className={cn(
              "relative bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden aspect-video transition-all duration-300",
              speakingParticipants.has(participants.local?.session_id || "") && "ring-4 ring-green-500"
            )}>
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
                  <Avatar className="w-16 h-16 sm:w-24 sm:h-24">
                    <AvatarImage src={user?.profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xl sm:text-3xl bg-primary">
                      {user?.profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1 sm:gap-2">
                <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black/60 rounded text-white text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none flex items-center gap-1">
                  {speakingParticipants.has(participants.local?.session_id || "") && (
                    <Volume2 className="w-3 h-3 text-green-500 animate-pulse" />
                  )}
                  {user?.profile?.full_name} (Você)
                </span>
                {isMuted && <MicOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />}
                {handRaised && <Hand className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 animate-bounce" />}
              </div>
            </div>

            {/* Screen share view - show prominently when someone is sharing */}
            {screenSharingParticipant && (
              <div className="col-span-full relative bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden aspect-video border-2 border-primary">
                <video
                  ref={el => { 
                    if (el && screenSharingParticipant[1].tracks?.screenVideo?.track) {
                      el.srcObject = new MediaStream([screenSharingParticipant[1].tracks.screenVideo.track]);
                    }
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain bg-black"
                />
                <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1 sm:gap-2">
                  <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-primary rounded text-white text-xs sm:text-sm flex items-center gap-1">
                    <ScreenShare className="w-3 h-3" />
                    {screenSharingParticipant[1].local 
                      ? "Você está compartilhando" 
                      : `${screenSharingParticipant[1].user_name || "Participante"} está compartilhando`}
                  </span>
                </div>
              </div>
            )}

            {/* Remote participants */}
            {remoteParticipants.map(([sessionId, participant]) => {
              const hasVideo = participant.video || participant.tracks?.video?.state === 'playable';
              const isSpeaking = speakingParticipants.has(sessionId);
              const hasHandRaised = raisedHands.has(sessionId);
              
              return (
                <div
                  key={sessionId}
                  className={cn(
                    "relative bg-gray-800 rounded-lg sm:rounded-xl overflow-hidden aspect-video transition-all duration-300",
                    isSpeaking && "ring-4 ring-green-500"
                  )}
                >
                  <video
                    ref={el => { participantRefs.current[sessionId] = el; }}
                    autoPlay
                    playsInline
                    className={cn(
                      "w-full h-full object-cover",
                      !hasVideo && "hidden"
                    )}
                  />
                  {!hasVideo && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar className="w-14 h-14 sm:w-20 sm:h-20">
                        <AvatarFallback className="text-lg sm:text-2xl bg-primary">
                          {participant.user_name?.charAt(0) || "P"}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 flex items-center gap-1 sm:gap-2">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black/60 rounded text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none flex items-center gap-1">
                      {isSpeaking && (
                        <Volume2 className="w-3 h-3 text-green-500 animate-pulse" />
                      )}
                      {participant.user_name || "Participante"}
                    </span>
                    {!participant.audio && <MicOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />}
                    {hasHandRaised && <Hand className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 animate-bounce" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat sidebar */}
        <Sheet open={showChat} onOpenChange={(open) => {
          setShowChat(open);
          if (open) setUnreadMessages(0);
        }}>
          <SheetContent side="right" className="w-80 sm:w-96 p-0">
            <SheetHeader className="p-4 border-b">
              <SheetTitle>Chat da reunião</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col h-[calc(100%-60px)]">
              <ScrollArea className="flex-1 p-4" ref={chatScrollRef}>
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg) => {
                      const isEmote = EMOTES.includes(msg.message);
                      // Convert URLs to clickable links
                      const renderMessageWithLinks = (text: string) => {
                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                        const parts = text.split(urlRegex);
                        return parts.map((part, index) => {
                          if (part.match(urlRegex)) {
                            return (
                              <a
                                key={index}
                                href={part}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline break-all"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {part}
                              </a>
                            );
                          }
                          return part;
                        });
                      };
                      
                      return (
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
                              isEmote ? "text-4xl bg-transparent" : (
                                msg.user_id === user?.id
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              )
                            )}>
                              <p className={cn(isEmote ? "" : "text-sm", "break-words")}>
                                {isEmote ? msg.message : renderMessageWithLinks(msg.message)}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(msg.created_at), "HH:mm")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              <div className="p-4 border-t space-y-2">
                {/* Emote picker */}
                <div className="flex gap-1 flex-wrap">
                  {EMOTES.slice(0, 8).map((emote) => (
                    <button
                      key={emote}
                      onClick={() => sendEmote(emote)}
                      className="hover:scale-125 transition-transform text-lg p-1"
                      disabled={!meeting?.allow_chat}
                    >
                      {emote}
                    </button>
                  ))}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="hover:bg-muted rounded p-1">
                        <Smile className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2">
                      <div className="grid grid-cols-6 gap-1">
                        {EMOTES.map((emote) => (
                          <button
                            key={emote}
                            onClick={() => sendEmote(emote)}
                            className="hover:scale-125 transition-transform text-xl p-1"
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
            
            <ScrollArea className="h-[calc(100%-80px)] mt-4">
              <div className="space-y-2">
                {Object.entries(participants).map(([sessionId, participant]) => {
                  const isSpeaking = speakingParticipants.has(sessionId);
                  const hasHandRaised = participant.local ? handRaised : raisedHands.has(sessionId);
                  const isParticipantHost = participant.owner;
                  
                  return (
                    <div
                      key={sessionId}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors",
                        isSpeaking && "bg-green-500/10 ring-1 ring-green-500"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {participant.user_name?.charAt(0) || "P"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium flex items-center gap-1">
                            {participant.user_name || "Participante"}
                            {participant.local && " (Você)"}
                            {isSpeaking && <Volume2 className="w-4 h-4 text-green-500 animate-pulse" />}
                          </p>
                          <div className="flex items-center gap-1">
                            {isParticipantHost && (
                              <span className="text-xs text-primary">Anfitrião</span>
                            )}
                            {hasHandRaised && (
                              <span className="text-xs text-yellow-500 flex items-center gap-0.5">
                                <Hand className="w-3 h-3" /> Mão levantada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasHandRaised && (
                          <Hand className="w-4 h-4 text-yellow-500 animate-bounce" />
                        )}
                        {/* Status indicators */}
                        {!participant.audio && (
                          <MicOff className="w-4 h-4 text-red-500" />
                        )}
                        {!participant.video && (
                          <VideoOff className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

        {/* Moderation Panel - Host only */}
        {isHost && (
          <Sheet open={showModeration} onOpenChange={setShowModeration}>
            <SheetContent side="right" className="w-80 sm:w-[420px]">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  Moderação
                </SheetTitle>
              </SheetHeader>
              
              {/* Global Controls */}
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <p className="text-sm font-medium">Controles Globais</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={globalAudioEnabled ? "outline" : "destructive"}
                    size="sm"
                    onClick={toggleAllAudio}
                    className="flex flex-col h-auto py-3 gap-1"
                  >
                    {globalAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    <span className="text-[10px]">{globalAudioEnabled ? "Mutar Todos" : "Liberar Todos"}</span>
                  </Button>
                  <Button
                    variant={globalVideoEnabled ? "outline" : "destructive"}
                    size="sm"
                    onClick={toggleAllVideo}
                    className="flex flex-col h-auto py-3 gap-1"
                  >
                    {globalVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    <span className="text-[10px]">{globalVideoEnabled ? "Desligar Câmeras" : "Liberar Câmeras"}</span>
                  </Button>
                  <Button
                    variant={globalScreenShareEnabled ? "outline" : "destructive"}
                    size="sm"
                    onClick={toggleAllScreenShare}
                    className="flex flex-col h-auto py-3 gap-1"
                  >
                    {globalScreenShareEnabled ? <ScreenShare className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                    <span className="text-[10px]">{globalScreenShareEnabled ? "Bloquear Tela" : "Liberar Tela"}</span>
                  </Button>
                </div>
              </div>
              
              {/* Individual Participant Controls */}
              <div className="mt-4">
                <p className="text-sm font-medium mb-3">Controle Individual</p>
                <ScrollArea className="h-[calc(100vh-320px)]">
                  <div className="space-y-2">
                    {Object.entries(participants).map(([sessionId, participant]) => {
                      const isParticipantHost = participant.owner;
                      const firstName = (participant.user_name || "Participante").split(" ")[0];
                      const hasAudio = participant.audio;
                      const hasVideo = participant.video;
                      const isScreenSharing = participant.screen;
                      
                      // Skip local participant (host)
                      if (participant.local) return null;
                      
                      return (
                        <div
                          key={sessionId}
                          className="flex items-center justify-between p-3 bg-background rounded-lg border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {firstName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-sm truncate">
                              {firstName}
                              {isParticipantHost && <span className="text-primary ml-1">(Host)</span>}
                            </span>
                          </div>
                          
                          {!isParticipantHost && (
                            <div className="flex items-center gap-1">
                              {/* Mic control */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant={hasAudio ? "ghost" : "ghost"}
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8",
                                      hasAudio ? "text-green-500 hover:text-red-500" : "text-red-500"
                                    )}
                                    onClick={() => muteParticipant(sessionId, firstName)}
                                    disabled={!hasAudio}
                                  >
                                    {hasAudio ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasAudio ? "Mutar" : "Mutado"}
                                </TooltipContent>
                              </Tooltip>
                              
                              {/* Camera control */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      "h-8 w-8",
                                      hasVideo ? "text-green-500 hover:text-red-500" : "text-red-500"
                                    )}
                                    onClick={() => disableParticipantCamera(sessionId, firstName)}
                                    disabled={!hasVideo}
                                  >
                                    {hasVideo ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {hasVideo ? "Desligar câmera" : "Câmera desligada"}
                                </TooltipContent>
                              </Tooltip>
                              
                              {/* Screen share indicator */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "h-8 w-8 flex items-center justify-center rounded-md",
                                    isScreenSharing ? "text-blue-500" : "text-muted-foreground"
                                  )}>
                                    {isScreenSharing ? <ScreenShare className="w-4 h-4" /> : <ScreenShareOff className="w-4 h-4" />}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isScreenSharing ? "Compartilhando tela" : "Não está compartilhando"}
                                </TooltipContent>
                              </Tooltip>
                              
                              {/* Remove participant */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeParticipant(sessionId, firstName)}
                                  >
                                    <UserX className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remover da reunião</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Controls bar - Mobile optimized */}
      <div className="h-16 sm:h-20 bg-gray-800 flex items-center justify-center px-2 sm:px-4 gap-1 sm:gap-2 border-t border-gray-700 shrink-0">
        <TooltipProvider>
          {/* Mic toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
                onClick={toggleMute}
                disabled={!callObject || (!isHost && !globalAudioEnabled && isMuted)}
              >
                {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">{isMuted ? "Ativar microfone" : "Desativar microfone"}</TooltipContent>
          </Tooltip>

          {/* Video toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoOn ? "secondary" : "destructive"}
                size="lg"
                className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
                onClick={toggleVideo}
                disabled={!callObject || (!isHost && !globalVideoEnabled && !isVideoOn)}
              >
                {isVideoOn ? <Video className="w-4 h-4 sm:w-5 sm:h-5" /> : <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">{isVideoOn ? "Desativar câmera" : "Ativar câmera"}</TooltipContent>
          </Tooltip>

          {/* Screen share - Hidden on mobile */}
          {(globalScreenShareEnabled || isHost) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="lg"
                  className="rounded-full w-10 h-10 sm:w-12 sm:h-12 hidden sm:flex"
                  onClick={toggleScreenShare}
                  disabled={!callObject || (!isHost && !globalScreenShareEnabled)}
                >
                  {isScreenSharing ? <ScreenShareOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <ScreenShare className="w-4 h-4 sm:w-5 sm:h-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">{isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}</TooltipContent>
            </Tooltip>
          )}

          {/* Hand raise */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={handRaised ? "default" : "secondary"}
                size="lg"
                className={cn(
                  "rounded-full w-10 h-10 sm:w-12 sm:h-12",
                  handRaised && "bg-yellow-500 hover:bg-yellow-600"
                )}
                onClick={toggleHandRaise}
                disabled={!callObject}
              >
                <Hand className={cn("w-4 h-4 sm:w-5 sm:h-5", handRaised && "animate-bounce")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">{handRaised ? "Baixar a mão" : "Levantar a mão"}</TooltipContent>
          </Tooltip>

          {/* Reactions picker */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
                    disabled={!callObject}
                  >
                    <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">Reagir</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-auto p-2" side="top">
              <div className="flex gap-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="hover:scale-125 transition-transform text-2xl p-2 rounded-lg hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Recording (Host only) - Hidden on mobile */}
          {isHost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isRecording ? "destructive" : "secondary"}
                  size="lg"
                  className="rounded-full w-10 h-10 sm:w-12 sm:h-12 hidden sm:flex"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!callObject}
                >
                  {isRecording ? <Square className="w-4 h-4 sm:w-5 sm:h-5" /> : <Circle className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">{isRecording ? "Parar gravação" : "Iniciar gravação"}</TooltipContent>
            </Tooltip>
          )}

          {/* Moderation button (Host only) */}
          {isHost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="rounded-full h-10 sm:h-12 px-3 sm:px-4 gap-1 sm:gap-2"
                  onClick={() => setShowModeration(true)}
                >
                  <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline text-sm font-medium">MODERAÇÃO</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">Controles de moderação</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-6 sm:h-8 bg-gray-600 mx-1 sm:mx-2 hidden sm:block" />

          {/* Chat with notification badge */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-10 h-10 sm:w-12 sm:h-12 relative"
                onClick={() => setShowChat(true)}
              >
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">Chat</TooltipContent>
          </Tooltip>

          {/* Participants */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-10 h-10 sm:w-12 sm:h-12 relative"
                onClick={() => setShowParticipants(true)}
              >
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-primary text-primary-foreground text-[10px] sm:text-xs rounded-full flex items-center justify-center">
                  {participantCount}
                </span>
                {raisedHands.size > 0 && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce">
                    <Hand className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="hidden sm:block">Participantes</TooltipContent>
          </Tooltip>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-10 h-10 sm:w-12 sm:h-12"
              >
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyMeetingLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar link
              </DropdownMenuItem>
              {/* Mobile-only options */}
              {(globalScreenShareEnabled || isHost) && (
                <DropdownMenuItem onClick={toggleScreenShare} className="sm:hidden">
                  {isScreenSharing ? (
                    <>
                      <ScreenShareOff className="w-4 h-4 mr-2" />
                      Parar compartilhamento
                    </>
                  ) : (
                    <>
                      <ScreenShare className="w-4 h-4 mr-2" />
                      Compartilhar tela
                    </>
                  )}
                </DropdownMenuItem>
              )}
              {isHost && (
                <DropdownMenuItem onClick={isRecording ? stopRecording : startRecording} className="sm:hidden">
                  {isRecording ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Parar gravação
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 mr-2 fill-current" />
                      Iniciar gravação
                    </>
                  )}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={toggleFullscreen} className="hidden sm:flex">
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
                    Configurações
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-6 sm:h-8 bg-gray-600 mx-1 sm:mx-2" />

          {/* Leave call */}
          <Button
            variant="destructive"
            size="lg"
            className="rounded-full w-10 h-10 sm:w-auto sm:px-6 sm:h-12"
            onClick={leaveMeeting}
          >
            <Phone className="w-4 h-4 sm:w-5 sm:h-5 rotate-[135deg]" />
          </Button>

          {/* End meeting (Host only) - Hidden on very small screens */}
          {isHost && (
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-2 sm:px-4 h-10 sm:h-12 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground text-xs sm:text-sm hidden xs:flex"
              onClick={endMeeting}
            >
              <span className="hidden sm:inline">Encerrar</span>
              <span className="sm:hidden">Fim</span>
            </Button>
          )}
        </TooltipProvider>
      </div>
    </div>
  );
}
