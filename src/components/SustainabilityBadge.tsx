import React, { useState } from 'react';
import { Leaf, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const SustainabilityBadge: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex items-center gap-1.5 transition-all duration-300 ease-in-out cursor-pointer",
              "hover:scale-105 active:scale-95",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-full"
            )}
          >
            {isCollapsed ? (
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 animate-fade-in hover:bg-emerald-500/30 hover:border-emerald-400/50 transition-colors">
                <Globe className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 animate-fade-in hover:bg-emerald-500/25 hover:border-emerald-400/50 transition-colors">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400 whitespace-nowrap">
                  #Sustentabilidade
                </span>
              </div>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-xs bg-background border border-border shadow-lg p-3"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-500 font-semibold">
              <Leaf className="w-4 h-4" />
              <span>Compromisso Ambiental</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos comprometidos com práticas sustentáveis, reduzindo nosso impacto ambiental e promovendo um futuro mais verde para as próximas gerações.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SustainabilityBadge;
