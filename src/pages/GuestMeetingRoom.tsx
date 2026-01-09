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
  ScreenShare, ScreenShareOff, Send, Loader2, Hand, Smile, PictureInPicture2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import GuestScreenShareLayout from "@/components/GuestScreenShareLayout";
import { ScreenShareOptionsModal, ScreenShareType } from "@/components/ScreenShareOptionsModal";
import { ScreenSharePreview } from "@/components/ScreenSharePreview";
import { ScreenShareIndicator } from "@/components/ScreenShareIndicator";
import { formatParticipantName } from "@/lib/meeting-utils";
import { setUserInMeeting } from "@/hooks/useUserPresence";

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

// Global state to persist meeting data across tab switches
interface GlobalGuestMeetingState {
  meeting: Meeting | null;
  dailyRoom: { url: string; name: string } | null;
  callObject: DailyCall | null;
  messages: ChatMessage[];
}
const globalGuestMeetingState = new Map<string, GlobalGuestMeetingState>();

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
  const hasInitializedRef = useRef(false);
  
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
  
  // Picture-in-Picture state
  const [isPiPActive, setIsPiPActive] = useState(false);
  
  // Screen share options modal
  const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);
  
  // Track video state before screen share to restore it properly
  const videoStateBeforeScreenShareRef = useRef<boolean>(true);
  
  // Connection quality state
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('good');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const participantRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const screenAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

      // Handle non-fatal errors like screen share issues
      call.on("nonfatal-error", (error) => {
        console.warn("Daily non-fatal error:", error);
        if (error?.type === "screen-share-error") {
          console.log("Screen share error occurred");
          setIsScreenSharing(false);
        }
      });

      call.on("left-meeting", () => {
        setParticipants({});
        callObjectRef.current = null;
        isInitializingRef.current = false;
        setConnectionQuality('disconnected');
      });

      // Network quality monitoring
      call.on("network-quality-change", (event) => {
        if (event?.threshold) {
          const quality = event.threshold;
          if (quality === 'very-low' || quality === 'low') {
            setConnectionQuality('poor');
          } else {
            setConnectionQuality('good');
          }
        }
      });

      call.on("network-connection", (event) => {
        if (event?.event === 'connected') {
          setConnectionQuality('good');
        } else if (event?.event === 'interrupted') {
          setConnectionQuality('poor');
          toast.warning("Conexão instável detectada");
        }
      });

      // Screen share events - handle all states properly
      call.on("local-screen-share-started", async () => {
        console.log("Screen share started event received");
        setIsScreenSharing(true);
        toast.success("Compartilhamento de tela iniciado");
        
        // Restore camera if it was on before screen share
        // Use multiple attempts to ensure camera is restored
        const restoreCamera = async (attempt: number = 1) => {
          if (attempt > 3) {
            console.log("Max camera restore attempts reached");
            return;
          }
          
          try {
            const localParticipant = call.participants()?.local;
            const shouldRestoreVideo = videoStateBeforeScreenShareRef.current;
            
            console.log(`Camera restore attempt ${attempt}, shouldRestore: ${shouldRestoreVideo}, currentVideo: ${localParticipant?.video}`);
            
            if (shouldRestoreVideo && localParticipant && !localParticipant.video) {
              console.log("Restoring camera after screen share...");
              await call.setLocalVideo(true);
              setIsVideoOn(true);
              
              // Verify it worked
              setTimeout(async () => {
                const updated = call.participants()?.local;
                if (updated && !updated.video && videoStateBeforeScreenShareRef.current) {
                  console.log("Camera still off, retrying...");
                  restoreCamera(attempt + 1);
                }
              }, 300);
            }
          } catch (err) {
            console.error("Error restoring camera after screen share:", err);
            // Retry on error
            setTimeout(() => restoreCamera(attempt + 1), 500);
          }
        };
        
        // Start restoration after a small delay
        setTimeout(() => restoreCamera(1), 400);
      });

      call.on("local-screen-share-stopped", () => {
        console.log("Screen share stopped event received");
        setIsScreenSharing(false);
      });

      call.on("local-screen-share-canceled", () => {
        console.log("Screen share canceled by user");
        setIsScreenSharing(false);
      });

      // Track when another participant starts/stops screen sharing
      call.on("track-started", (event) => {
        if (event?.track?.kind === 'video' && event?.participant && !event.participant.local) {
          setParticipants(prev => ({
            ...prev,
            [event.participant.session_id]: {
              ...prev[event.participant.session_id],
              ...event.participant
            }
          }));
        }
      });

      call.on("track-stopped", (event) => {
        if (event?.track?.kind === 'video' && event?.participant && !event.participant.local) {
          setParticipants(prev => ({
            ...prev,
            [event.participant.session_id]: {
              ...prev[event.participant.session_id],
              ...event.participant
            }
          }));
        }
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
        
        // Handle screen audio - create separate audio element for screen share audio
        const screenAudioTrack = participant.tracks?.screenAudio?.track;
        if (screenAudioTrack) {
          let screenAudioEl = screenAudioRefs.current[sessionId];
          if (!screenAudioEl) {
            screenAudioEl = document.createElement('audio');
            screenAudioEl.autoplay = true;
            screenAudioEl.id = `screen-audio-${sessionId}`;
            document.body.appendChild(screenAudioEl);
            screenAudioRefs.current[sessionId] = screenAudioEl;
          }
          screenAudioEl.srcObject = new MediaStream([screenAudioTrack]);
        } else {
          // Clean up screen audio if no longer sharing
          const existingScreenAudio = screenAudioRefs.current[sessionId];
          if (existingScreenAudio) {
            existingScreenAudio.srcObject = null;
            existingScreenAudio.remove();
            delete screenAudioRefs.current[sessionId];
          }
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
    
    // Clean up screen audio elements for participants who left
    Object.keys(screenAudioRefs.current).forEach(sessionId => {
      if (!participants[sessionId]) {
        const screenAudioEl = screenAudioRefs.current[sessionId];
        if (screenAudioEl) {
          screenAudioEl.srcObject = null;
          screenAudioEl.remove();
          delete screenAudioRefs.current[sessionId];
        }
      }
    });
  }, [participants]);

  // Initialize meeting
  useEffect(() => {
    const meetingKey = `${code}-${guestInfo?.guestId}`;
    
    const existingState = globalGuestMeetingState.get(meetingKey);
    
    // Only initialize once when we have code and guestInfo
    // Check both the ref AND the global map to handle re-mounts
    if (code && guestInfo && !hasInitializedRef.current && !existingState) {
      console.log('Guest: Initializing meeting for first time:', meetingKey);
      setUserInMeeting(true);
      hasInitializedRef.current = true;
      initializeMeeting();
    } else if (code && guestInfo && existingState) {
      // Meeting was already initialized, restore state from global
      console.log('Guest: Meeting already initialized, restoring state:', meetingKey);
      setUserInMeeting(true);
      hasInitializedRef.current = true;
      
      // Restore state from global
      if (existingState.meeting) setMeeting(existingState.meeting);
      if (existingState.dailyRoom) setDailyRoom(existingState.dailyRoom);
      if (existingState.callObject) {
        setCallObject(existingState.callObject);
        callObjectRef.current = existingState.callObject;
        // Restore participants from callObject
        const currentParticipants = existingState.callObject.participants();
        setParticipants(currentParticipants as Record<string, ParticipantWithExtras>);
      }
      if (existingState.messages.length > 0) setMessages(existingState.messages);
      setLoading(false);
    }
  }, [code, guestInfo?.guestId]);

  // Save state to global when it changes
  useEffect(() => {
    const meetingKey = `${code}-${guestInfo?.guestId}`;
    if (meeting && callObject) {
      globalGuestMeetingState.set(meetingKey, {
        meeting,
        dailyRoom,
        callObject,
        messages
      });
    }
  }, [meeting, dailyRoom, callObject, messages, code, guestInfo?.guestId]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    const meetingKey = `${code}-${guestInfo?.guestId}`;
    
    return () => {
      console.log('Guest: Cleanup effect running for:', meetingKey);
    };
  }, [code, guestInfo?.guestId]);

  // Update document title when tab is in background to show meeting is active
  useEffect(() => {
    if (!meeting) return;
    
    const originalTitle = document.title;
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.title = `🔴 Reunião ativa - ${meeting.title}`;
      } else {
        document.title = meeting.title || "Reunião";
      }
    };

    // Prevent page refresh/navigation while in meeting
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Você está em uma reunião. Tem certeza que deseja sair?';
      return e.returnValue;
    };

    // Set initial title
    document.title = meeting.title || "Reunião";
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.title = originalTitle;
    };
  }, [meeting]);

  // Subscribe to meeting end events
  useEffect(() => {
    if (!meeting?.id) return;

    const channel = supabase
      .channel(`meeting-status-${meeting.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meetings',
          filter: `id=eq.${meeting.id}`
        },
        (payload) => {
          const updatedMeeting = payload.new as { is_active: boolean; ended_at: string | null };
          if (!updatedMeeting.is_active || updatedMeeting.ended_at) {
            toast.info("A reunião foi encerrada pelo anfitrião");
            setTimeout(async () => {
              await cleanup();
              navigate("/");
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, navigate]);

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
    if (!meeting?.id || !callObject) return;

    // Get local participant session ID
    const localParticipant = callObject.participants().local;
    const localSessionId = localParticipant?.session_id;
    
    console.log('Guest: Setting up host controls listener. Local session ID:', localSessionId);

    const channel = supabase
      .channel(`meeting-controls-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'host_control' },
        (payload) => {
          const { action, enabled, targetSessionId } = payload.payload;
          
          console.log('Guest received host control:', { 
            action, 
            enabled, 
            targetSessionId, 
            localSessionId,
            match: targetSessionId === localSessionId 
          });
          
          // Global commands
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
          // Individual commands - check if targeted at this participant
          else if (targetSessionId && targetSessionId === localSessionId) {
            console.log('Guest: Processing individual command:', action);
            
            if (action === 'mute_participant' && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O anfitrião desativou seu microfone");
            } else if (action === 'disable_camera' && callObject) {
              callObject.setLocalVideo(false);
              setIsVideoOn(false);
              toast.info("O anfitrião desativou sua câmera");
            } else if (action === 'remove_participant') {
              toast.error("Você foi removido da reunião pelo anfitrião");
              setTimeout(async () => {
                await cleanup();
                navigate(`/entrar/${code}`);
              }, 1500);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Guest: Host controls channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, callObject, isScreenSharing, navigate, code]);

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
    // Clean up message subscription
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
      messagesChannelRef.current = null;
    }
    
    // Clean up audio elements
    Object.keys(audioRefs.current).forEach(sessionId => {
      const audioEl = audioRefs.current[sessionId];
      if (audioEl) {
        audioEl.srcObject = null;
        audioEl.remove();
      }
    });
    audioRefs.current = {};
    
    // Clean up screen audio elements
    Object.keys(screenAudioRefs.current).forEach(sessionId => {
      const screenAudioEl = screenAudioRefs.current[sessionId];
      if (screenAudioEl) {
        screenAudioEl.srcObject = null;
        screenAudioEl.remove();
      }
    });
    screenAudioRefs.current = {};
    
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
    setConnectionQuality('good');
    
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
    // Cleanup any existing subscription first
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
    }
    
    const channel = supabase
      .channel(`guest-meeting-messages-${meetingId}`)
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
    
    messagesChannelRef.current = channel;
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

  const toggleScreenShare = useCallback(async () => {
    if (!callObject) {
      toast.error("Conexão não estabelecida");
      return;
    }

    // Check if global screen share is disabled
    if (!globalScreenShareEnabled) {
      toast.error("O anfitrião desativou o compartilhamento de tela");
      return;
    }

    // Get current screen share state directly from Daily
    const localParticipant = callObject.participants().local;
    const isCurrentlySharing = localParticipant?.screen;
    
    if (isCurrentlySharing || isScreenSharing) {
      try {
        console.log("Stopping screen share...");
        await callObject.stopScreenShare();
        setIsScreenSharing(false);
        toast.info("Compartilhamento de tela encerrado");
      } catch (err) {
        console.error("Error stopping screen share:", err);
        setIsScreenSharing(false);
      }
    } else {
      // Show options modal instead of starting directly
      setShowScreenShareOptions(true);
    }
  }, [callObject, isScreenSharing, globalScreenShareEnabled]);

  const startScreenShareWithType = useCallback(async (type: ScreenShareType) => {
    if (!callObject) return;

    try {
      console.log("Starting screen share with type:", type);
      
      // Store current video state to restore after screen share starts
      const wasVideoOn = isVideoOn;
      videoStateBeforeScreenShareRef.current = wasVideoOn;
      console.log("Saving video state before screen share:", wasVideoOn);
      
      // Configure display media constraints based on selection
      const displayMediaOptions: any = {
        screenVideoSendSettings: {
          maxQuality: 'high',
        },
        // Enable audio capture for screen sharing (important for sharing videos/tabs with sound)
        screenAudioSendSettings: {
          channelConfig: 'stereo',
        },
      };

      // For browser tabs, we can hint at preferCurrentTab
      if (type === 'tab') {
        displayMediaOptions.displayMediaOptions = {
          preferCurrentTab: false,
          selfBrowserSurface: 'include',
          surfaceSwitching: 'include',
          monitorTypeSurfaces: 'exclude',
          audio: true, // Request tab audio
        };
      } else if (type === 'window') {
        displayMediaOptions.displayMediaOptions = {
          monitorTypeSurfaces: 'exclude',
          surfaceSwitching: 'include',
          audio: true, // Request system audio
        };
      } else {
        // Full screen
        displayMediaOptions.displayMediaOptions = {
          monitorTypeSurfaces: 'include',
          surfaceSwitching: 'include',
          audio: true, // Request system audio
        };
      }

      await callObject.startScreenShare(displayMediaOptions);
      
      // Ensure camera stays on after screen share starts (Daily may turn it off by default)
      // Use multiple attempts to be more robust
      if (wasVideoOn) {
        const restoreCameraAfterShare = async (attempt: number = 1) => {
          if (attempt > 3) return;
          
          try {
            const localParticipant = callObject.participants()?.local;
            if (localParticipant && !localParticipant.video) {
              console.log(`Restoring camera after screen share start (attempt ${attempt})`);
              await callObject.setLocalVideo(true);
              setIsVideoOn(true);
              
              // Verify and retry if needed
              setTimeout(async () => {
                const updated = callObject.participants()?.local;
                if (updated && !updated.video) {
                  restoreCameraAfterShare(attempt + 1);
                }
              }, 400);
            }
          } catch (err) {
            console.error("Error restoring camera:", err);
            setTimeout(() => restoreCameraAfterShare(attempt + 1), 500);
          }
        };
        
        setTimeout(() => restoreCameraAfterShare(1), 600);
      }
      
      // State will be updated by the event listener
    } catch (err: any) {
      console.error("Error starting screen share:", err);
      
      // Handle user cancellation gracefully
      if (err?.message?.includes("NotAllowedError") || 
          err?.name === "NotAllowedError" ||
          err?.type === "screen-share-error" ||
          err?.message?.includes("Permission denied") ||
          err?.message?.includes("cancelled")) {
        console.log("Screen share cancelled by user or browser");
        setIsScreenSharing(false);
        return;
      }
      
      // Handle macOS screen recording permission
      if (err?.message?.includes("screen capture")) {
        toast.error("Permissão de gravação de tela necessária. Verifique as configurações do sistema.");
        setIsScreenSharing(false);
        return;
      }
      
      toast.error("Erro ao compartilhar tela. Verifique as permissões do navegador.");
      setIsScreenSharing(false);
    }
  }, [callObject, isVideoOn]);

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

  // Picture-in-Picture toggle
  const togglePiP = async () => {
    try {
      if (isPiPActive && document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiPActive(false);
        return;
      }

      // Find the best video to use for PiP (prefer remote participant with video, fallback to local)
      let videoElement: HTMLVideoElement | null = null;
      
      // First try to find a remote participant with video
      for (const [sessionId, participant] of Object.entries(participants)) {
        if (!participant.local && (participant.video || participant.tracks?.video?.state === 'playable')) {
          videoElement = participantRefs.current[sessionId] || null;
          if (videoElement) break;
        }
      }
      
      // Fallback to local video
      if (!videoElement && localVideoRef.current && isVideoOn) {
        videoElement = localVideoRef.current;
      }

      if (videoElement && videoElement.readyState >= 2) {
        await videoElement.requestPictureInPicture();
        setIsPiPActive(true);
        
        videoElement.addEventListener('leavepictureinpicture', () => {
          setIsPiPActive(false);
        }, { once: true });
      } else {
        toast.error("Nenhum vídeo disponível para Picture-in-Picture");
      }
    } catch (err: any) {
      console.log("PiP toggle error:", err);
      if (err.name === 'NotAllowedError') {
        toast.error("Picture-in-Picture não permitido pelo navegador");
      } else {
        toast.error("Erro ao ativar Picture-in-Picture");
      }
    }
  };

  const leaveMeeting = async () => {
    // Clear the global state when actually leaving
    const meetingKey = `${code}-${guestInfo?.guestId}`;
    globalGuestMeetingState.delete(meetingKey);
    hasInitializedRef.current = false;
    setUserInMeeting(false);
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

  const remoteParticipants: [string, ParticipantWithExtras][] = Object.entries(participants).filter(([_, p]) => !p.local) as [string, ParticipantWithExtras][];
  const participantCount = Object.keys(participants).length;
  
  // Find who is sharing screen
  const screenSharingParticipant = Object.entries(participants).find(
    ([_, p]) => p.tracks?.screenVideo?.state === 'playable'
  ) as [string, ParticipantWithExtras] | undefined;

  // Get the name of the screen sharer
  const getScreenSharerName = (): string | null => {
    if (!screenSharingParticipant) return null;
    const [_, participant] = screenSharingParticipant;
    if (participant.local) return null; // We use ScreenSharePreview for local
    return participant.user_name || "Participante";
  };
  
  const screenSharerName = getScreenSharerName();

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
            {/* Connection quality indicator */}
            {connectionQuality === 'poor' && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-1 text-orange-400">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Conexão instável</TooltipContent>
              </Tooltip>
            )}
            {joiningDaily && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Conectando...</span>
              </span>
            )}
            <span className="text-gray-400 text-sm">
              {format(new Date(), "HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Screen Share Indicator - shows who is sharing */}
        {screenSharerName && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40">
            <ScreenShareIndicator sharerName={screenSharerName} />
          </div>
        )}

        {/* Main content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Video grid - different layout when screen sharing */}
          <div className="flex-1 p-2 sm:p-4 flex overflow-hidden">
            {screenSharingParticipant ? (
              // Screen share layout: 2 columns - screen on left, cameras on right
              <GuestScreenShareLayout
                screenSharingParticipant={screenSharingParticipant}
                localVideoRef={localVideoRef}
                isVideoOn={isVideoOn}
                guestName={guestInfo.guestName}
                isMuted={isMuted}
                handRaised={handRaised}
                speakingParticipants={speakingParticipants}
                participants={participants}
                remoteParticipants={remoteParticipants}
                participantRefs={participantRefs}
                raisedHands={raisedHands}
              />
            ) : (
              // Normal grid layout
              <div className="flex-1 flex items-center justify-center overflow-auto">
                <div className="flex flex-wrap gap-4 justify-center items-center">
                  {/* Local video */}
                  <div 
                    className={cn(
                      "relative bg-[#3c4043] rounded-xl overflow-hidden shrink-0",
                      speakingParticipants.has(participants.local?.session_id || '') && "ring-2 ring-green-500"
                    )}
                    style={{ width: '300px', height: '250px' }}
                  >
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
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                      <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">
                        {guestInfo.guestName} <span className="text-amber-400 font-medium">(Convidado)</span>
                      </span>
                      <div className="flex items-center gap-1">
                        {isMuted && <MicOff className="h-4 w-4 text-red-500" />}
                        {handRaised && <span className="text-lg">✋</span>}
                      </div>
                    </div>
                  </div>

                  {/* Remote participants */}
                  {remoteParticipants.map(([sessionId, participant]) => {
                    const { displayName, roleLabel, roleColorClass } = formatParticipantName(participant.user_name || "Participante");
                    
                    return (
                      <div
                        key={sessionId}
                        className={cn(
                          "relative bg-[#3c4043] rounded-xl overflow-hidden shrink-0",
                          speakingParticipants.has(sessionId) && "ring-2 ring-green-500",
                          raisedHands.has(sessionId) && "ring-2 ring-yellow-500"
                        )}
                        style={{ width: '300px', height: '250px' }}
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
                                {displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                        )}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                          <span className="text-white text-sm bg-black/50 px-2 py-1 rounded flex items-center gap-1">
                            {displayName} {roleLabel && <span className={cn("font-medium", roleColorClass)}>({roleLabel})</span>}
                          </span>
                          <div className="flex items-center gap-1">
                            {!participant.audio && <MicOff className="h-4 w-4 text-red-500" />}
                            {raisedHands.has(sessionId) && <span className="text-lg">✋</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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

        {/* Control bar - Mobile optimized */}
        <div className="h-16 sm:h-20 bg-[#202124] border-t border-[#3c4043] flex items-center justify-center px-2 sm:px-4 shrink-0">
          {/* Main controls - scrollable on very small screens */}
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-full scrollbar-hide">
            {/* Mic toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMuted ? "destructive" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0",
                    isMuted ? "bg-red-600 hover:bg-red-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleMute}
                  disabled={joiningDaily}
                >
                  {isMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">{isMuted ? "Ativar microfone" : "Desativar microfone"}</TooltipContent>
            </Tooltip>

            {/* Video toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={!isVideoOn ? "destructive" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0",
                    !isVideoOn ? "bg-red-600 hover:bg-red-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleVideo}
                  disabled={joiningDaily}
                >
                  {isVideoOn ? <Video className="h-4 w-4 sm:h-5 sm:w-5" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">{isVideoOn ? "Desativar câmera" : "Ativar câmera"}</TooltipContent>
            </Tooltip>

            {/* Screen share */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isScreenSharing ? "default" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0",
                    isScreenSharing ? "bg-green-600 hover:bg-green-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleScreenShare}
                  disabled={joiningDaily || !callObject}
                >
                  {isScreenSharing ? <ScreenShareOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <ScreenShare className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">
                {isScreenSharing ? "Parar compartilhamento" : "Compartilhar tela"}
              </TooltipContent>
            </Tooltip>

            {/* Hand raise */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={handRaised ? "default" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0",
                    handRaised ? "bg-yellow-600 hover:bg-yellow-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={toggleHandRaise}
                  disabled={joiningDaily}
                >
                  <Hand className={cn("h-4 w-4 sm:h-5 sm:w-5", handRaised && "fill-current")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">{handRaised ? "Abaixar mão" : "Levantar mão"}</TooltipContent>
            </Tooltip>

            {/* Reactions popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-[#3c4043] hover:bg-[#5f6368] shrink-0"
                  disabled={joiningDaily}
                >
                  <Smile className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2 bg-[#3c4043] border-[#5f6368]" side="top">
                <div className="flex gap-1 flex-wrap max-w-[200px] sm:max-w-none">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="text-xl sm:text-2xl hover:bg-[#5f6368] p-1.5 sm:p-2 rounded transition-transform hover:scale-110 active:scale-95"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Picture-in-Picture */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isPiPActive ? "default" : "secondary"}
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0 hidden sm:flex",
                    isPiPActive ? "bg-blue-600 hover:bg-blue-700" : "bg-[#3c4043] hover:bg-[#5f6368]"
                  )}
                  onClick={togglePiP}
                  disabled={joiningDaily || !callObject}
                >
                  <PictureInPicture2 className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">
                {isPiPActive ? "Sair do Picture-in-Picture" : "Picture-in-Picture"}
              </TooltipContent>
            </Tooltip>

            {/* Chat button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 relative shrink-0",
                    showChat ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "text-white hover:bg-[#3c4043]"
                  )}
                  onClick={() => {
                    setShowChat(!showChat);
                    if (!showChat) setUnreadMessages(0);
                  }}
                >
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  {unreadMessages > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                      {unreadMessages > 9 ? "9+" : unreadMessages}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">Chat</TooltipContent>
            </Tooltip>

            {/* Participants button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "rounded-full h-10 w-10 sm:h-12 sm:w-12 relative shrink-0",
                    showParticipants ? "bg-[#8ab4f8]/20 text-[#8ab4f8]" : "text-white hover:bg-[#3c4043]"
                  )}
                  onClick={() => setShowParticipants(!showParticipants)}
                >
                  <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                    {participantCount}
                  </span>
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">Participantes ({participantCount})</TooltipContent>
            </Tooltip>

            {/* Leave button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="rounded-full h-10 w-10 sm:h-12 sm:w-12 shrink-0"
                  onClick={leaveMeeting}
                >
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5 rotate-135" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="hidden sm:block">Sair da reunião</TooltipContent>
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

      {/* Screen Share Options Modal */}
      {/* Screen Share Options Modal */}
      <ScreenShareOptionsModal
        open={showScreenShareOptions}
        onOpenChange={setShowScreenShareOptions}
        onSelect={startScreenShareWithType}
      />

      {/* Screen Share Preview */}
      <ScreenSharePreview
        callObject={callObject}
        isSharing={isScreenSharing}
        onStopSharing={toggleScreenShare}
      />
    </TooltipProvider>
  );
}
