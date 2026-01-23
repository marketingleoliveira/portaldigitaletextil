import React, { useEffect, useState } from 'react';

interface ConfettiPiece {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  rotation: number;
  shape: 'circle' | 'square' | 'streamer';
}

const CARNIVAL_COLORS = [
  '#FFD700', // Gold
  '#FF1493', // Deep Pink
  '#00CED1', // Dark Cyan
  '#FF4500', // Orange Red
  '#32CD32', // Lime Green
  '#9400D3', // Dark Violet
  '#FF69B4', // Hot Pink
  '#00FF7F', // Spring Green
  '#FF6347', // Tomato
  '#1E90FF', // Dodger Blue
];

interface CarnivalConfettiProps {
  enabled?: boolean;
}

const CarnivalConfetti: React.FC<CarnivalConfettiProps> = ({ enabled = true }) => {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    if (!enabled) {
      setConfetti([]);
      return;
    }

    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 50; i++) {
      pieces.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 3 + Math.random() * 4,
        color: CARNIVAL_COLORS[Math.floor(Math.random() * CARNIVAL_COLORS.length)],
        size: 6 + Math.random() * 10,
        rotation: Math.random() * 360,
        shape: ['circle', 'square', 'streamer'][Math.floor(Math.random() * 3)] as 'circle' | 'square' | 'streamer',
      });
    }
    setConfetti(pieces);
  }, [enabled]);

  if (!enabled || confetti.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        >
          {piece.shape === 'streamer' ? (
            <div
              className="animate-confetti-sway"
              style={{
                width: piece.size / 2,
                height: piece.size * 3,
                backgroundColor: piece.color,
                borderRadius: '2px',
                transform: `rotate(${piece.rotation}deg)`,
              }}
            />
          ) : (
            <div
              className="animate-confetti-spin"
              style={{
                width: piece.size,
                height: piece.size,
                backgroundColor: piece.color,
                borderRadius: piece.shape === 'circle' ? '50%' : '2px',
                transform: `rotate(${piece.rotation}deg)`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default CarnivalConfetti;
