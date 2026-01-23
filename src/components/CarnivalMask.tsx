import React from 'react';

interface CarnivalMaskProps {
  className?: string;
  variant?: 'gold' | 'pink' | 'purple' | 'teal' | 'rainbow';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const CarnivalMask: React.FC<CarnivalMaskProps> = ({ 
  className = '', 
  variant = 'gold',
  size = 'md' 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-5',
    md: 'w-12 h-8',
    lg: 'w-16 h-10',
    xl: 'w-24 h-16',
  };

  const gradients = {
    gold: {
      main: 'url(#goldGradient)',
      accent: '#FFD700',
      feather1: '#FF6B6B',
      feather2: '#4ECDC4',
      feather3: '#9B59B6',
      gem: '#E74C3C',
    },
    pink: {
      main: 'url(#pinkGradient)',
      accent: '#FF1493',
      feather1: '#FFD700',
      feather2: '#00CED1',
      feather3: '#FF69B4',
      gem: '#9400D3',
    },
    purple: {
      main: 'url(#purpleGradient)',
      accent: '#9400D3',
      feather1: '#FFD700',
      feather2: '#FF1493',
      feather3: '#00CED1',
      gem: '#FF6347',
    },
    teal: {
      main: 'url(#tealGradient)',
      accent: '#00CED1',
      feather1: '#FF1493',
      feather2: '#FFD700',
      feather3: '#9400D3',
      gem: '#32CD32',
    },
    rainbow: {
      main: 'url(#rainbowGradient)',
      accent: '#FFD700',
      feather1: '#FF1493',
      feather2: '#00CED1',
      feather3: '#9400D3',
      gem: '#FF6347',
    },
  };

  const colors = gradients[variant];

  return (
    <svg
      viewBox="0 0 120 80"
      className={`${sizeClasses[size]} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#FFA500" />
          <stop offset="100%" stopColor="#FF8C00" />
        </linearGradient>
        <linearGradient id="pinkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF69B4" />
          <stop offset="50%" stopColor="#FF1493" />
          <stop offset="100%" stopColor="#C71585" />
        </linearGradient>
        <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9B59B6" />
          <stop offset="50%" stopColor="#8E44AD" />
          <stop offset="100%" stopColor="#6C3483" />
        </linearGradient>
        <linearGradient id="tealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1ABC9C" />
          <stop offset="50%" stopColor="#16A085" />
          <stop offset="100%" stopColor="#0E6655" />
        </linearGradient>
        <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF1493" />
          <stop offset="25%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#00CED1" />
          <stop offset="75%" stopColor="#9400D3" />
          <stop offset="100%" stopColor="#FF1493" />
        </linearGradient>
        <linearGradient id="featherGradient1" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={colors.feather1} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors.feather1} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="featherGradient2" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={colors.feather2} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors.feather2} stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="featherGradient3" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={colors.feather3} stopOpacity="0.9" />
          <stop offset="100%" stopColor={colors.feather3} stopOpacity="0.3" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Feathers - Left Side */}
      <g className="animate-pulse" style={{ animationDuration: '3s' }}>
        <path
          d="M25 40 Q15 25, 8 5 Q12 20, 18 35 Q15 20, 5 8 Q14 25, 22 38"
          fill="url(#featherGradient1)"
          filter="url(#glow)"
        />
        <path
          d="M22 42 Q8 30, 2 15 Q10 28, 18 40"
          fill="url(#featherGradient2)"
          filter="url(#glow)"
        />
        <path
          d="M28 38 Q22 22, 15 2 Q20 18, 26 35"
          fill="url(#featherGradient3)"
          filter="url(#glow)"
        />
      </g>

      {/* Feathers - Right Side */}
      <g className="animate-pulse" style={{ animationDuration: '3s', animationDelay: '0.5s' }}>
        <path
          d="M95 40 Q105 25, 112 5 Q108 20, 102 35 Q105 20, 115 8 Q106 25, 98 38"
          fill="url(#featherGradient1)"
          filter="url(#glow)"
        />
        <path
          d="M98 42 Q112 30, 118 15 Q110 28, 102 40"
          fill="url(#featherGradient2)"
          filter="url(#glow)"
        />
        <path
          d="M92 38 Q98 22, 105 2 Q100 18, 94 35"
          fill="url(#featherGradient3)"
          filter="url(#glow)"
        />
      </g>

      {/* Center Feathers */}
      <g className="animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '0.25s' }}>
        <path
          d="M60 42 Q55 20, 50 0 Q58 18, 60 38 Q62 18, 70 0 Q65 20, 60 42"
          fill="url(#featherGradient2)"
          filter="url(#glow)"
        />
        <path
          d="M55 44 Q48 25, 42 5 Q50 22, 55 40"
          fill="url(#featherGradient1)"
          filter="url(#glow)"
        />
        <path
          d="M65 44 Q72 25, 78 5 Q70 22, 65 40"
          fill="url(#featherGradient3)"
          filter="url(#glow)"
        />
      </g>

      {/* Main Mask Body */}
      <path
        d="M15 50 
           Q25 35, 45 38 
           Q55 42, 60 42 
           Q65 42, 75 38 
           Q95 35, 105 50 
           Q100 62, 85 65 
           Q70 68, 60 65 
           Q50 68, 35 65 
           Q20 62, 15 50 Z"
        fill={colors.main}
        stroke={colors.accent}
        strokeWidth="1.5"
        filter="url(#glow)"
      />

      {/* Decorative swirls on mask */}
      <path
        d="M25 50 Q30 45, 38 48 Q32 52, 28 55"
        stroke={colors.accent}
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M95 50 Q90 45, 82 48 Q88 52, 92 55"
        stroke={colors.accent}
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />

      {/* Left Eye Hole */}
      <ellipse
        cx="40"
        cy="52"
        rx="12"
        ry="7"
        fill="currentColor"
        className="text-background"
      />
      <ellipse
        cx="40"
        cy="52"
        rx="12"
        ry="7"
        fill="none"
        stroke={colors.accent}
        strokeWidth="1.5"
      />

      {/* Right Eye Hole */}
      <ellipse
        cx="80"
        cy="52"
        rx="12"
        ry="7"
        fill="currentColor"
        className="text-background"
      />
      <ellipse
        cx="80"
        cy="52"
        rx="12"
        ry="7"
        fill="none"
        stroke={colors.accent}
        strokeWidth="1.5"
      />

      {/* Center Gem */}
      <g filter="url(#glow)">
        <polygon
          points="60,38 64,44 60,50 56,44"
          fill={colors.gem}
        />
        <polygon
          points="60,40 62,44 60,48 58,44"
          fill="white"
          opacity="0.4"
        />
      </g>

      {/* Side Gems */}
      <circle cx="28" cy="52" r="2.5" fill={colors.gem} filter="url(#glow)" />
      <circle cx="28" cy="52" r="1" fill="white" opacity="0.5" />
      <circle cx="92" cy="52" r="2.5" fill={colors.gem} filter="url(#glow)" />
      <circle cx="92" cy="52" r="1" fill="white" opacity="0.5" />

      {/* Glitter dots */}
      <g opacity="0.8">
        <circle cx="35" cy="45" r="1" fill="white" className="animate-pulse" />
        <circle cx="50" cy="60" r="0.8" fill="white" className="animate-pulse" style={{ animationDelay: '0.3s' }} />
        <circle cx="70" cy="60" r="0.8" fill="white" className="animate-pulse" style={{ animationDelay: '0.6s' }} />
        <circle cx="85" cy="45" r="1" fill="white" className="animate-pulse" style={{ animationDelay: '0.9s' }} />
      </g>
    </svg>
  );
};

export default CarnivalMask;
