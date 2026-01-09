import { useEffect, useRef, useState } from "react";
import { X, Minimize2, Maximize2, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DailyCall } from "@daily-co/daily-js";

interface ScreenSharePreviewProps {
  callObject: DailyCall | null;
  isSharing: boolean;
  onStopSharing: () => void;
}

export function ScreenSharePreview({ 
  callObject, 
  isSharing, 
  onStopSharing 
}: ScreenSharePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Attach screen share track to video element
  useEffect(() => {
    if (!callObject || !isSharing || !videoRef.current) return;

    const updateScreenTrack = () => {
      const localParticipant = callObject.participants().local;
      const screenTrack = localParticipant?.tracks?.screenVideo?.track;
      
      if (screenTrack && videoRef.current) {
        videoRef.current.srcObject = new MediaStream([screenTrack]);
      }
    };

    // Initial setup
    updateScreenTrack();

    // Listen for track changes
    const handleTrackStarted = (event: any) => {
      if (event?.participant?.local && event?.track?.kind === 'video') {
        setTimeout(updateScreenTrack, 100);
      }
    };

    callObject.on("track-started", handleTrackStarted);

    return () => {
      callObject.off("track-started", handleTrackStarted);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [callObject, isSharing]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    
    setIsDragging(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - (containerRef.current?.offsetWidth || 200);
      const maxY = window.innerHeight - (containerRef.current?.offsetHeight || 150);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!isSharing) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed z-50 rounded-lg overflow-hidden shadow-2xl border-2 border-primary/50 bg-black transition-all duration-200",
        isDragging && "cursor-grabbing",
        !isDragging && "cursor-grab"
      )}
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 160 : 280,
        height: isMinimized ? 100 : 180,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-1.5 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-1 text-xs text-white/90">
          <Move className="h-3 w-3" />
          <span className="font-medium">Seu compartilhamento</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-white/80 hover:text-white hover:bg-white/20"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-white/80 hover:text-red-400 hover:bg-white/20"
            onClick={onStopSharing}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Video preview */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain bg-black"
      />

      {/* Recording indicator */}
      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-green-600/90 rounded text-[10px] text-white font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
        AO VIVO
      </div>

      {/* Stop sharing button */}
      <Button
        variant="destructive"
        size="sm"
        className="absolute bottom-1.5 right-1.5 h-6 text-[10px] px-2"
        onClick={onStopSharing}
      >
        Parar
      </Button>
    </div>
  );
}
