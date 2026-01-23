import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import CarnivalMask from '@/components/CarnivalMask';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CarnivalCountdown: React.FC = () => {
  // Carnaval 2026 - Sábado de Carnaval é 14 de Fevereiro de 2026
  const carnivalDate = new Date('2026-02-14T00:00:00-03:00');
  
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = carnivalDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <Card className="relative overflow-hidden bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 border-2 animate-rainbow-border">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-4 -left-4 opacity-20">
          <CarnivalMask variant="gold" size="xl" />
        </div>
        <div className="absolute -top-2 right-20 opacity-20 rotate-12">
          <CarnivalMask variant="pink" size="lg" />
        </div>
        <div className="absolute -bottom-4 -right-4 opacity-20 rotate-[-15deg]">
          <CarnivalMask variant="purple" size="xl" />
        </div>
        
        {/* Confetti-like dots */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: ['#FFD700', '#FF1493', '#00CED1', '#9400D3', '#32CD32'][Math.floor(Math.random() * 5)],
              opacity: 0.3,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Left side - Title and Mask */}
          <div className="flex items-center gap-3">
            <CarnivalMask variant="rainbow" size="lg" className="hidden sm:block" />
            <div className="text-center sm:text-left">
              <h3 className="text-lg sm:text-xl font-bold carnival-text">
                🎭 Carnaval 2026 🎉
              </h3>
              <p className="text-sm text-muted-foreground">
                A maior festa do Brasil está chegando!
              </p>
            </div>
          </div>

          {/* Center - Countdown */}
          <div className="flex items-center gap-2 sm:gap-4">
            <CountdownUnit value={timeLeft.days} label="Dias" />
            <span className="text-2xl font-bold text-primary animate-pulse">:</span>
            <CountdownUnit value={timeLeft.hours} label="Horas" />
            <span className="text-2xl font-bold text-primary animate-pulse">:</span>
            <CountdownUnit value={timeLeft.minutes} label="Min" />
            <span className="text-2xl font-bold text-primary animate-pulse hidden sm:block">:</span>
            <div className="hidden sm:block">
              <CountdownUnit value={timeLeft.seconds} label="Seg" />
            </div>
          </div>

          {/* Right side - Close button */}
          <button
            onClick={() => setIsVisible(false)}
            className="absolute top-2 right-2 sm:static text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label="Fechar banner"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
};

interface CountdownUnitProps {
  value: number;
  label: string;
}

const CountdownUnit: React.FC<CountdownUnitProps> = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <div className="bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 min-w-[50px] sm:min-w-[60px] text-center border border-primary/30 shadow-lg">
      <span className="text-xl sm:text-2xl font-bold bg-gradient-to-b from-primary to-accent bg-clip-text text-transparent">
        {String(value).padStart(2, '0')}
      </span>
    </div>
    <span className="text-[10px] sm:text-xs text-muted-foreground mt-1 font-medium">
      {label}
    </span>
  </div>
);

export default CarnivalCountdown;
