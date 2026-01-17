import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PaperBallEffectProps {
  isActive: boolean;
  senderName: string;
  onComplete: () => void;
}

export function PaperBallEffect({ isActive, senderName, onComplete }: PaperBallEffectProps) {
  const [showImpact, setShowImpact] = useState(false);
  const [showSplat, setShowSplat] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setShowImpact(false);
      setShowSplat(false);
      return;
    }

    // Show impact after throw animation
    const impactTimer = setTimeout(() => {
      setShowImpact(true);
      setShowSplat(true);
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
