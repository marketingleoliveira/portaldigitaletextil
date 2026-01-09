import React from 'react';
import { useTheme } from 'next-themes';
import logoWhite from '@/assets/logo-white.png';
import logoDark from '@/assets/logo-dark.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'auto' | 'light' | 'dark';
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', variant = 'auto' }) => {
  const { resolvedTheme } = useTheme();
  
  const sizes = {
    sm: 'h-10',
    md: 'h-14',
    lg: 'h-20',
  };

  // Determine which logo to use
  const getLogo = () => {
    if (variant === 'light') return logoWhite;
    if (variant === 'dark') return logoDark;
    // Auto: white logo on dark theme, dark logo on light theme
    return resolvedTheme === 'dark' ? logoWhite : logoDark;
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={getLogo()} 
        alt="Digitale Têxtil" 
        className={`${sizes[size]} w-auto object-contain transition-all duration-300 hover:brightness-0 hover:invert hover:sepia hover:saturate-[10000%] hover:hue-rotate-[85deg]`}
      />
    </div>
  );
};

export default Logo;
