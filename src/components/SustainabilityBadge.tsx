import React, { useState } from 'react';
import { Leaf, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

const SustainabilityBadge: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <button
      onClick={() => setIsCollapsed(!isCollapsed)}
      className={cn(
        "flex items-center gap-1.5 transition-all duration-300 ease-in-out cursor-pointer",
        "hover:scale-105 active:scale-95"
      )}
      title={isCollapsed ? "Expandir" : "Recolher"}
    >
      {isCollapsed ? (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-fade-in">
          <Globe className="w-4 h-4 text-emerald-400" />
        </div>
      ) : (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 animate-fade-in">
          <Leaf className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
            #Sustentabilidade
          </span>
        </div>
      )}
    </button>
  );
};

export default SustainabilityBadge;
