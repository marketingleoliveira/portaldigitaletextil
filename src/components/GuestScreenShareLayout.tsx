import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MicOff, Hand, ScreenShare, ChevronLeft, ChevronRight, Volume2 } from "lucide-react";
import { DailyParticipant } from "@daily-co/daily-js";
import { formatParticipantName } from "@/lib/meeting-utils";

interface ParticipantWithExtras extends DailyParticipant {
  isSpeaking?: boolean;
  handRaised?: boolean;
}

interface GuestScreenShareLayoutProps {
  screenSharingParticipant: [string, ParticipantWithExtras];
  localVideoRef: React.RefObject<HTMLVideoElement>;
  isVideoOn: boolean;
  guestName: string;
  isMuted: boolean;
  handRaised: boolean;
  speakingParticipants: Set<string>;
  participants: Record<string, ParticipantWithExtras>;
  remoteParticipants: [string, ParticipantWithExtras][];
  participantRefs: React.MutableRefObject<Record<string, HTMLVideoElement | null>>;
  raisedHands: Set<string>;
}

const CAMERAS_PER_PAGE = 5;

export default function GuestScreenShareLayout({
  screenSharingParticipant,
  localVideoRef,
  isVideoOn,
  guestName,
  isMuted,
  handRaised,
  speakingParticipants,
  participants,
  remoteParticipants,
  participantRefs,
  raisedHands,
}: GuestScreenShareLayoutProps) {
  const [currentPage, setCurrentPage] = useState(0);

  // Sort participants: host first, then by name
  const sortedParticipants = [...remoteParticipants].sort((a, b) => {
    const aIsHost = a[1].owner;
    const bIsHost = b[1].owner;
    if (aIsHost && !bIsHost) return -1;
    if (!aIsHost && bIsHost) return 1;
    return (a[1].user_name || "").localeCompare(b[1].user_name || "");
  });

  // Build list of all cameras (local + remote), with host first
  const allCameras: { 
    id: string; 
    isLocal: boolean; 
    participant?: ParticipantWithExtras;
    isHostCamera: boolean;
  }[] = [];

  // Add local participant (guest is never host)
  allCameras.push({ 
    id: "local", 
    isLocal: true, 
    isHostCamera: false 
  });

  // Add remote participants
  sortedParticipants.forEach(([sessionId, participant]) => {
    allCameras.push({ 
      id: sessionId, 
      isLocal: false, 
      participant,
      isHostCamera: participant.owner || false
    });
  });

  // Sort: host camera first
  allCameras.sort((a, b) => {
    if (a.isHostCamera && !b.isHostCamera) return -1;
    if (!a.isHostCamera && b.isHostCamera) return 1;
    return 0;
  });

  const totalPages = Math.ceil(allCameras.length / CAMERAS_PER_PAGE);
  const startIndex = currentPage * CAMERAS_PER_PAGE;
  const visibleCameras = allCameras.slice(startIndex, startIndex + CAMERAS_PER_PAGE);

  const goToPrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages - 1, prev + 1));
  };

  return (
    <div className="flex-1 flex gap-2 sm:gap-4 h-full">
      {/* Left side - Screen share (larger) */}
      <div className="flex-1 flex items-center justify-center min-w-0">
        <div className="relative bg-[#3c4043] rounded-lg overflow-hidden w-full h-full max-h-full border-2 border-primary">
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
      </div>

      {/* Right side - Camera list with pagination */}
      <div className="w-48 sm:w-56 md:w-64 flex flex-col gap-2 h-full shrink-0">
        {/* Pagination controls - top */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-2 py-1 bg-[#3c4043]/50 rounded-lg">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={goToPrevPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-gray-400">
              {currentPage + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={goToNextPage}
              disabled={currentPage === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Camera list */}
        <div className="flex-1 flex flex-col gap-2 overflow-hidden">
          {visibleCameras.map((camera) => {
            if (camera.isLocal) {
              // Local camera (guest)
              return (
                <div
                  key="local"
                  className={cn(
                    "relative bg-[#3c4043] rounded-lg overflow-hidden aspect-video transition-all duration-300 shrink-0",
                    speakingParticipants.has(participants.local?.session_id || "") && "ring-2 ring-green-500"
                  )}
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
                    style={{ transform: "scaleX(-1)" }}
                  />
                  {!isVideoOn && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Avatar className="w-10 h-10 sm:w-12 sm:h-12">
                        <AvatarFallback className="text-sm sm:text-base bg-primary">
                          {guestName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                    <span className="px-1 py-0.5 bg-black/60 rounded text-white text-[10px] sm:text-xs truncate max-w-[85%]">
                      Você <span className="text-gray-300">(Convidado)</span>
                    </span>
                    <div className="flex items-center gap-0.5">
                      {isMuted && <MicOff className="w-2.5 h-2.5 text-red-500" />}
                      {handRaised && <Hand className="w-2.5 h-2.5 text-yellow-500" />}
                    </div>
                  </div>
                </div>
              );
            } else {
              // Remote camera
              const participant = camera.participant!;
              const sessionId = camera.id;
              const hasVideo = participant.video || participant.tracks?.video?.state === 'playable';
              const isSpeaking = speakingParticipants.has(sessionId);
              const hasHandRaised = raisedHands.has(sessionId);
              const { displayName, roleLabel, roleColorClass } = formatParticipantName(participant.user_name || "Participante");

              return (
                <div
                  key={sessionId}
                  className={cn(
                    "relative bg-[#3c4043] rounded-lg overflow-hidden aspect-video transition-all duration-300 shrink-0",
                    isSpeaking && "ring-2 ring-green-500"
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
                      <Avatar className="w-10 h-10 sm:w-12 sm:h-12">
                        <AvatarFallback className="text-sm sm:text-base bg-blue-600">
                          {displayName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
                    <span className="px-1 py-0.5 bg-black/60 rounded text-white text-[10px] sm:text-xs truncate max-w-[85%] flex items-center gap-0.5">
                      {isSpeaking && <Volume2 className="w-2 h-2 text-green-500 animate-pulse" />}
                      {camera.isHostCamera && <span className="text-primary font-medium">★</span>}
                      {displayName} {roleLabel && <span className={cn("font-medium", roleColorClass)}>({roleLabel})</span>}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {!participant.audio && <MicOff className="w-2.5 h-2.5 text-red-500" />}
                      {hasHandRaised && <Hand className="w-2.5 h-2.5 text-yellow-500" />}
                    </div>
                  </div>
                </div>
              );
            }
          })}
        </div>

        {/* Pagination info */}
        {totalPages > 1 && (
          <div className="text-center text-[10px] text-gray-500">
            {allCameras.length} participantes
          </div>
        )}
      </div>
    </div>
  );
}
