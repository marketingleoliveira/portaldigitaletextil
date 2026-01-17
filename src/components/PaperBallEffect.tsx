import { useEffect, useState, useRef } from "react";
import { cn } from "@/lib/utils";

// Base64 encoded throw sound (whoosh sound)
const THROW_SOUND_BASE64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYbV7Ps6AAAAAAAAAAAAAAAAAAAAAP/7kGQAAANUMEoFPeACNQV40KEAA0wxPToVvAAA0gAqEAwwACMXGzY2QDAYBkMdDxwMSC0Ndo7PMzMzMwBgMBgMBg7u7u7hAAAADBg7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7sIQhCEIQhCEIQhCEIf/7kmRAj/AAADSAAAAAgAAA0gAAABAbKx/ADBxAAAANIAAAAQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCEIQhCE";

// Base64 encoded impact sound (thud/splat sound) 
const IMPACT_SOUND_BASE64 = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYbKpKHZAAAAAAAAAAAAAAAAAAAAAAD/+5JkAAADNgA/gAgAAEKgB/AAAAMaAC1hBgAAIUAD6CAAAAgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/+5JkYo/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAAQKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKA==";

interface PaperBallEffectProps {
  isActive: boolean;
  senderName: string;
  onComplete: () => void;
}

export function PaperBallEffect({ isActive, senderName, onComplete }: PaperBallEffectProps) {
  const [showImpact, setShowImpact] = useState(false);
  const [showSplat, setShowSplat] = useState(false);
  const throwSoundRef = useRef<HTMLAudioElement | null>(null);
  const impactSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isActive) {
      setShowImpact(false);
      setShowSplat(false);
      return;
    }

    // Play throw sound immediately
    try {
      throwSoundRef.current = new Audio(THROW_SOUND_BASE64);
      throwSoundRef.current.volume = 0.6;
      throwSoundRef.current.play().catch(() => {});
    } catch (e) {
      console.log('Could not play throw sound');
    }

    // Show impact after throw animation
    const impactTimer = setTimeout(() => {
      setShowImpact(true);
      setShowSplat(true);
      
      // Play impact sound
      try {
        impactSoundRef.current = new Audio(IMPACT_SOUND_BASE64);
        impactSoundRef.current.volume = 0.7;
        impactSoundRef.current.play().catch(() => {});
      } catch (e) {
        console.log('Could not play impact sound');
      }
    }, 700);

    // Hide splat after animation
    const splatTimer = setTimeout(() => {
      setShowSplat(false);
    }, 1200);

    // Complete after all animations
    const completeTimer = setTimeout(() => {
      setShowImpact(false);
      onComplete();
    }, 1500);

    return () => {
      clearTimeout(impactTimer);
      clearTimeout(splatTimer);
      clearTimeout(completeTimer);
      // Cleanup audio
      if (throwSoundRef.current) {
        throwSoundRef.current.pause();
        throwSoundRef.current = null;
      }
      if (impactSoundRef.current) {
        impactSoundRef.current.pause();
        impactSoundRef.current = null;
      }
    };
  }, [isActive, onComplete]);

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Paper ball flying animation */}
      <div 
        className="absolute left-1/2 top-1/2 animate-paper-ball-throw"
        style={{ transformOrigin: 'center center' }}
      >
        <div className="relative">
          {/* Paper ball emoji with rotation */}
          <span className="text-5xl drop-shadow-2xl">📄</span>
        </div>
      </div>

      {/* Impact splat effect */}
      {showSplat && (
        <div 
          className="absolute left-1/2 top-1/2 animate-splat"
          style={{ transformOrigin: 'center center' }}
        >
          <span className="text-6xl">💥</span>
        </div>
      )}

      {/* Camera shake effect */}
      {showImpact && (
        <div className="absolute inset-0 bg-yellow-500/10 animate-paper-ball-impact rounded-xl" />
      )}

      {/* Sender info toast */}
      <div 
        className={cn(
          "absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-500 text-black rounded-full font-bold text-sm shadow-lg transition-all duration-300",
          isActive ? "opacity-100 scale-100" : "opacity-0 scale-90"
        )}
      >
        🗞️ {senderName} jogou uma bolinha de papel em você!
      </div>
    </div>
  );
}

// Paper ball throwing button for the moderation panel
interface ThrowPaperBallButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function ThrowPaperBallButton({ onClick, disabled }: ThrowPaperBallButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-8 w-8 flex items-center justify-center rounded-md transition-all duration-200",
        "text-yellow-500 hover:bg-yellow-500/20 hover:scale-110",
        "active:scale-95",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      title="Jogar bolinha de papel"
    >
      <span className="text-lg">📄</span>
    </button>
  );
}
