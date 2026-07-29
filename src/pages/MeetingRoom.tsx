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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DailyIframe, { DailyCall, DailyParticipant, DailyEventObjectParticipant, DailyEventObjectParticipantLeft, DailyParticipantsObject } from "@daily-co/daily-js";
import {
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, 
  ScreenShare, ScreenShareOff, MoreVertical, Settings,
  Copy, Maximize, Minimize, Send, ChevronLeft, Loader2,
  Circle, Square, Lock, Hand, Smile, Volume2, Shield,
  VideoIcon, MicIcon, Ban, Sparkles, UserX, PictureInPicture2, Download, HardDrive, FileText
} from "lucide-react";
import { useLocalRecording } from "@/hooks/useLocalRecording";
import { PaperBallEffect, ThrowPaperBallButton } from "@/components/PaperBallEffect";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ScreenShareLayout from "@/components/ScreenShareLayout";
import { ScreenShareOptionsModal, ScreenShareType } from "@/components/ScreenShareOptionsModal";
import { ScreenSharePreview } from "@/components/ScreenSharePreview";
import { ScreenShareIndicator } from "@/components/ScreenShareIndicator";
import { ROLE_LABELS } from "@/types/auth";
import { ROLE_TEXT_COLORS, formatParticipantName } from "@/lib/meeting-utils";
import { setUserInMeeting } from "@/hooks/useUserPresence";

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

