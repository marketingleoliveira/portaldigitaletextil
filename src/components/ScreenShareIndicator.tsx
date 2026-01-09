import { ScreenShare, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScreenShareIndicatorProps {
  sharerName: string | null;
  isLocalSharing?: boolean;
  hasAudio?: boolean;
  className?: string;
}

export function ScreenShareIndicator({ 
  sharerName, 
  isLocalSharing = false,
  hasAudio = false,
  className 
}: ScreenShareIndicatorProps) {
  if (!sharerName) return null;

  return (
    <div 
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
        "bg-green-600/90 text-white shadow-lg",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <ScreenShare className="h-4 w-4" />
      <span>
        {isLocalSharing ? "Você está compartilhando" : `${sharerName} está compartilhando`}
      </span>
      {hasAudio && (
        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
          <Volume2 className="h-3 w-3" />
          <span>Áudio</span>
        </span>
      )}
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
    </div>
  );
}
