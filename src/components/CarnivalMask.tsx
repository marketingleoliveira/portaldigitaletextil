import React from 'react';

interface CarnivalMaskProps {
  className?: string;
  variant?: 'gold' | 'pink' | 'purple' | 'teal';
  size?: 'sm' | 'md' | 'lg';
}

const CarnivalMask: React.FC<CarnivalMaskProps> = ({ 
  className = '', 
  variant = 'gold',
  size = 'md' 
}) => {
  const colors = {
    gold: {
      primary: '#FFD700',
      secondary: '#FFA500',
      accent: '#FF6347',
    },
    pink: {
      primary: '#FF1493',
      secondary: '#FF69B4',
      accent: '#9400D3',
    },
    purple: {
      primary: '#9400D3',
      secondary: '#8A2BE2',
      accent: '#FF1493',
    },
    teal: {
      primary: '#00CED1',
      secondary: '#20B2AA',
      accent: '#32CD32',
    },
  };

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const { primary, secondary, accent } = colors[variant];

  return (
    <svg
      viewBox="0 0 100 60"
      className={`${sizeClasses[size]} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Mask body */}
      <path
        d="M10 30 Q25 10, 50 15 Q75 10, 90 30 Q75 50, 50 45 Q25 50, 10 30Z"
        fill={primary}
        stroke={secondary}
        strokeWidth="2"
      />
      
      {/* Left eye hole */}
      <ellipse
        cx="30"
        cy="28"
        rx="12"
        ry="8"
        fill="currentColor"
        className="text-background"
      />
      
      {/* Right eye hole */}
      <ellipse
        cx="70"
        cy="28"
        rx="12"
        ry="8"
        fill="currentColor"
        className="text-background"
      />
      
      {/* Decorative feathers - left */}
      <path
        d="M5 25 Q-5 10, 10 5"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 20 Q0 8, 18 3"
        stroke={secondary}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Decorative feathers - right */}
      <path
        d="M95 25 Q105 10, 90 5"
        stroke={accent}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M92 20 Q100 8, 82 3"
        stroke={secondary}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Center decoration */}
      <circle cx="50" cy="12" r="4" fill={accent} />
      <circle cx="50" cy="12" r="2" fill={secondary} />
      
      {/* Glitter dots */}
      <circle cx="25" cy="35" r="1.5" fill={secondary} opacity="0.8" />
      <circle cx="35" cy="38" r="1" fill={accent} opacity="0.8" />
      <circle cx="65" cy="38" r="1" fill={accent} opacity="0.8" />
      <circle cx="75" cy="35" r="1.5" fill={secondary} opacity="0.8" />
    </svg>
  );
};

export default CarnivalMask;