// Global state to persist meeting data across tab switches
interface GlobalMeetingState {
  meeting: Meeting | null;
  dailyRoom: { url: string; name: string } | null;
  callObject: DailyCall | null;
  messages: ChatMessage[];
  // User settings that persist across tab switches
  isMuted: boolean;
  isVideoOn: boolean;
  handRaised: boolean;
  showChat: boolean;
  showParticipants: boolean;
}
const globalMeetingState = new Map<string, GlobalMeetingState>();

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
  const hasInitializedRef = useRef(false);
  
  // Local state - microphone starts OFF for all users
  const [isMuted, setIsMuted] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [bgBlurEnabled, setBgBlurEnabled] = useState(false);
  const [bgEffect, setBgEffect] = useState<"none" | "blur-light" | "blur-strong">("none");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showModeration, setShowModeration] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [isLocalRecordingMode, setIsLocalRecordingMode] = useState(false);
  
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
  
  // Picture-in-Picture state
  const [isPiPActive, setIsPiPActive] = useState(false);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  
  // Screen share options modal
  const [showScreenShareOptions, setShowScreenShareOptions] = useState(false);
  
  // Track video state before screen share to restore it properly
  const videoStateBeforeScreenShareRef = useRef<boolean>(true);
  
  // Connection quality state
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'disconnected'>('good');
  
  // Paper ball effect state
  const [paperBallActive, setPaperBallActive] = useState(false);
  const [paperBallSender, setPaperBallSender] = useState("");
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const participantRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const screenAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const controlsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const userRef = useRef(user);

  const isHost = meeting?.host_user_id === user?.id;
  const isDev = user?.role === 'dev';
  const hasModeratorAccess = isHost || isDev;

  // Local recording hook
  const {
    isLocalRecording,
    localRecordingStartTime,
    startLocalRecording,
    stopLocalRecording,
    downloadRecording,
    recordedBlob
  } = useLocalRecording({ meetingTitle: meeting?.title, meetingId: meeting?.id });

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
        startAudioOff: true, // Start with microphone OFF
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

      // Track when another participant starts/stops screen sharing or camera
      call.on("track-started", (event) => {
        if (event?.participant) {
          console.log("Track started:", event.track?.kind, "from", event.participant.user_name);
          // Force re-render of participants to update display
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
        if (event?.participant) {
          console.log("Track stopped:", event.track?.kind, "from", event.participant.user_name);
          // Force re-render of participants to update display
          setParticipants(prev => ({
            ...prev,
            [event.participant.session_id]: {
              ...prev[event.participant.session_id],
              ...event.participant
            }
          }));
        }
      });

      // Join the meeting with name and role
      // Override: gerente@digitaletextil.com.br aparece como Gerente na reunião
      const effectiveRoleForMeeting = user.email === 'gerente@digitaletextil.com.br' ? 'gerente' : user.role;
      const roleLabel = effectiveRoleForMeeting ? ROLE_LABELS[effectiveRoleForMeeting] : '';
      const displayName = user.profile?.full_name || user.email || "Participante";
      const userNameWithRole = roleLabel ? `${displayName} (${roleLabel})` : displayName;
      
      await call.join({
        url: roomUrl,
        userName: userNameWithRole,
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

  // Update remote video and audio elements when participants change
  // CRITICAL: This handles screen share audio for all participants
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
            const currentStream = videoEl.srcObject as MediaStream | null;
            const currentTrackId = currentStream?.getVideoTracks()[0]?.id;
            if (currentTrackId !== trackToUse.id) {
              videoEl.srcObject = new MediaStream([trackToUse]);
            }
          }
        }
        
        // Handle participant audio - create audio element if needed
        const audioTrack = participant.tracks?.audio?.track;
        if (audioTrack) {
          let audioEl = audioRefs.current[sessionId];
          if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.volume = 1.0;
            audioEl.id = `audio-${sessionId}`;
            document.body.appendChild(audioEl);
            audioRefs.current[sessionId] = audioEl;
          }
          
          // Check if we need to update the stream
          const currentStream = audioEl.srcObject as MediaStream | null;
          const currentTrackId = currentStream?.getAudioTracks()[0]?.id;
          if (currentTrackId !== audioTrack.id) {
            audioEl.srcObject = new MediaStream([audioTrack]);
            audioEl.play().catch(err => console.warn('Audio play failed:', err));
          }
        }
        
        // CRITICAL: Handle screen share audio separately - this is what enables 
        // system audio from screen shares to be heard by all participants
        const screenAudioTrack = participant.tracks?.screenAudio?.track;
        if (screenAudioTrack) {
          let screenAudioEl = screenAudioRefs.current[sessionId];
          if (!screenAudioEl) {
            screenAudioEl = document.createElement('audio');
            screenAudioEl.autoplay = true;
            screenAudioEl.volume = 1.0; // Full volume for screen share audio
            screenAudioEl.id = `screen-audio-${sessionId}`;
            document.body.appendChild(screenAudioEl);
            screenAudioRefs.current[sessionId] = screenAudioEl;
            console.log('Created screen audio element for:', participant.user_name);
          }
          
          // Check if we need to update the stream
          const currentStream = screenAudioEl.srcObject as MediaStream | null;
          const currentTrackId = currentStream?.getAudioTracks()[0]?.id;
          if (currentTrackId !== screenAudioTrack.id) {
            console.log('Setting screen audio track for:', participant.user_name);
            screenAudioEl.srcObject = new MediaStream([screenAudioTrack]);
            // Force play with retry for autoplay policy
            const playAudio = async () => {
              try {
                await screenAudioEl!.play();
                console.log('Screen audio playing for:', participant.user_name);
              } catch (err) {
                console.warn('Screen audio play failed, retrying:', err);
                // Retry after a short delay
                setTimeout(async () => {
                  try {
                    await screenAudioEl!.play();
                  } catch (e) {
                    console.error('Screen audio retry failed:', e);
                  }
                }, 500);
              }
            };
            playAudio();
          }
        } else {
          // Clean up screen audio if no longer sharing
          const existingScreenAudio = screenAudioRefs.current[sessionId];
          if (existingScreenAudio) {
            console.log('Removing screen audio element for:', participant.user_name);
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

  // Periodic sync to ensure video and audio tracks are always attached
  // Also syncs screen share audio for proper system sound playback
  useEffect(() => {
    if (!callObject) return;
    
    const syncAllTracks = () => {
      const currentParticipants = callObject.participants();
      
      // Sync local video
      const localParticipant = currentParticipants.local;
      if (localParticipant && localVideoRef.current) {
        const videoTrack = localParticipant.tracks?.video?.track;
        if (videoTrack) {
          const currentStream = localVideoRef.current.srcObject as MediaStream | null;
          const currentTrack = currentStream?.getVideoTracks()[0];
          if (!currentTrack || currentTrack.id !== videoTrack.id) {
            console.log("Syncing local video track");
            localVideoRef.current.srcObject = new MediaStream([videoTrack]);
          }
        }
      }
      
      // Sync remote videos and screen share audio
      Object.entries(currentParticipants).forEach(([sessionId, participant]) => {
        if (!participant.local) {
          // Sync video
          const videoEl = participantRefs.current[sessionId];
          if (videoEl) {
            const screenTrack = participant.tracks?.screenVideo?.track;
            const videoTrack = participant.tracks?.video?.track;
            const trackToUse = screenTrack || videoTrack;
            
            if (trackToUse) {
              const currentStream = videoEl.srcObject as MediaStream | null;
              const currentTrack = currentStream?.getVideoTracks()[0];
              if (!currentTrack || currentTrack.id !== trackToUse.id) {
                console.log("Syncing video track for", participant.user_name);
                videoEl.srcObject = new MediaStream([trackToUse]);
              }
            }
          }
          
          // CRITICAL: Ensure screen audio elements exist and are playing
          const screenAudioTrack = participant.tracks?.screenAudio?.track;
          if (screenAudioTrack) {
            let screenAudioEl = screenAudioRefs.current[sessionId];
            if (!screenAudioEl) {
              screenAudioEl = document.createElement('audio');
              screenAudioEl.autoplay = true;
              screenAudioEl.volume = 1.0;
              screenAudioEl.id = `screen-audio-sync-${sessionId}`;
              document.body.appendChild(screenAudioEl);
              screenAudioRefs.current[sessionId] = screenAudioEl;
              console.log('Sync: Created screen audio element for:', participant.user_name);
            }
            
            const currentStream = screenAudioEl.srcObject as MediaStream | null;
            const currentTrackId = currentStream?.getAudioTracks()[0]?.id;
            if (currentTrackId !== screenAudioTrack.id) {
              console.log('Sync: Updating screen audio track for:', participant.user_name);
              screenAudioEl.srcObject = new MediaStream([screenAudioTrack]);
              screenAudioEl.play().catch(err => console.warn('Sync screen audio play failed:', err));
            }
            
            // Ensure audio is not paused
            if (screenAudioEl.paused && screenAudioEl.srcObject) {
              screenAudioEl.play().catch(() => {});
            }
          }
          
          // Ensure regular audio is not paused
          const audioEl = audioRefs.current[sessionId];
          if (audioEl && audioEl.paused && audioEl.srcObject) {
            audioEl.play().catch(() => {});
          }
        }
      });
      
      // Update participants state to ensure UI is in sync - REPLACE entire state to avoid duplicates
      setParticipants(prev => {
        // Start fresh with only current participants from callObject
        const updated: Record<string, ParticipantWithExtras> = {};
        Object.entries(currentParticipants).forEach(([sessionId, participant]) => {
          updated[sessionId] = {
            ...participant,
            // Preserve hand raised and speaking state from previous state
            handRaised: prev[sessionId]?.handRaised,
            isSpeaking: prev[sessionId]?.isSpeaking
          };
        });
        return updated;
      });
    };
    
    // Sync immediately and then every 1.5 seconds (faster for better audio responsiveness)
    syncAllTracks();
    const interval = setInterval(syncAllTracks, 1500);
    
    return () => clearInterval(interval);
  }, [callObject]);

  // Keep userRef updated
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const meetingKey = `${code}-${user?.id}`;
    
    const existingState = globalMeetingState.get(meetingKey);
    
    // Only initialize once when we have code and user id
    // Check both the ref AND the global map to handle re-mounts
    if (code && user?.id && !hasInitializedRef.current && !existingState) {
      console.log('Initializing meeting for first time:', meetingKey);
      setUserInMeeting(true);
      hasInitializedRef.current = true;
      initializeMeeting();
    } else if (code && user?.id && existingState) {
      // Meeting was already initialized, restore state from global
      console.log('Meeting already initialized, restoring state:', meetingKey);
      setUserInMeeting(true);
      hasInitializedRef.current = true;
      
      // Restore state from global
      if (existingState.meeting) setMeeting(existingState.meeting);
      if (existingState.dailyRoom) setDailyRoom(existingState.dailyRoom);
      if (existingState.callObject) {
        setCallObject(existingState.callObject);
        callObjectRef.current = existingState.callObject;
        // Restore participants from callObject - use only current participants
        const currentParticipants = existingState.callObject.participants();
        setParticipants(currentParticipants as Record<string, ParticipantWithExtras>);
      }
      if (existingState.messages.length > 0) setMessages(existingState.messages);
      
      // Restore user settings
      setIsMuted(existingState.isMuted);
      setIsVideoOn(existingState.isVideoOn);
      setHandRaised(existingState.handRaised);
      setShowChat(existingState.showChat);
      setShowParticipants(existingState.showParticipants);
      
      setLoading(false);
    }
  }, [code, user?.id]);

  // Save state to global when it changes
  useEffect(() => {
    const meetingKey = `${code}-${user?.id}`;
    if (meeting && callObject) {
      globalMeetingState.set(meetingKey, {
        meeting,
        dailyRoom,
        callObject,
        messages,
        isMuted,
        isVideoOn,
        handRaised,
        showChat,
        showParticipants,
      });
    }
  }, [meeting, dailyRoom, callObject, messages, code, user?.id, isMuted, isVideoOn, handRaised, showChat, showParticipants]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    const meetingKey = `${code}-${user?.id}`;
    
    return () => {
      // Only cleanup when actually leaving the meeting (navigating away)
      // Not on re-mounts due to tab switching
      console.log('Cleanup effect running for:', meetingKey);
      // We'll handle actual cleanup in leaveMeeting function instead
    };
  }, [code, user?.id]);

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

    // Handle fullscreen changes without affecting meeting state
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    // Set initial title
    document.title = meeting.title || "Reunião";
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.title = originalTitle;
    };
  }, [meeting]);

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

  // Subscribe to meeting end events (for non-hosts)
  useEffect(() => {
    if (!meeting?.id || isHost) return;

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
              navigate("/reunioes");
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, isHost, navigate]);

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
                if (hasModeratorAccess) {
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
    if (!meeting?.id || !callObject) return;

    // Get local participant session ID directly from callObject
    const localParticipant = callObject.participants().local;
    const localSessionId = localParticipant?.session_id;
    
    console.log('Setting up host controls listener. Local session ID:', localSessionId, 'isHost:', isHost);

    const channel = supabase
      .channel(`meeting-controls-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'host_control' },
        (payload) => {
          const { action, enabled, targetSessionId } = payload.payload;
          
          console.log('Received host control:', { 
            action, 
            enabled, 
            targetSessionId, 
            localSessionId, 
            isHost,
            match: targetSessionId === localSessionId 
          });
          
          // Check if current user has moderator access (host or dev)
          const currentUserIsDev = userRef.current?.role === 'dev';
          const currentUserIsHost = isHost;
          const currentUserHasModeratorAccess = currentUserIsHost || currentUserIsDev;
          
          // Global commands - only apply to non-moderators
          if (action === 'toggle_all_audio' && !currentUserHasModeratorAccess) {
            if (!enabled && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O anfitrião desativou todos os microfones");
            }
            setGlobalAudioEnabled(enabled);
          } else if (action === 'toggle_all_video' && !currentUserHasModeratorAccess) {
            if (!enabled && callObject) {
              callObject.setLocalVideo(false);
              setIsVideoOn(false);
              toast.info("O anfitrião desativou todas as câmeras");
            }
            setGlobalVideoEnabled(enabled);
          } else if (action === 'toggle_screen_share') {
            if (!enabled && isScreenSharing && callObject && !currentUserHasModeratorAccess) {
              callObject.stopScreenShare();
              setIsScreenSharing(false);
            }
            setGlobalScreenShareEnabled(enabled);
            if (!enabled && !currentUserHasModeratorAccess) {
              toast.info("Somente o anfitrião pode compartilhar tela");
            }
          } 
          // Individual commands - process if targeted at this participant AND user is not a moderator
          else if (!currentUserHasModeratorAccess && targetSessionId && targetSessionId === localSessionId) {
            console.log('Processing individual command for this participant:', action);
            
            if (action === 'mute_participant' && callObject) {
              callObject.setLocalAudio(false);
              setIsMuted(true);
              toast.info("O moderador desativou seu microfone");
            } else if (action === 'disable_camera' && callObject) {
              callObject.setLocalVideo(false);
              setIsVideoOn(false);
              toast.info("O moderador desativou sua câmera");
            } else if (action === 'remove_participant') {
              toast.error("Você foi removido da reunião pelo moderador");
              setTimeout(async () => {
                await cleanup();
                navigate("/reunioes");
              }, 1500);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Host controls channel status:', status);
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

  // Subscribe to paper ball throws via realtime
  useEffect(() => {
    if (!meeting?.id || !callObject) return;

    const localParticipant = callObject.participants().local;
    const localSessionId = localParticipant?.session_id;

    const channel = supabase
      .channel(`meeting-paperball-${meeting.id}`)
      .on(
        'broadcast',
        { event: 'paper_ball' },
        (payload) => {
          const { targetSessionId, senderName } = payload.payload;
          
          // Only show effect if targeted at this participant
          if (targetSessionId === localSessionId) {
            setPaperBallSender(senderName);
            setPaperBallActive(true);
            // Sound is now handled by the PaperBallEffect component
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meeting?.id, callObject]);

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
      // Developers can bypass password protection
      const isUserHost = meetingData.host_user_id === user.id;
      const isDeveloper = user.role === 'dev';
      if (!isUserHost && !isDeveloper && meetingData.password) {
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
    // Cleanup any existing subscription first
    if (messagesChannelRef.current) {
      supabase.removeChannel(messagesChannelRef.current);
    }
    
    const channel = supabase
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
    
    messagesChannelRef.current = channel;
  };

  const toggleMute = useCallback(async () => {
    if (!callObject) return;
    
    // Check if global audio is disabled (for non-moderators)
    if (!hasModeratorAccess && !globalAudioEnabled && isMuted) {
      toast.error("O moderador desativou os microfones");
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
  }, [isMuted, callObject, meeting, user, hasModeratorAccess, globalAudioEnabled]);

  const toggleVideo = useCallback(async () => {
    if (!callObject) return;
    
    // Check if global video is disabled (for non-moderators)
    if (!hasModeratorAccess && !globalVideoEnabled && !isVideoOn) {
      toast.error("O moderador desativou as câmeras");
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
  }, [isVideoOn, callObject, meeting, user, hasModeratorAccess, globalVideoEnabled]);

  const applyBackgroundEffect = useCallback(
    async (effect: "none" | "blur-light" | "blur-strong") => {
      if (!callObject) return;
      try {
        let processor: any = { type: "none" };
        if (effect === "blur-light") {
          processor = { type: "background-blur", config: { strength: 0.4 } };
        } else if (effect === "blur-strong") {
          processor = { type: "background-blur", config: { strength: 0.9 } };
        }
        await callObject.updateInputSettings({ video: { processor } });
        setBgEffect(effect);
        setBgBlurEnabled(effect !== "none");
        toast.success(
          effect === "none"
            ? "Fundo original"
            : effect === "blur-light"
            ? "Desfoque leve aplicado"
            : "Desfoque forte aplicado"
        );
      } catch (err) {
        console.error("Error applying background effect:", err);
        toast.error("Seu navegador/dispositivo não suporta efeitos de fundo");
      }
    },
    [callObject]
  );

  const toggleBackgroundBlur = useCallback(
    () => applyBackgroundEffect(bgEffect === "none" ? "blur-strong" : "none"),
    [applyBackgroundEffect, bgEffect]
  );




  const toggleScreenShare = useCallback(async () => {
    if (!callObject) {
      toast.error("Conexão não estabelecida");
      return;
    }

    // Check if global screen share is disabled (for non-moderators)
    if (!hasModeratorAccess && !globalScreenShareEnabled) {
      toast.error("O moderador desativou o compartilhamento de tela");
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
  }, [callObject, isScreenSharing, hasModeratorAccess, globalScreenShareEnabled]);

  const startScreenShareWithType = useCallback(async (type: ScreenShareType) => {
    if (!callObject) return;

    try {
      console.log("Starting screen share with type:", type);
      
      // Store current video state to restore after screen share starts
      const wasVideoOn = isVideoOn;
      videoStateBeforeScreenShareRef.current = wasVideoOn;
      console.log("Saving video state before screen share:", wasVideoOn);
      
      // Capture screen with ONLY the window/tab audio (not system audio)
      // This prevents duplicating the call audio
      const displayMediaConstraints: DisplayMediaStreamOptions = {
        video: {
          displaySurface: type === 'screen' ? 'monitor' : type === 'window' ? 'window' : 'browser',
          frameRate: { ideal: 30 },
        } as MediaTrackConstraints,
        // Only request audio for tabs (browser tabs have isolated audio)
        // Windows and full screen don't have isolated audio - would capture call audio too
        audio: type === 'tab' ? {
          // Tab audio only - this is isolated from system audio
          suppressLocalAudioPlayback: false,
          noiseSuppression: false,
          autoGainControl: false,
          echoCancellation: false,
        } as MediaTrackConstraints : false,
      };
      
      // Add additional hints based on type
      const extendedConstraints = displayMediaConstraints as any;
      if (type === 'tab') {
        extendedConstraints.preferCurrentTab = false;
        extendedConstraints.selfBrowserSurface = 'include';
        // For tabs, we can safely include audio as it's isolated
        extendedConstraints.surfaceSwitching = 'include';
      }
      // DO NOT use systemAudio for windows/screens - it would duplicate call audio
      // Only tabs have isolated audio that won't include the meeting sounds
      
      console.log("Requesting screen capture with constraints:", extendedConstraints, "type:", type);
      
      // Get the media stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia(extendedConstraints);
      
      const hasAudioTrack = screenStream.getAudioTracks().length > 0;
      console.log("Screen stream obtained, has audio:", hasAudioTrack, "audio tracks:", screenStream.getAudioTracks());
      
      if (hasAudioTrack) {
        toast.success("Compartilhamento com áudio da aba ativado");
      } else if (type === 'tab') {
        toast.info("Compartilhamento iniciado (marque 'Compartilhar áudio da aba' para incluir som)");
      } else {
        toast.success("Compartilhamento de tela iniciado");
      }
      
      // Pass the captured stream to Daily.co
      await callObject.startScreenShare({
        mediaStream: screenStream,
        screenVideoSendSettings: {
          maxQuality: 'high',
        },
      } as any);
      
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

  // Host/Moderator control functions
  const toggleAllAudio = async () => {
    if (!meeting || !hasModeratorAccess) return;
    
    const newEnabled = !globalAudioEnabled;
    setGlobalAudioEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_participants_audio: newEnabled })
      .eq("id", meeting.id);
    
    // Create a new channel for broadcasting if the ref isn't ready
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    
    try {
      // Subscribe first if needed
      if (!controlsChannelRef.current) {
        await new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel;
              resolve();
            }
          });
          // Timeout after 2 seconds
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'toggle_all_audio', enabled: newEnabled }
      });
    } catch (err) {
      console.error('Error broadcasting toggle_all_audio:', err);
    }
    
    toast.success(newEnabled ? "Microfones liberados" : "Todos os microfones desativados");
  };

  const toggleAllVideo = async () => {
    if (!meeting || !hasModeratorAccess) return;
    
    const newEnabled = !globalVideoEnabled;
    setGlobalVideoEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_participants_video: newEnabled })
      .eq("id", meeting.id);
    
    // Create a new channel for broadcasting if the ref isn't ready
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    
    try {
      if (!controlsChannelRef.current) {
        await new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel;
              resolve();
            }
          });
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'toggle_all_video', enabled: newEnabled }
      });
    } catch (err) {
      console.error('Error broadcasting toggle_all_video:', err);
    }
    
    toast.success(newEnabled ? "Câmeras liberadas" : "Todas as câmeras desativadas");
  };

  const toggleAllScreenShare = async () => {
    if (!meeting || !hasModeratorAccess) return;
    
    const newEnabled = !globalScreenShareEnabled;
    setGlobalScreenShareEnabled(newEnabled);
    
    // Update meeting settings in database
    await supabase
      .from("meetings")
      .update({ allow_screen_share: newEnabled })
      .eq("id", meeting.id);
    
    // Create a new channel for broadcasting if the ref isn't ready
    const channel = controlsChannelRef.current || supabase.channel(`meeting-controls-${meeting.id}`);
    
    try {
      if (!controlsChannelRef.current) {
        await new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel;
              resolve();
            }
          });
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'toggle_screen_share', enabled: newEnabled }
      });
    } catch (err) {
      console.error('Error broadcasting toggle_screen_share:', err);
    }
    
    toast.success(newEnabled ? "Compartilhamento de tela liberado para todos" : "Somente o anfitrião pode compartilhar tela");
  };

  // Mute a specific participant
  const muteParticipant = async (sessionId: string, participantName: string) => {
    if (!meeting || !hasModeratorAccess) {
      console.error('Cannot mute: missing meeting or not moderator');
      return;
    }
    
    console.log('Sending mute command:', { sessionId, participantName });
    
    try {
      // Use existing channel or create new one
      let channel = controlsChannelRef.current;
      
      if (!channel) {
        channel = supabase.channel(`meeting-controls-${meeting.id}`);
        await new Promise<void>((resolve) => {
          channel!.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel!;
              resolve();
            }
          });
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'mute_participant', targetSessionId: sessionId }
      });
      toast.success(`Microfone de ${participantName} desativado`);
    } catch (error) {
      console.error('Error sending mute command:', error);
      toast.error("Erro ao enviar comando");
    }
  };

  // Disable camera of a specific participant
  const disableParticipantCamera = async (sessionId: string, participantName: string) => {
    if (!meeting || !hasModeratorAccess) {
      console.error('Cannot disable camera: missing meeting or not moderator');
      return;
    }
    
    console.log('Sending disable camera command:', { sessionId, participantName });
    
    try {
      let channel = controlsChannelRef.current;
      
      if (!channel) {
        channel = supabase.channel(`meeting-controls-${meeting.id}`);
        await new Promise<void>((resolve) => {
          channel!.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel!;
              resolve();
            }
          });
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'disable_camera', targetSessionId: sessionId }
      });
      toast.success(`Câmera de ${participantName} desativada`);
    } catch (error) {
      console.error('Error sending disable camera command:', error);
      toast.error("Erro ao enviar comando");
    }
  };

  // Remove a participant from the meeting
  const removeParticipant = async (sessionId: string, participantName: string) => {
    if (!meeting || !hasModeratorAccess) {
      console.error('Cannot remove: missing meeting or not moderator');
      return;
    }
    
    console.log('Sending remove command:', { sessionId, participantName });
    
    try {
      let channel = controlsChannelRef.current;
      
      if (!channel) {
        channel = supabase.channel(`meeting-controls-${meeting.id}`);
        await new Promise<void>((resolve) => {
          channel!.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              controlsChannelRef.current = channel!;
              resolve();
            }
          });
          setTimeout(resolve, 2000);
        });
      }
      
      await channel.send({
        type: 'broadcast',
        event: 'host_control',
        payload: { action: 'remove_participant', targetSessionId: sessionId }
      });
      toast.success(`${participantName} foi removido da reunião`);
    } catch (error) {
      console.error('Error sending remove command:', error);
      toast.error("Erro ao enviar comando");
    }
  };

  // Throw paper ball at a participant (fun attention getter)
  const throwPaperBall = async (sessionId: string, participantName: string) => {
    if (!meeting || !hasModeratorAccess) {
      console.error('Cannot throw paper ball: missing meeting or not moderator');
      return;
    }
    
    console.log('Throwing paper ball at:', { sessionId, participantName });
    
    try {
      const channel = supabase.channel(`meeting-paperball-${meeting.id}`);
      
      await new Promise<void>((resolve) => {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          }
        });
        setTimeout(resolve, 1000);
      });
      
      await channel.send({
        type: 'broadcast',
        event: 'paper_ball',
        payload: { 
          targetSessionId: sessionId,
          senderName: user?.profile?.full_name || "Moderador"
        }
      });
      
      // Send a chat message to show who received the paper ball
      await supabase
        .from("meeting_messages")
        .insert({
          meeting_id: meeting.id,
          user_id: user?.id,
          message: `🗞️ ${user?.profile?.full_name || "Moderador"} jogou uma bolinha de papel em ${participantName}!`
        });
      
      toast.success(`📄 Bolinha de papel jogada em ${participantName}!`, { icon: "🗞️" });
      
      // Cleanup channel
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 500);
    } catch (error) {
      console.error('Error throwing paper ball:', error);
      toast.error("Erro ao jogar bolinha de papel");
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
    // Clear the global state when actually leaving
    const meetingKey = `${code}-${user?.id}`;
    globalMeetingState.delete(meetingKey);
    hasInitializedRef.current = false;
    setUserInMeeting(false);
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
    // Override: Use guest entry link (/entrar/:code) instead of direct meeting link
    const link = `${window.location.origin}/entrar/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link para convidados copiado!");
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen toggle error (ignored):", err);
    }
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

  // Recording functions - local recording is the primary path (works without Daily.co paid plan)
  const startRecording = async () => {
    if (!meeting || !hasModeratorAccess) {
      toast.error("Apenas o anfitrião pode gravar a reunião");
      return;
    }

    if (!callObject) {
      toast.error("Reunião ainda não está pronta. Aguarde alguns segundos.");
      return;
    }

    toast.info("Selecione a aba/tela da reunião na próxima janela para iniciar a gravação...");

    const success = await startLocalRecording(callObject);
    if (success) {
      setIsRecording(true);
      setIsLocalRecordingMode(true);
      setRecordingStartTime(new Date());
    }
  };

  const stopRecording = async () => {
    if (!meeting || !hasModeratorAccess) return;
    
    if (isLocalRecordingMode) {
      // Stop local recording - will auto-download
      await stopLocalRecording();
      setIsRecording(false);
      setRecordingStartTime(null);
      setIsLocalRecordingMode(false);
    } else {
      // Stop cloud recording
      try {
        const roomName = meeting.meeting_code.replace(/-/g, "");
        const { error } = await supabase.functions.invoke("daily-room", {
          body: { action: "stop-recording", roomName }
        });
        
        if (error) throw error;
        
        setIsRecording(false);
        setRecordingStartTime(null);
        toast.success("Gravação finalizada! O vídeo estará disponível em breve.");
        
        // Sync recordings after stopping - wait for Daily.co to process
        setTimeout(async () => {
          try {
            const { data, error: syncError } = await supabase.functions.invoke("sync-recordings", {
              body: { 
                action: "sync-meeting",
                meetingId: meeting.id,
                meetingTitle: meeting.title,
                meetingDate: new Date().toISOString()
              }
            });
            
            if (syncError) {
              console.error("Error syncing recording:", syncError);
            } else {
              console.log("Recording synced successfully:", data);
            }
          } catch (err) {
            console.error("Error syncing recording:", err);
          }
        }, 10000);
      } catch (err) {
        console.error("Error stopping recording:", err);
        toast.error("Erro ao parar gravação");
      }
    }
  };

  // Start local recording directly (for manual fallback)
  const handleStartLocalRecording = async () => {
    if (!meeting || !hasModeratorAccess) return;
    
    // Pass callObject to capture meeting directly without screen picker
    const success = await startLocalRecording(callObject || undefined);
    if (success) {
      setIsRecording(true);
      setIsLocalRecordingMode(true);
      setRecordingStartTime(new Date());
    }
  };

  const formatRecordingTime = (startTime: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Get the current recording time (from either cloud or local)
  const currentRecordingTime = recordingStartTime || localRecordingStartTime;

  const participantCount = Object.keys(participants).length;
  
  // Deduplicate remote participants by user_name to prevent multiple camera windows
  // from the same user (e.g. when they open multiple tabs)
  const allRemoteParticipants = Object.entries(participants).filter(([_, p]) => !p.local);
  const remoteParticipants = (() => {
    const seen = new Map<string, [string, typeof participants[string]]>();
    for (const entry of allRemoteParticipants) {
      const [sessionId, p] = entry;
      const name = p.user_name || sessionId;
      const existing = seen.get(name);
      if (!existing) {
        seen.set(name, entry);
      } else {
        // Keep the session that has video active, or the newer one
        const existingHasVideo = existing[1].video || existing[1].tracks?.video?.state === 'playable';
        const currentHasVideo = p.video || p.tracks?.video?.state === 'playable';
        if (currentHasVideo && !existingHasVideo) {
          seen.set(name, entry);
        }
      }
    }
    return Array.from(seen.values());
  })();
  
  // Find who is sharing screen
  const screenSharingParticipant = Object.entries(participants).find(
    ([_, p]) => p.tracks?.screenVideo?.state === 'playable'
  );

  // Get the name of the screen sharer
  const getScreenSharerName = (): string | null => {
    if (!screenSharingParticipant) return null;
    const [_, participant] = screenSharingParticipant;
    if (participant.local) return null; // We use ScreenSharePreview for local
    return participant.user_name || "Participante";
  };
  
  // Check if screen sharer has audio
  const screenShareHasAudio = (): boolean => {
    if (!screenSharingParticipant) return false;
    const [_, participant] = screenSharingParticipant;
    return !!participant.tracks?.screenAudio?.track;
  };
  
  const screenSharerName = getScreenSharerName();
  const hasScreenShareAudio = screenShareHasAudio();

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
          {(isRecording || isLocalRecording) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-red-500 animate-pulse cursor-help">
                  {isLocalRecordingMode ? (
                    <HardDrive className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <Circle className="w-2 h-2 sm:w-3 sm:h-3 fill-red-500" />
                  )}
                  <span className="hidden sm:inline">
                    REC {currentRecordingTime && formatRecordingTime(currentRecordingTime)}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isLocalRecordingMode ? "Gravação local (será salva na nuvem ao finalizar)" : "Gravação na nuvem"}
              </TooltipContent>
            </Tooltip>
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

        {/* Screen Share Indicator - shows who is sharing */}
        {screenSharerName && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40">
            <ScreenShareIndicator sharerName={screenSharerName} hasAudio={hasScreenShareAudio} />
          </div>
        )}

        {/* Video grid - different layout when screen sharing */}
        <div className="flex-1 p-2 sm:p-4 flex overflow-hidden">
          {screenSharingParticipant ? (
            // Screen share layout: 2 columns - screen on left, cameras on right
            <ScreenShareLayout
              screenSharingParticipant={screenSharingParticipant}
              localVideoRef={localVideoRef}
              isVideoOn={isVideoOn}
              user={user}
              userRole={user?.role || null}
              isMuted={isMuted}
              handRaised={handRaised}
              speakingParticipants={speakingParticipants}
              participants={participants}
              remoteParticipants={remoteParticipants}
              participantRefs={participantRefs}
              raisedHands={raisedHands}
              isHost={isHost}
              meeting={meeting}
            />
          ) : (
            // Normal grid layout
            <div className="flex-1 flex items-center justify-center overflow-auto">
              <div className="flex flex-wrap gap-4 justify-center items-center">
                {/* Local video (self) */}
                <div 
                  className={cn(
                    "relative bg-gray-800 rounded-xl overflow-hidden transition-all duration-300 shrink-0",
                    speakingParticipants.has(participants.local?.session_id || "") && "ring-4 ring-green-500",
                    paperBallActive && "animate-paper-ball-impact"
                  )}
                   style={{ width: '800px', height: '800px', maxWidth: '100%', maxHeight: '80vh' }}
                 >
                   {/* Paper ball effect overlay */}
                  <PaperBallEffect 
                    isActive={paperBallActive} 
                    senderName={paperBallSender}
                    onComplete={() => setPaperBallActive(false)}
                  />
                  
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
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black/60 rounded text-white text-xs sm:text-sm truncate max-w-[200px] flex items-center gap-1">
                      {speakingParticipants.has(participants.local?.session_id || "") && (
                        <Volume2 className="w-3 h-3 text-green-500 animate-pulse" />
                      )}
                      {user?.profile?.full_name} {user?.role && <span className={cn("font-medium", ROLE_TEXT_COLORS[user.role])}>({ROLE_LABELS[user.role]})</span>} - Você
                    </span>
                    <div className="flex items-center gap-1">
                      {isMuted && <MicOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />}
                      {handRaised && <Hand className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 animate-bounce" />}
                    </div>
                  </div>
                </div>

                {/* Remote participants */}
                {remoteParticipants.map(([sessionId, participant]) => {
                  const hasVideo = participant.video || participant.tracks?.video?.state === 'playable';
                  const isSpeaking = speakingParticipants.has(sessionId);
                  const hasHandRaised = raisedHands.has(sessionId);
                  const { displayName, roleLabel, roleColorClass } = formatParticipantName(participant.user_name || "Participante");
                  
                  return (
                    <div
                      key={sessionId}
                      className={cn(
                        "relative bg-gray-800 rounded-xl overflow-hidden transition-all duration-300 shrink-0",
                        isSpeaking && "ring-4 ring-green-500"
                      )}
                       style={{ width: '800px', height: '800px', maxWidth: '100%', maxHeight: '80vh' }}
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
                              {displayName.charAt(0) || "P"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                        <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black/60 rounded text-white text-xs sm:text-sm truncate max-w-[200px] flex items-center gap-1">
                          {isSpeaking && (
                            <Volume2 className="w-3 h-3 text-green-500 animate-pulse" />
                          )}
                          {displayName} {roleLabel && <span className={cn("font-medium", roleColorClass)}>({roleLabel})</span>}
                        </span>
                        <div className="flex items-center gap-1">
                          {!participant.audio && <MicOff className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />}
                          {hasHandRaised && <Hand className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 animate-bounce" />}
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

        {/* Moderation Panel - Host and Dev */}
        {hasModeratorAccess && (
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
                      const { displayName, roleLabel } = formatParticipantName(participant.user_name || "Participante");
                      const firstName = displayName.split(" ")[0];
                      const hasAudio = participant.audio;
                      const hasVideo = participant.video;
                      const isParticipantScreenSharing = participant.screen;
                      
                      // Check if participant is a dev (moderator)
                      const isParticipantDev = roleLabel === 'Desenvolvedor';
                      const isParticipantModerator = isParticipantHost || isParticipantDev;
                      
                      // Skip local participant (current user)
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
                              {isParticipantDev && !isParticipantHost && <span className="text-fuchsia-400 ml-1">(Dev)</span>}
                            </span>
                          </div>
                          
                          {!isParticipantModerator && (
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
                                    isParticipantScreenSharing ? "text-blue-500" : "text-muted-foreground"
                                  )}>
                                    {isParticipantScreenSharing ? <ScreenShare className="w-4 h-4" /> : <ScreenShareOff className="w-4 h-4" />}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {isParticipantScreenSharing ? "Compartilhando tela" : "Não está compartilhando"}
                                </TooltipContent>
                              </Tooltip>
                              
                              {/* Throw paper ball (fun attention getter) */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/20"
                                    onClick={() => throwPaperBall(sessionId, firstName)}
                                  >
                                    <span className="text-lg">📄</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Jogar bolinha de papel 🗞️</TooltipContent>
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

      {/* Controls bar - Mobile optimized with two rows */}
      <div className="bg-gray-800 border-t border-gray-700 shrink-0">
        <TooltipProvider>
          {/* Mobile: two-row layout / Desktop: single row */}
          <div className="sm:hidden flex flex-col gap-1 px-2 py-2">
            {/* Row 1: Primary controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="sm"
                className="rounded-full w-11 h-11"
                onClick={toggleMute}
                disabled={!callObject || (!hasModeratorAccess && !globalAudioEnabled && isMuted)}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </Button>

              <Button
                variant={isVideoOn ? "secondary" : "destructive"}
                size="sm"
                className="rounded-full w-11 h-11"
                onClick={toggleVideo}
                disabled={!callObject || (!hasModeratorAccess && !globalVideoEnabled && !isVideoOn)}
              >
                {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </Button>

              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="sm"
                className={cn("rounded-full w-11 h-11", isScreenSharing && "bg-green-600 hover:bg-green-700")}
                onClick={toggleScreenShare}
                disabled={!callObject}
              >
                {isScreenSharing ? <ScreenShareOff className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
              </Button>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={bgBlurEnabled ? "default" : "secondary"}
                    size="sm"
                    className={cn("rounded-full w-11 h-11", bgBlurEnabled && "bg-primary hover:bg-primary/90")}
                    disabled={!callObject || !isVideoOn}
                    title="Plano de fundo"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="w-56 p-2">
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">Plano de fundo</div>
                  <button
                    onClick={() => applyBackgroundEffect("none")}
                    className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "none" && "bg-accent font-medium")}
                  >
                    Nenhum (original)
                  </button>
                  <button
                    onClick={() => applyBackgroundEffect("blur-light")}
                    className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "blur-light" && "bg-accent font-medium")}
                  >
                    Desfoque leve
                  </button>
                  <button
                    onClick={() => applyBackgroundEffect("blur-strong")}
                    className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "blur-strong" && "bg-accent font-medium")}
                  >
                    Desfoque forte
                  </button>
                </PopoverContent>
              </Popover>


              <Button
                variant={handRaised ? "default" : "secondary"}
                size="sm"
                className={cn("rounded-full w-11 h-11", handRaised && "bg-yellow-500 hover:bg-yellow-600")}
                onClick={toggleHandRaise}
                disabled={!callObject}
              >
                <Hand className={cn("w-4 h-4", handRaised && "animate-bounce")} />
              </Button>

              <Button
                variant="destructive"
                size="sm"
                className="rounded-full w-11 h-11"
                onClick={leaveMeeting}
              >
                <Phone className="w-4 h-4 rotate-[135deg]" />
              </Button>
            </div>

            {/* Row 2: Secondary controls */}
            <div className="flex items-center justify-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm" className="rounded-full w-11 h-11" disabled={!callObject}>
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top">
                  <div className="flex gap-1">
                    {REACTIONS.map((emoji) => (
                      <button key={emoji} onClick={() => sendReaction(emoji)} className="hover:scale-125 transition-transform text-2xl p-2 rounded-lg hover:bg-muted">
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              <Button variant="secondary" size="sm" className="rounded-full w-11 h-11 relative" onClick={() => setShowChat(true)}>
                <MessageSquare className="w-4 h-4" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}
              </Button>

              <Button variant="secondary" size="sm" className="rounded-full w-11 h-11 relative" onClick={() => setShowParticipants(true)}>
                <Users className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                  {participantCount}
                </span>
                {raisedHands.size > 0 && (
                  <span className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce">
                    <Hand className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </Button>

              {hasModeratorAccess && (
                <Button variant="destructive" size="sm" className="rounded-full w-11 h-11" onClick={() => setShowModeration(true)}>
                  <Shield className="w-4 h-4" />
                </Button>
              )}

              {hasModeratorAccess && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={(isRecording || isLocalRecording) ? "destructive" : "secondary"}
                      size="sm"
                      className="rounded-full w-11 h-11"
                      disabled={!callObject}
                    >
                      {(isRecording || isLocalRecording) ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4 fill-current" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {(isRecording || isLocalRecording) ? (
                      <DropdownMenuItem onClick={stopRecording}>
                        <Square className="w-4 h-4 mr-2" />
                        Parar gravação
                      </DropdownMenuItem>
                    ) : (
                      <>
                        <DropdownMenuItem onClick={startRecording}>
                          <Circle className="w-4 h-4 mr-2 fill-current" />
                          Gravar (nuvem)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleStartLocalRecording}>
                          <HardDrive className="w-4 h-4 mr-2" />
                          Gravar localmente
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="rounded-full w-11 h-11">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={copyMeetingLink}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleFullscreen}>
                    {isFullscreen ? (
                      <><Minimize className="w-4 h-4 mr-2" />Sair da tela cheia</>
                    ) : (
                      <><Maximize className="w-4 h-4 mr-2" />Tela cheia</>
                    )}
                  </DropdownMenuItem>
                  {isHost && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={endMeeting} className="text-destructive">
                        <Phone className="w-4 h-4 mr-2 rotate-[135deg]" />
                        Encerrar reunião
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Desktop: single row with labels */}
          <div className="hidden sm:flex h-20 items-center justify-center px-3 gap-1.5 flex-wrap">
            <Button
              variant={isMuted ? "destructive" : "secondary"}
              size="sm"
              className="rounded-full h-11 px-3 gap-2"
              onClick={toggleMute}
              disabled={!callObject || (!hasModeratorAccess && !globalAudioEnabled && isMuted)}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              <span className="text-xs font-medium">{isMuted ? "Ativar mic" : "Mudo"}</span>
            </Button>

            <Button
              variant={isVideoOn ? "secondary" : "destructive"}
              size="sm"
              className="rounded-full h-11 px-3 gap-2"
              onClick={toggleVideo}
              disabled={!callObject || (!hasModeratorAccess && !globalVideoEnabled && !isVideoOn)}
            >
              {isVideoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              <span className="text-xs font-medium">{isVideoOn ? "Câmera" : "Ativar câmera"}</span>
            </Button>

            <Button
              variant={isScreenSharing ? "default" : "secondary"}
              size="sm"
              className={cn("rounded-full h-11 px-3 gap-2", isScreenSharing && "bg-green-600 hover:bg-green-700")}
              onClick={toggleScreenShare}
              disabled={!callObject}
            >
              {isScreenSharing ? <ScreenShareOff className="w-4 h-4" /> : <ScreenShare className="w-4 h-4" />}
              <span className="text-xs font-medium">{isScreenSharing ? "Parar" : "Apresentar"}</span>
            </Button>

            <Button
              variant={handRaised ? "default" : "secondary"}
              size="sm"
              className={cn("rounded-full h-11 px-3 gap-2", handRaised && "bg-yellow-500 hover:bg-yellow-600")}
              onClick={toggleHandRaise}
              disabled={!callObject}
            >
              <Hand className={cn("w-4 h-4", handRaised && "animate-bounce")} />
              <span className="text-xs font-medium">{handRaised ? "Baixar mão" : "Levantar mão"}</span>
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={bgBlurEnabled ? "default" : "secondary"}
                  size="sm"
                  className={cn("rounded-full h-11 px-3 gap-2", bgBlurEnabled && "bg-primary hover:bg-primary/90")}
                  disabled={!callObject || !isVideoOn}
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-medium">Fundo</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="w-56 p-2">
                <div className="text-xs font-medium text-muted-foreground px-2 py-1">Plano de fundo</div>
                <button
                  onClick={() => applyBackgroundEffect("none")}
                  className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "none" && "bg-accent font-medium")}
                >
                  Nenhum (original)
                </button>
                <button
                  onClick={() => applyBackgroundEffect("blur-light")}
                  className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "blur-light" && "bg-accent font-medium")}
                >
                  Desfoque leve
                </button>
                <button
                  onClick={() => applyBackgroundEffect("blur-strong")}
                  className={cn("w-full text-left px-2 py-2 rounded hover:bg-accent text-sm", bgEffect === "blur-strong" && "bg-accent font-medium")}
                >
                  Desfoque forte
                </button>
              </PopoverContent>
            </Popover>


            <Popover>
              <PopoverTrigger asChild>
                <Button variant="secondary" size="sm" className="rounded-full h-11 px-3 gap-2" disabled={!callObject}>
                  <span className="text-base leading-none">😀</span>
                  <span className="text-xs font-medium">Reagir</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" side="top">
                <div className="flex gap-1">
                  {REACTIONS.map((emoji) => (
                    <button key={emoji} onClick={() => sendReaction(emoji)} className="hover:scale-125 transition-transform text-2xl p-2 rounded-lg hover:bg-muted">
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {hasModeratorAccess && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={(isRecording || isLocalRecording) ? "destructive" : "secondary"}
                    size="sm"
                    className="rounded-full h-11 px-3 gap-2"
                    disabled={!callObject}
                  >
                    {(isRecording || isLocalRecording) ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4 fill-current" />}
                    <span className="text-xs font-medium">{(isRecording || isLocalRecording) ? "Parar" : "Gravar"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {(isRecording || isLocalRecording) ? (
                    <DropdownMenuItem onClick={stopRecording}>
                      <Square className="w-4 h-4 mr-2" />
                      Parar gravação
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={startRecording}>
                        <Circle className="w-4 h-4 mr-2 fill-current" />
                        Gravar (nuvem)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleStartLocalRecording}>
                        <HardDrive className="w-4 h-4 mr-2" />
                        Gravar localmente
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {hasModeratorAccess && (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-full h-11 px-3 gap-2"
                onClick={() => setShowModeration(true)}
              >
                <Shield className="w-4 h-4" />
                <span className="text-xs font-medium">Moderação</span>
              </Button>
            )}

            <Button
              variant={isPiPActive ? "default" : "secondary"}
              size="sm"
              className={cn("rounded-full h-11 px-3 gap-2", isPiPActive && "bg-blue-600 hover:bg-blue-700")}
              onClick={togglePiP}
              disabled={!callObject}
            >
              <PictureInPicture2 className="w-4 h-4" />
              <span className="text-xs font-medium">Mini</span>
            </Button>

            <div className="w-px h-8 bg-gray-600 mx-1" />

            <Button variant="secondary" size="sm" className="rounded-full h-11 px-3 gap-2 relative" onClick={() => setShowChat(true)}>
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-medium">Chat</span>
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadMessages > 9 ? "9+" : unreadMessages}
                </span>
              )}
            </Button>

            <Button variant="secondary" size="sm" className="rounded-full h-11 px-3 gap-2 relative" onClick={() => setShowParticipants(true)}>
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Pessoas</span>
              <span className="ml-1 min-w-5 h-5 px-1 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                {participantCount}
              </span>
              {raisedHands.size > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center animate-bounce">
                  <Hand className="w-2.5 h-2.5 text-white" />
                </span>
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="rounded-full h-11 px-3 gap-2">
                  <MoreVertical className="w-4 h-4" />
                  <span className="text-xs font-medium">Mais</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={copyMeetingLink}>
                  <Copy className="w-4 h-4 mr-2" />
                  Convidar (copiar link)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <><Minimize className="w-4 h-4 mr-2" />Sair da tela cheia</>
                  ) : (
                    <><Maximize className="w-4 h-4 mr-2" />Tela cheia</>
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

            <div className="w-px h-8 bg-gray-600 mx-1" />

            <Button variant="destructive" size="sm" className="rounded-full h-11 px-4 gap-2" onClick={leaveMeeting}>
              <Phone className="w-4 h-4 rotate-[135deg]" />
              <span className="text-xs font-medium">Sair</span>
            </Button>

            {isHost && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-11 px-4 gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={endMeeting}
              >
                <span className="text-xs font-medium">Encerrar reunião</span>
              </Button>
            )}
          </div>
        </TooltipProvider>
      </div>

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

    </div>
  );
}
